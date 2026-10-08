"""Panel de Repeater (Fase 3): editar y reenviar requests a mano, en pestañas.

Cada pestaña tiene un editor de request crudo (editable), un botón Enviar y un
visor de respuesta en texto plano (regla de seguridad: nunca HTML). El envío usa
`POST /api/repeater/send-raw`; las pestañas se guardan/cargan vía `/api/repeater`.
La red se delega al `runner` del shell para no congelar la UI.
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QCheckBox,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSplitter,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from ..rawhttp import format_raw, parse_raw
from .http_view import HttpEditor, HttpView

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]


def format_send_response(resp: dict[str, Any]) -> str:
    """Respuesta de send-raw -> texto plano (status / headers / body)."""
    if resp.get("error"):
        return f"⚠ Error: {resp['error']}"
    parts = [f"HTTP {resp.get('status_code', '')}".strip()]
    headers = resp.get("headers") or {}
    for key, value in headers.items():
        parts.append(f"{key}: {value}")
    body = resp.get("body")
    if body:
        parts.append("")
        parts.append(str(body))
    return "\n".join(parts)


class RepeaterTab(QWidget):
    """Una pestaña de Repeater: request editable + respuesta."""

    def __init__(self, api, runner: Runner, palette: dict[str, Any],
                 parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self.tab_id: int | None = None  # id de persistencia (None = sin guardar)
        self.name = "Repeater"
        self._last_response: dict[str, Any] | None = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        top = QHBoxLayout()
        self._send_btn = QPushButton("Enviar")
        self._send_btn.setObjectName("AccentButton")
        self._send_btn.clicked.connect(self.send)
        self._follow = QCheckBox("Seguir redirects")
        self._status = QLabel("")
        top.addWidget(self._send_btn)
        top.addWidget(self._follow)
        top.addStretch(1)
        top.addWidget(self._status)
        layout.addLayout(top)

        split = QSplitter(Qt.Horizontal)
        self._req = HttpEditor(palette, read_only=False)
        self._req.setPlaceholderText("GET https://ejemplo.com/\nHost: ejemplo.com\n")
        self._resp = HttpView(palette)
        self._resp.set_placeholder("Envía el request para ver la respuesta")
        split.addWidget(self._req)
        split.addWidget(self._resp)
        split.setSizes([560, 560])
        layout.addWidget(split, 1)

    def set_palette(self, palette: dict[str, Any]) -> None:
        self._req.set_palette(palette)
        self._resp.set_palette(palette)

    # -- contenido ---------------------------------------------------------- #
    def load_from_detail(self, detail: dict[str, Any]) -> None:
        """Prellena el editor desde un request del historial."""
        self._req.setPlainText(format_raw(
            detail.get("method", "GET"), detail.get("url", ""),
            detail.get("headers"), detail.get("body"),
        ))
        self.name = detail.get("method", "REQ")

    def load_saved(self, saved: dict[str, Any]) -> None:
        """Carga una pestaña persistida (`GET /api/repeater`)."""
        self.tab_id = saved.get("id")
        self.name = saved.get("name") or "Repeater"
        self._req.setPlainText(format_raw(
            saved.get("method", "GET"), saved.get("url", ""),
            saved.get("headers"), saved.get("body"),
        ))
        last = saved.get("last_response")
        if isinstance(last, dict):
            self._last_response = last
            self._resp.set_message(format_send_response(last))

    def request_fields(self) -> dict[str, Any]:
        return parse_raw(self._req.toPlainText())

    def save_payload(self) -> dict[str, Any]:
        fields = self.request_fields()
        return {
            "name": self.name,
            "method": fields["method"], "url": fields["url"],
            "headers": fields["headers"], "body": fields["body"],
            "last_response": self._last_response,
        }

    # -- envío -------------------------------------------------------------- #
    def send(self) -> None:
        fields = self.request_fields()
        self._status.setText("Enviando…")
        self._send_btn.setEnabled(False)
        follow = self._follow.isChecked()
        self._run(
            lambda: self._api.repeater_send(
                fields["method"], fields["url"], fields["headers"],
                fields["body"], follow,
            ),
            self._on_response,
        )

    def _on_response(self, resp: dict[str, Any]) -> None:
        self._send_btn.setEnabled(True)
        self._last_response = resp if isinstance(resp, dict) else {}
        self._resp.set_message(format_send_response(self._last_response))
        if resp.get("error"):
            self._status.setText("⚠ error")
        else:
            elapsed = resp.get("elapsed", 0) or 0
            self._status.setText(
                f"{resp.get('status_code', '')}  ·  {elapsed * 1000:.0f} ms  "
                f"·  {resp.get('size', 0)} B"
            )


class RepeaterPanel(QTabWidget):
    """Colección de pestañas de Repeater con alta/cierre/guardado."""

    def __init__(self, api, runner: Runner, palette: dict[str, Any],
                 parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._palette = palette
        self.setTabsClosable(True)
        self.setMovable(True)
        self.tabCloseRequested.connect(self._close_tab)

        # Botón "+" en la esquina para añadir pestañas.
        add_btn = QPushButton("+")
        add_btn.setFixedWidth(28)
        add_btn.clicked.connect(lambda: self.new_tab())
        self.setCornerWidget(add_btn, Qt.TopRightCorner)

    # -- gestión de pestañas ------------------------------------------------ #
    def set_palette(self, palette: dict[str, Any]) -> None:
        self._palette = palette
        for i in range(self.count()):
            tab = self.widget(i)
            if isinstance(tab, RepeaterTab):
                tab.set_palette(palette)

    def new_tab(self, detail: dict[str, Any] | None = None) -> RepeaterTab:
        tab = RepeaterTab(self._api, self._run, self._palette)
        if detail is not None:
            tab.load_from_detail(detail)
        index = self.addTab(tab, tab.name)
        self.setCurrentIndex(index)
        return tab

    def load_saved(self) -> None:
        self._run(self._api.repeater_list, self._on_saved)

    def _on_saved(self, saved: list[dict[str, Any]]) -> None:
        for item in saved or []:
            tab = RepeaterTab(self._api, self._run, self._palette)
            tab.load_saved(item)
            self.addTab(tab, tab.name)
        if self.count() == 0:
            self.new_tab()

    def save_current(self) -> None:
        tab = self.currentWidget()
        if not isinstance(tab, RepeaterTab):
            return
        payload = tab.save_payload()
        if tab.tab_id is None:
            self._run(
                lambda: self._api.repeater_save(**payload),
                lambda r: self._on_saved_id(tab, r),
            )
        else:
            self._run(lambda: self._api.repeater_update(tab.tab_id, payload),
                      lambda _r: None)

    def _on_saved_id(self, tab: RepeaterTab, result: dict[str, Any]) -> None:
        if isinstance(result, dict) and result.get("id") is not None:
            tab.tab_id = result["id"]

    def _close_tab(self, index: int) -> None:
        widget = self.widget(index)
        self.removeTab(index)
        if widget is not None:
            widget.deleteLater()
        if self.count() == 0:
            self.new_tab()
