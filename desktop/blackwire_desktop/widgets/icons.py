"""Themed SVG icon loader for the native GUI (UI remaster).

Loads monochrome stroke SVGs from ``assets/icons`` and recolors them to any
theme-token color at render time, so icons follow the active theme exactly like
the QSS does. No external icon dependency (no ``qtawesome``/icon font); the SVG
set is vendored and fully offline (Lucide-style geometry).

Usage (inside the ``widgets`` package)::

    from . import icons
    icons.apply(button, "play")     # themed QIcon, auto-recolors on theme change

``main`` wires the color source once at startup::

    from .widgets import icons
    icons.install(lambda: theme.tokens["txt"])
    theme.changed.connect(icons.refresh)
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from PySide6.QtCore import QByteArray, QRectF, Qt
from PySide6.QtGui import QIcon, QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer

_ICON_DIR = Path(__file__).resolve().parent.parent / "assets" / "icons"
_DEFAULT_COLOR = "#e6edf3"
_RENDER_SCALE = 2  # render at 2x for crisp HiDPI downscaling

# Color provider installed by main(); a light gray until then.
_color_provider: Callable[[], str] = lambda: _DEFAULT_COLOR

# Caches: rendered icons by (name, color, size) and raw SVG text by name.
_icon_cache: dict[tuple[str, str, int], QIcon] = {}
_svg_cache: dict[str, str] = {}
# Live targets to recolor on theme change: (widget/action, name, size).
_targets: list[tuple[object, str, int]] = []


def install(color_provider: Callable[[], str]) -> None:
    """Set the callable returning the current icon color (a theme token)."""
    global _color_provider
    _color_provider = color_provider
    refresh()


def _svg_text(name: str) -> str:
    """Return the raw SVG markup for ``name`` (cached after first read)."""
    cached = _svg_cache.get(name)
    if cached is None:
        cached = (_ICON_DIR / f"{name}.svg").read_text(encoding="utf-8")
        _svg_cache[name] = cached
    return cached


def icon(name: str, color: str | None = None, size: int = 18) -> QIcon:
    """Return a themed ``QIcon`` for ``name`` recolored to ``color``.

    ``color`` defaults to the installed provider's current color. Unknown names
    degrade to an empty ``QIcon`` rather than raising.
    """
    hexcolor = color or _color_provider()
    key = (name, hexcolor, size)
    cached = _icon_cache.get(key)
    if cached is not None:
        return cached
    try:
        svg = _svg_text(name).replace("currentColor", hexcolor)
    except OSError:
        return QIcon()
    renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
    dim = size * _RENDER_SCALE
    pix = QPixmap(dim, dim)
    pix.fill(Qt.transparent)
    painter = QPainter(pix)
    # Render across the FULL pixmap rect; without explicit bounds QSvgRenderer
    # fills only the (half-size) logical viewport when a devicePixelRatio is set,
    # which clipped icons to their top-left quarter. Set the ratio AFTER painting.
    renderer.render(painter, QRectF(0, 0, dim, dim))
    painter.end()
    pix.setDevicePixelRatio(float(_RENDER_SCALE))
    result = QIcon(pix)
    _icon_cache[key] = result
    return result


def apply(target: object, name: str, size: int = 18) -> object:
    """Set a themed icon on ``target`` and register it for re-coloring.

    ``target`` is any object exposing ``setIcon`` (``QAbstractButton`` or
    ``QAction``). Returns ``target`` for convenient chaining.
    """
    target.setIcon(icon(name, None, size))  # type: ignore[attr-defined]
    _targets.append((target, name, size))
    return target


def refresh() -> None:
    """Re-color every registered icon to the current theme (drops dead refs)."""
    alive: list[tuple[object, str, int]] = []
    for target, name, size in _targets:
        try:
            target.setIcon(icon(name, None, size))  # type: ignore[attr-defined]
        except RuntimeError:
            continue  # underlying C++ object was deleted
        alive.append((target, name, size))
    _targets[:] = alive
