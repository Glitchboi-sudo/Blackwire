"""Panel de Collections (Fase 5): secuencias de requests con variables.

Lista colecciones y sus pasos; ejecuta un paso o toda la cadena. No hay endpoint
"run collection": se encadena en cliente ejecutando cada paso y pasando sus
`extracted_variables` al siguiente (`/api/collections/...`). Sustitución `{{var}}`
y extracción JSONPath las resuelve el backend por paso.
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QAbstractItemView,
    QHBoxLayout,
    QHeaderView,
    QInputDialog,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QPlainTextEdit,
    QPushButton,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .. import themes

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]


class CollectionsPanel(QWidget):
    """Colecciones | pasos | ejecución encadenada."""

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._collections: list[dict[str, Any]] = []
        self._items: list[dict[str, Any]] = []
        self._cid: int | None = None
        self._pending_detail: dict[str, Any] | None = None

        layout = QHBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)

        split = QSplitter(Qt.Horizontal)

        # -- colecciones ---------------------------------------------------- #
        left = QWidget()
        lleft = QVBoxLayout(left)
        lleft.setContentsMargins(0, 0, 0, 0)
        lleft.addWidget(QLabel("Colecciones"))
        self._coll_list = QListWidget()
        self._coll_list.currentItemChanged.connect(self._on_coll)
        lleft.addWidget(self._coll_list, 1)
        cbtns = QHBoxLayout()
        new_btn = QPushButton("Nueva"); new_btn.clicked.connect(self._new_collection)
        del_btn = QPushButton("Eliminar"); del_btn.clicked.connect(self._delete_collection)
        reload_btn = QPushButton("↻"); reload_btn.clicked.connect(self.reload)
        cbtns.addWidget(new_btn); cbtns.addWidget(del_btn); cbtns.addWidget(reload_btn)
        lleft.addLayout(cbtns)
        split.addWidget(left)

        # -- pasos + ejecución ---------------------------------------------- #
        right = QWidget()
        lright = QVBoxLayout(right)
        lright.setContentsMargins(0, 0, 0, 0)
        lright.addWidget(QLabel("Pasos"))
        self._items_tbl = QTableWidget(0, 3)
        self._items_tbl.setHorizontalHeaderLabels(["#", "Método", "URL"])
        self._items_tbl.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._items_tbl.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._items_tbl.verticalHeader().setVisible(False)
        self._items_tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        lright.addWidget(self._items_tbl, 1)

        ibtns = QHBoxLayout()
        add_btn = QPushButton("Añadir request actual")
        add_btn.clicked.connect(self._add_current)
        run_step = QPushButton("Ejecutar paso")
        run_step.clicked.connect(self._run_step)
        run_all = QPushButton("Ejecutar todo")
        run_all.setObjectName("AccentButton")
        run_all.clicked.connect(self._run_all)
        del_step = QPushButton("Quitar paso")
        del_step.clicked.connect(self._delete_step)
        ibtns.addWidget(add_btn)
        ibtns.addWidget(run_step)
        ibtns.addWidget(run_all)
        ibtns.addStretch(1)
        ibtns.addWidget(del_step)
        lright.addLayout(ibtns)

        lright.addWidget(QLabel("Salida"))
        self._output = QPlainTextEdit()
        self._output.setReadOnly(True)
        self._output.setFont(QFont(themes.MONO_FAMILY, 10))
        lright.addWidget(self._output, 1)
        split.addWidget(right)
        split.setSizes([300, 760])
        layout.addWidget(split)

    # -- carga -------------------------------------------------------------- #
    def reload(self) -> None:
        self._run(self._api.collections_list, self._on_collections)

    def _on_collections(self, colls: list[dict[str, Any]]) -> None:
        self._collections = colls if isinstance(colls, list) else []
        self._coll_list.clear()
        for c in self._collections:
            item = QListWidgetItem(f"{c.get('name', '')} ({c.get('item_count', 0)})")
            item.setData(Qt.UserRole, c.get("id"))
            self._coll_list.addItem(item)

    def _on_coll(self, current: QListWidgetItem | None, _p: QListWidgetItem | None) -> None:
        if current is None:
            self._cid = None
            return
        self._cid = current.data(Qt.UserRole)
        self._load_items()

    def _load_items(self) -> None:
        if self._cid is None:
            return
        self._run(lambda: self._api.collection_items(self._cid), self._on_items)

    def _on_items(self, items: list[dict[str, Any]]) -> None:
        self._items = items if isinstance(items, list) else []
        self._items_tbl.setRowCount(len(self._items))
        for r, it in enumerate(self._items):
            for c, text in enumerate([str(it.get("position", r)), it.get("method", ""),
                                      it.get("url", "")]):
                cell = QTableWidgetItem(text)
                cell.setFlags(cell.flags() & ~Qt.ItemIsEditable)
                self._items_tbl.setItem(r, c, cell)

    # -- colecciones CRUD --------------------------------------------------- #
    def _new_collection(self) -> None:
        name, ok = QInputDialog.getText(self, "Nueva colección", "Nombre:")
        if ok and name.strip():
            self._run(lambda: self._api.collection_create(name.strip()),
                      lambda _r: self.reload())

    def _delete_collection(self) -> None:
        if self._cid is None:
            return
        cid = self._cid
        self._run(lambda: self._api.collection_delete(cid), lambda _r: self.reload())

    # -- pasos -------------------------------------------------------------- #
    def load_from_detail(self, detail: dict[str, Any]) -> None:
        """Memoriza el request actual para 'Añadir request actual'."""
        self._pending_detail = detail

    def _add_current(self) -> None:
        if self._cid is None or self._pending_detail is None:
            self._output.setPlainText(
                "Selecciona una colección y un request (en Proxy) primero."
            )
            return
        d = self._pending_detail
        cid = self._cid
        self._run(
            lambda: self._api.collection_add_item(
                cid, d.get("method", "GET"), d.get("url", ""),
                d.get("headers") or {}, d.get("body"),
            ),
            lambda _r: self._load_items(),
        )

    def _selected_item(self) -> dict[str, Any] | None:
        row = self._items_tbl.currentRow()
        return self._items[row] if 0 <= row < len(self._items) else None

    def _delete_step(self) -> None:
        item = self._selected_item()
        if item is None or self._cid is None:
            return
        cid, iid = self._cid, item.get("id")
        self._run(lambda: self._api.collection_delete_item(cid, iid),
                  lambda _r: self._load_items())

    def _run_step(self) -> None:
        item = self._selected_item()
        if item is None or self._cid is None:
            return
        cid, iid = self._cid, item.get("id")
        self._output.setPlainText("Ejecutando paso…")
        self._run(lambda: self._api.collection_execute_item(cid, iid, {}),
                  self._on_step_result)

    def _on_step_result(self, result: dict[str, Any]) -> None:
        if result.get("error"):
            self._output.setPlainText(f"⚠ Error: {result['error']}")
            return
        extracted = result.get("extracted_variables", {})
        self._output.setPlainText(
            f"HTTP {result.get('status_code', '')}  ·  {result.get('size', 0)} B  ·  "
            f"{round((result.get('elapsed') or 0) * 1000)} ms\n"
            f"Variables extraídas: {extracted}\n\n{result.get('body', '')}"
        )

    def _run_all(self) -> None:
        """Encadena todos los pasos pasando extracted_variables al siguiente."""
        if self._cid is None or not self._items:
            return
        self._output.setPlainText("Ejecutando cadena…")
        self._run(lambda: self._execute_chain(self._cid, list(self._items)),
                  self._on_chain_done)

    def _execute_chain(self, cid: int, items: list[dict[str, Any]]) -> dict[str, Any]:
        """Ejecuta la cadena en el hilo de red (secuencial, variables acumuladas)."""
        variables: dict[str, Any] = {}
        log_lines: list[str] = []
        for i, item in enumerate(items):
            res = self._api.collection_execute_item(cid, item.get("id"), variables)
            if res.get("error"):
                log_lines.append(f"[{i + 1}] ERROR: {res['error']}")
                break
            extracted = res.get("extracted_variables", {}) or {}
            variables.update(extracted)
            log_lines.append(
                f"[{i + 1}] {item.get('method')} {item.get('url')} -> "
                f"HTTP {res.get('status_code')}  (vars: {extracted})"
            )
        return {"log": "\n".join(log_lines), "variables": variables}

    def _on_chain_done(self, result: dict[str, Any]) -> None:
        self._output.setPlainText(
            result.get("log", "") + f"\n\nVariables finales: {result.get('variables', {})}"
        )
