"""Panel del visor de WebSocket (Fase 5).

Lista conexiones WS capturadas y sus frames (dirección up/down), muestra el
contenido del frame en texto plano y permite reenviar un mensaje a la conexión
(`/api/websocket/connections|frames|resend`).
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QAbstractItemView,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QPushButton,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ._sorting import make_sortable, numeric_item, populating
from .http_view import HttpEditor

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]


class WebSocketPanel(QWidget):
    """Conexiones | frames | contenido + reenvío."""

    def __init__(self, api, runner: Runner, palette: dict[str, Any],
                 parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._frames: list[dict[str, Any]] = []
        self._cur_url: str | None = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        top = QHBoxLayout()
        reload_btn = QPushButton("Recargar conexiones")
        reload_btn.clicked.connect(self.reload)
        top.addWidget(reload_btn)
        top.addStretch(1)
        layout.addLayout(top)

        split = QSplitter(Qt.Horizontal)
        self._conns = QListWidget()
        self._conns.currentItemChanged.connect(self._on_conn)
        split.addWidget(self._conns)

        right = QSplitter(Qt.Vertical)
        self._frames_tbl = QTableWidget(0, 3)
        self._frames_tbl.setHorizontalHeaderLabels(["#", "Dirección", "Hora"])
        self._frames_tbl.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._frames_tbl.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._frames_tbl.verticalHeader().setVisible(False)
        self._frames_tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        make_sortable(self._frames_tbl)  # orden por cabecera / click-to-sort
        self._frames_tbl.currentCellChanged.connect(self._on_frame)
        right.addWidget(self._frames_tbl)

        self._content = HttpEditor(palette, read_only=True, body_only=True)
        right.addWidget(self._content)
        right.setSizes([300, 300])
        split.addWidget(right)
        split.setSizes([360, 700])
        layout.addWidget(split, 1)

        resend = QHBoxLayout()
        resend.addWidget(QLabel("Reenviar:"))
        self._resend_msg = QLineEdit()
        self._resend_msg.setPlaceholderText("mensaje a enviar a la conexión…")
        self._resend_msg.returnPressed.connect(self._resend)
        resend_btn = QPushButton("Enviar")
        resend_btn.setObjectName("AccentButton")
        resend_btn.clicked.connect(self._resend)
        self._resend_status = QLabel("")
        resend.addWidget(self._resend_msg, 1)
        resend.addWidget(resend_btn)
        resend.addWidget(self._resend_status)
        layout.addLayout(resend)

    def set_palette(self, palette: dict[str, Any]) -> None:
        self._content.set_palette(palette)

    # -- conexiones --------------------------------------------------------- #
    def reload(self) -> None:
        self._run(self._api.ws_connections, self._on_conns)

    def _on_conns(self, conns: list[dict[str, Any]]) -> None:
        # Preserva la selección actual al repoblar (refresco en vivo no disruptivo):
        # repoblar sin bloquear señales reiniciaría los frames en cada frame nuevo.
        prev = self._cur_url
        self._conns.blockSignals(True)
        self._conns.clear()
        sel_row = -1
        for i, c in enumerate(conns if isinstance(conns, list) else []):
            item = QListWidgetItem(f"{c.get('url', '')}  ({c.get('frame_count', 0)})")
            item.setData(Qt.UserRole, c.get("url"))
            self._conns.addItem(item)
            if c.get("url") == prev:
                sel_row = i
        if sel_row >= 0:
            self._conns.setCurrentRow(sel_row)
        self._conns.blockSignals(False)

    # -- refresco en vivo --------------------------------------------------- #
    def on_live_frame(self, url: str) -> None:
        """Llamado al llegar un frame WS nuevo: actualiza conteos y frames."""
        self.reload()
        if url and url == self._cur_url:
            self._refresh_frames_preserving()

    def _refresh_frames_preserving(self) -> None:
        if not self._cur_url:
            return
        row = self._frames_tbl.currentRow()

        def _apply(frames: list[dict[str, Any]]) -> None:
            self._on_frames(frames)
            if 0 <= row < self._frames_tbl.rowCount():
                self._frames_tbl.selectRow(row)

        self._run(lambda: self._api.ws_frames(self._cur_url), _apply)

    def _on_conn(self, current: QListWidgetItem | None, _p: QListWidgetItem | None) -> None:
        if current is None:
            return
        self._cur_url = current.data(Qt.UserRole)
        if self._cur_url:
            self._run(lambda: self._api.ws_frames(self._cur_url), self._on_frames)

    # -- frames ------------------------------------------------------------- #
    def _on_frames(self, frames: list[dict[str, Any]]) -> None:
        self._frames = frames if isinstance(frames, list) else []
        # Desactiva el orden al poblar para que las filas no "salten":
        with populating(self._frames_tbl):
            self._frames_tbl.setRowCount(len(self._frames))
            for r, f in enumerate(self._frames):
                arrow = "UP" if f.get("direction") == "up" else "DOWN"
                # Columna "#" numérica + índice estable en UserRole:
                item0 = numeric_item(f.get("id", ""))
                item0.setData(Qt.UserRole, r)
                self._frames_tbl.setItem(r, 0, item0)
                for col, text in enumerate([arrow, str(f.get("timestamp", ""))],
                                           start=1):
                    item = QTableWidgetItem(text)
                    item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                    self._frames_tbl.setItem(r, col, item)
        self._content.clear()

    def _frame_index(self, row: int) -> int:
        """Índice estable en `self._frames` de la fila visual `row` (o -1)."""
        item = self._frames_tbl.item(row, 0) if row >= 0 else None
        idx = item.data(Qt.UserRole) if item is not None else None
        return idx if isinstance(idx, int) else -1

    def _on_frame(self, row: int, _c: int, _pr: int, _pc: int) -> None:
        idx = self._frame_index(row)
        if 0 <= idx < len(self._frames):
            self._content.setPlainText(str(self._frames[idx].get("content", "")))

    # -- reenvío ------------------------------------------------------------ #
    def _resend(self) -> None:
        if not self._cur_url:
            return
        msg = self._resend_msg.text()
        if not msg:
            return
        self._resend_status.setText("Enviando…")
        self._run(lambda: self._api.ws_resend(self._cur_url, msg), self._on_resent)

    def _on_resent(self, result: dict[str, Any]) -> None:
        if result.get("error"):
            self._resend_status.setText(f"{result['error']}")
        else:
            self._resend_status.setText(f"{result.get('status', 'ok')}")
