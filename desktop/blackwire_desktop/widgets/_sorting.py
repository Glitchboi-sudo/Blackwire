"""Helpers de ordenamiento por cabecera para tablas (Fase 2+).

Unifica el patrón ya usado en Intruder/Asset Profile: celdas con orden numérico
real (no lexicográfico) y un guard para poblar la tabla sin que las filas
"salten" mientras se insertan con el ordenamiento activo.

Uso típico en un panel con `QTableWidget`:

    from ._sorting import make_sortable, numeric_item, populating
    ...
    make_sortable(self._table)           # tras crear/configurar la tabla
    ...
    with populating(self._table):        # al repoblar
        self._table.setRowCount(len(rows))
        for r, row in enumerate(rows):
            self._table.setItem(r, 0, numeric_item(row["id"]))   # columna numérica
            self._table.setItem(r, 1, QTableWidgetItem(row["x"]))  # columna texto
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QTableWidget, QTableWidgetItem


def _as_number(text: str) -> float | int | None:
    """Devuelve el valor numérico de `text`, o None si no es un número."""
    text = text.strip()
    if not text:
        return None
    try:
        value = float(text)
    except (ValueError, TypeError):
        return None
    return int(value) if value.is_integer() else value


def numeric_item(value: Any, *, read_only: bool = True) -> QTableWidgetItem:
    """Celda que ordena numéricamente si `value` es numérico; si no, por texto.

    Guarda un `int`/`float` en `DisplayRole` cuando procede para que Qt compare
    como número (1 < 2 < 10), no como cadena ("1" < "10" < "2").
    """
    item = QTableWidgetItem()
    text = "" if value is None else str(value)
    number = _as_number(text)
    item.setData(Qt.DisplayRole, number if number is not None else text)
    if read_only:
        item.setFlags(item.flags() & ~Qt.ItemIsEditable)
    return item


def make_sortable(table: QTableWidget) -> None:
    """Habilita ordenar al hacer clic en las cabeceras de la tabla."""
    table.setSortingEnabled(True)
    table.horizontalHeader().setSortIndicatorShown(True)


@contextmanager
def populating(table: QTableWidget) -> Iterator[None]:
    """Desactiva el ordenamiento mientras se puebla la tabla y lo restaura.

    Insertar filas con el ordenamiento activo hace que se reordenen en cada
    `setItem`, corrompiendo las filas a medio construir.
    """
    was_sorting = table.isSortingEnabled()
    table.setSortingEnabled(False)
    try:
        yield
    finally:
        table.setSortingEnabled(was_sorting)
