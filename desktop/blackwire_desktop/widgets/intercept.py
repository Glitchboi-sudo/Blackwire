"""Panel de Intercept: pausar, editar y reenviar/descartar requests y responses.

Requests: con Intercept ON, cada request in-scope se pausa; se edita en texto crudo
y se reenvía (tal cual o modificado) o se descarta.

Responses (estilo Burp "intercept this response"): sobre un request pausado marcas
la casilla *Interceptar su respuesta*; al reenviar ese request, el backend marca el
flow (vía `flow.metadata`) y pausa su respuesta cuando llegue. La respuesta pausada
aparece en la MISMA cola etiquetada `RESP`; la editas (status/headers/body) y la
reenvías al cliente cuando quieras, o la descartas.

Edita-y-reenvía re-parsea el texto crudo. La red se delega al `runner` del shell.
Reacciona en vivo a los eventos WS de intercept (requests y responses).
"""

from __future__ import annotations

import re
from typing import Any, Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QCheckBox,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMenu,
    QPushButton,
    QSplitter,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

from ..i18n import t
from ..rawhttp import format_raw, parse_raw
from .http_view import HttpEditor

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

# Roles de datos de cada item de la lista: id del pendiente y su tipo (req/resp).
_ROLE_ID = Qt.UserRole
_ROLE_KIND = Qt.UserRole + 1


def format_intercepted(req: dict[str, Any]) -> str:
    """Request pausado -> texto editable crudo (método+URL / headers / body)."""
    return format_raw(req.get("method", ""), req.get("url", ""),
                      req.get("headers"), req.get("body"))


def parse_intercepted(text: str) -> dict[str, Any]:
    """Inverso de `format_intercepted`: texto editado -> {method,url,headers,body}."""
    return parse_raw(text)


def format_intercepted_response(resp: dict[str, Any]) -> str:
    """Response pausada -> texto editable crudo (status line / headers / body)."""
    lines = [f"HTTP {resp.get('status_code', '')}".strip()]
    for key, value in (resp.get("headers") or {}).items():
        lines.append(f"{key}: {value}")
    lines.append("")
    body = resp.get("body")
    if body:
        lines.append(str(body))
    return "\n".join(lines)


def parse_intercepted_response(text: str) -> dict[str, Any]:
    """Texto editado -> {status_code?, headers, body}. Inverso del anterior."""
    lines = text.split("\n")
    status: int | None = None
    if lines:
        match = re.search(r"\b(\d{3})\b", lines.pop(0))
        if match:
            status = int(match.group(1))
    headers: dict[str, str] = {}
    while lines:
        line = lines.pop(0)
        if line.strip() == "":
            break
        idx = line.find(":")
        if idx > 0:
            headers[line[:idx].strip()] = line[idx + 1:].strip()
    out: dict[str, Any] = {"headers": headers, "body": "\n".join(lines)}
    if status is not None:
        out["status_code"] = status
    return out


class InterceptPanel(QWidget):
    """Cola de requests/responses pausados + editor + acciones forward/drop."""

    status_text = Signal(str)

    def __init__(self, api, runner: Runner, palette: dict[str, Any],
                 parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._pending: dict[str, dict[str, Any]] = {}       # requests
        self._pending_resp: dict[str, dict[str, Any]] = {}  # responses
        self._enabled = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        # -- barra de estado + toggle --------------------------------------- #
        top = QHBoxLayout()
        self._toggle_btn = QPushButton("Intercept: OFF")
        self._toggle_btn.setCheckable(True)
        self._toggle_btn.clicked.connect(self._toggle)
        self._toggle_resp_btn = QPushButton("Resp intercept: OFF")
        self._toggle_resp_btn.setCheckable(True)
        self._toggle_resp_btn.setToolTip(
            "Intercepta TODAS las respuestas in-scope (no solo las marcadas)"
        )
        self._toggle_resp_btn.clicked.connect(self._toggle_responses)
        self._count = QLabel("0 pendientes")
        top.addWidget(self._toggle_btn)
        top.addWidget(self._toggle_resp_btn)
        top.addStretch(1)
        top.addWidget(self._count)
        layout.addLayout(top)

        # -- cola de pendientes | editor ------------------------------------ #
        split = QSplitter(Qt.Horizontal)
        self._list = QListWidget()
        self._list.currentItemChanged.connect(self._on_select)
        split.addWidget(self._list)

        self._editor = HttpEditor(palette, read_only=False)
        split.addWidget(self._editor)
        split.setSizes([300, 620])
        layout.addWidget(split, 1)

        # -- acciones ------------------------------------------------------- #
        actions = QHBoxLayout()
        self._fwd_btn = QPushButton(t("Forward"))
        self._fwd_btn.clicked.connect(lambda: self._forward(False))
        self._fwd_mod_btn = QPushButton(t("Forward modified"))
        self._fwd_mod_btn.setObjectName("AccentButton")
        self._fwd_mod_btn.clicked.connect(lambda: self._forward(True))
        self._drop_btn = QPushButton(t("Drop"))
        self._drop_btn.setObjectName("DangerButton")
        self._drop_btn.clicked.connect(self._drop)
        # Burp-style: sobre un REQUEST pausado, también pausar su respuesta.
        self._catch_resp = QCheckBox(t("Intercept its response"))
        self._catch_resp.setToolTip(
            "Al reenviar este request, pausa también su respuesta para editarla"
        )
        # Las 4 acciones en lote se agrupan en un único botón de menú para
        # reducir el ruido visual de la barra de acciones.
        self._bulk_btn = QToolButton()
        self._bulk_btn.setText(t("Bulk actions"))
        self._bulk_btn.setPopupMode(QToolButton.InstantPopup)
        bulk_menu = QMenu(self._bulk_btn)
        bulk_menu.addAction(t("Forward all"), self._forward_all)
        bulk_menu.addAction(t("Drop all"), self._drop_all)
        bulk_menu.addSeparator()
        bulk_menu.addAction(t("Forward responses"), self._forward_all_responses)
        bulk_menu.addAction(t("Drop responses"), self._drop_all_responses)
        self._bulk_btn.setMenu(bulk_menu)

        actions.addWidget(self._fwd_btn)
        actions.addWidget(self._fwd_mod_btn)
        actions.addWidget(self._drop_btn)
        actions.addWidget(self._catch_resp)
        actions.addStretch(1)
        actions.addWidget(self._bulk_btn)
        layout.addLayout(actions)

    def set_palette(self, palette: dict[str, Any]) -> None:
        self._editor.set_palette(palette)

    # -- carga inicial ------------------------------------------------------ #
    def refresh_status(self) -> None:
        self._run(self._api.intercept_status, self._on_status)

    def refresh_pending(self) -> None:
        self._run(self._api.intercept_pending, self._on_pending)
        self._run(self._api.intercept_pending_responses, self._on_pending_resp)

    def _on_status(self, status: dict[str, Any]) -> None:
        self._set_enabled(bool(status.get("enabled")))

    def _on_pending(self, pending: list[dict[str, Any]]) -> None:
        self._pending = {str(r.get("id")): r for r in (pending or [])}
        self._rebuild_list()

    def _on_pending_resp(self, pending: list[dict[str, Any]]) -> None:
        self._pending_resp = {str(r.get("id")): r for r in (pending or [])}
        self._rebuild_list()

    # -- eventos WS en vivo ------------------------------------------------- #
    def on_ws_event(self, mtype: str, msg: dict[str, Any]) -> None:
        if mtype == "intercept_status":
            self._set_enabled(bool(msg.get("enabled")))
        elif mtype == "intercept_new":
            data = msg.get("data") or {}
            rid = str(data.get("id"))
            if rid and rid != "None":
                self._pending[rid] = data
                self._rebuild_list()
        elif mtype == "intercept_response_new":
            data = msg.get("data") or {}
            rid = str(data.get("id"))
            if rid and rid != "None":
                self._pending_resp[rid] = data
                self._rebuild_list()
        elif mtype in ("intercept_forwarded", "intercept_dropped"):
            self._pending.pop(str(msg.get("request_id")), None)
            self._rebuild_list()
        elif mtype in ("response_forwarded", "response_dropped"):
            self._pending_resp.pop(str(msg.get("id")), None)
            self._rebuild_list()
        elif mtype == "intercept_all_forwarded":
            self._pending.clear()
            self._rebuild_list()
        elif mtype == "intercept_responses_toggled":
            self._set_resp_enabled(bool(msg.get("enabled")))
        elif mtype in ("intercept_all_responses_forwarded",
                       "intercept_all_responses_dropped"):
            self._pending_resp.clear()
            self._rebuild_list()

    # -- helpers UI --------------------------------------------------------- #
    def _set_enabled(self, enabled: bool) -> None:
        self._enabled = enabled
        self._toggle_btn.setChecked(enabled)
        self._toggle_btn.setText(f"Intercept: {'ON' if enabled else 'OFF'}")
        self.status_text.emit(f"Intercept {'activo' if enabled else 'inactivo'}")

    def _rebuild_list(self) -> None:
        prev_kind, prev_id = self._selected()
        self._list.clear()
        for rid, req in self._pending.items():
            item = QListWidgetItem(f"REQ   {req.get('method', '')}  {req.get('url', '')}")
            item.setData(_ROLE_ID, rid)
            item.setData(_ROLE_KIND, "req")
            self._list.addItem(item)
            if prev_kind == "req" and rid == prev_id:
                self._list.setCurrentItem(item)
        for rid, resp in self._pending_resp.items():
            label = (f"RESP  {resp.get('status_code', '')}  "
                     f"{resp.get('method', '')}  {resp.get('url', '')}")
            item = QListWidgetItem(label)
            item.setData(_ROLE_ID, rid)
            item.setData(_ROLE_KIND, "resp")
            self._list.addItem(item)
            if prev_kind == "resp" and rid == prev_id:
                self._list.setCurrentItem(item)
        nreq, nresp = len(self._pending), len(self._pending_resp)
        self._count.setText(f"{nreq} req · {nresp} resp pendientes")
        if self._list.currentItem() is None and not nreq and not nresp:
            self._editor.clear()

    def _selected(self) -> tuple[str | None, str | None]:
        item = self._list.currentItem()
        if item is None:
            return None, None
        return item.data(_ROLE_KIND), item.data(_ROLE_ID)

    def _on_select(
        self, current: QListWidgetItem | None, _prev: QListWidgetItem | None
    ) -> None:
        if current is None:
            return
        kind = current.data(_ROLE_KIND)
        rid = current.data(_ROLE_ID)
        if kind == "resp":
            resp = self._pending_resp.get(rid)
            if resp is not None:
                self._editor.setPlainText(format_intercepted_response(resp))
        else:
            req = self._pending.get(rid)
            if req is not None:
                self._editor.setPlainText(format_intercepted(req))
        # La casilla solo aplica a requests; deshabilitar sobre una respuesta.
        self._catch_resp.setEnabled(kind == "req")

    # -- acciones (vía runner) ---------------------------------------------- #
    def toggle(self) -> None:
        """API pública (comando del menú): activa/desactiva el intercept."""
        self._toggle()

    def _toggle(self) -> None:
        self._run(self._api.intercept_toggle, self._on_status)

    def _toggle_responses(self) -> None:
        self._run(self._api.intercept_toggle_responses, self._on_resp_status)

    def _on_resp_status(self, status: dict[str, Any]) -> None:
        self._set_resp_enabled(bool(status.get("enabled")))

    def _set_resp_enabled(self, enabled: bool) -> None:
        self._toggle_resp_btn.setChecked(enabled)
        self._toggle_resp_btn.setText(f"Resp intercept: {'ON' if enabled else 'OFF'}")

    def _forward_all_responses(self) -> None:
        self._run(self._api.intercept_forward_all_responses,
                  lambda _r: self.refresh_pending())

    def _drop_all_responses(self) -> None:
        self._run(self._api.intercept_drop_all_responses,
                  lambda _r: self.refresh_pending())

    def _forward(self, modified: bool) -> None:
        kind, rid = self._selected()
        if rid is None:
            return
        if kind == "resp":
            payload = (parse_intercepted_response(self._editor.toPlainText())
                       if modified else None)
            self._run(
                lambda: self._api.intercept_forward_response(rid, payload),
                lambda _r: None,
            )
            return
        payload = parse_intercepted(self._editor.toPlainText()) if modified else None
        catch = self._catch_resp.isChecked()
        self._run(
            lambda: self._api.intercept_forward(rid, payload, intercept_response=catch),
            lambda _r: None,
        )

    def _drop(self) -> None:
        kind, rid = self._selected()
        if rid is None:
            return
        if kind == "resp":
            self._run(lambda: self._api.intercept_drop_response(rid), lambda _r: None)
        else:
            self._run(lambda: self._api.intercept_drop(rid), lambda _r: None)

    def _forward_all(self) -> None:
        self._run(self._api.intercept_forward_all, lambda _r: self.refresh_pending())

    def _drop_all(self) -> None:
        # drop-all no emite WS: refrescar pendientes al terminar.
        self._run(self._api.intercept_drop_all, lambda _r: self.refresh_pending())
