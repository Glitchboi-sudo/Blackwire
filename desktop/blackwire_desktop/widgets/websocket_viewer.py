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
        self._conns.clear()
        for c in (conns if isinstance(conns, list) else []):
            item = QListWidgetItem(f"{c.get('url', '')}  ({c.get('frame_count', 0)})")
            item.setData(Qt.UserRole, c.get("url"))
            self._conns.addItem(item)

    def _on_conn(self, current: QListWidgetItem | None, _p: QListWidgetItem | None) -> None:
        if current is None:
            return
        self._cur_url = current.data(Qt.UserRole)
        if self._cur_url:
            self._run(lambda: self._api.ws_frames(self._cur_url), self._on_frames)

    # -- frames ------------------------------------------------------------- #
    def _on_frames(self, frames: list[dict[str, Any]]) -> None:
        self._frames = frames if isinstance(frames, list) else []
        self._frames_tbl.setRowCount(len(self._frames))
        for r, f in enumerate(self._frames):
            arrow = "↑ up" if f.get("direction") == "up" else "↓ down"
            for col, text in enumerate([str(f.get("id", "")), arrow,
                                        str(f.get("timestamp", ""))]):
                item = QTableWidgetItem(text)
                item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                self._frames_tbl.setItem(r, col, item)
        self._content.clear()

    def _on_frame(self, row: int, _c: int, _pr: int, _pc: int) -> None:
        if 0 <= row < len(self._frames):
            self._content.setPlainText(str(self._frames[row].get("content", "")))

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
            self._resend_status.setText(f"⚠ {result['error']}")
        else:
            self._resend_status.setText(f"✓ {result.get('status', 'ok')}")
