"""Visor/editor de mensajes HTTP con resaltado, búsqueda y menú contextual.

Dos piezas reutilizables en todos los paneles (detalle, Repeater, Intercept, WS):

- `HttpEditor`: un `QPlainTextEdit` mono con `HttpHighlighter`, barra de búsqueda
  incremental (Ctrl+F) y un menú contextual extensible con acciones propias
  (enviar a Repeater, copiar como cURL, decodificar selección, etc.).
- `HttpView`: envuelve tres `HttpEditor` en pestañas **Pretty · Raw · Hex** al
  estilo de Burp. Pretty reformatea el cuerpo JSON; Raw lo deja crudo; Hex hace
  un volcado hexadecimal.

Regla de seguridad: el contenido siempre entra por `setPlainText`; el color lo
pone el `HttpHighlighter` vía `QTextCharFormat`. Nunca se usa `setHtml`.
"""

from __future__ import annotations

import json
from typing import Any, Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont, QKeySequence, QShortcut, QTextDocument
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLineEdit,
    QMenu,
    QPlainTextEdit,
    QPushButton,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from .. import themes
from .highlight import HttpHighlighter

# (label, callback) — el callback recibe el texto seleccionado (o todo si vacío).
ContextAction = tuple[str, Callable[[str], None]]


def _mono(size: int = 10) -> QFont:
    return QFont(themes.MONO_FAMILY, size)


def _pretty_json(body: str) -> str:
    try:
        return json.dumps(json.loads(body), indent=2, ensure_ascii=False)
    except (ValueError, TypeError):
        return body


def prettify_message(text: str) -> str:
    """Reformatea el cuerpo (tras la línea en blanco) si es JSON; headers intactos."""
    head, sep, body = text.partition("\n\n")
    if not sep or not body.strip():
        return text
    return f"{head}\n\n{_pretty_json(body)}"


def hexdump(text: str) -> str:
    """Volcado hex (offset · bytes · ASCII) del mensaje, 16 bytes por línea."""
    data = text.encode("utf-8", "replace")
    lines = []
    for off in range(0, len(data), 16):
        chunk = data[off:off + 16]
        hexs = " ".join(f"{b:02x}" for b in chunk)
        ascii_ = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        lines.append(f"{off:08x}  {hexs:<47}  {ascii_}")
    return "\n".join(lines)


class _FindBar(QWidget):
    """Barra de búsqueda incremental sobre un `QPlainTextEdit`."""

    def __init__(self, edit: QPlainTextEdit, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._edit = edit
        lay = QHBoxLayout(self)
        lay.setContentsMargins(4, 2, 4, 2)
        lay.setSpacing(4)
        self._input = QLineEdit()
        self._input.setPlaceholderText("Buscar… (Enter: siguiente)")
        self._input.textChanged.connect(lambda _t: self._find(forward=True, moved=False))
        self._input.returnPressed.connect(lambda: self._find(forward=True, moved=True))
        prev = QPushButton("▲")
        prev.setFixedWidth(28)
        prev.clicked.connect(lambda: self._find(forward=False, moved=True))
        nxt = QPushButton("▼")
        nxt.setFixedWidth(28)
        nxt.clicked.connect(lambda: self._find(forward=True, moved=True))
        close = QPushButton("✕")
        close.setFixedWidth(28)
        close.clicked.connect(self.hide)
        lay.addWidget(self._input, 1)
        lay.addWidget(prev)
        lay.addWidget(nxt)
        lay.addWidget(close)
        self.hide()

    def focus(self) -> None:
        self.show()
        self._input.setFocus()
        self._input.selectAll()

    def _find(self, *, forward: bool, moved: bool) -> None:
        needle = self._input.text()
        if not needle:
            return
        flags = QTextDocument.FindFlags()
        if not forward:
            flags |= QTextDocument.FindBackward
        if moved and not self._edit.find(needle, flags):
            # Reinicia la búsqueda desde el extremo opuesto (wrap-around).
            cursor = self._edit.textCursor()
            cursor.movePosition(
                cursor.MoveOperation.End if not forward
                else cursor.MoveOperation.Start
            )
            self._edit.setTextCursor(cursor)
            self._edit.find(needle, flags)
        elif not moved:
            self._edit.find(needle, flags)


class HttpEditor(QWidget):
    """Editor/visor mono con resaltado HTTP, búsqueda y menú contextual propio."""

    def __init__(
        self, palette: dict[str, Any], read_only: bool = True,
        highlight: bool = True, body_only: bool = False,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        self.edit = QPlainTextEdit()
        self.edit.setReadOnly(read_only)
        self.edit.setLineWrapMode(QPlainTextEdit.NoWrap)
        self.edit.setFont(_mono())
        self.edit.setContextMenuPolicy(Qt.CustomContextMenu)
        self.edit.customContextMenuRequested.connect(self._show_menu)
        lay.addWidget(self.edit, 1)

        self._find = _FindBar(self.edit)
        lay.addWidget(self._find)

        self._actions: list[ContextAction] = []
        self._highlighter = (
            HttpHighlighter(self.edit.document(), palette, body_only)
            if highlight else None
        )

        sc = QShortcut(QKeySequence.Find, self.edit)
        sc.activated.connect(self._find.focus)

    # -- contenido ---------------------------------------------------------- #
    def setPlainText(self, text: str) -> None:  # noqa: N802 (API tipo Qt)
        self.edit.setPlainText(text)

    def toPlainText(self) -> str:  # noqa: N802 (API tipo Qt)
        return self.edit.toPlainText()

    def clear(self) -> None:
        self.edit.clear()

    def setPlaceholderText(self, text: str) -> None:  # noqa: N802
        self.edit.setPlaceholderText(text)

    def selected_text(self) -> str:
        # QTextCursor usa U+2029 como separador de párrafo; normaliza a \n.
        return self.edit.textCursor().selectedText().replace(" ", "\n")

    # -- paleta / acciones -------------------------------------------------- #
    def set_palette(self, palette: dict[str, Any]) -> None:
        if self._highlighter is not None:
            self._highlighter.set_palette(palette)

    def set_context_actions(self, actions: list[ContextAction]) -> None:
        self._actions = actions or []

    def _show_menu(self, pos) -> None:
        menu: QMenu = self.edit.createStandardContextMenu()
        if self._actions:
            menu.addSeparator()
            for label, callback in self._actions:
                act = menu.addAction(label)
                act.triggered.connect(
                    lambda _c=False, cb=callback: cb(
                        self.selected_text() or self.toPlainText()
                    )
                )
        menu.addSeparator()
        find_act = menu.addAction("Buscar…\tCtrl+F")
        find_act.triggered.connect(self._find.focus)
        wrap_act = menu.addAction("Ajuste de línea")
        wrap_act.setCheckable(True)
        wrap_act.setChecked(self.edit.lineWrapMode() == QPlainTextEdit.WidgetWidth)
        wrap_act.toggled.connect(self._set_wrap)
        menu.exec(self.edit.viewport().mapToGlobal(pos))

    def _set_wrap(self, on: bool) -> None:
        self.edit.setLineWrapMode(
            QPlainTextEdit.WidgetWidth if on else QPlainTextEdit.NoWrap
        )


class HttpView(QWidget):
    """Visor read-only de un mensaje HTTP con pestañas Pretty · Raw · Hex."""

    send_to_repeater = Signal(str)

    def __init__(
        self, palette: dict[str, Any], parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        self._tabs = QTabWidget()
        self._tabs.setDocumentMode(True)
        self._pretty = HttpEditor(palette, read_only=True, highlight=True)
        self._raw = HttpEditor(palette, read_only=True, highlight=True)
        self._hex = HttpEditor(palette, read_only=True, highlight=False)
        self._tabs.addTab(self._pretty, "Pretty")
        self._tabs.addTab(self._raw, "Raw")
        self._tabs.addTab(self._hex, "Hex")
        lay.addWidget(self._tabs)

        self._raw_text = ""

    def set_message(self, text: str) -> None:
        self._raw_text = text or ""
        self._pretty.setPlainText(prettify_message(self._raw_text))
        self._raw.setPlainText(self._raw_text)
        self._hex.setPlainText(hexdump(self._raw_text))

    def set_placeholder(self, text: str) -> None:
        for ed in (self._pretty, self._raw, self._hex):
            ed.setPlaceholderText(text)

    def set_palette(self, palette: dict[str, Any]) -> None:
        self._pretty.set_palette(palette)
        self._raw.set_palette(palette)

    def set_context_actions(self, actions: list[ContextAction]) -> None:
        self._pretty.set_context_actions(actions)
        self._raw.set_context_actions(actions)
        self._hex.set_context_actions(actions)

    def text(self) -> str:
        return self._raw_text
