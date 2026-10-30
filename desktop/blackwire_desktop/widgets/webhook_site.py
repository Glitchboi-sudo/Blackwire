"""Herramienta Webhook.site (nativa).

Webhook.site genera una URL pública; el tráfico que llega a ella se captura EN los
servidores de webhook.site (la extensión NO toca el proxy). Esta herramienta:

- crea/regenera un token (`POST /api/webhooksite/token`), mostrando su URL para copiar,
- guarda una API key opcional (`POST /api/webhooksite/apikey`),
- sincroniza los requests remotos a la BD local (`POST /api/webhooksite/refresh`),
- lista/inspecciona lo capturado (`GET /api/webhooksite/requests`) y lo limpia
  (`DELETE /api/webhooksite/requests`).

Regla de seguridad: el contenido capturado se muestra SIEMPRE en texto plano
(`setPlainText`), nunca como HTML.
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont, QGuiApplication
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QPlainTextEdit,
    QPushButton,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from .. import themes

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

_COLUMNS = ["Método", "URL", "IP", "Fecha"]


def _fmt_obj(obj: Any) -> str:
    """Formatea un dict {k:v} a texto plano `k: v` por línea."""
    if not obj or not isinstance(obj, dict):
        return ""
    return "\n".join(f"{k}: {v}" for k, v in obj.items())


class WebhookSitePanel(QWidget):
    """Gestión de token Webhook.site + historial de requests capturados."""

    status_text = Signal(str)
    send_to_repeater = Signal(dict)  # detalle {method,url,headers,body} -> shell

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._requests: list[dict[str, Any]] = []
        self._token_url = ""

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        # -- URL del token -------------------------------------------------- #
        url_row = QHBoxLayout()
        url_row.addWidget(QLabel("URL:"))
        self._url = QLineEdit()
        self._url.setReadOnly(True)
        self._url.setPlaceholderText("(sin token — pulsa 'Crear URL')")
        self._url.setFont(QFont(themes.MONO_FAMILY, 10))
        copy_btn = QPushButton("Copiar")
        copy_btn.clicked.connect(self._copy_url)
        self._create_btn = QPushButton("Crear URL")
        self._create_btn.setObjectName("AccentButton")
        self._create_btn.clicked.connect(self._create_token)
        url_row.addWidget(self._url, 1)
        url_row.addWidget(copy_btn)
        url_row.addWidget(self._create_btn)

        # -- API key -------------------------------------------------------- #
        key_row = QHBoxLayout()
        key_row.addWidget(QLabel("API key:"))
        self._api_key = QLineEdit()
        self._api_key.setEchoMode(QLineEdit.Password)
        self._api_key.setPlaceholderText("(opcional)")
        save_key_btn = QPushButton("Guardar API key")
        save_key_btn.clicked.connect(self._save_api_key)
        key_row.addWidget(self._api_key, 1)
        key_row.addWidget(save_key_btn)

        cfg_box = QGroupBox("Token y API key")
        cfg_box_lay = QVBoxLayout(cfg_box)
        cfg_box_lay.addLayout(url_row)
        cfg_box_lay.addLayout(key_row)
        layout.addWidget(cfg_box)

        # -- acciones del historial ----------------------------------------- #
        actions = QHBoxLayout()
        sync_btn = QPushButton("Sincronizar")
        sync_btn.clicked.connect(self._sync)
        self._all_tokens = QCheckBox("Todos los tokens")
        self._all_tokens.toggled.connect(lambda _c: self._load_requests())
        repeater_btn = QPushButton("Enviar al Repeater")
        repeater_btn.clicked.connect(self._send_selected_to_repeater)
        clear_btn = QPushButton("Limpiar historial")
        clear_btn.setObjectName("DangerButton")
        clear_btn.clicked.connect(self._clear)
        actions.addWidget(sync_btn)
        actions.addWidget(self._all_tokens)
        actions.addStretch(1)
        actions.addWidget(repeater_btn)
        actions.addWidget(clear_btn)
        layout.addLayout(actions)

        # -- tabla + detalle ------------------------------------------------ #
        split = QSplitter(Qt.Horizontal)
        self._table = QTableWidget(0, len(_COLUMNS))
        self._table.setHorizontalHeaderLabels(_COLUMNS)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.verticalHeader().setVisible(False)
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self._table.currentCellChanged.connect(
            lambda r, _c, _pr, _pc: self._show_detail(r)
        )
        split.addWidget(self._table)

        self._detail = QTabWidget()
        self._req_view = self._viewer()
        self._hdr_view = self._viewer()
        self._query_view = self._viewer()
        self._body_view = self._viewer()
        self._detail.addTab(self._req_view, "Request")
        self._detail.addTab(self._hdr_view, "Headers")
        self._detail.addTab(self._query_view, "Query")
        self._detail.addTab(self._body_view, "Body")
        split.addWidget(self._detail)
        split.setSizes([620, 520])
        layout.addWidget(split, 1)

    @staticmethod
    def _viewer() -> QPlainTextEdit:
        ed = QPlainTextEdit()
        ed.setReadOnly(True)
        ed.setLineWrapMode(QPlainTextEdit.NoWrap)
        ed.setFont(QFont(themes.MONO_FAMILY, 10))
        return ed

    # -- carga -------------------------------------------------------------- #
    def reload(self) -> None:
        self._run(lambda: self._api.extension_get("webhook_site"), self._on_ext)

    def _on_ext(self, ext: dict[str, Any] | None) -> None:
        config = (ext or {}).get("config") or {}
        self._token_url = config.get("token_url") or ""
        self._url.setText(self._token_url)
        self._create_btn.setText("Regenerar" if config.get("token_id") else "Crear URL")
        if config.get("api_key"):
            self._api_key.setText(str(config["api_key"]))
        self._load_requests()

    def _load_requests(self) -> None:
        self._run(
            lambda: self._api.webhooksite_requests(
                all_tokens=self._all_tokens.isChecked()
            ),
            self._on_requests,
        )

    def _on_requests(self, requests: list[dict[str, Any]]) -> None:
        self._requests = requests or []
        self._table.setRowCount(len(self._requests))
        for r, req in enumerate(self._requests):
            cells = [
                req.get("method", ""),
                req.get("url", ""),
                req.get("ip", ""),
                req.get("created_at", ""),
            ]
            for c, text in enumerate(cells):
                item = QTableWidgetItem(str(text))
                item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                self._table.setItem(r, c, item)
        if self._requests:
            self._table.selectRow(0)
        else:
            self._clear_detail()

    def _clear_detail(self) -> None:
        for view in (self._req_view, self._hdr_view, self._query_view, self._body_view):
            view.setPlainText("")

    def _show_detail(self, row: int) -> None:
        if not (0 <= row < len(self._requests)):
            return
        req = self._requests[row]
        # Regla de seguridad: setPlainText, jamás setHtml con datos capturados.
        self._req_view.setPlainText(
            f"{req.get('method', '')} {req.get('url', '')}\n"
            f"IP: {req.get('ip', '')}\n"
            f"User-Agent: {req.get('user_agent', '')}\n"
            f"Fecha: {req.get('created_at', '')}"
        )
        self._hdr_view.setPlainText(_fmt_obj(req.get("headers")))
        self._query_view.setPlainText(_fmt_obj(req.get("query")))
        self._body_view.setPlainText(req.get("content") or "")

    # -- acciones de red ---------------------------------------------------- #
    def _create_token(self) -> None:
        self.status_text.emit("Webhook.site: creando token…")
        self._run(
            lambda: self._api.webhooksite_create_token(self._api_key.text().strip()),
            self._on_token,
        )

    def _on_token(self, result: dict[str, Any]) -> None:
        if not isinstance(result, dict) or result.get("error") or not result.get(
            "token_url"
        ):
            msg = result.get("error") if isinstance(result, dict) else "respuesta inválida"
            self.status_text.emit(f"Webhook.site: {msg}")
            return
        self._token_url = result["token_url"]
        self._url.setText(self._token_url)
        self._create_btn.setText("Regenerar")
        self.status_text.emit(f"Webhook.site: token {result.get('token_id', '')} listo")
        self._load_requests()

    def _save_api_key(self) -> None:
        key = self._api_key.text().strip()
        self._run(
            lambda: self._api.webhooksite_set_apikey(key),
            lambda _r: self.status_text.emit("Webhook.site: API key guardada"),
        )

    def _sync(self) -> None:
        self.status_text.emit("Webhook.site: sincronizando…")
        self._run(self._api.webhooksite_refresh, self._on_synced)

    def _on_synced(self, result: dict[str, Any]) -> None:
        if isinstance(result, dict) and result.get("error"):
            self.status_text.emit(f"Webhook.site: {result['error']}")
            return
        count = result.get("count", 0) if isinstance(result, dict) else 0
        self.status_text.emit(f"Webhook.site: {count} request(s) sincronizados")
        self._load_requests()

    def _clear(self) -> None:
        self._run(self._api.webhooksite_delete_requests, self._on_cleared)

    def _on_cleared(self, result: dict[str, Any]) -> None:
        deleted = result.get("deleted", 0) if isinstance(result, dict) else 0
        self.status_text.emit(f"Webhook.site: {deleted} request(s) borrados")
        self._load_requests()

    # -- utilidades --------------------------------------------------------- #
    def _copy_url(self) -> None:
        if self._token_url:
            QGuiApplication.clipboard().setText(self._token_url)
            self.status_text.emit("Webhook.site: URL copiada al portapapeles")

    def _send_selected_to_repeater(self) -> None:
        row = self._table.currentRow()
        if not (0 <= row < len(self._requests)):
            return
        req = self._requests[row]
        detail = {
            "method": req.get("method", "GET"),
            "url": req.get("url", ""),
            "headers": req.get("headers") or {},
            "body": req.get("content") or "",
        }
        self.send_to_repeater.emit(detail)
