"""Panel de Collections (Fase 5): secuencias de requests con variables.

Lista colecciones y sus pasos; ejecuta un paso, toda la cadena o avanza paso a
paso (Send Next/Reset) acumulando variables entre pasos. No hay endpoint "run
collection": se encadena en cliente ejecutando cada paso y pasando sus
`extracted_variables` al siguiente (`/api/collections/...`). Sustitución `{{var}}`
y extracción JSONPath las resuelve el backend por paso.

Las extracciones de variables de un paso (`var_extracts`) son objetos
`{"name", "source": "body"|"header", "path"}`: `body` usa JSONPath sobre el JSON
de la respuesta; `header` toma el valor de la cabecera indicada en `path`.
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QInputDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .. import themes
from . import icons
from ._sorting import make_sortable, numeric_item, populating

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

_SOURCES = ("body", "header")


class _StepEditDialog(QDialog):
    """Edita método / URL / body de un paso existente."""

    def __init__(self, item: dict[str, Any], parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Editar paso")
        self.setMinimumWidth(420)
        form = QFormLayout(self)

        self.method = QComboBox()
        self.method.addItems(["GET", "POST", "PUT", "PATCH", "DELETE",
                              "HEAD", "OPTIONS"])
        self.method.setCurrentText(item.get("method", "GET"))
        self.url = QLineEdit(item.get("url", ""))
        self.body = QPlainTextEdit(item.get("body") or "")
        self.body.setFont(QFont(themes.MONO_FAMILY, 10))

        form.addRow("Método", self.method)
        form.addRow("URL", self.url)
        form.addRow("Body", self.body)

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

    def values(self) -> dict[str, Any]:
        return {
            "method": self.method.currentText(),
            "url": self.url.text(),
            "body": self.body.toPlainText(),
        }


class CollectionsPanel(QWidget):
    """Colecciones | pasos | extracciones | ejecución (paso a paso o cadena)."""

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._collections: list[dict[str, Any]] = []
        self._items: list[dict[str, Any]] = []
        self._cid: int | None = None
        self._pending_detail: dict[str, Any] | None = None
        # Estado de ejecución paso a paso.
        self._cursor = 0
        self._session_vars: dict[str, Any] = {}

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
        reload_btn = QPushButton(); reload_btn.setToolTip("Recargar"); icons.apply(reload_btn, "refresh", 14)
        reload_btn.clicked.connect(self.reload)
        reload_btn.setToolTip("Recargar"); reload_btn.setAccessibleName("Recargar colecciones")
        cbtns.addWidget(new_btn); cbtns.addWidget(del_btn); cbtns.addWidget(reload_btn)
        lleft.addLayout(cbtns)
        split.addWidget(left)

        # -- pasos + extracciones + ejecución ------------------------------- #
        right = QWidget()
        lright = QVBoxLayout(right)
        lright.setContentsMargins(0, 0, 0, 0)
        lright.addWidget(QLabel("Pasos"))
        self._items_tbl = QTableWidget(0, 3)
        self._items_tbl.setHorizontalHeaderLabels(["#", "Método", "URL"])
        self._items_tbl.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._items_tbl.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._items_tbl.setSelectionMode(QAbstractItemView.SingleSelection)
        self._items_tbl.verticalHeader().setVisible(False)
        self._items_tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        make_sortable(self._items_tbl)  # ordenar al clicar cabecera / sort on header click
        self._items_tbl.itemSelectionChanged.connect(self._on_item_selected)
        lright.addWidget(self._items_tbl, 1)

        # Toolbar de edición de pasos.
        sbtns = QHBoxLayout()
        add_btn = QPushButton("Añadir request actual")
        add_btn.clicked.connect(self._add_current)
        edit_btn = QPushButton("Editar paso")
        edit_btn.clicked.connect(self._edit_step)
        up_btn = QPushButton(); up_btn.setToolTip("Subir"); icons.apply(up_btn, "arrow-up", 14); up_btn.setFixedWidth(28)
        up_btn.setToolTip("Subir paso"); up_btn.setAccessibleName("Subir paso")
        up_btn.clicked.connect(lambda: self._move_step(-1))
        down_btn = QPushButton(); down_btn.setToolTip("Bajar"); icons.apply(down_btn, "arrow-down", 14); down_btn.setFixedWidth(28)
        down_btn.setToolTip("Bajar paso"); down_btn.setAccessibleName("Bajar paso")
        down_btn.clicked.connect(lambda: self._move_step(1))
        del_step = QPushButton("Quitar paso")
        del_step.setObjectName("DangerButton")
        del_step.clicked.connect(self._delete_step)
        sbtns.addWidget(add_btn)
        sbtns.addWidget(edit_btn)
        sbtns.addWidget(up_btn)
        sbtns.addWidget(down_btn)
        sbtns.addStretch(1)
        sbtns.addWidget(del_step)
        lright.addLayout(sbtns)

        # Extracciones de variables del paso seleccionado.
        lright.addWidget(self._build_extracts_group())

        # Toolbar de ejecución.
        ibtns = QHBoxLayout()
        send_next = QPushButton("Send Next")
        send_next.setObjectName("AccentButton")
        send_next.clicked.connect(self._send_next)
        run_step = QPushButton("Ejecutar paso")
        run_step.clicked.connect(self._run_step)
        run_all = QPushButton("Ejecutar todo")
        run_all.clicked.connect(self._run_all)
        reset_btn = QPushButton("Reset")
        reset_btn.clicked.connect(self._reset_session)
        self._cursor_label = QLabel("Paso 1")
        ibtns.addWidget(send_next)
        ibtns.addWidget(run_step)
        ibtns.addWidget(run_all)
        ibtns.addWidget(reset_btn)
        ibtns.addStretch(1)
        ibtns.addWidget(self._cursor_label)
        lright.addLayout(ibtns)

        self._vars_label = QLabel("Variables de sesión: {}")
        self._vars_label.setWordWrap(True)
        lright.addWidget(self._vars_label)

        lright.addWidget(QLabel("Salida"))
        self._output = QPlainTextEdit()
        self._output.setReadOnly(True)
        self._output.setFont(QFont(themes.MONO_FAMILY, 10))
        lright.addWidget(self._output, 1)
        split.addWidget(right)
        split.setSizes([280, 780])
        layout.addWidget(split)

    # -- extracciones: UI --------------------------------------------------- #
    def _build_extracts_group(self) -> QGroupBox:
        box = QGroupBox("Extracciones de variables (del paso seleccionado)")
        lay = QVBoxLayout(box)
        self._ex_tbl = QTableWidget(0, 3)
        self._ex_tbl.setHorizontalHeaderLabels(["Variable", "Origen", "Path / Header"])
        self._ex_tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self._ex_tbl.verticalHeader().setVisible(False)
        self._ex_tbl.setMaximumHeight(140)
        lay.addWidget(self._ex_tbl)
        ebtns = QHBoxLayout()
        add = QPushButton("Añadir"); add.clicked.connect(lambda: self._add_extract_row())
        rm = QPushButton("Quitar"); rm.clicked.connect(self._remove_extract_row)
        save = QPushButton("Guardar extracciones")
        save.clicked.connect(self._save_extracts)
        ebtns.addWidget(add); ebtns.addWidget(rm); ebtns.addStretch(1); ebtns.addWidget(save)
        lay.addLayout(ebtns)
        return box

    def _add_extract_row(self, ve: dict[str, Any] | None = None) -> None:
        ve = ve or {}
        r = self._ex_tbl.rowCount()
        self._ex_tbl.insertRow(r)
        self._ex_tbl.setItem(r, 0, QTableWidgetItem(ve.get("name", "")))
        source = QComboBox(); source.addItems(_SOURCES)
        source.setCurrentText(ve.get("source", "body"))
        self._ex_tbl.setCellWidget(r, 1, source)
        self._ex_tbl.setItem(r, 2, QTableWidgetItem(ve.get("path", "")))

    def _remove_extract_row(self) -> None:
        row = self._ex_tbl.currentRow()
        if row >= 0:
            self._ex_tbl.removeRow(row)

    def _load_extracts(self, item: dict[str, Any] | None) -> None:
        self._ex_tbl.setRowCount(0)
        if not item:
            return
        for ve in item.get("var_extracts") or []:
            self._add_extract_row(ve)

    def _collect_extracts(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for r in range(self._ex_tbl.rowCount()):
            name_item = self._ex_tbl.item(r, 0)
            path_item = self._ex_tbl.item(r, 2)
            source = self._ex_tbl.cellWidget(r, 1)
            name = name_item.text().strip() if name_item else ""
            path = path_item.text().strip() if path_item else ""
            if not name or not path:
                continue
            out.append({
                "name": name,
                "source": source.currentText() if source else "body",
                "path": path,
            })
        return out

    def _save_extracts(self) -> None:
        item = self._selected_item()
        if item is None or self._cid is None:
            return
        cid, iid = self._cid, item.get("id")
        extracts = self._collect_extracts()
        self._run(
            lambda: self._api.collection_update_item(cid, iid, {"var_extracts": extracts}),
            lambda _r: self._load_items(),
        )

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
        self._reset_session()
        self._load_items()

    def _load_items(self) -> None:
        if self._cid is None:
            return
        self._run(lambda: self._api.collection_items(self._cid), self._on_items)

    def _on_items(self, items: list[dict[str, Any]]) -> None:
        self._items = items if isinstance(items, list) else []
        # Poblar sin ordenar en vivo / populate with live sorting disabled.
        with populating(self._items_tbl):
            self._items_tbl.setRowCount(len(self._items))
            for r, it in enumerate(self._items):
                # "#" ordena numéricamente; guarda el índice estable en UserRole.
                # "#" sorts numerically; stash the stable list index in UserRole.
                item0 = numeric_item(str(it.get("position", r)))
                item0.setData(Qt.UserRole, r)
                self._items_tbl.setItem(r, 0, item0)
                for c, text in enumerate([it.get("method", ""), it.get("url", "")], 1):
                    cell = QTableWidgetItem(text)
                    cell.setFlags(cell.flags() & ~Qt.ItemIsEditable)
                    self._items_tbl.setItem(r, c, cell)
        self._update_session_labels()
        self._load_extracts(self._selected_item())

    def _on_item_selected(self) -> None:
        self._load_extracts(self._selected_item())

    # -- colecciones CRUD --------------------------------------------------- #
    def _new_collection(self) -> None:
        name, ok = QInputDialog.getText(self, "Nueva colección", "Nombre:")
        if ok and name.strip():
            self._run(lambda: self._api.collection_create(name.strip()),
                      lambda _r: self.reload())

    def _delete_collection(self) -> None:
        if self._cid is None:
            return
        name = self._coll_list.currentItem().text() if self._coll_list.currentItem() else ""
        resp = QMessageBox.question(
            self, "Eliminar colección",
            f"¿Eliminar la colección '{name}' y todos sus pasos? No se puede deshacer.",
        )
        if resp != QMessageBox.Yes:
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
        # Mapear fila visible -> índice estable vía UserRole (la tabla es ordenable).
        # Map visible row -> stable index via UserRole (the table is sortable).
        row = self._items_tbl.currentRow()
        if row < 0:
            return None
        cell = self._items_tbl.item(row, 0)
        idx = cell.data(Qt.UserRole) if cell is not None else None
        if isinstance(idx, int) and 0 <= idx < len(self._items):
            return self._items[idx]
        return None

    def _selected_row_index(self) -> int | None:
        """Índice estable en `self._items` de la fila seleccionada, o None."""
        row = self._items_tbl.currentRow()
        if row < 0:
            return None
        cell = self._items_tbl.item(row, 0)
        idx = cell.data(Qt.UserRole) if cell is not None else None
        return idx if isinstance(idx, int) and 0 <= idx < len(self._items) else None

    def _select_by_index(self, idx: int) -> None:
        """Selecciona la fila visible cuyo índice estable (UserRole) es `idx`."""
        for row in range(self._items_tbl.rowCount()):
            cell = self._items_tbl.item(row, 0)
            if cell is not None and cell.data(Qt.UserRole) == idx:
                self._items_tbl.selectRow(row)
                return

    def _edit_step(self) -> None:
        item = self._selected_item()
        if item is None or self._cid is None:
            return
        dialog = _StepEditDialog(item, self)
        if dialog.exec() != QDialog.Accepted:
            return
        cid, iid = self._cid, item.get("id")
        self._run(
            lambda: self._api.collection_update_item(cid, iid, dialog.values()),
            lambda _r: self._load_items(),
        )

    def _move_step(self, step: int) -> None:
        """Intercambia la posición del paso seleccionado con su vecino."""
        # Índice estable (la tabla es ordenable) / stable index (table is sortable).
        row = self._selected_row_index()
        if row is None:
            return
        target = row + step
        if self._cid is None or not (0 <= row < len(self._items)) \
                or not (0 <= target < len(self._items)):
            return
        cid = self._cid
        a, b = self._items[row], self._items[target]
        pos_a, pos_b = a.get("position"), b.get("position")
        self._run(
            lambda: self._swap_positions(cid, a["id"], pos_b, b["id"], pos_a),
            lambda _r: self._reselect_after_move(target),
        )

    def _swap_positions(self, cid: int, id_a: int, pos_a: Any,
                        id_b: int, pos_b: Any) -> dict[str, Any]:
        """Dos PUT en el hilo de red para intercambiar posiciones."""
        self._api.collection_update_item(cid, id_a, {"position": pos_a})
        self._api.collection_update_item(cid, id_b, {"position": pos_b})
        return {"ok": True}

    def _reselect_after_move(self, row: int) -> None:
        self._load_items()
        if 0 <= row < len(self._items):
            # `row` es índice estable; localizar su fila visible / find visible row.
            self._select_by_index(row)

    def _delete_step(self) -> None:
        item = self._selected_item()
        if item is None or self._cid is None:
            return
        cid, iid = self._cid, item.get("id")
        self._run(lambda: self._api.collection_delete_item(cid, iid),
                  lambda _r: self._load_items())

    # -- ejecución: un paso suelto ------------------------------------------ #
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
            self._output.setPlainText(f"Error: {result['error']}")
            return
        extracted = result.get("extracted_variables", {})
        self._output.setPlainText(
            f"HTTP {result.get('status_code', '')}  ·  {result.get('size', 0)} B  ·  "
            f"{round((result.get('elapsed') or 0) * 1000)} ms\n"
            f"Variables extraídas: {extracted}\n\n{result.get('body', '')}"
        )

    # -- ejecución: paso a paso (Send Next / Reset) ------------------------- #
    def _reset_session(self) -> None:
        self._cursor = 0
        self._session_vars = {}
        self._update_session_labels()
        self._output.setPlainText("Sesión reiniciada. Send Next ejecuta el paso 1.")

    def _update_session_labels(self) -> None:
        total = len(self._items)
        pos = min(self._cursor + 1, total) if total else 0
        self._cursor_label.setText(f"Paso {pos}/{total}" if total else "Sin pasos")
        self._vars_label.setText(f"Variables de sesión: {self._session_vars}")

    def _send_next(self) -> None:
        if self._cid is None or not self._items:
            return
        if self._cursor >= len(self._items):
            self._output.setPlainText("Fin de la cadena. Usa Reset para empezar de nuevo.")
            return
        item = self._items[self._cursor]
        cid, iid = self._cid, item.get("id")
        variables = dict(self._session_vars)
        # `_cursor` es índice estable; localizar su fila visible / find visible row.
        self._select_by_index(self._cursor)
        self._output.setPlainText(f"Ejecutando paso {self._cursor + 1}…")
        self._run(lambda: self._api.collection_execute_item(cid, iid, variables),
                  self._on_send_next_result)

    def _on_send_next_result(self, result: dict[str, Any]) -> None:
        if result.get("error"):
            self._output.setPlainText(f"Error en paso {self._cursor + 1}: {result['error']}")
            return
        extracted = result.get("extracted_variables", {}) or {}
        self._session_vars.update(extracted)
        step_no = self._cursor + 1
        self._cursor += 1
        self._update_session_labels()
        self._output.setPlainText(
            f"[paso {step_no}] HTTP {result.get('status_code', '')}  ·  "
            f"{round((result.get('elapsed') or 0) * 1000)} ms\n"
            f"Variables extraídas: {extracted}\n"
            f"Variables acumuladas: {self._session_vars}\n\n{result.get('body', '')}"
        )

    # -- ejecución: cadena completa ----------------------------------------- #
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
