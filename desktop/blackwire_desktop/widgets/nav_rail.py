"""Vertical navigation rail + page stack for the native shell (UI remaster).

Replaces the old top ``QTabWidget`` with a Burp-Pro-style left rail of
icon+label buttons driving a ``QStackedWidget``. It exposes the subset of the
``QTabWidget`` API the shell relies on (``addTab`` / ``count`` /
``currentIndex`` / ``setCurrentIndex`` / ``currentWidget`` /
``setCurrentWidget`` / ``indexOf`` / ``widget`` plus a ``currentChanged``
signal), so existing navigation code keeps working unchanged.

Rail items are grouped with lightweight section headers added via
``add_section``; headers and separators are purely visual and never consume a
page index, so button/stack indices stay aligned.
"""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QButtonGroup,
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSizePolicy,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from . import icons

_RAIL_WIDTH = 176
_ICON_SIZE = 17


class NavRail(QWidget):
    """Left icon+label rail driving a page stack (``QTabWidget`` drop-in)."""

    currentChanged = Signal(int)

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._buttons: list[QPushButton] = []
        self._group = QButtonGroup(self)
        self._group.setExclusive(True)

        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        self._rail = QWidget()
        self._rail.setObjectName("NavRail")
        self._rail.setFixedWidth(_RAIL_WIDTH)
        self._rail_lay = QVBoxLayout(self._rail)
        self._rail_lay.setContentsMargins(6, 8, 6, 8)
        self._rail_lay.setSpacing(2)

        self._stack = QStackedWidget()
        # Forward the stack's page changes as our own currentChanged(int).
        self._stack.currentChanged.connect(self.currentChanged)

        root.addWidget(self._rail)
        root.addWidget(self._stack, 1)

    # -- construction ------------------------------------------------------ #
    def add_section(self, title: str) -> None:
        """Add a visual group header (and a separator if not the first)."""
        if self._rail_lay.count():
            sep = QFrame()
            sep.setObjectName("NavSep")
            sep.setFrameShape(QFrame.HLine)
            self._rail_lay.addWidget(sep)
        label = QLabel(title.upper())
        label.setObjectName("NavSectionLabel")
        self._rail_lay.addWidget(label)

    def addTab(self, widget: QWidget, label: str, icon_name: str = "") -> int:
        """Add a page + its rail button. Returns the page index."""
        index = self._stack.addWidget(widget)
        btn = QPushButton(label)
        btn.setObjectName("NavItem")
        btn.setCheckable(True)
        btn.setToolTip(label)
        btn.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        if icon_name:
            icons.apply(btn, icon_name, _ICON_SIZE)
        btn.clicked.connect(lambda _checked=False, i=index: self.setCurrentIndex(i))
        self._group.addButton(btn, index)
        self._rail_lay.addWidget(btn)
        self._buttons.append(btn)
        if index == 0:
            btn.setChecked(True)
        return index

    def finish(self) -> None:
        """Push rail items to the top (call once after all tabs are added)."""
        self._rail_lay.addStretch(1)

    # -- QTabWidget-compatible API ----------------------------------------- #
    def count(self) -> int:
        return self._stack.count()

    def currentIndex(self) -> int:
        return self._stack.currentIndex()

    def currentWidget(self) -> QWidget | None:
        return self._stack.currentWidget()

    def setCurrentIndex(self, index: int) -> None:
        if 0 <= index < self._stack.count():
            self._stack.setCurrentIndex(index)
            self._buttons[index].setChecked(True)

    def setCurrentWidget(self, widget: QWidget) -> None:
        index = self._stack.indexOf(widget)
        if index >= 0:
            self.setCurrentIndex(index)

    def indexOf(self, widget: QWidget) -> int:
        return self._stack.indexOf(widget)

    def widget(self, index: int) -> QWidget | None:
        return self._stack.widget(index)
