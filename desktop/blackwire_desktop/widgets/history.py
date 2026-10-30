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
from . import icons
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QFileDialog,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMenu,
    QPlainTextEdit,
    QPushButton,
    QSplitter,
    QTabWidget,
    QTableView,
    QToolButton,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ..sitemap import (
    build_site_tree,
    collect_node_reqs,
    node_stats,
    node_to_csv,
    node_to_json,
)


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

    # Claves de orden por columna: # y Status ordenan numéricamente; Method y
    # URL, alfabéticamente (sin distinguir mayúsculas).
    _SORT_KEYS = {
        0: lambda r: r.get("id") or 0,
        1: lambda r: (r.get("method") or "").casefold(),
        2: lambda r: r.get("response_status") or 0,
        3: lambda r: (r.get("url") or "").casefold(),
    }

    def sort(self, column: int, order=Qt.AscendingOrder) -> None:
        key = self._SORT_KEYS.get(column)
        if key is None or not self._rows:
            return
        self.layoutAboutToBeChanged.emit()
        self._rows.sort(key=key, reverse=(order == Qt.DescendingOrder))
        self.layoutChanged.emit()

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
    clear_requested = Signal()              # limpiar el historial (conserva guardados)

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
        self._filter.setPlaceholderText(
            "HTTPQL…  resp.code eq 200 AND req.method eq GET"
            "   (o req.method.eq:GET)"
        )
        self._filter.setClearButtonEnabled(True)
        self._filter.returnPressed.connect(
            lambda: self.search_requested.emit(self._filter.text())
        )
        self._error = QLabel("")
        self._error.setObjectName("FilterError")
        self._error.setVisible(False)

        # Botón del constructor visual de HTTPQL (campo/operador/valor).
        self._builder_btn = QToolButton()
        icons.apply(self._builder_btn, "wrench", 15)
        self._builder_btn.setToolTip("Constructor visual de filtro HTTPQL")
        self._builder_btn.setAccessibleName("Abrir constructor de filtro")
        self._builder_btn.clicked.connect(self._open_builder)

        # Botón de Filter Presets (guardar/cargar/eliminar consultas HTTPQL).
        self._presets_btn = QToolButton()
        self._presets_btn.setText("Presets")
        self._presets_btn.setPopupMode(QToolButton.InstantPopup)
        self._presets_menu = QMenu(self._presets_btn)
        self._presets_btn.setMenu(self._presets_menu)
        self._rebuild_presets_menu()

        # Botón "Limpiar": vacía el historial no guardado (DELETE /api/requests).
        self._clear_btn = QToolButton()
        self._clear_btn.setText("Limpiar")
        self._clear_btn.setToolTip("Vaciar el historial (conserva los guardados)")
        self._clear_btn.setAccessibleName("Limpiar historial")
        self._clear_btn.clicked.connect(self.clear_requested.emit)

        filter_bar = QWidget()
        bar_lay = QHBoxLayout(filter_bar)
        bar_lay.setContentsMargins(6, 4, 6, 4)
        bar_lay.setSpacing(6)
        bar_lay.addWidget(QLabel("Filtro:"))
        bar_lay.addWidget(self._filter, 1)
        bar_lay.addWidget(self._error)
        bar_lay.addWidget(self._builder_btn)
        bar_lay.addWidget(self._presets_btn)
        bar_lay.addWidget(self._clear_btn)
        bar_lay.addWidget(QLabel("Mostrar:"))
        self._page_size = QComboBox()
        # Etiquetas autoexplicativas: deja claro que es el máximo de requests
        # (las más recientes) que se cargan y se ven en la tabla. El valor real
        # (el LIMIT) va en itemData, no en el texto.
        for label, value in (
            ("Últimas 100", 100),
            ("Últimas 300", 300),
            ("Últimas 500", 500),
            ("Últimas 1000", 1000),
            ("Últimas 5000", 5000),
            ("Todas", self.PAGE_SIZE_ALL),
        ):
            self._page_size.addItem(label, value)
        self._page_size.setCurrentText("Últimas 1000")
        self._page_size.setToolTip(
            "Máximo de requests (las más recientes) que se cargan y se muestran\n"
            "en la tabla. No afecta a lo capturado: el total real de la base de\n"
            "datos se ve en la barra de estado."
        )
        self._page_size.currentIndexChanged.connect(
            lambda _i: self.search_requested.emit(self._filter.text())
        )
        bar_lay.addWidget(self._page_size)
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
        # Ordenar por cabecera (# numérico, Method/URL alfabético). Por defecto
        # se mantiene el orden del backend (id desc = más reciente primero).
        self.table.setSortingEnabled(True)
        self.table.sortByColumn(0, Qt.DescendingOrder)
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

    # -- Constructor visual de filtro --------------------------------------- #
    def _open_builder(self) -> None:
        from .filter_builder import FilterBuilderDialog

        dialog = FilterBuilderDialog(self)
        if dialog.exec() == FilterBuilderDialog.Accepted:
            query = dialog.build_query()
            self._filter.setText(query)
            self.search_requested.emit(query)

    def _build_tree(self) -> QWidget:
        self._selected_node_reqs: list[dict[str, Any]] = []
        container = QWidget()
        lay = QVBoxLayout(container)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(4)

        # Filtro del árbol (oculta hosts/rutas que no contengan el texto).
        tree_filter_bar = QHBoxLayout()
        tree_filter_bar.addWidget(QLabel("Filtrar árbol:"))
        self._tree_filter = QLineEdit()
        self._tree_filter.setPlaceholderText("host o ruta…")
        self._tree_filter.setClearButtonEnabled(True)
        self._tree_filter.textChanged.connect(self._apply_tree_filter)
        tree_filter_bar.addWidget(self._tree_filter, 1)
        lay.addLayout(tree_filter_bar)

        # Split horizontal: árbol a la izquierda (usa el ancho), panel de detalle
        # a la derecha — antes el árbol dejaba la derecha vacía y las stats eran
        # una franja a todo lo ancho que robaba altura.
        split = QSplitter(Qt.Horizontal)

        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(["Host / Ruta", "#"])
        self.tree.header().setSectionResizeMode(0, QHeaderView.Stretch)
        self.tree.header().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.tree.setUniformRowHeights(True)
        self.tree.setSortingEnabled(True)  # ordenar por Host/Ruta o por # (clic cabecera)
        self.tree.currentItemChanged.connect(self._on_tree_item)
        split.addWidget(self.tree)

        # Panel de detalle del nodo seleccionado (estadísticas + export).
        detail = QWidget()
        dlay = QVBoxLayout(detail)
        dlay.setContentsMargins(6, 0, 0, 0)
        dlay.setSpacing(4)
        stats_label = QLabel("Estadísticas del nodo")
        stats_label.setObjectName("SectionLabel")
        dlay.addWidget(stats_label)
        self._stats = QPlainTextEdit()
        self._stats.setReadOnly(True)
        self._stats.setPlaceholderText("Selecciona un nodo para ver estadísticas")
        dlay.addWidget(self._stats, 1)

        exp = QHBoxLayout()
        self._export_json_btn = QPushButton("Exportar JSON")
        self._export_json_btn.clicked.connect(lambda: self._export_node("json"))
        self._export_csv_btn = QPushButton("Exportar CSV")
        self._export_csv_btn.clicked.connect(lambda: self._export_node("csv"))
        exp.addWidget(self._export_json_btn)
        exp.addWidget(self._export_csv_btn)
        exp.addStretch(1)
        dlay.addLayout(exp)
        split.addWidget(detail)

        split.setStretchFactor(0, 3)
        split.setStretchFactor(1, 2)
        split.setSizes([640, 360])
        lay.addWidget(split, 1)
        return container

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

    # Sentinela de "Todos": LIMIT suficientemente alto para traer el historial
    # completo (la tabla está virtualizada, así que renderiza 20k+ filas sin
    # problema). El backend lo trata como un LIMIT normal.
    PAGE_SIZE_ALL = 100_000_000

    def page_size(self) -> int:
        data = self._page_size.currentData()
        return int(data) if data is not None else 1000

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
        item = QTreeWidgetItem([node["label"]])
        # El count va como int en DisplayRole para que la columna "#" ordene
        # numéricamente (1 < 2 < 10), no como texto.
        item.setData(1, Qt.DisplayRole, int(node["count"]))
        # Guardar el id del request más reciente de este subárbol (si hay) y los
        # requests del subárbol para estadísticas/export.
        reqs = collect_node_reqs(node)
        if reqs:
            rid = reqs[-1].get("id")
            if rid is not None:
                item.setData(0, Qt.UserRole, int(rid))
        item.setData(0, Qt.UserRole + 1, reqs)
        for key in sorted(node["children"]):
            item.addChild(self._node_item(node["children"][key]))
        return item

    # -- Site Map: filtro / stats / export ---------------------------------- #
    def _apply_tree_filter(self, text: str) -> None:
        needle = text.strip().lower()

        def match(item: QTreeWidgetItem) -> bool:
            # Un nodo es visible si él o algún descendiente contiene el texto.
            self_match = needle in item.text(0).lower()
            child_match = False
            for i in range(item.childCount()):
                child_match = match(item.child(i)) or child_match
            visible = self_match or child_match or not needle
            item.setHidden(not visible)
            return visible

        for i in range(self.tree.topLevelItemCount()):
            match(self.tree.topLevelItem(i))

    def _render_stats(self, reqs: list[dict[str, Any]]) -> None:
        stats = node_stats(reqs)

        def top(pairs: list[tuple[Any, int]], n: int = 5) -> str:
            return ", ".join(f"{k}: {v}" for k, v in pairs[:n]) or "—"

        self._stats.setPlainText(
            f"Total: {stats['total']}\n"
            f"Métodos: {top(stats['methods'])}\n"
            f"Status:  {top(stats['codes'])}\n"
            f"Extensiones: {top(stats['exts'])}"
        )

    def _export_node(self, fmt: str) -> None:
        if not self._selected_node_reqs:
            return
        default = f"sitemap_node.{fmt}"
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar nodo", default, f"*.{fmt}"
        )
        if not path:
            return
        if fmt == "json":
            content = node_to_json(self._selected_node_reqs)
        else:
            content = node_to_csv(self._selected_node_reqs)
        with open(path, "w", encoding="utf-8", newline="") as fh:
            fh.write(content)

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
        reqs = current.data(0, Qt.UserRole + 1) or []
        self._selected_node_reqs = list(reqs)
        self._render_stats(self._selected_node_reqs)
        rid = current.data(0, Qt.UserRole)
        if rid is not None:
            self.request_selected.emit(int(rid))
