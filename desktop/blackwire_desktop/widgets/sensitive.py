"""Panel de Sensitive Discovery (Fase 5): escaneo de secretos en cliente.

No hay endpoint de escaneo: se obtienen los requests (`/api/requests/search`),
se baja el detalle de cada uno y se aplican los patrones + umbral de entropía
(`sensitive.py`) en segundo plano, acumulando resultados en una tabla coloreada
por categoría.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from PySide6.QtCore import QObject, QRunnable, Qt, QThreadPool, Signal
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QDoubleSpinBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QProgressBar,
    QPushButton,
    QSpinBox,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .. import themes
from ..rawhttp import format_raw
from ..sensitive import DEFAULT_PATTERNS, category_token, scan_detail
from .http_view import HttpView

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]
_COLUMNS = ["Patrón", "Categoría", "Coincidencia", "Sección", "Método", "URL", "Entropía"]


def _format_request(detail: dict[str, Any]) -> str:
    return format_raw(detail.get("method", ""), detail.get("url", ""),
                      detail.get("headers"), detail.get("body"))


def _format_response(detail: dict[str, Any]) -> str:
    status = detail.get("response_status")
    parts = [f"HTTP {status}" if status else "(sin respuesta)"]
    for key, value in (detail.get("response_headers") or {}).items():
        parts.append(f"{key}: {value}")
    body = detail.get("response_body")
    if body:
        parts.append("")
        parts.append(str(body))
    return "\n".join(parts)


class _ScanSignals(QObject):
    started = Signal(int)
    result = Signal(dict)
    progress = Signal(int, int)
    finished = Signal()


class _ScanWorker(QRunnable):
    def __init__(self, api, options: dict[str, Any], stop: threading.Event,
                 signals: _ScanSignals) -> None:
        super().__init__()
        self._api = api
        self._o = options
        self._stop = stop
        self.signals = signals

    def run(self) -> None:
        try:
            search = self._api.search(page=1, page_size=50000,
                                      in_scope_only=self._o["scope_only"])
            targets = search.get("requests", []) if isinstance(search, dict) else []
        except Exception:  # noqa: BLE001
            targets = []
        total = len(targets)
        self.signals.started.emit(total)
        if total == 0:
            self.signals.finished.emit()
            return
        threshold = self._o["entropy"]
        max_size = self._o["max_size"]
        conc = 8
        done = 0

        def scan_one(req):
            try:
                detail = self._api.get_detail(req["id"])
            except Exception:  # noqa: BLE001
                return []
            return scan_detail(detail, DEFAULT_PATTERNS, threshold, max_size)

        with ThreadPoolExecutor(max_workers=conc) as ex:
            for start in range(0, total, conc):
                if self._stop.is_set():
                    break
                batch = targets[start:start + conc]
                for rows in ex.map(scan_one, batch):
                    for row in rows:
                        self.signals.result.emit(row)
                    done += 1
                    self.signals.progress.emit(done, total)
        self.signals.finished.emit()


class SensitivePanel(QWidget):
    """Escáner de datos sensibles con resultados coloreados por categoría."""

    def __init__(self, api, runner: Runner, tokens_getter: Callable[[], dict],
                 parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._tokens = tokens_getter
        self._results: list[dict[str, Any]] = []
        self._stop = threading.Event()
        self._running = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        ctrl = QHBoxLayout()
        self._start_btn = QPushButton("Escanear")
        self._start_btn.clicked.connect(self._start)
        self._stop_btn = QPushButton("Detener")
        self._stop_btn.clicked.connect(lambda: self._stop.set())
        self._stop_btn.setEnabled(False)
        ctrl.addWidget(self._start_btn)
        ctrl.addWidget(self._stop_btn)
        ctrl.addSpacing(12)
        ctrl.addWidget(QLabel("Entropía mín:"))
        self._entropy = QDoubleSpinBox(); self._entropy.setRange(0.0, 8.0)
        self._entropy.setSingleStep(0.1); self._entropy.setValue(3.5)
        ctrl.addWidget(self._entropy)
        ctrl.addWidget(QLabel("Máx tamaño:"))
        self._max_size = QSpinBox(); self._max_size.setRange(0, 1000000)
        self._max_size.setValue(1024)
        ctrl.addWidget(self._max_size)
        self._scope_only = QCheckBox("Solo scope"); self._scope_only.setChecked(True)
        ctrl.addWidget(self._scope_only)
        ctrl.addStretch(1)
        self._filter = QLineEdit(); self._filter.setPlaceholderText("filtrar…")
        self._filter.textChanged.connect(self._apply_filter)
        ctrl.addWidget(self._filter)
        layout.addLayout(ctrl)

        self._progress = QProgressBar()
        layout.addWidget(self._progress)

        self._table = QTableWidget(0, len(_COLUMNS))
        self._table.setHorizontalHeaderLabels(_COLUMNS)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.verticalHeader().setVisible(False)
        self._table.horizontalHeader().setSectionResizeMode(5, QHeaderView.Stretch)
        self._table.itemSelectionChanged.connect(self._on_select)

        # -- detalle: Request / Response completos del hallazgo seleccionado --- #
        palette = themes.highlight_palette(self._tokens())
        self._req_view = HttpView(palette)
        self._resp_view = HttpView(palette)
        self._req_view.set_placeholder("Selecciona un hallazgo para ver el request")
        self._resp_view.set_placeholder("Sin respuesta")
        self._detail_title = QLabel("Request / Response del hallazgo")
        self._detail_title.setObjectName("SectionTitle")

        detail = QWidget()
        detail_lay = QVBoxLayout(detail)
        detail_lay.setContentsMargins(0, 0, 0, 0)
        detail_lay.setSpacing(4)
        detail_lay.addWidget(self._detail_title)
        views = QSplitter(Qt.Horizontal)
        views.addWidget(self._titled("Request", "ReqLabel", self._req_view))
        views.addWidget(self._titled("Response", "RespLabel", self._resp_view))
        views.setSizes([680, 680])
        detail_lay.addWidget(views, 1)

        split = QSplitter(Qt.Vertical)
        split.addWidget(self._table)
        split.addWidget(detail)
        split.setSizes([360, 420])
        layout.addWidget(split, 1)

    @staticmethod
    def _titled(title: str, obj_name: str, inner: QWidget) -> QWidget:
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        label = QLabel(title)
        label.setObjectName(obj_name)
        lay.addWidget(label)
        lay.addWidget(inner, 1)
        return box

    def set_palette(self, palette: dict[str, Any]) -> None:
        self._req_view.set_palette(palette)
        self._resp_view.set_palette(palette)

    # -- escaneo ------------------------------------------------------------ #
    def _start(self) -> None:
        if self._running:
            return
        self._results = []
        self._table.setRowCount(0)
        self._progress.setValue(0)
        self._stop.clear()
        self._running = True
        self._start_btn.setEnabled(False)
        self._stop_btn.setEnabled(True)
        options = {
            "entropy": self._entropy.value(), "max_size": self._max_size.value(),
            "scope_only": self._scope_only.isChecked(),
        }
        signals = _ScanSignals()
        signals.started.connect(lambda t: self._progress.setMaximum(max(1, t)))
        signals.result.connect(self._on_result)
        signals.progress.connect(self._on_progress)
        signals.finished.connect(self._on_finished)
        QThreadPool.globalInstance().start(
            _ScanWorker(self._api, options, self._stop, signals)
        )

    def _on_result(self, row: dict[str, Any]) -> None:
        self._results.append(row)
        self._append_row(row)

    def _append_row(self, row: dict[str, Any]) -> None:
        r = self._table.rowCount()
        self._table.insertRow(r)
        values = [row["patternName"], row["category"], row["match"], row["section"],
                  row["method"], row["url"], row["entropy"]]
        color = self._tokens().get(category_token(row["category"]))
        for c, val in enumerate(values):
            item = QTableWidgetItem(str(val))
            if c == 1 and color:
                item.setForeground(QColor(color))
            self._table.setItem(r, c, item)

    def _on_progress(self, done: int, total: int) -> None:
        self._progress.setValue(done)
        self._progress.setFormat(f"{done}/{total}  ·  {len(self._results)} hallazgos")

    def _on_finished(self) -> None:
        self._running = False
        self._start_btn.setEnabled(True)
        self._stop_btn.setEnabled(False)

    def _apply_filter(self, text: str) -> None:
        needle = text.lower()
        for r in range(self._table.rowCount()):
            row = self._results[r] if r < len(self._results) else {}
            hay = " ".join(str(row.get(k, "")) for k in
                           ("patternName", "category", "match", "url")).lower()
            self._table.setRowHidden(r, bool(needle) and needle not in hay)

    # -- detalle del hallazgo seleccionado ---------------------------------- #
    def _on_select(self) -> None:
        idx = self._table.currentRow()
        if idx < 0 or idx >= len(self._results):
            return
        finding = self._results[idx]
        rid = finding.get("requestId")
        if rid is None:
            self._detail_title.setText("Hallazgo sin request asociado")
            self._req_view.set_message("")
            self._resp_view.set_message("")
            return
        self._detail_title.setText(
            f"Request #{rid} — {finding.get('patternName', '')} "
            f"en {finding.get('section', '')}"
        )
        self._run(lambda: self._api.get_detail(rid), self._render_detail)

    def _render_detail(self, detail: dict[str, Any]) -> None:
        detail = detail or {}
        self._req_view.set_message(_format_request(detail))
        self._resp_view.set_message(_format_response(detail))
