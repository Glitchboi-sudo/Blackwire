"""Panel de Session rules (Fase 5): extracción de variables por regex.

En Blackwire las "session rules" capturan un grupo de una regex sobre el tráfico
proxied (request/response) a una variable con nombre — no son reglas de
match/replace. Este panel lista, crea, activa/desactiva y elimina reglas vía
`/api/session/rules`. La red se delega al `runner` del shell.
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLineEdit,
    QPushButton,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

_WHEN = ["request", "response"]
_TARGET = ["body", "url", "headers", "header"]
_COLUMNS = ["Nombre", "Cuándo", "Objetivo", "Regex", "Grupo", "Variable", "Activa"]


class SessionPanel(QWidget):
    """Gestión de reglas de extracción por regex."""

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._rules: list[dict[str, Any]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        # -- alta de regla -------------------------------------------------- #
        form = QFormLayout()
        self._name = QLineEdit()
        self._when = QComboBox(); self._when.addItems(_WHEN)
        self._target = QComboBox(); self._target.setEditable(True)
        self._target.addItems(_TARGET)
        self._header = QLineEdit(); self._header.setPlaceholderText("(si objetivo=header)")
        self._regex = QLineEdit(); self._regex.setPlaceholderText(r'token"\s*:\s*"([^"]+)"')
        self._group = QSpinBox(); self._group.setRange(0, 20); self._group.setValue(1)
        self._variable = QLineEdit()
        form.addRow("Nombre", self._name)
        form.addRow("Cuándo", self._when)
        form.addRow("Objetivo", self._target)
        form.addRow("Header", self._header)
        form.addRow("Regex", self._regex)
        form.addRow("Grupo", self._group)
        form.addRow("Variable", self._variable)

        add_row = QHBoxLayout()
        add_btn = QPushButton("Añadir regla")
        add_btn.setObjectName("AccentButton")
        add_btn.clicked.connect(self._add_rule)
        add_row.addStretch(1)
        add_row.addWidget(add_btn)

        rule_box = QGroupBox("Nueva regla de extracción")
        rule_box_lay = QVBoxLayout(rule_box)
        rule_box_lay.addLayout(form)
        rule_box_lay.addLayout(add_row)
        layout.addWidget(rule_box)

        # -- tabla de reglas ------------------------------------------------ #
        self._table = QTableWidget(0, len(_COLUMNS))
        self._table.setHorizontalHeaderLabels(_COLUMNS)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.verticalHeader().setVisible(False)
        self._table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self._table.cellDoubleClicked.connect(lambda _r, _c: self._toggle_selected())
        layout.addWidget(self._table, 1)

        # -- acciones ------------------------------------------------------- #
        btns = QHBoxLayout()
        toggle_btn = QPushButton("Activar/Desactivar")
        toggle_btn.clicked.connect(self._toggle_selected)
        del_btn = QPushButton("Eliminar")
        del_btn.setObjectName("DangerButton")
        del_btn.clicked.connect(self._delete_selected)
        reload_btn = QPushButton("Recargar")
        reload_btn.clicked.connect(self.reload)
        btns.addWidget(toggle_btn)
        btns.addWidget(del_btn)
        btns.addStretch(1)
        btns.addWidget(reload_btn)
        layout.addLayout(btns)

    # -- carga -------------------------------------------------------------- #
    def reload(self) -> None:
        self._run(self._api.session_rules, self._on_rules)

    def _on_rules(self, rules: list[dict[str, Any]]) -> None:
        self._rules = rules or []
        self._table.setRowCount(len(self._rules))
        for r, rule in enumerate(self._rules):
            cells = [
                rule.get("name", ""), rule.get("when", ""), rule.get("target", ""),
                rule.get("regex", ""), str(rule.get("group", 1)),
                rule.get("variable", ""), "sí" if rule.get("enabled", True) else "no",
            ]
            for c, text in enumerate(cells):
                item = QTableWidgetItem(text)
                item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                self._table.setItem(r, c, item)

    def _selected_rule(self) -> dict[str, Any] | None:
        row = self._table.currentRow()
        return self._rules[row] if 0 <= row < len(self._rules) else None

    # -- mutaciones --------------------------------------------------------- #
    def _after_mutation(self, _result: Any) -> None:
        self.reload()

    def _add_rule(self) -> None:
        name = self._name.text().strip()
        regex = self._regex.text()
        variable = self._variable.text().strip()
        if not (name and regex and variable):
            return
        rule = {
            "name": name, "when": self._when.currentText(),
            "target": self._target.currentText(), "header": self._header.text().strip(),
            "regex": regex, "group": self._group.value(),
            "variable": variable, "enabled": True,
        }
        self._name.clear(); self._regex.clear(); self._variable.clear()
        self._header.clear()
        self._run(lambda: self._api.session_add_rule(rule), self._after_mutation)

    def _toggle_selected(self) -> None:
        rule = self._selected_rule()
        if rule is None:
            return
        rid = rule.get("id")
        new_enabled = not rule.get("enabled", True)
        self._run(lambda: self._api.session_update_rule(rid, {"enabled": new_enabled}),
                  self._after_mutation)

    def _delete_selected(self) -> None:
        rule = self._selected_rule()
        if rule is None:
            return
        rid = rule.get("id")
        self._run(lambda: self._api.session_delete_rule(rid), self._after_mutation)
