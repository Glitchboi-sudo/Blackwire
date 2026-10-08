"""Panel de HTTP History (Fase 2): filtro HTTPQL + tabla + Site Map.

Contiene el modelo virtualizado del historial y un panel compuesto con:
- barra de filtro HTTPQL (con error en línea cuando la consulta es inválida),
- pestaña "Requests" (tabla virtualizada),
- pestaña "Site Map" (árbol host -> path construido en el cliente).

No hace red: emite `search_requested(query)` y `request_selected(id)`; el shell
(`main.py`) resuelve la búsqueda contra el backend y repuebla las filas.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtCore import QAbstractTableModel, QModelIndex, Qt, Signal
from PySide6.QtGui import QAction, QColor
from PySide6.QtWidgets import (
    QAbstractItemView,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMenu,
    QTabWidget,
    QTableView,
    QToolButton,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ..sitemap import build_site_tree, collect_node_reqs


class HistoryModel(QAbstractTableModel):
    """Modelo virtualizado: QTableView no instancia widgets por fila."""

    COLUMNS = ("#", "Method", "Status", "URL")

    def __init__(self) -> None:
        super().__init__()
        self._rows: list[dict[str, Any]] = []
        self._status_colors: dict[int, str] = {}

    def set_status_colors(self, colors: dict[int, str]) -> None:
        self._status_colors = colors
        if self._rows:
            top = self.index(0, 2)
            bottom = self.index(len(self._rows) - 1, 2)
            self.dataChanged.emit(top, bottom, [Qt.ForegroundRole])

    def set_rows(self, rows: list[dict[str, Any]]) -> None:
        self.beginResetModel()
        self._rows = list(rows)
        self.endResetModel()

    def prepend_row(self, row: dict[str, Any]) -> None:
        self.beginInsertRows(QModelIndex(), 0, 0)
        self._rows.insert(0, row)
        self.endInsertRows()

    def rows(self) -> list[dict[str, Any]]:
        return self._rows

    def row_at(self, row: int) -> dict[str, Any] | None:
        return self._rows[row] if 0 <= row < len(self._rows) else None

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:
        return 0 if parent.isValid() else len(self._rows)

    def columnCount(self, parent: QModelIndex = QModelIndex()) -> int:
        return len(self.COLUMNS)

    def headerData(self, section, orientation, role=Qt.DisplayRole):
        if role == Qt.DisplayRole and orientation == Qt.Horizontal:
            return self.COLUMNS[section]
        return None

    def data(self, index: QModelIndex, role=Qt.DisplayRole):
        if not index.isValid():
            return None
        row = self._rows[index.row()]
        col = index.column()
        if role == Qt.DisplayRole:
            status = row.get("response_status")
            return (
                str(row.get("id", "")),
                row.get("method", ""),
                str(status) if status else "-",
                row.get("url", ""),
            )[col]
        if role == Qt.ForegroundRole and col == 2:
            status = row.get("response_status") or 0
            color = self._status_colors.get(status // 100)
            return QColor(color) if color else None
        return None


class HistoryPanel(QWidget):
    """Filtro HTTPQL + tabla de historial + Site Map."""

    search_requested = Signal(str)
    request_selected = Signal(int)
    context_action = Signal(str, int, str)  # (acción, request_id, url)
    preset_apply = Signal(str)              # aplicar la consulta de un preset
    preset_save = Signal()                  # guardar el filtro actual como preset
    preset_delete = Signal(int)             # eliminar un preset por id

    # Acciones del menú contextual: (id, etiqueta).
    _CTX_ACTIONS = (
        ("repeater", "Enviar al Repeater"),
        ("intruder", "Enviar al Intruder"),
        ("collection", "Añadir a Collection"),
        ("compare_a", "Comparar: fijar A"),
        ("compare_b", "Comparar: fijar B"),
        ("copy_url", "Copiar URL"),
        ("copy_curl", "Copiar como cURL"),
        ("sqlmap", "Descargar para SQLMap"),
        ("render", "Render en navegador"),
        ("replay", "Replay en navegador"),
        ("save", "Guardar / favorito"),
        ("delete", "Eliminar request"),
    )

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.model = HistoryModel()
        self._presets: list[dict[str, Any]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # -- barra de filtro HTTPQL (fila propia, a todo el ancho) ----------- #
        # Antes vivía apretado en el corner widget de las pestañas y se recortaba;
        # ahora es una barra dedicada estilo Burp, con el filtro expandible.
        self._filter = QLineEdit()
        self._filter.setObjectName("HttpqlFilter")
        self._filter.setPlaceholderText("HTTPQL…  req.method.eq:GET AND resp.code.gte:400")
        self._filter.setClearButtonEnabled(True)
        self._filter.returnPressed.connect(
            lambda: self.search_requested.emit(self._filter.text())
        )
        self._error = QLabel("")
        self._error.setObjectName("FilterError")
        self._error.setVisible(False)

        # Botón de Filter Presets (guardar/cargar/eliminar consultas HTTPQL).
        self._presets_btn = QToolButton()
        self._presets_btn.setText("Presets")
        self._presets_btn.setPopupMode(QToolButton.InstantPopup)
        self._presets_menu = QMenu(self._presets_btn)
        self._presets_btn.setMenu(self._presets_menu)
        self._rebuild_presets_menu()

        filter_bar = QWidget()
        bar_lay = QHBoxLayout(filter_bar)
        bar_lay.setContentsMargins(6, 4, 6, 4)
        bar_lay.setSpacing(6)
        bar_lay.addWidget(QLabel("Filtro:"))
        bar_lay.addWidget(self._filter, 1)
        bar_lay.addWidget(self._error)
        bar_lay.addWidget(self._presets_btn)
        layout.addWidget(filter_bar)

        # -- pestañas Requests / Site Map ----------------------------------- #
        self._tabs = QTabWidget()
        self._tabs.addTab(self._build_table(), "Requests")
        self._tabs.addTab(self._build_tree(), "Site Map")
        layout.addWidget(self._tabs, 1)

    # -- construcción ------------------------------------------------------- #
    def _build_table(self) -> QWidget:
        self.table = QTableView()
        self.table.setModel(self.model)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setShowGrid(False)
        hh = self.table.horizontalHeader()
        hh.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        hh.setSectionResizeMode(1, QHeaderView.ResizeToContents)
        hh.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        hh.setSectionResizeMode(3, QHeaderView.Stretch)
        self.table.selectionModel().currentRowChanged.connect(self._on_table_row)
        self.table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.table.customContextMenuRequested.connect(self._show_context_menu)
        return self.table

    # -- menú contextual del historial -------------------------------------- #
    def _show_context_menu(self, pos) -> None:
        index = self.table.indexAt(pos)
        if not index.isValid():
            return
        self.table.selectRow(index.row())
        row = self.model.row_at(index.row())
        if not row or row.get("id") is None:
            return
        rid = int(row["id"])
        url = row.get("url", "")
        menu = QMenu(self.table)
        for action_id, label in self._CTX_ACTIONS:
            act = QAction(label, menu)
            act.triggered.connect(
                lambda _c=False, a=action_id: self.context_action.emit(a, rid, url)
            )
            menu.addAction(act)
        menu.exec(self.table.viewport().mapToGlobal(pos))

    # -- Filter Presets ----------------------------------------------------- #
    def set_presets(self, presets: list[dict[str, Any]]) -> None:
        self._presets = presets or []
        self._rebuild_presets_menu()

    def _rebuild_presets_menu(self) -> None:
        self._presets_menu.clear()
        save_act = QAction("Guardar filtro actual…", self._presets_menu)
        save_act.triggered.connect(self.preset_save.emit)
        self._presets_menu.addAction(save_act)
        if self._presets:
            self._presets_menu.addSeparator()
        for preset in self._presets:
            name = preset.get("name", "?")
            query = preset.get("query", "")
            pid = preset.get("id")
            sub = self._presets_menu.addMenu(name)
            apply_act = QAction("Aplicar", sub)
            apply_act.triggered.connect(lambda _c=False, q=query: self._apply_preset(q))
            del_act = QAction("Eliminar", sub)
            del_act.triggered.connect(
                lambda _c=False, i=pid: self.preset_delete.emit(int(i))
            )
            sub.addAction(apply_act)
            sub.addAction(del_act)

    def _apply_preset(self, query: str) -> None:
        self._filter.setText(query)
        self.preset_apply.emit(query)

    def _build_tree(self) -> QWidget:
        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(["Host / Ruta", "#"])
        self.tree.setColumnWidth(0, 420)
        self.tree.setUniformRowHeights(True)
        self.tree.currentItemChanged.connect(self._on_tree_item)
        return self.tree

    # -- API pública -------------------------------------------------------- #
    def set_status_colors(self, colors: dict[int, str]) -> None:
        self.model.set_status_colors(colors)

    def set_rows(self, rows: list[dict[str, Any]]) -> None:
        self.model.set_rows(rows)
        self._rebuild_tree(rows)
        if rows:
            self.table.selectRow(0)

    def prepend_row(self, row: dict[str, Any]) -> None:
        keep = self.table.currentIndex().row()
        self.model.prepend_row(row)
        if keep >= 0:
            self.table.selectRow(keep + 1)
        # Reconstruir el árbol con el set actual (barato para historiales típicos).
        self._rebuild_tree(self.model.rows())

    def current_filter(self) -> str:
        return self._filter.text()

    def show_error(self, message: str) -> None:
        if message:
            self._error.setText(f"HTTPQL: {message}")
            self._error.setVisible(True)
        else:
            self._error.clear()
            self._error.setVisible(False)

    def focus_filter(self) -> None:
        self._filter.setFocus()
        self._filter.selectAll()

    # -- Site Map ----------------------------------------------------------- #
    def _rebuild_tree(self, rows: list[dict[str, Any]]) -> None:
        self.tree.clear()
        tree = build_site_tree(rows)
        for root_key in sorted(tree):
            node = tree[root_key]
            item = self._node_item(node)
            self.tree.addTopLevelItem(item)
        self.tree.setHeaderLabels([f"{len(tree)} hosts", "#"])

    def _node_item(self, node: dict[str, Any]) -> QTreeWidgetItem:
        item = QTreeWidgetItem([node["label"], str(node["count"])])
        # Guardar el id del request más reciente de este subárbol (si hay).
        reqs = collect_node_reqs(node)
        if reqs:
            rid = reqs[-1].get("id")
            if rid is not None:
                item.setData(0, Qt.UserRole, int(rid))
        for key in sorted(node["children"]):
            item.addChild(self._node_item(node["children"][key]))
        return item

    # -- señales internas --------------------------------------------------- #
    def _on_table_row(self, current: QModelIndex, _prev: QModelIndex) -> None:
        row = self.model.row_at(current.row())
        if row and row.get("id") is not None:
            self.request_selected.emit(int(row["id"]))

    def _on_tree_item(
        self, current: QTreeWidgetItem | None, _prev: QTreeWidgetItem | None
    ) -> None:
        if current is None:
            return
        rid = current.data(0, Qt.UserRole)
        if rid is not None:
            self.request_selected.emit(int(rid))
