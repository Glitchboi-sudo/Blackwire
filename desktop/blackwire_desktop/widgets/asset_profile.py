"""Panel de Asset Profile: fingerprinting de tecnologías por host (Fase 6).

No hay endpoint de backend: el análisis es en cliente, igual que Sensitive
Discovery (`sensitive.py` / `widgets/sensitive.py`). Dos modos conviven:

  - "Analizar historial": escaneo retroactivo de todo lo ya capturado.
  - Auto-detectar tráfico nuevo: `main._wire_signals` conecta
    `LiveHistoryClient.new_request` a `on_live_request`, así el perfil se arma
    solo mientras exploras con el proxy activo.

Resultado: una tabla con una fila por (host, tecnología) con versión, nivel de
confianza, evidencia (header/cookie/patrón que matcheó) y última vez vista.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Callable

from PySide6.QtCore import Qt, QObject, QRunnable, QThreadPool, Signal
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QProgressBar,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ..tech_fingerprint import detect_profile, host_of

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]
_COLUMNS = ["Host", "Tecnología", "Categoría", "Versión", "Confianza", "Evidencia", "Vistas", "Última vez"]

# Categoría -> token de color del tema (espejo de sensitive._CATEGORY_TOKEN).
_CATEGORY_TOKEN = {
    "Servidor web": "orange", "Lenguaje/Backend": "blue", "Framework backend": "purple",
    "Framework frontend": "green", "CMS": "red", "CDN/Proxy": "cyan",
    "Analytics": "txt2", "Hosting/PaaS": "cyan", "Librería JS": "green",
    "UI Framework": "green", "Seguridad": "red", "Pagos": "orange", "API": "blue",
    "Herramientas de build": "txt2",
}


def category_token(category: str) -> str:
    return _CATEGORY_TOKEN.get(category, "txt2")


class _ScanSignals(QObject):
    started = Signal(int)
    result = Signal(str, dict)
    progress = Signal(int, int)
    finished = Signal()


class _ScanWorker(QRunnable):
    """Escaneo retroactivo: baja el detalle de cada request y lo analiza."""

    def __init__(self, api, scope_only: bool, stop: threading.Event, signals: _ScanSignals) -> None:
        super().__init__()
        self._api = api
        self._scope_only = scope_only
        self._stop = stop
        self.signals = signals

    def run(self) -> None:
        try:
            search = self._api.search(page=1, page_size=50000, in_scope_only=self._scope_only)
            targets = search.get("requests", []) if isinstance(search, dict) else []
        except Exception:  # noqa: BLE001
            targets = []
        targets = [t for t in targets if t.get("request_type", "http") == "http"]
        total = len(targets)
        self.signals.started.emit(total)
        if total == 0:
            self.signals.finished.emit()
            return
        conc = 8
        done = 0

        def scan_one(req):
            try:
                detail = self._api.get_detail(req["id"])
            except Exception:  # noqa: BLE001
                return None, []
            return host_of(detail.get("url", "")), detect_profile(detail)

        with ThreadPoolExecutor(max_workers=conc) as ex:
            for start in range(0, total, conc):
                if self._stop.is_set():
                    break
                batch = targets[start:start + conc]
                for host, findings in ex.map(scan_one, batch):
                    if host:
                        for finding in findings:
                            self.signals.result.emit(host, finding)
                    done += 1
                    self.signals.progress.emit(done, total)
        self.signals.finished.emit()


class AssetProfilePanel(QWidget):
    """Perfil de tecnologías por host (estilo Wappalyzer) armado del tráfico."""

    def __init__(
        self, api, runner: Runner, tokens_getter: Callable[[], dict],
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._tokens = tokens_getter
        self._profiles: dict[tuple[str, str], dict[str, Any]] = {}
        self._stop = threading.Event()
        self._running = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        ctrl = QHBoxLayout()
        self._start_btn = QPushButton("Analizar historial")
        self._start_btn.clicked.connect(self._start_bulk)
        self._stop_btn = QPushButton("Detener")
        self._stop_btn.clicked.connect(lambda: self._stop.set())
        self._stop_btn.setEnabled(False)
        self._clear_btn = QPushButton("Limpiar")
        self._clear_btn.clicked.connect(self._clear)
        ctrl.addWidget(self._start_btn)
        ctrl.addWidget(self._stop_btn)
        ctrl.addWidget(self._clear_btn)
        ctrl.addSpacing(12)
        self._auto = QCheckBox("Auto-detectar tráfico nuevo")
        self._auto.setChecked(True)
        ctrl.addWidget(self._auto)
        self._scope_only = QCheckBox("Solo scope")
        self._scope_only.setChecked(True)
        ctrl.addWidget(self._scope_only)
        ctrl.addStretch(1)
        self._filter = QLineEdit()
        self._filter.setPlaceholderText("filtrar host o tecnología…")
        self._filter.textChanged.connect(self._apply_filter)
        ctrl.addWidget(self._filter)
        layout.addLayout(ctrl)

        self._summary = QLabel("0 hosts perfilados")
        layout.addWidget(self._summary)

        self._progress = QProgressBar()
        layout.addWidget(self._progress)

        self._table = QTableWidget(0, len(_COLUMNS))
        self._table.setHorizontalHeaderLabels(_COLUMNS)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.verticalHeader().setVisible(False)
        self._table.setSortingEnabled(True)
        self._table.horizontalHeader().setSectionResizeMode(5, QHeaderView.Stretch)
        layout.addWidget(self._table, 1)

    # -- escaneo retroactivo -------------------------------------------------- #
    def _start_bulk(self) -> None:
        if self._running:
            return
        self._stop.clear()
        self._running = True
        self._start_btn.setEnabled(False)
        self._stop_btn.setEnabled(True)
        signals = _ScanSignals()
        signals.started.connect(lambda t: self._progress.setMaximum(max(1, t)))
        signals.result.connect(self._upsert)
        signals.progress.connect(self._on_progress)
        signals.finished.connect(self._on_finished)
        QThreadPool.globalInstance().start(
            _ScanWorker(self._api, self._scope_only.isChecked(), self._stop, signals)
        )

    def _on_progress(self, done: int, total: int) -> None:
        self._progress.setValue(done)
        self._progress.setFormat(f"{done}/{total}")

    def _on_finished(self) -> None:
        self._running = False
        self._start_btn.setEnabled(True)
        self._stop_btn.setEnabled(False)

    def _clear(self) -> None:
        self._profiles.clear()
        self._table.setRowCount(0)
        self._update_summary()

    # -- detección en vivo ----------------------------------------------------- #
    def on_live_request(self, data: dict[str, Any]) -> None:
        """Conectado a `LiveHistoryClient.new_request`: fingerprinting incremental
        cada vez que el proxy captura un request nuevo mientras se explora."""
        if not self._auto.isChecked():
            return
        if data.get("request_type", "http") != "http":
            return
        if self._scope_only.isChecked() and not data.get("in_scope", True):
            return
        rid = data.get("id")
        if rid is None:
            return
        self._run(lambda: self._api.get_detail(rid), self._on_live_detail)

    def _on_live_detail(self, detail: dict[str, Any]) -> None:
        detail = detail or {}
        host = host_of(detail.get("url", ""))
        if not host:
            return
        for finding in detect_profile(detail):
            self._upsert(host, finding)

    # -- tabla ------------------------------------------------------------------ #
    def _upsert(self, host: str, finding: dict[str, Any]) -> None:
        key = (host, finding["name"])
        now = datetime.now().strftime("%H:%M:%S")
        row = self._profiles.get(key)
        is_new = row is None
        if is_new:
            row = {
                "host": host, "name": finding["name"], "category": finding["category"],
                "version": finding.get("version"), "confidence": finding["confidence"],
                "evidence": finding.get("evidence", ""), "count": 0, "last_seen": now,
            }
            self._profiles[key] = row
        row["count"] += 1
        row["last_seen"] = now
        if finding.get("version"):
            row["version"] = finding["version"]
        if finding.get("evidence"):
            row["evidence"] = finding["evidence"]
        if is_new:
            self._append_row(row)
        else:
            self._refresh_row(row)
        self._update_summary()

    def _update_summary(self) -> None:
        hosts = {row["host"] for row in self._profiles.values()}
        self._summary.setText(f"{len(hosts)} hosts · {len(self._profiles)} tecnologías detectadas")

    @staticmethod
    def _readonly_item(text: str) -> QTableWidgetItem:
        item = QTableWidgetItem(text)
        item.setFlags(item.flags() & ~Qt.ItemIsEditable)
        return item

    def _append_row(self, row: dict[str, Any]) -> None:
        self._table.setSortingEnabled(False)
        r = self._table.rowCount()
        self._table.insertRow(r)
        host_item = self._readonly_item(row["host"])
        self._table.setItem(r, 0, host_item)
        row["_anchor"] = host_item
        for c in range(1, len(_COLUMNS)):
            self._table.setItem(r, c, self._readonly_item(""))
        self._table.setSortingEnabled(True)
        self._refresh_row(row)

    def _refresh_row(self, row: dict[str, Any]) -> None:
        anchor = row.get("_anchor")
        if anchor is None:
            return
        r = anchor.row()
        if r < 0:
            return
        values = [
            row["name"], row["category"], row.get("version") or "—",
            row["confidence"], row.get("evidence", ""), str(row["count"]), row["last_seen"],
        ]
        color = self._tokens().get(category_token(row["category"]))
        for c, val in enumerate(values, start=1):
            item = self._table.item(r, c)
            if item is None:
                item = self._readonly_item("")
                self._table.setItem(r, c, item)
            item.setText(str(val))
            if c == 2 and color:
                item.setForeground(QColor(color))

    def _apply_filter(self, text: str) -> None:
        needle = text.lower()
        for r in range(self._table.rowCount()):
            hay = " ".join(
                (self._table.item(r, c).text() if self._table.item(r, c) else "")
                for c in (0, 1, 2)
            ).lower()
            self._table.setRowHidden(r, bool(needle) and needle not in hay)
