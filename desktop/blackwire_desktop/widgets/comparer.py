"""Panel de Comparer (Fase 3): diff LCS lado a lado entre dos textos.

Replica el Comparer web (`ComparePanel.jsx`): dos buffers A y B (editables o
rellenados desde el request/respuesta actual) y un diff por líneas calculado con
LCS (`diff.diff_lines`). El lado A resalta las líneas eliminadas; el lado B, las
añadidas. Todo texto plano (regla de seguridad).
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import (
    QAbstractItemView,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QPlainTextEdit,
    QPushButton,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .. import themes
from ..diff import diff_lines

_REMOVED_BG = QColor(248, 81, 73, 60)   # rojo translúcido (lado A)
_ADDED_BG = QColor(63, 185, 80, 60)     # verde translúcido (lado B)


class ComparerPanel(QWidget):
    """Dos entradas (A/B) + diff por líneas lado a lado."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        # -- entradas A / B ------------------------------------------------- #
        inputs = QSplitter(Qt.Horizontal)
        self._a_label = QLabel("A")
        self._b_label = QLabel("B")
        self._a_label.setObjectName("ReqLabel")
        self._b_label.setObjectName("RespLabel")
        self._a = self._mono()
        self._b = self._mono()
        inputs.addWidget(self._titled(self._a_label, self._a))
        inputs.addWidget(self._titled(self._b_label, self._b))
        inputs.setSizes([500, 500])
        layout.addWidget(inputs, 1)

        # -- acciones ------------------------------------------------------- #
        actions = QHBoxLayout()
        compare_btn = QPushButton("Comparar")
        compare_btn.setObjectName("AccentButton")
        compare_btn.clicked.connect(self.compare)
        clear_btn = QPushButton("Limpiar")
        clear_btn.clicked.connect(self._clear)
        self._summary = QLabel("")
        actions.addWidget(compare_btn)
        actions.addWidget(clear_btn)
        actions.addStretch(1)
        actions.addWidget(self._summary)
        layout.addLayout(actions)

        # -- diff ----------------------------------------------------------- #
        self._diff = QTableWidget(0, 2)
        self._diff.setHorizontalHeaderLabels(["A", "B"])
        self._diff.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self._diff.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self._diff.verticalHeader().setVisible(False)
        self._diff.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._diff.setSelectionMode(QAbstractItemView.NoSelection)
        self._diff.setShowGrid(False)
        self._diff.setFont(QFont(themes.MONO_FAMILY, 10))
        layout.addWidget(self._diff, 2)

    # -- construcción ------------------------------------------------------- #
    def _mono(self) -> QPlainTextEdit:
        ed = QPlainTextEdit()
        ed.setLineWrapMode(QPlainTextEdit.NoWrap)
        ed.setFont(QFont(themes.MONO_FAMILY, 10))
        return ed

    def _titled(self, label: QLabel, inner: QWidget) -> QWidget:
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(label)
        lay.addWidget(inner)
        return box

    # -- API pública -------------------------------------------------------- #
    def set_a(self, text: str, label: str = "A") -> None:
        self._a.setPlainText(text)
        self._a_label.setText(f"A — {label}")

    def set_b(self, text: str, label: str = "B") -> None:
        self._b.setPlainText(text)
        self._b_label.setText(f"B — {label}")

    def compare(self) -> None:
        entries = diff_lines(self._a.toPlainText(), self._b.toPlainText())
        self._diff.setRowCount(len(entries))
        added = removed = 0
        for row, entry in enumerate(entries):
            etype = entry["type"]
            a_text = "" if etype == "added" else (entry.get("lineA") or "")
            b_text = "" if etype == "removed" else (entry.get("lineB") or "")
            a_item = QTableWidgetItem(a_text)
            b_item = QTableWidgetItem(b_text)
            if etype == "removed":
                a_item.setBackground(_REMOVED_BG)
                removed += 1
            elif etype == "added":
                b_item.setBackground(_ADDED_BG)
                added += 1
            self._diff.setItem(row, 0, a_item)
            self._diff.setItem(row, 1, b_item)
        self._summary.setText(f"{added} añadidas · {removed} eliminadas")

    # -- helpers ------------------------------------------------------------ #
    def _clear(self) -> None:
        self._a.clear()
        self._b.clear()
        self._diff.setRowCount(0)
        self._summary.clear()
        self._a_label.setText("A")
        self._b_label.setText("B")
