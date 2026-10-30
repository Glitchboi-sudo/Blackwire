"""Proxy Bypass: sitios que NO deben pasar por mitmproxy (cert pinning, etc.).

Las reglas alimentan `--ignore-hosts` de mitmdump al arrancar el proxy. Gestiona
reglas `{id, pattern, is_regex, description, enabled}` vía `/api/bypass/rules` y
permite aplicar presets predefinidos (`/api/bypass/presets`).

Nota: las reglas se aplican al (re)arrancar el proxy, no en caliente.
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

_COLUMNS = ["Patrón", "Regex", "Descripción", "Activa"]


class BypassPanel(QWidget):
    """Gestión de reglas de bypass + presets."""

    status_text = Signal(str)

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._rules: list[dict[str, Any]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        layout.addWidget(QLabel(
            "Hosts que se saltan la interceptación MITM (ej. sitios con cert pinning). "
            "Se aplican al (re)arrancar el proxy."
        ))

        # -- alta de regla -------------------------------------------------- #
        add = QHBoxLayout()
        self._pattern = QLineEdit()
        self._pattern.setPlaceholderText("patrón de host (ej. .*\\.apple\\.com)")
        self._is_regex = QCheckBox("Regex")
        self._desc = QLineEdit()
        self._desc.setPlaceholderText("descripción (opcional)")
        add_btn = QPushButton("Añadir")
        add_btn.setObjectName("AccentButton")
        add_btn.clicked.connect(self._add_rule)
        add.addWidget(self._pattern, 2)
        add.addWidget(self._is_regex)
        add.addWidget(self._desc, 1)
        add.addWidget(add_btn)

        # -- presets -------------------------------------------------------- #
        preset_row = QHBoxLayout()
        preset_row.addWidget(QLabel("Preset:"))
        self._presets = QComboBox()
        apply_btn = QPushButton("Aplicar preset")
        apply_btn.clicked.connect(self._apply_preset)
        preset_row.addWidget(self._presets, 1)
        preset_row.addWidget(apply_btn)

        add_box = QGroupBox("Nueva regla / presets")
        add_box_lay = QVBoxLayout(add_box)
        add_box_lay.addLayout(add)
        add_box_lay.addLayout(preset_row)
        layout.addWidget(add_box)

        # -- tabla ---------------------------------------------------------- #
        self._table = QTableWidget(0, len(_COLUMNS))
        self._table.setHorizontalHeaderLabels(_COLUMNS)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.verticalHeader().setVisible(False)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
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
        self._run(self._api.bypass_rules, self._on_rules)
        self._run(self._api.bypass_presets, self._on_presets)

    def _on_rules(self, rules: list[dict[str, Any]]) -> None:
        self._rules = rules or []
        self._table.setRowCount(len(self._rules))
        for r, rule in enumerate(self._rules):
            cells = [
                rule.get("pattern", ""),
                "sí" if rule.get("is_regex") else "no",
                rule.get("description", ""),
                "sí" if rule.get("enabled", True) else "no",
            ]
            for c, text in enumerate(cells):
                item = QTableWidgetItem(text)
                item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                self._table.setItem(r, c, item)

    def _on_presets(self, presets: dict[str, Any]) -> None:
        self._presets.clear()
        for name in sorted(presets or {}):
            self._presets.addItem(name)

    def _selected_rule(self) -> dict[str, Any] | None:
        row = self._table.currentRow()
        return self._rules[row] if 0 <= row < len(self._rules) else None

    def _after(self, _result: Any) -> None:
        self.reload()

    # -- mutaciones --------------------------------------------------------- #
    def _add_rule(self) -> None:
        pattern = self._pattern.text().strip()
        if not pattern:
            self.status_text.emit("El patrón no puede estar vacío")
            return
        self._run(
            lambda: self._api.bypass_add_rule(
                pattern, self._is_regex.isChecked(), self._desc.text().strip()
            ),
            self._on_added,
        )

    def _on_added(self, result: dict[str, Any]) -> None:
        if isinstance(result, dict) and result.get("error"):
            self.status_text.emit(f"Bypass: {result['error']}")
            return
        self._pattern.clear()
        self._desc.clear()
        self._is_regex.setChecked(False)
        self.status_text.emit("Regla de bypass añadida")
        self.reload()

    def _apply_preset(self) -> None:
        name = self._presets.currentText()
        if not name:
            return
        self._run(lambda: self._api.bypass_apply_preset(name), self._on_preset_applied)

    def _on_preset_applied(self, result: dict[str, Any]) -> None:
        added = result.get("added", "?") if isinstance(result, dict) else "?"
        self.status_text.emit(f"Preset aplicado ({added} reglas nuevas)")
        self.reload()

    def _toggle_selected(self) -> None:
        rule = self._selected_rule()
        if rule is None:
            return
        self._run(lambda: self._api.bypass_toggle_rule(rule.get("id")), self._after)

    def _delete_selected(self) -> None:
        rule = self._selected_rule()
        if rule is None:
            return
        self._run(lambda: self._api.bypass_delete_rule(rule.get("id")), self._after)
