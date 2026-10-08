"""Resaltado de sintaxis para mensajes HTTP crudos (request/response).

Regla de seguridad del proyecto: el contenido interceptado JAMÁS se pinta con
`setHtml`. `QSyntaxHighlighter` aplica `QTextCharFormat` directamente sobre el
`QTextDocument` del visor — formatea caracteres de forma programática sin
interpretar el texto como markup, así que es seguro para cuerpos no confiables.

El resaltador reconoce la estructura de un mensaje HTTP crudo:
    línea de inicio (request line o status line)
    Header-Name: valor
    …
    (línea en blanco)
    cuerpo (resaltado como JSON si procede)

La paleta se obtiene de `themes.highlight_palette(tokens)` y se reaplica al
cambiar de tema con `set_palette()`.
"""

from __future__ import annotations

import re
from typing import Any

from PySide6.QtCore import QRegularExpression
from PySide6.QtGui import QColor, QSyntaxHighlighter, QTextCharFormat

# Estados de bloque: antes o después de la línea en blanco separadora.
_HEADERS = 0
_BODY = 1

# Regex del cuerpo JSON. Orden de aplicación en highlightBlock (las claves se
# aplican al final para sobreescribir el formato de string sobre una clave).
_RE_STRING = QRegularExpression(r'"(?:[^"\\]|\\.)*"')
_RE_NUMBER = QRegularExpression(r'-?\b\d+\.?\d*(?:[eE][-+]?\d+)?\b')
_RE_LITERAL = QRegularExpression(r'\b(?:true|false|null)\b')
_RE_KEY = QRegularExpression(r'"(?:[^"\\]|\\.)*"(?=\s*:)')

_START_REQUEST = re.compile(r'^([A-Z]+)\s+(\S+)(.*)$')


def _fmt(color: str, *, bold: bool = False) -> QTextCharFormat:
    fmt = QTextCharFormat()
    fmt.setForeground(QColor(color))
    if bold:
        fmt.setFontWeight(700)
    return fmt


class HttpHighlighter(QSyntaxHighlighter):
    """Colorea un mensaje HTTP crudo (línea de inicio + headers + cuerpo JSON)."""

    def __init__(
        self, document: Any, palette: dict[str, Any], body_only: bool = False
    ) -> None:
        super().__init__(document)
        # body_only: el documento es solo cuerpo (p. ej. un frame WebSocket JSON),
        # no un mensaje HTTP con línea de inicio + headers.
        self._body_only = body_only
        self._build_formats(palette)

    # -- paleta ------------------------------------------------------------- #
    def set_palette(self, palette: dict[str, Any]) -> None:
        """Reaplica colores (p. ej. tras un cambio de tema) y re-resalta."""
        self._build_formats(palette)
        self.rehighlight()

    def _build_formats(self, palette: dict[str, Any]) -> None:
        self._f_method = _fmt(palette["method"], bold=True)
        self._f_url = _fmt(palette["url"])
        self._f_http = _fmt(palette["http"])
        self._f_header_name = _fmt(palette["header_name"])
        self._f_header_value = _fmt(palette["header_value"])
        self._f_key = _fmt(palette["key"])
        self._f_string = _fmt(palette["string"])
        self._f_number = _fmt(palette["number"])
        self._f_literal = _fmt(palette["literal"])
        # Status por familia (2xx/3xx/4xx/5xx), con fallback al color de url.
        self._status = {
            fam: _fmt(col, bold=True)
            for fam, col in (palette.get("status") or {}).items()
        }
        self._f_status_default = _fmt(palette["url"], bold=True)

    # -- resaltado ---------------------------------------------------------- #
    def highlightBlock(self, text: str) -> None:  # noqa: N802 (API de Qt)
        if self._body_only:
            self._highlight_body(text)
            return
        in_body = self.previousBlockState() == _BODY
        if in_body:
            self._highlight_body(text)
            self.setCurrentBlockState(_BODY)
            return

        if text.strip() == "":
            # Línea en blanco: separa headers del cuerpo; lo que sigue es cuerpo.
            self.setCurrentBlockState(_BODY)
            return

        if self.currentBlock().blockNumber() == 0:
            self._highlight_start_line(text)
        else:
            self._highlight_header(text)
        self.setCurrentBlockState(_HEADERS)

    def _highlight_start_line(self, text: str) -> None:
        if text.startswith("HTTP"):
            # Status line: "HTTP/1.1 200 OK" (o "HTTP 200" de nuestros formateos).
            self.setFormat(0, len(text), self._f_http)
            match = re.search(r'\b(\d{3})\b', text)
            if match:
                code = int(match.group(1))
                fmt = self._status.get(code // 100, self._f_status_default)
                self.setFormat(match.start(1), 3, fmt)
            return
        # Request line: "GET https://… HTTP/1.1".
        match = _START_REQUEST.match(text)
        if not match:
            return
        self.setFormat(match.start(1), len(match.group(1)), self._f_method)
        self.setFormat(match.start(2), len(match.group(2)), self._f_url)
        if match.group(3).strip():
            self.setFormat(match.start(3), len(match.group(3)), self._f_http)

    def _highlight_header(self, text: str) -> None:
        sep = text.find(":")
        if sep <= 0:
            return
        self.setFormat(0, sep, self._f_header_name)
        self.setFormat(sep + 1, len(text) - sep - 1, self._f_header_value)

    def _highlight_body(self, text: str) -> None:
        self._apply(_RE_STRING, text, self._f_string)
        self._apply(_RE_NUMBER, text, self._f_number)
        self._apply(_RE_LITERAL, text, self._f_literal)
        self._apply(_RE_KEY, text, self._f_key)  # al final: sobreescribe claves

    def _apply(self, regex: QRegularExpression, text: str, fmt: QTextCharFormat) -> None:
        it = regex.globalMatch(text)
        while it.hasNext():
            m = it.next()
            self.setFormat(m.capturedStart(), m.capturedLength(), fmt)
