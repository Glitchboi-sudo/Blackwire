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

from PySide6.QtCore import QRegularExpression, Qt, Signal
from PySide6.QtGui import QFont, QKeySequence, QShortcut, QTextDocument
from . import icons
from PySide6.QtWidgets import (
    QCheckBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMenu,
    QPlainTextEdit,
    QPushButton,
    QTabWidget,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)

from .. import themes
from .highlight import HttpHighlighter

# (label, callback) — el callback recibe el texto seleccionado (o todo si vacío).
ContextAction = tuple[str, Callable[[str], None]]


def _mono(size: int = 10) -> QFont:
    return QFont(themes.MONO_FAMILY, size)


def _pretty_xml(body: str) -> str:
    """Indenta XML bien formado; '' si no parsea (HTML suelto no es XML válido)."""
    try:
        import xml.dom.minidom as minidom

        dom = minidom.parseString(body)
        pretty = dom.toprettyxml(indent="  ")
        # minidom intercala líneas en blanco; se colapsan.
        return "\n".join(ln for ln in pretty.splitlines() if ln.strip())
    except Exception:  # noqa: BLE001 - cualquier fallo de parseo => sin indentar
        return ""


def _pretty_body(body: str) -> str:
    """Pretty-print del cuerpo: JSON indentado, luego XML; si no, se deja igual."""
    stripped = body.lstrip()
    if stripped[:1] in "{[":
        try:
            return json.dumps(json.loads(body), indent=2, ensure_ascii=False)
        except (ValueError, TypeError):
            pass
    if stripped[:1] == "<":
        pretty = _pretty_xml(body)
        if pretty:
            return pretty
    return body


def _split_body(text: str) -> str:
    """Devuelve solo el cuerpo (tras la primera línea en blanco), o '' si no hay."""
    _head, sep, body = text.partition("\n\n")
    return body if sep else ""


def prettify_message(text: str) -> str:
    """Reformatea el cuerpo (tras la línea en blanco) si es JSON/XML; headers intactos."""
    head, sep, body = text.partition("\n\n")
    if not sep or not body.strip():
        return text
    return f"{head}\n\n{_pretty_body(body)}"


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
        self._rx = QCheckBox("Rx")
        self._rx.setToolTip("Interpretar la búsqueda como expresión regular")
        self._rx.toggled.connect(lambda _c: self._find(forward=True, moved=False))
        self._counter = QLabel("0/0")
        self._counter.setMinimumWidth(48)
        self._counter.setAlignment(Qt.AlignCenter)
        prev = QPushButton()
        prev.setToolTip("Anterior")
        icons.apply(prev, "chevron-up", 14)
        prev.setFixedWidth(28)
        prev.setToolTip("Buscar anterior")
        prev.setAccessibleName("Buscar anterior")
        prev.clicked.connect(lambda: self._find(forward=False, moved=True))
        nxt = QPushButton()
        nxt.setToolTip("Siguiente")
        icons.apply(nxt, "chevron-down", 14)
        nxt.setFixedWidth(28)
        nxt.setToolTip("Buscar siguiente")
        nxt.setAccessibleName("Buscar siguiente")
        nxt.clicked.connect(lambda: self._find(forward=True, moved=True))
        close = QPushButton()
        close.setToolTip("Cerrar")
        icons.apply(close, "x", 14)
        close.setFixedWidth(28)
        close.setToolTip("Cerrar búsqueda")
        close.setAccessibleName("Cerrar búsqueda")
        close.clicked.connect(self.hide)
        lay.addWidget(self._input, 1)
        lay.addWidget(self._rx)
        lay.addWidget(self._counter)
        lay.addWidget(prev)
        lay.addWidget(nxt)
        lay.addWidget(close)
        self.hide()

    def focus(self) -> None:
        self.show()
        self._input.setFocus()
        self._input.selectAll()

    def _build_regex(self) -> QRegularExpression | None:
        """Devuelve la QRegularExpression activa, o None si el patrón es inválido."""
        needle = self._input.text()
        if not needle:
            return None
        if self._rx.isChecked():
            rx = QRegularExpression(needle)
        else:
            rx = QRegularExpression(
                QRegularExpression.escape(needle),
                QRegularExpression.CaseInsensitiveOption,
            )
        return rx if rx.isValid() else None

    def _find(self, *, forward: bool, moved: bool) -> None:
        rx = self._build_regex()
        if rx is None:
            self._counter.setText("—" if self._input.text() else "0/0")
            return
        flags = QTextDocument.FindFlags()
        if not forward:
            flags |= QTextDocument.FindBackward
        if moved and not self._edit.find(rx, flags):
            # Reinicia la búsqueda desde el extremo opuesto (wrap-around).
            cursor = self._edit.textCursor()
            cursor.movePosition(
                cursor.MoveOperation.End if not forward
                else cursor.MoveOperation.Start
            )
            self._edit.setTextCursor(cursor)
            self._edit.find(rx, flags)
        elif not moved:
            self._edit.find(rx, flags)
        self._update_counter(rx)

    def _update_counter(self, rx: QRegularExpression) -> None:
        """Actualiza el contador n/N según las coincidencias en el documento."""
        text = self._edit.toPlainText()
        starts: list[int] = []
        it = rx.globalMatch(text)
        while it.hasNext():
            starts.append(it.next().capturedStart())
        total = len(starts)
        cur = self._edit.textCursor().selectionStart()
        idx = next((i + 1 for i, s in enumerate(starts) if s == cur), 0)
        self._counter.setText(f"{idx}/{total}")


class HttpEditor(QWidget):
    """Editor/visor mono con resaltado HTTP, búsqueda y menú contextual propio."""

    def __init__(
        self, palette: dict[str, Any], read_only: bool = True,
        highlight: bool = True, body_only: bool = False,
        wrap: bool = True, parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        self.edit = QPlainTextEdit()
        self.edit.setReadOnly(read_only)
        # Ajuste de línea activo por defecto (las líneas largas no desbordan en
        # horizontal); Hex lo desactiva para preservar columnas fijas.
        self.edit.setLineWrapMode(
            QPlainTextEdit.WidgetWidth if wrap else QPlainTextEdit.NoWrap
        )
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


class _RenderView(QTextBrowser):
    """Render de HTML del cuerpo, SIN JavaScript y SIN red.

    `QTextBrowser` no incluye motor JS (a diferencia de `QWebEngineView`), así
    que ningún script del contenido interceptado se ejecuta. Su cargador de
    recursos por defecto NO hace peticiones de red (no tiene QNetworkAccessMana-
    ger): `<img src=http…>`/CSS remoto no se descargan, así que no hay SSRF/
    beaconing al previsualizar. Es una desviación deliberada y acotada de la
    regla "nunca setHtml con datos no confiables": una vista previa segura.

    No se sobrescribe ningún virtual de Qt (p. ej. `loadResource`) a propósito:
    un override en Python de un virtual que Qt llama durante el layout provoca
    cuelgues de shiboken en algunas combinaciones de Python/PySide6. El render
    es además **perezoso** (solo al ver la pestaña) — ver `HttpView`.
    """

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setOpenLinks(False)
        self.setOpenExternalLinks(False)
        self.setPlaceholderText("Sin contenido HTML para renderizar")

    def render_body(self, body: str) -> None:
        if body.strip():
            self.setHtml(body)
        else:
            self.clear()


class HttpView(QWidget):
    """Visor read-only de un mensaje HTTP con pestañas Pretty · Raw · Hex · Render."""

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
        self._hex = HttpEditor(palette, read_only=True, highlight=False, wrap=False)
        self._render = _RenderView()
        self._tabs.addTab(self._pretty, "Pretty")
        self._tabs.addTab(self._raw, "Raw")
        self._tabs.addTab(self._hex, "Hex")
        self._tabs.addTab(self._render, "Render")
        self._tabs.currentChanged.connect(self._on_tab_changed)
        lay.addWidget(self._tabs)

        self._raw_text = ""
        self._pending_body = ""
        self._rendered_body: str | None = None

    def _on_tab_changed(self, index: int) -> None:
        # Render perezoso: solo construimos el HTML cuando la pestaña Render pasa
        # a estar visible (evita setHtml en cada selección del historial).
        if self._tabs.widget(index) is self._render:
            self._render_if_needed()

    def _render_if_needed(self) -> None:
        if self._rendered_body != self._pending_body:
            self._rendered_body = self._pending_body
            self._render.render_body(self._pending_body)

    def set_message(self, text: str) -> None:
        self._raw_text = text or ""
        self._pretty.setPlainText(prettify_message(self._raw_text))
        self._raw.setPlainText(self._raw_text)
        self._hex.setPlainText(hexdump(self._raw_text))
        self._pending_body = _split_body(self._raw_text)
        self._rendered_body = None
        if self._tabs.currentWidget() is self._render:
            self._render_if_needed()

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
