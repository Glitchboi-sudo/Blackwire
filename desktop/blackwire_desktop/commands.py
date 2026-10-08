"""Registro de comandos + command palette (Fase 1).

Un `Command` empaqueta id estable, título legible, callback y atajo por defecto.
`CommandRegistry` los materializa como `QAction` (atajo reconfigurable desde
`Settings`) y alimenta el `CommandPalette` (Ctrl+K), estilo Burp/VS Code: filtro
difuso por subsecuencia y ejecución con Enter.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction, QKeySequence
from PySide6.QtWidgets import (
    QDialog,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .settings import Settings


@dataclass(frozen=True)
class Command:
    """Una acción invocable desde menú, atajo o paleta."""

    id: str
    title: str
    callback: Callable[[], None]
    default_shortcut: str = ""


class CommandRegistry:
    """Guarda los comandos y crea sus `QAction` con atajos persistidos."""

    def __init__(self, owner: QWidget, settings: Settings) -> None:
        self._owner = owner
        self._settings = settings
        self._commands: list[Command] = []
        self._actions: dict[str, QAction] = {}

    def register(self, command: Command) -> QAction:
        """Registra un comando y devuelve su `QAction` (ya con atajo aplicado)."""
        self._commands.append(command)
        action = QAction(command.title, self._owner)
        action.triggered.connect(command.callback)
        seq = self._settings.shortcut(command.id, command.default_shortcut)
        if seq:
            action.setShortcut(QKeySequence(seq))
        # El atajo funciona aunque la acción no esté en un menú visible.
        self._owner.addAction(action)
        self._actions[command.id] = action
        return action

    def commands(self) -> list[Command]:
        return list(self._commands)

    def action(self, command_id: str) -> QAction | None:
        return self._actions.get(command_id)

    def shortcut_text(self, command_id: str) -> str:
        action = self._actions.get(command_id)
        return action.shortcut().toString() if action else ""

    def rebind(self, command_id: str, sequence: str) -> None:
        """Reasigna un atajo en caliente y lo persiste."""
        action = self._actions.get(command_id)
        if action is None:
            return
        action.setShortcut(QKeySequence(sequence))
        self._settings.set_shortcut(command_id, sequence)


def _subsequence_match(needle: str, haystack: str) -> bool:
    """True si `needle` aparece como subsecuencia en `haystack` (fuzzy)."""
    it = iter(haystack)
    return all(ch in it for ch in needle)


class CommandPalette(QDialog):
    """Paleta Ctrl+K: filtra comandos por subsecuencia y ejecuta el elegido."""

    def __init__(self, registry: CommandRegistry, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._registry = registry
        self.setWindowTitle("Command Palette")
        self.setModal(True)
        self.setMinimumWidth(520)
        self.setWindowFlag(Qt.FramelessWindowHint, True)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)

        self._input = QLineEdit()
        self._input.setPlaceholderText("Escribe un comando…")
        self._input.textChanged.connect(self._refilter)
        self._input.returnPressed.connect(self._run_current)
        layout.addWidget(self._input)

        self._list = QListWidget()
        self._list.itemActivated.connect(lambda _it: self._run_current())
        layout.addWidget(self._list)

        # Navegar con flechas sin salir del campo de texto.
        self._input.installEventFilter(self)
        self._populate("")

    # -- navegación --------------------------------------------------------- #
    def eventFilter(self, obj, event):  # noqa: N802 - API de Qt
        if obj is self._input and event.type() == event.Type.KeyPress:
            key = event.key()
            if key in (Qt.Key_Down, Qt.Key_Up):
                row = self._list.currentRow()
                row += 1 if key == Qt.Key_Down else -1
                row = max(0, min(row, self._list.count() - 1))
                self._list.setCurrentRow(row)
                return True
        return super().eventFilter(obj, event)

    # -- filtrado ----------------------------------------------------------- #
    def _refilter(self, text: str) -> None:
        self._populate(text)

    def _populate(self, text: str) -> None:
        needle = text.lower().strip()
        self._list.clear()
        for cmd in self._registry.commands():
            if needle and not _subsequence_match(needle, cmd.title.lower()):
                continue
            item = QListWidgetItem(cmd.title)
            item.setData(Qt.UserRole, cmd.id)
            shortcut = self._registry.shortcut_text(cmd.id)
            if shortcut:
                item.setText(f"{cmd.title}\t{shortcut}")
            self._list.addItem(item)
        if self._list.count():
            self._list.setCurrentRow(0)

    def _run_current(self) -> None:
        item = self._list.currentItem()
        if item is None:
            return
        command_id = item.data(Qt.UserRole)
        action = self._registry.action(command_id)
        self.accept()
        if action is not None:
            action.trigger()
