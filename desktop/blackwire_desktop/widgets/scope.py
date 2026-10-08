"""Panel de Scope (Fase 2): reglas include/exclude de host/URL.

Lista las reglas (`GET /api/scope`) y permite añadir/eliminar/alternar. Cambiar el
scope reclasifica el historial en el backend de forma retroactiva, así que tras
cada mutación se emite `scope_changed` para que el shell vuelva a buscar.

La red se delega al `runner` del shell (QThreadPool) para no congelar la UI.
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QHBoxLayout,
    QHeaderView,
    QLineEdit,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]


class ScopePanel(QWidget):
    """Gestión de reglas de scope."""

    scope_changed = Signal()

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._rules: list[dict[str, Any]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        # -- alta de regla -------------------------------------------------- #
        add_row = QHBoxLayout()
        self._pattern = QLineEdit()
        self._pattern.setPlaceholderText("patrón (host o URL, admite * y regex)")
        self._pattern.returnPressed.connect(self._add_rule)
        self._type = QComboBox()
        self._type.addItems(["include", "exclude"])
        add_btn = QPushButton("Añadir")
        add_btn.clicked.connect(self._add_rule)
        add_row.addWidget(self._pattern, 1)
        add_row.addWidget(self._type)
        add_row.addWidget(add_btn)
        layout.addLayout(add_row)

        # -- tabla de reglas ------------------------------------------------ #
        self._table = QTableWidget(0, 3)
        self._table.setHorizontalHeaderLabels(["Patrón", "Tipo", "Activa"])
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.verticalHeader().setVisible(False)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(
            1, QHeaderView.ResizeToContents
        )
        self._table.horizontalHeader().setSectionResizeMode(
            2, QHeaderView.ResizeToContents
        )
        self._table.cellDoubleClicked.connect(lambda _r, _c: self._toggle_selected())
        layout.addWidget(self._table, 1)

        # -- acciones ------------------------------------------------------- #
        btn_row = QHBoxLayout()
        toggle_btn = QPushButton("Activar/Desactivar")
        toggle_btn.clicked.connect(self._toggle_selected)
        remove_btn = QPushButton("Eliminar")
        remove_btn.clicked.connect(self._remove_selected)
        reload_btn = QPushButton("Recargar")
        reload_btn.clicked.connect(self.reload)
        btn_row.addWidget(toggle_btn)
        btn_row.addWidget(remove_btn)
        btn_row.addStretch(1)
        btn_row.addWidget(reload_btn)
        layout.addLayout(btn_row)

    # -- carga -------------------------------------------------------------- #
    def reload(self) -> None:
        self._run(self._api.get_scope, self._on_rules)

    def _on_rules(self, rules: list[dict[str, Any]]) -> None:
        self._rules = rules or []
        self._table.setRowCount(len(self._rules))
        for r, rule in enumerate(self._rules):
            self._set_cell(r, 0, rule.get("pattern", ""))
            self._set_cell(r, 1, rule.get("rule_type", ""))
            self._set_cell(r, 2, "sí" if rule.get("enabled", True) else "no")

    def _set_cell(self, row: int, col: int, text: str) -> None:
        item = QTableWidgetItem(text)
        item.setFlags(item.flags() & ~Qt.ItemIsEditable)
        self._table.setItem(row, col, item)

    def _selected_rule(self) -> dict[str, Any] | None:
        row = self._table.currentRow()
        return self._rules[row] if 0 <= row < len(self._rules) else None

    # -- mutaciones (vía runner, luego recarga + avisa) --------------------- #
    def _after_mutation(self, _result: Any) -> None:
        self.scope_changed.emit()
        self.reload()

    def _add_rule(self) -> None:
        pattern = self._pattern.text().strip()
        if not pattern:
            return
        rule_type = self._type.currentText()
        self._pattern.clear()
        self._run(
            lambda: self._api.add_scope_rule(pattern, rule_type), self._after_mutation
        )

    def _remove_selected(self) -> None:
        rule = self._selected_rule()
        if rule is None:
            return
        rid = rule.get("id")
        self._run(lambda: self._api.delete_scope_rule(rid), self._after_mutation)

    def _toggle_selected(self) -> None:
        rule = self._selected_rule()
        if rule is None:
            return
        rid = rule.get("id")
        self._run(lambda: self._api.toggle_scope_rule(rid), self._after_mutation)
