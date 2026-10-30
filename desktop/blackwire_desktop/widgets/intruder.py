"""Panel de Intruder (Fase 4): marcadores §, payloads, ataque y resultados.

El backend no ejecuta el ataque (solo persiste): la ejecución es en cliente. El
panel arma la plantilla con marcadores `§name§`, genera las combinaciones según el
tipo de ataque (`intruder.py`) y las dispara concurrentemente contra
`POST /api/repeater/send-raw`, recogiendo resultados en una tabla.

Render seguro: request/response de cada resultado se muestran en texto plano.
"""

from __future__ import annotations

import math
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from PySide6.QtCore import QObject, QRunnable, Qt, QThreadPool, Signal
from PySide6.QtGui import QAction, QFont
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QHeaderView,
    QInputDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMenu,
    QMessageBox,
    QPlainTextEdit,
    QProgressBar,
    QPushButton,
    QSpinBox,
    QSplitter,
    QStackedWidget,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from .. import themes
from ..intruder import (
    ATTACK_TYPES,
    MARKER,
    build_int_request,
    generate_attack_combinations,
    parse_positions,
)

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
_ATTACK_LABELS = {
    "targeted": "Targeted (sniper)",
    "broadcast": "Broadcast (battering ram)",
    "parallel": "Parallel (pitchfork)",
    "matrix": "Matrix (cluster bomb)",
}
_MARKER_RE = re.compile(r"§([^§]*)§")


# --------------------------------------------------------------------------- #
# Runner del ataque (background): genera combos y los dispara concurrentemente.
# --------------------------------------------------------------------------- #
class _AttackSignals(QObject):
    started = Signal(int)          # total de requests
    result = Signal(dict)          # una fila de resultado
    progress = Signal(int, int)    # done, total
    finished = Signal()


class _AttackWorker(QRunnable):
    def __init__(self, api, template: dict[str, Any], options: dict[str, Any],
                 stop_event: threading.Event, signals: _AttackSignals) -> None:
        super().__init__()
        self._api = api
        self._t = template
        self._o = options
        self._stop = stop_event
        self.signals = signals

    def run(self) -> None:
        t = self._t
        combos = generate_attack_combinations(
            t["url"], t["headers"], t["body"], t["method"],
            t["attack_type"], t["payloads"],
        )
        total = len(combos)
        self.signals.started.emit(total)
        if total == 0:
            self.signals.finished.emit()
            return

        conc = max(1, min(50, self._o["concurrency"]))
        follow = self._o["follow_redirects"]
        max_retries = self._o["max_retries"]
        delay_s = max(0, self._o.get("delay", 0)) / 1000.0
        done = 0

        def send_one(indexed):
            i, combo = indexed
            req = build_int_request(combo, t["url"], t["headers"], t["body"], t["method"])
            resp: dict[str, Any] = {}
            retries = 0
            while True:
                resp = self._api.repeater_send(
                    req["method"], req["url"], req["headers"], req["body"], follow
                )
                if not resp.get("error") or retries >= max_retries:
                    break
                retries += 1
            return {
                "num": i + 1, "payload": combo["label"],
                "status": resp.get("status_code", 0) or 0,
                "length": resp.get("size", 0) or 0,
                "time": round((resp.get("elapsed") or 0) * 1000),
                "error": resp.get("error", "") or "",
                "request": req, "response": resp,
            }

        indexed_combos = list(enumerate(combos))
        with ThreadPoolExecutor(max_workers=conc) as ex:
            for start in range(0, total, conc):
                if self._stop.is_set():
                    break
                # Throttle entre lotes (delay configurable); salta el primero.
                if delay_s and start > 0 and self._stop.wait(delay_s):
                    break
                batch = indexed_combos[start:start + conc]
                for row in ex.map(send_one, batch):
                    self.signals.result.emit(row)
                    done += 1
                    self.signals.progress.emit(done, total)
        self.signals.finished.emit()


class IntruderRunner(QObject):
    """Fachada del runner: start/stop + reemisión de señales a la UI."""

    started = Signal(int)
    result = Signal(dict)
    progress = Signal(int, int)
    finished = Signal()

    def __init__(self, api, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._stop = threading.Event()
        self._running = False

    @property
    def running(self) -> bool:
        return self._running

    def start(self, template: dict[str, Any], options: dict[str, Any]) -> None:
        if self._running:
            return
        self._stop.clear()
        self._running = True
        signals = _AttackSignals()
        signals.started.connect(self.started)
        signals.result.connect(self.result)
        signals.progress.connect(self.progress)
        signals.finished.connect(self._on_finished)
        worker = _AttackWorker(self._api, template, options, self._stop, signals)
        QThreadPool.globalInstance().start(worker)

    def stop(self) -> None:
        self._stop.set()

    def _on_finished(self) -> None:
        self._running = False
        self.finished.emit()


# --------------------------------------------------------------------------- #
# Editor de un conjunto de payloads (list / numbers / bruteforce + procesado).
# --------------------------------------------------------------------------- #
class _PayloadEditor(QWidget):
    """Edita la config de payloads de la posición seleccionada."""

    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self._stack = QStackedWidget()

        type_row = QHBoxLayout()
        type_row.addWidget(QLabel("Tipo:"))
        self.type = QComboBox()
        self.type.addItems(["list", "numbers", "bruteforce"])
        self.type.currentIndexChanged.connect(self._stack.setCurrentIndex)
        type_row.addWidget(self.type)
        type_row.addStretch(1)
        layout.addLayout(type_row)

        # list
        self.items = QPlainTextEdit()
        self.items.setPlaceholderText("un payload por línea")
        self.items.setFont(QFont(themes.MONO_FAMILY, 10))
        self._stack.addWidget(self.items)

        # numbers
        numbers = QWidget()
        nform = QFormLayout(numbers)
        self.n_from = QSpinBox(); self.n_from.setRange(-10**9, 10**9)
        self.n_to = QSpinBox(); self.n_to.setRange(-10**9, 10**9); self.n_to.setValue(99)
        self.n_step = QSpinBox(); self.n_step.setRange(1, 10**9); self.n_step.setValue(1)
        self.n_pad = QSpinBox(); self.n_pad.setRange(0, 32)
        nform.addRow("Desde", self.n_from)
        nform.addRow("Hasta", self.n_to)
        nform.addRow("Paso", self.n_step)
        nform.addRow("Relleno 0", self.n_pad)
        self._stack.addWidget(numbers)

        # bruteforce
        brute = QWidget()
        bform = QFormLayout(brute)
        self.b_charset = QLineEdit("abcdefghijklmnopqrstuvwxyz")
        self.b_min = QSpinBox(); self.b_min.setRange(1, 8); self.b_min.setValue(1)
        self.b_max = QSpinBox(); self.b_max.setRange(1, 8); self.b_max.setValue(3)
        bform.addRow("Charset", self.b_charset)
        bform.addRow("Long. mín", self.b_min)
        bform.addRow("Long. máx", self.b_max)
        self._stack.addWidget(brute)

        layout.addWidget(self._stack, 1)

        # procesado
        proc = QHBoxLayout()
        self.prefix = QLineEdit(); self.prefix.setPlaceholderText("prefijo")
        self.suffix = QLineEdit(); self.suffix.setPlaceholderText("sufijo")
        self.url_encode = QCheckBox("URL-encode")
        self.base64 = QCheckBox("Base64")
        proc.addWidget(self.prefix)
        proc.addWidget(self.suffix)
        proc.addWidget(self.url_encode)
        proc.addWidget(self.base64)
        layout.addLayout(proc)

    def to_cfg(self) -> dict[str, Any]:
        return {
            "type": self.type.currentText(),
            "items": self.items.toPlainText(),
            "from": self.n_from.value(), "to": self.n_to.value(),
            "step": self.n_step.value(), "padLen": self.n_pad.value(),
            "charset": self.b_charset.text(),
            "minLen": self.b_min.value(), "maxLen": self.b_max.value(),
            "prefix": self.prefix.text(), "suffix": self.suffix.text(),
            "urlEncode": self.url_encode.isChecked(), "base64": self.base64.isChecked(),
        }

    def from_cfg(self, cfg: dict[str, Any]) -> None:
        cfg = cfg or {}
        self.type.setCurrentText(cfg.get("type", "list"))
        self.items.setPlainText(cfg.get("items", ""))
        self.n_from.setValue(int(cfg.get("from", 0) or 0))
        self.n_to.setValue(int(cfg.get("to", 99) or 0))
        self.n_step.setValue(int(cfg.get("step", 1) or 1))
        self.n_pad.setValue(int(cfg.get("padLen", 0) or 0))
        self.b_charset.setText(cfg.get("charset", "abcdefghijklmnopqrstuvwxyz"))
        self.b_min.setValue(int(cfg.get("minLen", 1) or 1))
        self.b_max.setValue(int(cfg.get("maxLen", 3) or 3))
        self.prefix.setText(cfg.get("prefix", ""))
        self.suffix.setText(cfg.get("suffix", ""))
        self.url_encode.setChecked(bool(cfg.get("urlEncode", False)))
        self.base64.setChecked(bool(cfg.get("base64", False)))


# --------------------------------------------------------------------------- #
# Panel de Intruder
# --------------------------------------------------------------------------- #
class IntruderPanel(QWidget):
    status_text = Signal(str)
    send_to_repeater = Signal(dict)   # request de una fila de resultados

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._payloads: dict[int, dict[str, Any]] = {}
        self._positions: list[dict[str, Any]] = []
        self._cur_pos = -1
        self._results: list[dict[str, Any]] = []
        self._attacks: list[dict[str, Any]] = []
        self._runner = IntruderRunner(api, self)
        self._runner.started.connect(self._on_started)
        self._runner.result.connect(self._on_result)
        self._runner.progress.connect(self._on_progress)
        self._runner.finished.connect(self._on_finished)

        root = QVBoxLayout(self)
        root.setContentsMargins(6, 6, 6, 6)
        root.setSpacing(6)

        # Sidebar de ataques guardados (estilo frontend web/Tauri) a la izquierda,
        # siempre visible, + las pestañas Positions/Payloads/Results a la derecha.
        body = QSplitter(Qt.Horizontal)
        body.addWidget(self._build_attacks_sidebar())
        self._tabs = QTabWidget()
        self._tabs.addTab(self._build_positions_tab(), "Positions")
        self._tabs.addTab(self._build_payloads_tab(), "Payloads")
        self._tabs.addTab(self._build_results_tab(), "Results")
        body.addWidget(self._tabs)
        body.setStretchFactor(0, 0)
        body.setStretchFactor(1, 1)
        body.setSizes([230, 900])
        root.addWidget(body, 1)

        self._recompute_positions()

    # -- sidebar de ataques guardados -------------------------------------- #
    def _build_attacks_sidebar(self) -> QWidget:
        panel = QWidget()
        panel.setObjectName("AttacksSidebar")
        panel.setMaximumWidth(280)
        lay = QVBoxLayout(panel)
        lay.setContentsMargins(0, 0, 6, 0)
        lay.setSpacing(4)

        head = QHBoxLayout()
        title = QLabel("Ataques guardados")
        title.setObjectName("SectionLabel")
        new_btn = QPushButton("+ Nuevo")
        new_btn.setToolTip("Empezar un ataque nuevo (limpia el formulario)")
        new_btn.clicked.connect(self._new_attack)
        head.addWidget(title, 1)
        head.addWidget(new_btn)
        lay.addLayout(head)

        self.attacks_list = QListWidget()
        self.attacks_list.setSelectionMode(QAbstractItemView.SingleSelection)
        self.attacks_list.setWordWrap(True)
        self.attacks_list.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.attacks_list.itemClicked.connect(lambda _i: self._load_selected_attack())
        lay.addWidget(self.attacks_list, 1)

        row = QHBoxLayout()
        self.rename_btn = QPushButton("Renombrar")
        self.rename_btn.clicked.connect(self._rename_selected_attack)
        self.del_attack_btn = QPushButton("Eliminar")
        self.del_attack_btn.setObjectName("DangerButton")
        self.del_attack_btn.clicked.connect(self._delete_selected_attack)
        row.addWidget(self.rename_btn)
        row.addWidget(self.del_attack_btn)
        lay.addLayout(row)
        return panel

    def _new_attack(self) -> None:
        """Limpia el formulario para empezar un ataque desde cero (botón +Nuevo)."""
        self.attacks_list.clearSelection()
        self.method.setCurrentText("GET")
        self.url.clear()
        self.headers.clear()
        self.body.clear()
        self._payloads = {}
        self._results = []
        self.table.setRowCount(0)
        self.progress.setValue(0)
        self._cur_pos = -1
        self._recompute_positions()
        self._tabs.setCurrentIndex(0)
        self.status_text.emit("Nuevo ataque")

    def _current_attack_id(self) -> Any:
        item = self.attacks_list.currentItem()
        return item.data(Qt.UserRole) if item is not None else None

    # -- pestaña Positions -------------------------------------------------- #
    def _build_positions_tab(self) -> QWidget:
        page = QWidget()
        lay = QVBoxLayout(page)

        bar = QHBoxLayout()
        self.method = QComboBox(); self.method.setEditable(True)
        self.method.addItems(_METHODS)
        self.url = QLineEdit(); self.url.setPlaceholderText("https://host/path?q=§p§")
        bar.addWidget(self.method)
        bar.addWidget(self.url, 1)
        lay.addLayout(bar)

        self.headers = QPlainTextEdit()
        self.headers.setPlaceholderText("Authorization: Bearer §token§")
        self.headers.setFont(QFont(themes.MONO_FAMILY, 10))
        self.body = QPlainTextEdit()
        self.body.setPlaceholderText('{"username":"§user§"}')
        self.body.setFont(QFont(themes.MONO_FAMILY, 10))
        split = QSplitter(Qt.Vertical)
        split.addWidget(self.headers)
        split.addWidget(self.body)
        lay.addWidget(split, 1)

        marks = QHBoxLayout()
        add_btn = QPushButton(f"{MARKER} Add {MARKER}")
        add_btn.setToolTip("Marca la selección como posición de payload")
        # NoFocus: el botón NO debe robar el foco del editor, o al hacer clic
        # `focusWidget()` devolvería el botón y se perdería la selección.
        add_btn.setFocusPolicy(Qt.NoFocus)
        add_btn.clicked.connect(self._add_marker)
        clear_btn = QPushButton(f"Clear {MARKER}")
        clear_btn.setFocusPolicy(Qt.NoFocus)
        clear_btn.clicked.connect(self._clear_markers)
        self.attack_type = QComboBox()
        for key in ATTACK_TYPES:
            self.attack_type.addItem(_ATTACK_LABELS[key], key)
        self._pos_label = QLabel("0 posiciones")
        marks.addWidget(add_btn)
        marks.addWidget(clear_btn)
        marks.addSpacing(16)
        marks.addWidget(QLabel("Ataque:"))
        marks.addWidget(self.attack_type)
        marks.addStretch(1)
        marks.addWidget(self._pos_label)
        lay.addLayout(marks)

        # Recalcular posiciones cuando cambie la plantilla.
        self.url.textChanged.connect(self._recompute_positions)
        self.headers.textChanged.connect(self._recompute_positions)
        self.body.textChanged.connect(self._recompute_positions)
        return page

    # -- pestaña Payloads --------------------------------------------------- #
    def _build_payloads_tab(self) -> QWidget:
        page = QWidget()
        lay = QVBoxLayout(page)

        sel = QHBoxLayout()
        sel.addWidget(QLabel("Posición:"))
        self.pos_select = QComboBox()
        self.pos_select.currentIndexChanged.connect(self._on_pos_changed)
        sel.addWidget(self.pos_select, 1)
        lay.addLayout(sel)

        self.payload_editor = _PayloadEditor()
        lay.addWidget(self.payload_editor, 1)
        return page

    # -- pestaña Results ---------------------------------------------------- #
    def _build_results_tab(self) -> QWidget:
        page = QWidget()
        lay = QVBoxLayout(page)

        ctrl = QHBoxLayout()
        self.start_btn = QPushButton("Iniciar ataque")
        self.start_btn.setObjectName("AccentButton")
        self.start_btn.clicked.connect(self._start)
        self.stop_btn = QPushButton("Detener")
        self.stop_btn.setObjectName("DangerButton")
        self.stop_btn.clicked.connect(self._runner.stop)
        self.stop_btn.setEnabled(False)
        self.preview_btn = QPushButton("Preview")
        self.preview_btn.setToolTip("Estimar nº de requests y tiempo del ataque")
        self.preview_btn.clicked.connect(self._preview_attack)
        ctrl.addWidget(self.start_btn)
        ctrl.addWidget(self.stop_btn)
        ctrl.addWidget(self.preview_btn)
        ctrl.addSpacing(12)
        ctrl.addWidget(QLabel("Concurrencia:"))
        self.conc = QSpinBox(); self.conc.setRange(1, 50); self.conc.setValue(10)
        ctrl.addWidget(self.conc)
        ctrl.addWidget(QLabel("Delay (ms):"))
        self.delay = QSpinBox(); self.delay.setRange(0, 60000); self.delay.setValue(0)
        ctrl.addWidget(self.delay)
        self.follow = QCheckBox("Redirects"); self.follow.setChecked(True)
        ctrl.addWidget(self.follow)
        ctrl.addStretch(1)
        # Guardar/exportar viven aquí; la lista de ataques guardados (cargar/
        # renombrar/eliminar) está en el sidebar izquierdo, siempre visible.
        self.export_btn = QPushButton("Exportar resultados")
        self.export_btn.setToolTip("Guardar los resultados del ataque en CSV/JSON")
        self.export_btn.clicked.connect(self._export_results)
        self.save_btn = QPushButton("Guardar ataque")
        self.save_btn.setToolTip("Guarda el ataque actual (nombre automático)")
        self.save_btn.clicked.connect(self._save_attack)
        ctrl.addWidget(self.export_btn)
        ctrl.addWidget(self.save_btn)
        lay.addLayout(ctrl)

        self.progress = QProgressBar()
        self.progress.setTextVisible(True)
        lay.addWidget(self.progress)

        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(
            ["#", "Payload", "Status", "Longitud", "Tiempo (ms)", "Error"]
        )
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.verticalHeader().setVisible(False)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.table.setSortingEnabled(True)  # ordenar por cualquier columna
        self.table.currentCellChanged.connect(self._on_result_row)
        self.table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.table.customContextMenuRequested.connect(self._show_result_menu)
        lay.addWidget(self.table, 1)

        detail = QSplitter(Qt.Horizontal)
        self._req_view = self._mono_ro()
        self._resp_view = self._mono_ro()
        detail.addWidget(self._req_view)
        detail.addWidget(self._resp_view)
        lay.addWidget(detail, 1)
        return page

    def _mono_ro(self) -> QPlainTextEdit:
        ed = QPlainTextEdit()
        ed.setReadOnly(True)
        ed.setLineWrapMode(QPlainTextEdit.NoWrap)
        ed.setFont(QFont(themes.MONO_FAMILY, 10))
        return ed

    # -- plantilla / posiciones --------------------------------------------- #
    def load_from_detail(self, detail: dict[str, Any]) -> None:
        self.method.setCurrentText(detail.get("method", "GET"))
        self.url.setText(detail.get("url", ""))
        headers = detail.get("headers") or {}
        self.headers.setPlainText("\n".join(f"{k}: {v}" for k, v in headers.items()))
        self.body.setPlainText(detail.get("body") or "")

    def _template_text(self) -> tuple[str, str, str]:
        return self.url.text(), self.headers.toPlainText(), self.body.toPlainText()

    def _recompute_positions(self) -> None:
        url, headers, body = self._template_text()
        self._positions = parse_positions(url, headers, body)
        self._pos_label.setText(f"{len(self._positions)} posiciones")
        self._save_current_payload()
        self.pos_select.blockSignals(True)
        self.pos_select.clear()
        for pos in self._positions:
            self.pos_select.addItem(
                f"[{pos['idx']}] {MARKER}{pos['name']}{MARKER} ({pos['section']})",
                pos["idx"],
            )
        self.pos_select.blockSignals(False)
        self._cur_pos = -1
        if self._positions:
            self.pos_select.setCurrentIndex(0)
            self._on_pos_changed(0)

    def _add_marker(self) -> None:
        focused = self.focusWidget()
        if focused is self.url and self.url.hasSelectedText():
            s = self.url.text()
            start = self.url.selectionStart()
            sel = self.url.selectedText()
            self.url.setText(s[:start] + MARKER + sel + MARKER + s[start + len(sel):])
            return
        for editor in (self.headers, self.body):
            if focused is editor:
                cur = editor.textCursor()
                if cur.hasSelection():
                    cur.insertText(MARKER + cur.selectedText() + MARKER)
                    return
        self.status_text.emit("Selecciona texto en URL, headers o body primero")

    def _clear_markers(self) -> None:
        self.url.setText(_MARKER_RE.sub(r"\1", self.url.text()))
        self.headers.setPlainText(_MARKER_RE.sub(r"\1", self.headers.toPlainText()))
        self.body.setPlainText(_MARKER_RE.sub(r"\1", self.body.toPlainText()))

    # -- payloads por posición ---------------------------------------------- #
    def _save_current_payload(self) -> None:
        if self._cur_pos >= 0:
            self._payloads[self._cur_pos] = self.payload_editor.to_cfg()

    def _on_pos_changed(self, index: int) -> None:
        if index < 0:
            return
        self._save_current_payload()
        idx = self.pos_select.itemData(index)
        self._cur_pos = idx
        self.payload_editor.from_cfg(
            self._payloads.get(idx, {"type": "list", "items": ""})
        )

    # -- ejecución ---------------------------------------------------------- #
    def _collect_payloads(self) -> dict[int, dict[str, Any]]:
        self._save_current_payload()
        return dict(self._payloads)

    def _template(self) -> dict[str, Any]:
        url, headers, body = self._template_text()
        return {
            "method": self.method.currentText(), "url": url,
            "headers": headers, "body": body,
            "attack_type": self.attack_type.currentData(),
            "payloads": self._collect_payloads(),
        }

    def _preview_attack(self) -> None:
        """Estima nº de requests y tiempo total sin lanzar el ataque."""
        if not self._positions:
            self.status_text.emit("No hay posiciones § definidas")
            return
        t = self._template()
        combos = generate_attack_combinations(
            t["url"], t["headers"], t["body"], t["method"],
            t["attack_type"], t["payloads"],
        )
        total = len(combos)
        conc = max(1, self.conc.value())
        delay_ms = self.delay.value()
        batches = math.ceil(total / conc) if total else 0
        # Estimación grosera: ~150 ms amortizados por request + delay por lote.
        est_ms = (total / conc) * 150 + max(0, batches - 1) * delay_ms
        self.status_text.emit(
            f"Preview: {total} requests · ~{est_ms / 1000:.1f}s estimado "
            f"(conc={conc}, delay={delay_ms} ms)"
        )

    def _show_result_menu(self, pos) -> None:
        row = self.table.rowAt(pos.y())
        idx = self._result_index(row)
        if not (0 <= idx < len(self._results)):
            return
        menu = QMenu(self.table)
        act = QAction("Enviar al Repeater", menu)
        act.triggered.connect(lambda _c=False, r=idx: self._send_result_to_repeater(r))
        menu.addAction(act)
        menu.exec(self.table.viewport().mapToGlobal(pos))

    def _send_result_to_repeater(self, row: int) -> None:
        req = self._results[row].get("request") or {}
        if req:
            self.send_to_repeater.emit(req)

    def _start(self) -> None:
        if not self._positions:
            self.status_text.emit("No hay posiciones § definidas")
            return
        self._results = []
        self.table.setRowCount(0)
        self.progress.setValue(0)
        self.start_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        self._tabs.setCurrentIndex(2)
        options = {
            "concurrency": self.conc.value(), "delay": self.delay.value(),
            "follow_redirects": self.follow.isChecked(), "max_retries": 0,
        }
        self._runner.start(self._template(), options)

    def _on_started(self, total: int) -> None:
        self.progress.setMaximum(max(1, total))
        self.status_text.emit(f"Ataque iniciado: {total} requests")

    def _on_result(self, row: dict[str, Any]) -> None:
        self.table.setSortingEnabled(False)
        self._append_result_row(row)
        self.table.setSortingEnabled(True)

    def _append_result_row(self, row: dict[str, Any]) -> None:
        """Añade una fila a la tabla de resultados (usado en vivo y al cargar).

        El índice real se guarda en UserRole (col 0) para que ordenar por
        columnas no rompa el detalle — la fila visual ya no coincide con el
        índice de self._results. Las claves usan `.get` por si un ataque
        guardado trae filas con forma ligeramente distinta.
        """
        idx = len(self._results)
        self._results.append(row)
        r = self.table.rowCount()
        self.table.insertRow(r)
        num_item = self._num_item(row.get("num", r + 1))
        num_item.setData(Qt.UserRole, idx)
        self.table.setItem(r, 0, num_item)
        self.table.setItem(r, 1, QTableWidgetItem(str(row.get("payload", ""))))
        self.table.setItem(r, 2, self._num_item(row.get("status", "")))
        self.table.setItem(r, 3, self._num_item(row.get("length", "")))
        self.table.setItem(r, 4, self._num_item(row.get("time", "")))
        self.table.setItem(r, 5, QTableWidgetItem(str(row.get("error", ""))))

    def _load_results(self, results: list[dict[str, Any]]) -> None:
        """Rellena la tabla desde los resultados de un ataque guardado."""
        self._results = []
        self.table.setSortingEnabled(False)
        self.table.setRowCount(0)
        for row in results:
            if isinstance(row, dict):
                self._append_result_row(row)
        self.table.setSortingEnabled(True)
        self._req_view.clear()
        self._resp_view.clear()

    @staticmethod
    def _num_item(value: Any) -> QTableWidgetItem:
        """Celda que ordena numéricamente si `value` es numérico; si no, por texto."""
        item = QTableWidgetItem()
        try:
            item.setData(Qt.DisplayRole, int(value))
        except (ValueError, TypeError):
            item.setData(Qt.DisplayRole, str(value))
        return item

    def _result_index(self, row: int) -> int:
        """Índice real en self._results para una fila visual (via UserRole)."""
        item = self.table.item(row, 0)
        idx = item.data(Qt.UserRole) if item is not None else None
        return idx if isinstance(idx, int) else -1

    def _export_results(self) -> None:
        """Exporta los resultados del ataque a un archivo CSV o JSON."""
        if not self._results:
            self.status_text.emit("No hay resultados que exportar")
            return
        path, _flt = QFileDialog.getSaveFileName(
            self, "Exportar resultados", "intruder_results.csv",
            "CSV (*.csv);;JSON (*.json)",
        )
        if not path:
            return
        cols = ("num", "payload", "status", "length", "time", "error")
        try:
            if path.lower().endswith(".json"):
                import json

                data = [{k: r.get(k) for k in cols} for r in self._results]
                with open(path, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, indent=2, ensure_ascii=False)
            else:
                import csv

                with open(path, "w", newline="", encoding="utf-8") as fh:
                    writer = csv.writer(fh)
                    writer.writerow(cols)
                    for r in self._results:
                        writer.writerow([r.get(k) for k in cols])
            self.status_text.emit(f"Resultados exportados a {path}")
        except OSError as exc:
            self.status_text.emit(f"No se pudo exportar: {exc}")

    def _on_progress(self, done: int, total: int) -> None:
        self.progress.setValue(done)
        self.progress.setFormat(f"{done}/{total}")

    def _on_finished(self) -> None:
        self.start_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        self.status_text.emit(f"Ataque terminado: {len(self._results)} resultados")

    def _on_result_row(self, row: int, _c: int, _pr: int, _pc: int) -> None:
        idx = self._result_index(row)
        if not (0 <= idx < len(self._results)):
            return
        res = self._results[idx]
        req = res.get("request")
        if not isinstance(req, dict):
            req = {}
        self._req_view.setPlainText(
            f"{req.get('method', '')} {req.get('url', '')}\n"
            + "\n".join(f"{k}: {v}" for k, v in (req.get("headers") or {}).items())
            + ("\n\n" + req["body"] if req.get("body") else "")
        )
        # La respuesta puede venir como dict (en vivo) o como string/None (de un
        # ataque guardado round-tripeado por JSON); se maneja cualquier forma.
        resp = res.get("response")
        if isinstance(resp, dict):
            if resp.get("error"):
                self._resp_view.setPlainText(f"Error: {resp['error']}")
            else:
                self._resp_view.setPlainText(
                    f"HTTP {resp.get('status_code', '')}\n"
                    + "\n".join(f"{k}: {v}" for k, v in (resp.get("headers") or {}).items())
                    + ("\n\n" + str(resp.get("body")) if resp.get("body") else "")
                )
        elif resp:
            self._resp_view.setPlainText(str(resp))
        else:
            self._resp_view.setPlainText("")

    # -- persistencia ------------------------------------------------------- #
    def load_attacks(self) -> None:
        self._run(self._api.intruder_list, self._on_attacks)

    def _on_attacks(self, attacks: list[dict[str, Any]]) -> None:
        self._attacks = attacks or []
        self.attacks_list.clear()
        if not self._attacks:
            empty = QListWidgetItem("Sin ataques guardados")
            empty.setFlags(Qt.NoItemFlags)  # no seleccionable: estado vacío
            self.attacks_list.addItem(empty)
            return
        for att in self._attacks:
            item = QListWidgetItem(
                f"{att.get('name')}   ·   {att.get('total', 0)} res."
            )
            item.setData(Qt.UserRole, att.get("id"))
            self.attacks_list.addItem(item)

    def _attack_config(self) -> dict[str, Any]:
        t = self._template()
        return {
            "method": t["method"], "url": t["url"], "headers": t["headers"],
            "body": t["body"], "attackType": t["attack_type"],
            "payloads": t["payloads"], "concurrency": self.conc.value(),
            "delay": self.delay.value(), "followRedirects": self.follow.isChecked(),
        }

    def _save_attack(self) -> None:
        # Guardado instantáneo con nombre autogenerado (sin diálogo). El nombre
        # es descriptivo (método + host/ruta + hora) para que la lista de ataques
        # guardados sea fácil de reconocer; se puede renombrar luego.
        config = self._attack_config()
        results = list(self._results)
        name = self._auto_attack_name(config)
        self._run(
            lambda: self._api.intruder_save(name, config, results, len(results)),
            lambda _r: self._after_save(name),
        )

    def _after_save(self, name: str) -> None:
        self.load_attacks()
        self.status_text.emit(f"Ataque guardado: {name}")

    @staticmethod
    def _auto_attack_name(config: dict[str, Any]) -> str:
        """Nombre descriptivo por defecto: 'MÉTODO host/ruta · HH:MM:SS'."""
        from datetime import datetime

        url = (config.get("url") or "").split("://", 1)[-1]
        label = url[:46] if url else "ataque"
        return f"{config.get('method', 'GET')} {label} · {datetime.now():%H:%M:%S}"

    def _load_selected_attack(self) -> None:
        aid = self._current_attack_id()
        if aid is None:
            return
        self._run(lambda: self._api.intruder_load(aid), self._apply_attack)

    def _rename_selected_attack(self) -> None:
        aid = self._current_attack_id()
        if aid is None:
            return
        item = self.attacks_list.currentItem()
        old = item.text().split("   ·   ", 1)[0] if item is not None else ""
        name, ok = QInputDialog.getText(
            self, "Renombrar ataque", "Nuevo nombre:", text=old
        )
        if not (ok and name.strip()):
            return
        self._run(lambda: self._api.intruder_update(aid, {"name": name.strip()}),
                  lambda _r: self.load_attacks())

    def _delete_selected_attack(self) -> None:
        aid = self._current_attack_id()
        if aid is None:
            return
        item = self.attacks_list.currentItem()
        name = item.text() if item is not None else ""
        resp = QMessageBox.question(
            self, "Eliminar ataque", f"¿Eliminar el ataque guardado '{name}'?"
        )
        if resp != QMessageBox.Yes:
            return
        self._run(lambda: self._api.intruder_delete(aid),
                  lambda _r: self.load_attacks())

    def _apply_attack(self, attack: dict[str, Any]) -> None:
        if not isinstance(attack, dict) or attack.get("error"):
            self.status_text.emit("No se pudo cargar el ataque")
            return
        cfg = attack.get("config", {}) or {}
        self.method.setCurrentText(cfg.get("method", "GET"))
        self.url.setText(cfg.get("url", ""))
        self.headers.setPlainText(cfg.get("headers", ""))
        self.body.setPlainText(cfg.get("body", ""))
        at = cfg.get("attackType", "targeted")
        i = self.attack_type.findData(at)
        if i >= 0:
            self.attack_type.setCurrentIndex(i)
        # payloads vienen con claves string tras el round-trip JSON.
        raw = cfg.get("payloads", {}) or {}
        self._payloads = {int(k): v for k, v in raw.items()}
        self._cur_pos = -1
        self._recompute_positions()
        # Restaurar los resultados guardados en la tabla (antes se ignoraban:
        # el ataque cargaba pero la tabla quedaba vacía).
        results = attack.get("results") or []
        self._load_results(results)
        if results:
            self._tabs.setCurrentIndex(2)  # saltar a Results
        name = attack.get("name", "")
        self.status_text.emit(f"Ataque '{name}' cargado — {len(results)} resultados")
