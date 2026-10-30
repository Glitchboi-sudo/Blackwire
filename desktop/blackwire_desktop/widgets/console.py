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
        self._level.currentTextChanged.connect(lambda _t: self._render_full())
        self._text = QLineEdit()
        self._text.setPlaceholderText("Filtrar texto…")
        self._text.setClearButtonEnabled(True)
        self._text.textChanged.connect(lambda _t: self._render_full())
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

        # Sondeo rápido (1s) con append incremental -> sensación de tiempo real.
        # Los logs no se emiten por el WS de la app; el backend mantiene un ring
        # buffer que incluye los errores del proxy (reenviados por el addon).
        self._timer = QTimer(self)
        self._timer.setInterval(1000)
        self._timer.timeout.connect(self._poll)
        self._timer.start()

    # -- carga -------------------------------------------------------------- #
    def reload(self) -> None:
        self._poll()

    def _poll(self) -> None:
        if self._paused.isChecked():
            return
        self._run(lambda: self._api.console_logs(1000), self._on_logs)

    @staticmethod
    def _sig(entry: dict[str, Any]) -> tuple:
        """Firma para detectar entradas ya vistas (ts+nivel+nombre+msg)."""
        return (entry.get("ts"), entry.get("level"),
                entry.get("name"), entry.get("msg"))

    def _on_logs(self, entries: list[dict[str, Any]]) -> None:
        """Integra el tail devuelto por el backend añadiendo solo lo nuevo.

        El endpoint devuelve las últimas N entradas (no un delta); localizamos la
        última conocida dentro del tail y añadimos únicamente el sufijo posterior,
        así la vista no se reconstruye entera en cada sondeo (sin parpadeo ni
        saltos de scroll).
        """
        entries = entries or []
        if not self._entries:
            self._entries = entries
            self._render_full()
            return
        last = self._sig(self._entries[-1])
        idx = next((i for i in range(len(entries) - 1, -1, -1)
                    if self._sig(entries[i]) == last), None)
        if idx is None:
            # El buffer rotó más allá del tail: reemplazo completo.
            self._entries = entries
            self._render_full()
            return
        new = entries[idx + 1:]
        if not new:
            return
        self._entries.extend(new)
        if len(self._entries) > 20000:
            self._entries = self._entries[-20000:]
        self._append(new)

    def _passes_filter(self, entry: dict[str, Any]) -> str | None:
        """Devuelve la línea formateada si pasa los filtros; si no, None."""
        threshold = _LEVEL_ORDER.get(self._level.currentText(), 0)
        if _LEVEL_ORDER.get(entry.get("level", ""), 0) < threshold:
            return None
        line = (f"{entry.get('ts', '')} [{entry.get('level', '')}] "
                f"{entry.get('name', '')}: {entry.get('msg', '')}")
        needle = self._text.text().strip().lower()
        if needle and needle not in line.lower():
            return None
        return line

    def _scroll_to_end(self) -> None:
        if self._autoscroll.isChecked():
            sb = self._view.verticalScrollBar()
            sb.setValue(sb.maximum())

    def _render_full(self) -> None:
        """Reconstruye la vista completa (carga inicial o cambio de filtro)."""
        lines = [ln for e in self._entries if (ln := self._passes_filter(e))]
        self._count.setText(str(len(lines)))
        self._view.setPlainText("\n".join(lines))
        self._scroll_to_end()

    def _append(self, new: list[dict[str, Any]]) -> None:
        """Añade al final solo las entradas nuevas que pasan el filtro."""
        lines = [ln for e in new if (ln := self._passes_filter(e))]
        if not lines:
            return
        self._view.appendPlainText("\n".join(lines))
        self._count.setText(str(int(self._count.text() or 0) + len(lines)))
        self._scroll_to_end()

    def _clear(self) -> None:
        def _done(_r: Any) -> None:
            self._entries = []
            self._render_full()
        self._run(self._api.clear_console_logs, _done)
