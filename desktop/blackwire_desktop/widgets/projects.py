"""Panel de Proyectos: crear/cambiar/eliminar + export/import por proyecto.

Un proyecto en Blackwire es un workspace aislado con su propia BD SQLite (historial,
repeater, collections, reglas, presets, scope, config del proxy). Casi todo el
backend exige un proyecto activo (400 si no hay), así que esta es la pantalla base.

Endpoints: `GET /api/projects` (lista), `POST /api/projects` (crear),
`POST /api/projects/{name}/select` (activar; NO reinicia el proxy),
`DELETE /api/projects/{name}` (eliminar), export/import por proyecto.
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QAbstractItemView,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from . import icons

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]


class _NewProjectDialog(QDialog):
    """Pide nombre + descripción para un proyecto nuevo."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Nuevo proyecto")
        form = QFormLayout(self)
        self._name = QLineEdit()
        self._desc = QLineEdit()
        form.addRow("Nombre", self._name)
        form.addRow("Descripción", self._desc)
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

    def values(self) -> tuple[str, str]:
        return self._name.text().strip(), self._desc.text().strip()


class ProjectsPanel(QWidget):
    """Gestión de proyectos (crear/activar/eliminar/export/import)."""

    project_changed = Signal()  # tras activar/crear/eliminar -> el shell recarga
    status_text = Signal(str)

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._projects: list[dict[str, Any]] = []

        layout = QHBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(8)

        # -- lista de proyectos --------------------------------------------- #
        # Las acciones de creación van ARRIBA, antes de la lista: es lo primero
        # que se busca al entrar al panel (crear/importar un proyecto) y mejora el
        # flujo frente a tenerlas al pie.
        left = QVBoxLayout()
        new_row = QHBoxLayout()
        new_btn = QPushButton("Nuevo proyecto")
        new_btn.clicked.connect(self._new_project)
        from_file_btn = QPushButton("Crear desde archivo…")
        from_file_btn.clicked.connect(self._create_from_file)
        new_row.addWidget(new_btn)
        new_row.addWidget(from_file_btn)
        left.addLayout(new_row)

        self._list = QListWidget()
        self._list.setSelectionMode(QAbstractItemView.SingleSelection)
        self._list.currentRowChanged.connect(self._on_select)
        self._list.itemDoubleClicked.connect(lambda _i: self._activate())
        left.addWidget(QLabel("Proyectos"))
        left.addWidget(self._list, 1)
        layout.addLayout(left, 1)

        # -- detalle + acciones --------------------------------------------- #
        right = QVBoxLayout()
        self._title = QLabel("Selecciona un proyecto")
        self._title.setObjectName("SectionTitle")
        self._meta = QLabel("")
        self._meta.setObjectName("Hint")
        self._desc = QPlainTextEdit()
        self._desc.setReadOnly(True)
        self._desc.setFixedHeight(80)
        right.addWidget(self._title)
        right.addWidget(self._meta)
        right.addWidget(self._desc)

        self._activate_btn = QPushButton("Activar proyecto")
        self._activate_btn.setObjectName("AccentButton")
        self._activate_btn.clicked.connect(self._activate)
        act_row = QHBoxLayout()
        act_row.addWidget(self._activate_btn)
        act_row.addStretch(1)
        right.addLayout(act_row)

        io_row = QHBoxLayout()
        exp_json = QPushButton("Exportar JSON")
        exp_json.clicked.connect(lambda: self._export("json"))
        exp_burp = QPushButton("Exportar Burp XML")
        exp_burp.clicked.connect(lambda: self._export("burp"))
        imp_burp = QPushButton("Importar Burp XML")
        imp_burp.clicked.connect(self._import_burp)
        io_row.addWidget(exp_json)
        io_row.addWidget(exp_burp)
        io_row.addWidget(imp_burp)
        io_row.addStretch(1)
        right.addLayout(io_row)

        del_row = QHBoxLayout()
        del_btn = QPushButton("Eliminar proyecto")
        del_btn.setObjectName("DangerButton")
        del_btn.clicked.connect(self._delete)
        reload_btn = QPushButton("Recargar")
        reload_btn.clicked.connect(self.reload)
        del_row.addWidget(del_btn)
        del_row.addStretch(1)
        del_row.addWidget(reload_btn)
        right.addLayout(del_row)
        right.addStretch(1)
        layout.addLayout(right, 2)

    # -- carga -------------------------------------------------------------- #
    def reload(self) -> None:
        self._run(self._api.projects, self._on_projects)

    def _on_projects(self, projects: list[dict[str, Any]]) -> None:
        self._projects = projects or []
        prev = self._list.currentRow()
        self._list.blockSignals(True)
        self._list.clear()
        for proj in self._projects:
            item = QListWidgetItem(proj.get("name", "?"))
            if proj.get("is_current"):
                item.setIcon(icons.icon("check", size=14))
            self._list.addItem(item)
        self._list.blockSignals(False)
        if self._projects:
            self._list.setCurrentRow(min(max(prev, 0), len(self._projects) - 1))
        else:
            self._title.setText("Sin proyectos")
            self._meta.setText("Crea uno para empezar.")
            self._desc.setPlainText("")

    def _current(self) -> dict[str, Any] | None:
        row = self._list.currentRow()
        return self._projects[row] if 0 <= row < len(self._projects) else None

    def _on_select(self, _row: int) -> None:
        proj = self._current()
        if proj is None:
            return
        active = " (ACTIVO)" if proj.get("is_current") else ""
        self._title.setText(f"{proj.get('name', '?')}{active}")
        self._meta.setText(f"Creado: {proj.get('created_at', '—')}")
        self._desc.setPlainText(proj.get("description", "") or "")
        self._activate_btn.setEnabled(not proj.get("is_current"))

    # -- mutaciones --------------------------------------------------------- #
    # -- API pública (comandos del menú Archivo) ---------------------------- #
    def known_projects(self) -> list[dict[str, Any]]:
        """Lista de proyectos cacheada (para el submenú 'Cambiar de proyecto')."""
        return list(getattr(self, "_projects", []))

    def new_project(self) -> None:
        """Abre el diálogo de nuevo proyecto (equivale al botón del panel)."""
        self._new_project()

    def activate_by_name(self, name: str) -> None:
        """Activa un proyecto por nombre (menú 'Cambiar de proyecto')."""
        if name:
            self._run(lambda: self._api.select_project(name), self._after_activate)

    def _new_project(self) -> None:
        dlg = _NewProjectDialog(self)
        if dlg.exec() != QDialog.Accepted:
            return
        name, desc = dlg.values()
        if not name:
            self.status_text.emit("El nombre del proyecto es obligatorio")
            return
        self._run(lambda: self._api.create_project(name, desc),
                  lambda r: self._after_create(r, name))

    def _after_create(self, result: dict[str, Any], name: str) -> None:
        if isinstance(result, dict) and result.get("status") == "created":
            self.status_text.emit(f"Proyecto '{name}' creado")
            # Activarlo automáticamente para que el shell cargue sus datos.
            self._run(lambda: self._api.select_project(name), self._after_activate)
        else:
            self.status_text.emit(f"No se pudo crear '{name}' (¿ya existe?)")
            self.reload()

    def _activate(self) -> None:
        proj = self._current()
        if proj is None or proj.get("is_current"):
            return
        name = proj.get("name")
        self._run(lambda: self._api.select_project(name), self._after_activate)

    def _after_activate(self, result: dict[str, Any]) -> None:
        name = result.get("project") if isinstance(result, dict) else None
        if name:
            self.status_text.emit(f"Proyecto activo: {name}")
            self.reload()
            self.project_changed.emit()
        else:
            self.status_text.emit("No se pudo activar el proyecto")

    def _delete(self) -> None:
        proj = self._current()
        if proj is None:
            return
        name = proj.get("name")
        confirm = QMessageBox.question(
            self, "Eliminar proyecto",
            f"¿Eliminar el proyecto '{name}' y TODOS sus datos? Esto no se puede deshacer.",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No,
        )
        if confirm != QMessageBox.Yes:
            return
        was_active = bool(proj.get("is_current"))
        self._run(lambda: self._api.delete_project(name),
                  lambda r: self._after_delete(name, was_active))

    def _after_delete(self, name: str, was_active: bool) -> None:
        self.status_text.emit(f"Proyecto '{name}' eliminado")
        self.reload()
        if was_active:
            self.project_changed.emit()  # el activo cambió -> recargar shell

    # -- import / export por proyecto --------------------------------------- #
    def _create_from_file(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Crear proyecto desde export JSON", "", "JSON (*.json);;Todos (*)"
        )
        if not path:
            return
        with open(path, "rb") as fh:
            data = fh.read()
        self._run(lambda: self._api.import_project_json(data), self._after_import_create)

    def _after_import_create(self, result: dict[str, Any]) -> None:
        if isinstance(result, dict) and result.get("error"):
            self.status_text.emit(f"Import: {result['error']}")
            return
        self.status_text.emit("Proyecto importado desde archivo")
        self.reload()

    def _export(self, fmt: str) -> None:
        proj = self._current()
        if proj is None:
            return
        name = proj.get("name")
        ext = "json" if fmt == "json" else "xml"
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar proyecto", f"blackwire-{name}.{ext}"
        )
        if not path:
            return
        fetch = (self._api.export_project_json if fmt == "json"
                 else self._api.export_project_burp)
        self._run(lambda: self._write_bytes(path, fetch(name)),
                  lambda p: self.status_text.emit(f"Exportado a {p}"))

    @staticmethod
    def _write_bytes(path: str, data: bytes) -> str:
        with open(path, "wb") as fh:
            fh.write(data)
        return path

    def _import_burp(self) -> None:
        proj = self._current()
        if proj is None:
            return
        name = proj.get("name")
        path, _ = QFileDialog.getOpenFileName(
            self, "Importar Burp XML", "", "XML (*.xml);;Todos (*)"
        )
        if not path:
            return
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            xml = fh.read()
        self._run(lambda: self._api.import_burp_xml(name, xml), self._after_import_burp)

    def _after_import_burp(self, result: dict[str, Any]) -> None:
        imported = result.get("imported", "?") if isinstance(result, dict) else "?"
        total = result.get("total", "?") if isinstance(result, dict) else "?"
        self.status_text.emit(f"Importados {imported}/{total} requests")
        if self._current() and self._current().get("is_current"):
            self.project_changed.emit()
