"""Herramienta Match & Replace (nativa) sobre la extensión `match_replace`.

La extensión corre dentro de mitmproxy y reescribe URL/headers/body en
requests/responses según una lista de reglas. Este panel edita esa lista y la
persiste con `PUT /api/extensions/match_replace` enviando el config PLANO completo
`{enabled, rules}` (el backend REEMPLAZA el config, no hace merge). Cada regla:

    {enabled, when(request|response|both), target(url|headers|body),
     pattern, replace, regex, ignore_case, header}

`ignore_case` solo surte efecto con `regex=True`; `header` solo aplica si
`target=="headers"` (vacío => todos los headers).
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLineEdit,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ._sorting import make_sortable, populating

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

_WHEN = ["request", "response", "both"]
_TARGET = ["url", "headers", "body"]
_COLUMNS = ["Activa", "Cuándo", "Objetivo", "Patrón", "Reemplazo", "Regex", "Header"]


class MatchReplacePanel(QWidget):
    """Edita y persiste las reglas de Match & Replace (estilo Burp)."""

    status_text = Signal(str)

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._rules: list[dict[str, Any]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        # -- interruptor global de la extensión ----------------------------- #
        top = QHBoxLayout()
        self._enabled = QCheckBox("Match && Replace activo")
        self._enabled.toggled.connect(self._on_enabled_toggled)
        top.addWidget(self._enabled)
        top.addStretch(1)
        layout.addLayout(top)

        # -- alta de regla -------------------------------------------------- #
        form = QFormLayout()
        self._when = QComboBox(); self._when.addItems(_WHEN)
        self._target = QComboBox(); self._target.addItems(_TARGET)
        self._target.currentTextChanged.connect(self._on_target_changed)
        self._header = QLineEdit()
        self._header.setPlaceholderText("(si objetivo=headers; vacío = todos)")
        self._header.setEnabled(False)
        self._pattern = QLineEdit()
        self._pattern.setPlaceholderText("texto o regex a buscar")
        self._replace = QLineEdit()
        self._replace.setPlaceholderText("reemplazo")
        self._regex = QCheckBox("Regex")
        self._ignore_case = QCheckBox("Ignorar mayúsculas (solo regex)")
        flags = QHBoxLayout()
        flags.addWidget(self._regex)
        flags.addWidget(self._ignore_case)
        flags.addStretch(1)

        form.addRow("Cuándo", self._when)
        form.addRow("Objetivo", self._target)
        form.addRow("Header", self._header)
        form.addRow("Patrón", self._pattern)
        form.addRow("Reemplazo", self._replace)
        form.addRow("", flags)

        add_row = QHBoxLayout()
        add_btn = QPushButton("Añadir regla")
        add_btn.setObjectName("AccentButton")
        add_btn.clicked.connect(self._add_rule)
        add_row.addStretch(1)
        add_row.addWidget(add_btn)

        rule_box = QGroupBox("Nueva regla")
        rule_box_lay = QVBoxLayout(rule_box)
        rule_box_lay.addLayout(form)
        rule_box_lay.addLayout(add_row)
        layout.addWidget(rule_box)

        # -- tabla de reglas ------------------------------------------------ #
        self._table = QTableWidget(0, len(_COLUMNS))
        self._table.setHorizontalHeaderLabels(_COLUMNS)
        make_sortable(self._table)  # orden por clic en cabecera / click-sort
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.verticalHeader().setVisible(False)
        self._table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(4, QHeaderView.Stretch)
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
        self._run(lambda: self._api.extension_get("match_replace"), self._on_ext)

    def _on_ext(self, ext: dict[str, Any] | None) -> None:
        config = (ext or {}).get("config") or {}
        self._rules = list(config.get("rules", []))
        self._enabled.blockSignals(True)
        self._enabled.setChecked(bool(config.get("enabled")))
        self._enabled.blockSignals(False)
        self._refresh_table()

    def _refresh_table(self) -> None:
        with populating(self._table):
            self._table.setRowCount(len(self._rules))
            for r, rule in enumerate(self._rules):
                cells = [
                    "sí" if rule.get("enabled", True) else "no",
                    rule.get("when", "request"),
                    rule.get("target", "url"),
                    rule.get("pattern", ""),
                    rule.get("replace", ""),
                    "sí" if rule.get("regex") else "no",
                    rule.get("header", "") if rule.get("target") == "headers" else "",
                ]
                for c, text in enumerate(cells):
                    item = QTableWidgetItem(text)
                    item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                    if c == 0:
                        # Índice estable en self._rules / stable rules index.
                        item.setData(Qt.UserRole, r)
                    self._table.setItem(r, c, item)

    # -- persistencia (PUT reemplaza el config entero) ---------------------- #
    def _persist(self) -> None:
        config = {"enabled": self._enabled.isChecked(), "rules": self._rules}
        self._run(
            lambda: self._api.extension_update_config("match_replace", config),
            self._on_saved,
        )

    def _on_saved(self, result: dict[str, Any]) -> None:
        if isinstance(result, dict) and result.get("error"):
            self.status_text.emit(f"Match & Replace: {result['error']}")
            return
        self.status_text.emit(
            f"Match & Replace: {len(self._rules)} regla(s) guardadas"
        )

    # -- interacción -------------------------------------------------------- #
    def _on_target_changed(self, target: str) -> None:
        self._header.setEnabled(target == "headers")

    def _on_enabled_toggled(self, _checked: bool) -> None:
        self._persist()

    def _add_rule(self) -> None:
        pattern = self._pattern.text()
        if not pattern:
            self.status_text.emit("El patrón no puede estar vacío")
            return
        rule = {
            "enabled": True,
            "when": self._when.currentText(),
            "target": self._target.currentText(),
            "pattern": pattern,
            "replace": self._replace.text(),
            "regex": self._regex.isChecked(),
            "ignore_case": self._ignore_case.isChecked(),
            "header": self._header.text().strip(),
        }
        self._rules.append(rule)
        self._pattern.clear()
        self._replace.clear()
        self._refresh_table()
        self._persist()

    def _selected_index(self) -> int:
        # Resuelve el índice original (UserRole) de la fila seleccionada, porque
        # el orden visual puede diferir del de self._rules tras ordenar.
        row = self._table.currentRow()
        if row < 0:
            return -1
        item = self._table.item(row, 0)
        idx = item.data(Qt.UserRole) if item is not None else None
        if isinstance(idx, int) and 0 <= idx < len(self._rules):
            return idx
        return -1

    def _toggle_selected(self) -> None:
        idx = self._selected_index()
        if idx < 0:
            return
        self._rules[idx]["enabled"] = not self._rules[idx].get("enabled", True)
        self._refresh_table()
        self._table.selectRow(idx)
        self._persist()

    def _delete_selected(self) -> None:
        idx = self._selected_index()
        if idx < 0:
            return
        del self._rules[idx]
        self._refresh_table()
        self._persist()
