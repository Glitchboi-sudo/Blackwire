"""Panel de Session Macros: secuencias de requests ejecutadas server-side.

Una macro es una lista ordenada de requests crudos que el backend reproduce en
orden (`POST /api/session/macros/{id}/execute`). A diferencia de Collections, no
hay variables entre pasos: es un "replay" de una secuencia (p. ej. un login).

Cada paso se persiste como {method, url, headers(JSON str), body} dentro del campo
`requests` de la macro; al mutar pasos se reescribe la lista completa vía PUT. La
red se delega al `runner` del shell.
"""

from __future__ import annotations

import json
from typing import Any, Callable

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
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

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]


def _headers_to_str(headers: Any) -> str:
    """Normaliza headers (dict o str) a string JSON para el backend."""
    if isinstance(headers, dict):
        return json.dumps(headers)
    if isinstance(headers, str):
        return headers or "{}"
    return "{}"


class _RequestEditDialog(QDialog):
    """Edita un request de la macro (método / URL / headers JSON / body)."""

    def __init__(self, req: dict[str, Any], parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Editar request")
        self.setMinimumWidth(560)
        form = QFormLayout(self)

        self.method = QComboBox()
        self.method.addItems(["GET", "POST", "PUT", "PATCH", "DELETE",
                              "HEAD", "OPTIONS"])
        self.method.setCurrentText(req.get("method", "GET"))
        self.url = QLineEdit(req.get("url", ""))
        self.headers = QPlainTextEdit(_headers_to_str(req.get("headers")))
        self.headers.setFont(QFont(themes.MONO_FAMILY, 10))
        self.body = QPlainTextEdit(req.get("body") or "")
        self.body.setFont(QFont(themes.MONO_FAMILY, 10))

        form.addRow("Método", self.method)
        form.addRow("URL", self.url)
        form.addRow("Headers (JSON)", self.headers)
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
            "headers": self.headers.toPlainText() or "{}",
            "body": self.body.toPlainText(),
        }


class SessionMacrosPanel(QWidget):
    """Macros | pasos (requests) | ejecución server-side."""

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._macros: list[dict[str, Any]] = []
        self._requests: list[dict[str, Any]] = []
        self._mid: int | None = None
        self._pending_detail: dict[str, Any] | None = None

        layout = QHBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        split = QSplitter(Qt.Horizontal)

        # -- lista de macros ------------------------------------------------ #
        left = QWidget()
        lleft = QVBoxLayout(left)
        lleft.setContentsMargins(0, 0, 0, 0)
        lleft.addWidget(QLabel("Macros"))
        self._list = QListWidget()
        self._list.currentItemChanged.connect(self._on_macro)
        lleft.addWidget(self._list, 1)
        mbtns = QHBoxLayout()
        new_btn = QPushButton("Nueva"); new_btn.clicked.connect(self._new_macro)
        ren_btn = QPushButton("Renombrar"); ren_btn.clicked.connect(self._rename_macro)
        del_btn = QPushButton("Eliminar"); del_btn.clicked.connect(self._delete_macro)
        reload_btn = QPushButton(); reload_btn.setToolTip("Recargar"); icons.apply(reload_btn, "refresh", 14)
        reload_btn.clicked.connect(self.reload)
        reload_btn.setToolTip("Recargar"); reload_btn.setAccessibleName("Recargar macros")
        mbtns.addWidget(new_btn); mbtns.addWidget(ren_btn)
        mbtns.addWidget(del_btn); mbtns.addWidget(reload_btn)
        lleft.addLayout(mbtns)
        split.addWidget(left)

        # -- pasos + ejecución ---------------------------------------------- #
        right = QWidget()
        lright = QVBoxLayout(right)
        lright.setContentsMargins(0, 0, 0, 0)
        lright.addWidget(QLabel("Requests de la macro"))
        self._steps = QTableWidget(0, 2)
        self._steps.setHorizontalHeaderLabels(["Método", "URL"])
        self._steps.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._steps.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._steps.setSelectionMode(QAbstractItemView.SingleSelection)
        self._steps.verticalHeader().setVisible(False)
        self._steps.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        lright.addWidget(self._steps, 1)

        sbtns = QHBoxLayout()
        add_btn = QPushButton("Añadir request actual")
        add_btn.clicked.connect(self._add_current)
        edit_btn = QPushButton("Editar")
        edit_btn.clicked.connect(self._edit_step)
        up_btn = QPushButton(); up_btn.setToolTip("Subir"); icons.apply(up_btn, "arrow-up", 14); up_btn.setFixedWidth(28)
        up_btn.setToolTip("Subir request"); up_btn.setAccessibleName("Subir request")
        up_btn.clicked.connect(lambda: self._move_step(-1))
        down_btn = QPushButton(); down_btn.setToolTip("Bajar"); icons.apply(down_btn, "arrow-down", 14); down_btn.setFixedWidth(28)
        down_btn.setToolTip("Bajar request"); down_btn.setAccessibleName("Bajar request")
        down_btn.clicked.connect(lambda: self._move_step(1))
        del_step = QPushButton("Quitar")
        del_step.setObjectName("DangerButton")
        del_step.clicked.connect(self._delete_step)
        run_btn = QPushButton("Ejecutar macro")
        run_btn.setObjectName("AccentButton")
        run_btn.clicked.connect(self._execute)
        sbtns.addWidget(add_btn)
        sbtns.addWidget(edit_btn)
        sbtns.addWidget(up_btn)
        sbtns.addWidget(down_btn)
        sbtns.addWidget(del_step)
        sbtns.addStretch(1)
        sbtns.addWidget(run_btn)
        lright.addLayout(sbtns)

        lright.addWidget(QLabel("Resultado"))
        self._output = QPlainTextEdit()
        self._output.setReadOnly(True)
        self._output.setFont(QFont(themes.MONO_FAMILY, 10))
        lright.addWidget(self._output, 1)
        split.addWidget(right)
        split.setSizes([280, 780])
        layout.addWidget(split)

    # -- carga -------------------------------------------------------------- #
    def reload(self) -> None:
        self._run(self._api.session_macros, self._on_macros)

    def _on_macros(self, macros: list[dict[str, Any]]) -> None:
        self._macros = macros if isinstance(macros, list) else []
        prev = self._mid
        self._list.clear()
        sel_row = -1
        for i, m in enumerate(self._macros):
            reqs = m.get("requests") or []
            item = QListWidgetItem(f"{m.get('name', '')} ({len(reqs)})")
            item.setData(Qt.UserRole, m.get("id"))
            self._list.addItem(item)
            if m.get("id") == prev:
                sel_row = i
        # Preserva la selección tras recargar (mutaciones recargan la lista).
        if sel_row >= 0:
            self._list.setCurrentRow(sel_row)

    def _on_macro(self, current: QListWidgetItem | None, _p: QListWidgetItem | None) -> None:
        if current is None:
            self._mid = None
            self._requests = []
            self._refresh_steps()
            return
        self._mid = current.data(Qt.UserRole)
        macro = next((m for m in self._macros if m.get("id") == self._mid), None)
        self._requests = list(macro.get("requests") or []) if macro else []
        self._refresh_steps()

    def _refresh_steps(self) -> None:
        self._steps.setRowCount(len(self._requests))
        for r, req in enumerate(self._requests):
            for c, text in enumerate([req.get("method", ""), req.get("url", "")]):
                cell = QTableWidgetItem(text)
                cell.setFlags(cell.flags() & ~Qt.ItemIsEditable)
                self._steps.setItem(r, c, cell)

    # -- macros CRUD -------------------------------------------------------- #
    def _current_name(self) -> str:
        item = self._list.currentItem()
        if item is None:
            return ""
        return item.text().rsplit(" (", 1)[0]

    def _new_macro(self) -> None:
        name, ok = QInputDialog.getText(self, "Nueva macro", "Nombre:")
        if ok and name.strip():
            self._run(lambda: self._api.session_create_macro(name.strip()),
                      lambda _r: self.reload())

    def _rename_macro(self) -> None:
        if self._mid is None:
            return
        mid = self._mid
        name, ok = QInputDialog.getText(self, "Renombrar macro", "Nuevo nombre:",
                                        text=self._current_name())
        if ok and name.strip():
            self._run(lambda: self._api.session_update_macro(mid, {"name": name.strip()}),
                      lambda _r: self.reload())

    def _delete_macro(self) -> None:
        if self._mid is None:
            return
        resp = QMessageBox.question(
            self, "Eliminar macro",
            f"¿Eliminar la macro '{self._current_name()}' y sus requests? "
            "No se puede deshacer.",
        )
        if resp != QMessageBox.Yes:
            return
        mid = self._mid
        self._run(lambda: self._api.session_delete_macro(mid), lambda _r: self.reload())

    # -- pasos -------------------------------------------------------------- #
    def load_from_detail(self, detail: dict[str, Any]) -> None:
        """Memoriza el request actual para 'Añadir request actual'."""
        self._pending_detail = detail

    def _persist_requests(self) -> None:
        """Reescribe la lista de requests de la macro activa y recarga."""
        if self._mid is None:
            return
        mid = self._mid
        reqs = list(self._requests)
        self._run(lambda: self._api.session_update_macro(mid, {"requests": reqs}),
                  lambda _r: self.reload())

    def _add_current(self) -> None:
        if self._mid is None or self._pending_detail is None:
            self._output.setPlainText(
                "Selecciona una macro y un request (en Proxy) primero."
            )
            return
        d = self._pending_detail
        self._requests.append({
            "method": d.get("method", "GET"), "url": d.get("url", ""),
            "headers": _headers_to_str(d.get("headers")), "body": d.get("body") or "",
        })
        self._refresh_steps()
        self._persist_requests()

    def _selected_row(self) -> int:
        return self._steps.currentRow()

    def _edit_step(self) -> None:
        row = self._selected_row()
        if not (0 <= row < len(self._requests)) or self._mid is None:
            return
        dialog = _RequestEditDialog(self._requests[row], self)
        if dialog.exec() != QDialog.Accepted:
            return
        self._requests[row] = dialog.values()
        self._refresh_steps()
        self._persist_requests()

    def _move_step(self, step: int) -> None:
        row = self._selected_row()
        target = row + step
        if not (0 <= row < len(self._requests)) or not (0 <= target < len(self._requests)):
            return
        self._requests[row], self._requests[target] = (
            self._requests[target], self._requests[row]
        )
        self._refresh_steps()
        self._steps.selectRow(target)
        self._persist_requests()

    def _delete_step(self) -> None:
        row = self._selected_row()
        if not (0 <= row < len(self._requests)):
            return
        del self._requests[row]
        self._refresh_steps()
        self._persist_requests()

    # -- ejecución ---------------------------------------------------------- #
    def _execute(self) -> None:
        if self._mid is None:
            return
        mid = self._mid
        self._output.setPlainText("Ejecutando macro…")
        self._run(lambda: self._api.session_execute_macro(mid), self._on_executed)

    def _on_executed(self, result: dict[str, Any]) -> None:
        if not isinstance(result, dict) or result.get("error"):
            detail = result.get("error") if isinstance(result, dict) else result
            self._output.setPlainText(f"Error: {detail}")
            return
        lines: list[str] = []
        for i, res in enumerate(result.get("results", []) or []):
            if res.get("status") == "error":
                lines.append(f"[{i + 1}] ERROR: {res.get('error')}")
            else:
                lines.append(f"[{i + 1}] HTTP {res.get('status_code')}")
        self._output.setPlainText("\n".join(lines) or "Sin resultados")
