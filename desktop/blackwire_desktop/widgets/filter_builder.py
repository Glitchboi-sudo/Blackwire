"""Constructor visual de HTTPQL (Fase alta de paridad).

Diálogo campo/operador/valor que arma una consulta HTTPQL válida sin escribir el
texto a mano. Reutiliza los catálogos de campos/operadores de `..httpql` para que
el resultado se parsee exactamente igual que una consulta escrita manualmente, y
muestra una vista previa en vivo validada con `httpql_parse`.
"""

from __future__ import annotations

import re

from . import icons

from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from ..httpql import (
    HTTPQL_BOOL_OPS,
    HTTPQL_NUM_OPS,
    HTTPQL_REQ_FIELDS,
    HTTPQL_RESP_FIELDS,
    HTTPQL_STR_OPS,
    httpql_parse,
)

# Campos como "ns.field" -> conjunto de operadores válidos (según tipo).
_NUM_FIELDS = {"port", "len", "code"}
_BOOL_FIELDS = {"tls"}


def _ops_for(field: str) -> list[str]:
    if field in _BOOL_FIELDS:
        return HTTPQL_BOOL_OPS
    if field in _NUM_FIELDS:
        return HTTPQL_NUM_OPS
    return HTTPQL_STR_OPS


def _field_catalog() -> list[str]:
    fields = [f"req.{f}" for f in HTTPQL_REQ_FIELDS]
    fields += [f"resp.{f}" for f in HTTPQL_RESP_FIELDS]
    return fields


_BARE_RE = re.compile(r"^[a-zA-Z0-9_.%*?\-/&+=@:]+$")


def _format_value(value: str) -> str:
    """Deja el valor crudo si es una 'palabra' HTTPQL; si no, lo entrecomilla."""
    if value and _BARE_RE.match(value):
        return value
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


class _ConditionRow(QWidget):
    """Una fila: campo + operador + valor + botón de borrado."""

    def __init__(self, on_change, on_remove) -> None:
        super().__init__()
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.field = QComboBox()
        self.field.addItems(_field_catalog())
        self.field.currentTextChanged.connect(self._refresh_ops)

        self.op = QComboBox()
        self.value = QLineEdit()
        self.value.setPlaceholderText("valor")

        remove = QPushButton()
        remove.setToolTip("Quitar")
        icons.apply(remove, "x", 14)
        remove.setFixedWidth(28)
        remove.setToolTip("Quitar condición")
        remove.setAccessibleName("Quitar condición")
        remove.clicked.connect(lambda: on_remove(self))

        layout.addWidget(self.field, 2)
        layout.addWidget(self.op, 1)
        layout.addWidget(self.value, 3)
        layout.addWidget(remove)

        self._refresh_ops()
        self.field.currentTextChanged.connect(lambda _t: on_change())
        self.op.currentTextChanged.connect(lambda _t: on_change())
        self.value.textChanged.connect(lambda _t: on_change())

    def _refresh_ops(self) -> None:
        field = self.field.currentText().split(".", 1)[-1]
        current = self.op.currentText()
        self.op.clear()
        self.op.addItems(_ops_for(field))
        idx = self.op.findText(current)
        if idx >= 0:
            self.op.setCurrentIndex(idx)

    def to_clause(self) -> str | None:
        value = self.value.text().strip()
        if not value:
            return None
        return f"{self.field.currentText()}.{self.op.currentText()}:" \
               f"{_format_value(value)}"


class FilterBuilderDialog(QDialog):
    """Arma una consulta HTTPQL combinando condiciones con AND/OR."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Constructor de filtro HTTPQL")
        self.setMinimumWidth(460)
        self._rows: list[_ConditionRow] = []

        layout = QVBoxLayout(self)

        # Combinador global AND/OR (simple y predecible).
        join_row = QHBoxLayout()
        join_row.addWidget(QLabel("Combinar con:"))
        self.join = QComboBox()
        self.join.addItems(["AND", "OR"])
        self.join.currentTextChanged.connect(self._update_preview)
        join_row.addWidget(self.join)
        join_row.addStretch(1)
        add_btn = QPushButton("Condición")
        icons.apply(add_btn, "plus", 14)
        add_btn.clicked.connect(lambda: self._add_row())
        join_row.addWidget(add_btn)
        layout.addLayout(join_row)

        # Zona de condiciones (desplazable).
        self._rows_host = QWidget()
        self._rows_lay = QVBoxLayout(self._rows_host)
        self._rows_lay.setContentsMargins(0, 0, 0, 0)
        self._rows_lay.addStretch(1)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self._rows_host)
        layout.addWidget(scroll, 1)

        layout.addWidget(QLabel("Vista previa:"))
        self.preview = QLineEdit()
        self.preview.setReadOnly(True)
        layout.addWidget(self.preview)
        self._error = QLabel("")
        self._error.setObjectName("FilterError")
        self._error.setVisible(False)
        layout.addWidget(self._error)

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        self._ok_btn = buttons.button(QDialogButtonBox.Ok)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

        self._add_row()
        self._update_preview()

    def _add_row(self) -> None:
        row = _ConditionRow(self._update_preview, self._remove_row)
        self._rows.append(row)
        self._rows_lay.insertWidget(self._rows_lay.count() - 1, row)
        self._update_preview()

    def _remove_row(self, row: _ConditionRow) -> None:
        if row not in self._rows:
            return
        self._rows.remove(row)
        row.setParent(None)
        row.deleteLater()
        self._update_preview()

    def build_query(self) -> str:
        clauses = [c for c in (r.to_clause() for r in self._rows) if c]
        return f" {self.join.currentText()} ".join(clauses)

    def _update_preview(self) -> None:
        query = self.build_query()
        self.preview.setText(query)
        _ast, err = httpql_parse(query)
        if err:
            self._error.setText(f"HTTPQL: {err}")
            self._error.setVisible(True)
            self._ok_btn.setEnabled(False)
        else:
            self._error.clear()
            self._error.setVisible(False)
            self._ok_btn.setEnabled(bool(query))
