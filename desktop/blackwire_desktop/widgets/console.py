"""Console: visor de logs del proxy (mitmproxy) en vivo.

Sondea `GET /api/console/logs` periódicamente y muestra las entradas
`{ts, level, name, msg}` en texto plano (nunca HTML), con filtro por nivel y por
texto, auto-scroll y limpieza (`DELETE /api/console/logs`).
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import QTimer
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPlainTextEdit,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from .. import themes

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

_LEVELS = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
_LEVEL_ORDER = {"DEBUG": 10, "INFO": 20, "WARNING": 30, "ERROR": 40, "CRITICAL": 50}


class ConsolePanel(QWidget):
    """Logs del proxy en vivo con filtros y auto-scroll."""

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._entries: list[dict[str, Any]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        # -- controles ------------------------------------------------------ #
        bar = QHBoxLayout()
        self._level = QComboBox()
        self._level.addItems(_LEVELS)
        self._level.currentTextChanged.connect(lambda _t: self._render())
        self._text = QLineEdit()
        self._text.setPlaceholderText("Filtrar texto…")
        self._text.setClearButtonEnabled(True)
        self._text.textChanged.connect(lambda _t: self._render())
        self._autoscroll = QCheckBox("Auto-scroll")
        self._autoscroll.setChecked(True)
        self._paused = QCheckBox("Pausar")
        self._count = QLabel("0")
        clear_btn = QPushButton("Limpiar")
        clear_btn.clicked.connect(self._clear)
        bar.addWidget(QLabel("Nivel:"))
        bar.addWidget(self._level)
        bar.addWidget(self._text, 1)
        bar.addWidget(self._autoscroll)
        bar.addWidget(self._paused)
        bar.addWidget(self._count)
        bar.addWidget(clear_btn)
        layout.addLayout(bar)

        # -- vista de logs (texto plano: regla de seguridad) ---------------- #
        self._view = QPlainTextEdit()
        self._view.setReadOnly(True)
        self._view.setLineWrapMode(QPlainTextEdit.NoWrap)
        self._view.setMaximumBlockCount(5000)
        self._view.setFont(QFont(themes.MONO_FAMILY, 9))
        layout.addWidget(self._view, 1)

        # Sondeo periódico (los logs no se emiten por el WS de la app).
        self._timer = QTimer(self)
        self._timer.setInterval(2000)
        self._timer.timeout.connect(self._poll)
        self._timer.start()

    # -- carga -------------------------------------------------------------- #
    def reload(self) -> None:
        self._poll()

    def _poll(self) -> None:
        if self._paused.isChecked():
            return
        self._run(lambda: self._api.console_logs(500), self._on_logs)

    def _on_logs(self, entries: list[dict[str, Any]]) -> None:
        self._entries = entries or []
        self._render()

    def _render(self) -> None:
        level_name = self._level.currentText()
        threshold = _LEVEL_ORDER.get(level_name, 0)
        needle = self._text.text().strip().lower()
        lines = []
        for e in self._entries:
            if _LEVEL_ORDER.get(e.get("level", ""), 0) < threshold:
                continue
            line = f"{e.get('ts', '')} [{e.get('level', '')}] {e.get('name', '')}: {e.get('msg', '')}"
            if needle and needle not in line.lower():
                continue
            lines.append(line)
        self._count.setText(str(len(lines)))
        self._view.setPlainText("\n".join(lines))
        if self._autoscroll.isChecked():
            sb = self._view.verticalScrollBar()
            sb.setValue(sb.maximum())

    def _clear(self) -> None:
        self._run(self._api.clear_console_logs, lambda _r: self._on_logs([]))
