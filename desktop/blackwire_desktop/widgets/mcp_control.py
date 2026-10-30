"""Control de la puerta MCP desde la GUI: estado + Enable/Disable + config.

Se monta en la barra de estado como un widget compacto (dot + etiqueta + botones),
en paralelo a `ProxyControl`. El servidor `blackwire-mcp` es un proceso aparte que
lanza el cliente de IA por stdio; esta GUI NO lo arranca. Lo que SÍ controla es la
**puerta**: `POST /api/mcp/enable|disable` y `GET /api/mcp/status`. Con la puerta
cerrada, toda herramienta MCP se rechaza en el servidor.

El botón "Copiar config" genera el snippet JSON listo para pegar en el cliente de
IA (Claude Desktop/Code): apunta al Python del venv ejecutando
`-m mcp_server.server`, con `PYTHONPATH` a la raíz del repo para que el paquete
`mcp_server` sea importable sin depender del cwd.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Callable

from PySide6.QtCore import QTimer, Signal
from PySide6.QtWidgets import (
    QApplication,
    QDialog,
    QDialogButtonBox,
    QHBoxLayout,
    QLabel,
    QPlainTextEdit,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from ..i18n import t
from . import icons

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]


def _repo_root() -> Path:
    """Raíz del repo: .../widgets/mcp_control.py -> parents[3] = Blackwire."""
    return Path(__file__).resolve().parents[3]


def _venv_python(repo_root: Path) -> str:
    """Python del venv del repo (donde vive `mcp`), o 'python3' como fallback."""
    rel = "Scripts/python.exe" if os.name == "nt" else "bin/python"
    cand = repo_root / "venv" / rel
    return str(cand) if cand.exists() else "python3"


class McpControl(QWidget):
    """Indicador de la puerta MCP + Enable/Disable + copiar config del cliente."""

    status_text = Signal(str)

    def __init__(self, api, runner: Runner,
                 tokens: Callable[[], dict] | None = None,
                 parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._tokens = tokens
        self._enabled = False

        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(6)

        self._dot = QLabel()
        self._label = QLabel(t("MCP: —"))
        self._toggle_btn = QPushButton(t("Enable"))
        icons.apply(self._toggle_btn, "code", 15)
        self._toggle_btn.setMaximumWidth(110)
        self._toggle_btn.clicked.connect(self._toggle)
        self._cfg_btn = QPushButton(t("Copy config"))
        icons.apply(self._cfg_btn, "link", 15)
        self._cfg_btn.setMaximumWidth(130)
        self._cfg_btn.setToolTip(t("Copy the MCP client config for Claude Desktop/Code"))
        self._cfg_btn.clicked.connect(self._copy_config)

        lay.addWidget(self._dot)
        lay.addWidget(self._label)
        lay.addWidget(self._toggle_btn)
        lay.addWidget(self._cfg_btn)

        self._set_indicator(False)

        # El estado no se emite por WS; sondeo periódico como en ProxyControl.
        self._timer = QTimer(self)
        self._timer.setInterval(4000)
        self._timer.timeout.connect(self.refresh_status)
        self._timer.start()

    # -- estado ------------------------------------------------------------- #
    def refresh_status(self) -> None:
        self._run(self._api.mcp_status, self._on_status)

    def _on_status(self, status: dict[str, Any]) -> None:
        self._set_indicator(bool(status.get("enabled")))

    def _state_colors(self) -> tuple[str, str]:
        if self._tokens is not None:
            tk = self._tokens()
            return tk.get("green", "#3fb950"), tk.get("red", "#f85149")
        return "#3fb950", "#f85149"

    def refresh_theme(self) -> None:
        self._set_indicator(self._enabled)

    def _set_indicator(self, enabled: bool) -> None:
        self._enabled = enabled
        green, red = self._state_colors()
        color = green if enabled else red
        self._dot.setPixmap(icons.icon("circle", color, 10).pixmap(10, 10))
        if enabled:
            self._label.setText(t("MCP: on"))
            self._toggle_btn.setText(t("Disable"))
        else:
            self._label.setText(t("MCP: off"))
            self._toggle_btn.setText(t("Enable"))

    # -- encender / apagar -------------------------------------------------- #
    def _toggle(self) -> None:
        if self._enabled:
            self.status_text.emit(t("Disabling MCP…"))
            self._run(self._api.mcp_disable, self._on_toggled)
        else:
            self.status_text.emit(t("Enabling MCP…"))
            self._run(self._api.mcp_enable, self._on_toggled)

    def _on_toggled(self, result: dict[str, Any]) -> None:
        enabled = bool(result.get("enabled")) if isinstance(result, dict) else False
        self._set_indicator(enabled)
        self.status_text.emit(t("MCP enabled") if enabled else t("MCP disabled"))

    # -- API pública (comandos del menú) ------------------------------------ #
    def toggle(self) -> None:
        """Enciende o apaga la puerta MCP (equivale al botón)."""
        self._toggle()

    def copy_config(self) -> None:
        """Copia el config del cliente MCP al portapapeles (comando del menú)."""
        self._copy_config()

    def show_activity(self) -> None:
        """Muestra la actividad reciente de las herramientas MCP."""
        self._run(lambda: self._api.mcp_activity(100), self._show_activity_dialog)

    # -- config del cliente ------------------------------------------------- #
    def _client_config(self) -> str:
        if getattr(sys, "frozen", False):
            # App empaquetada (PyInstaller): el propio binario corre el MCP con --mcp.
            server = {
                "command": sys.executable,
                "args": ["--mcp"],
                "env": {"BLACKWIRE_BASE_URL": self._api.base_url},
            }
        else:
            # Desarrollo: Python del venv ejecutando el módulo, con PYTHONPATH al repo.
            repo = _repo_root()
            server = {
                "command": _venv_python(repo),
                "args": ["-m", "mcp_server.server"],
                "env": {
                    "PYTHONPATH": str(repo),
                    "BLACKWIRE_BASE_URL": self._api.base_url,
                },
            }
        return json.dumps({"mcpServers": {"blackwire": server}}, indent=2)

    def _copy_config(self) -> None:
        text = self._client_config()
        QApplication.clipboard().setText(text)
        self.status_text.emit(t("MCP client config copied to clipboard"))
        dlg = QDialog(self)
        dlg.setWindowTitle(t("MCP client config"))
        v = QVBoxLayout(dlg)
        v.addWidget(QLabel(t(
            "Paste this into your AI client's MCP config, then enable the gate "
            "here. The server is launched by the client (stdio)."
        )))
        box = QPlainTextEdit(text)
        box.setReadOnly(True)
        box.setMinimumSize(560, 260)
        v.addWidget(box)
        buttons = QDialogButtonBox(QDialogButtonBox.Close)
        buttons.rejected.connect(dlg.reject)
        buttons.accepted.connect(dlg.accept)
        v.addWidget(buttons)
        dlg.exec()

    def _show_activity_dialog(self, activity: list[dict[str, Any]]) -> None:
        dlg = QDialog(self)
        dlg.setWindowTitle(t("MCP activity"))
        v = QVBoxLayout(dlg)
        box = QPlainTextEdit()
        box.setReadOnly(True)
        box.setMinimumSize(560, 320)
        if not activity:
            box.setPlainText(t("No MCP tool calls recorded yet."))
        else:
            lines = []
            for entry in activity:
                mark = "ok " if entry.get("ok") else "ERR"
                lines.append(f"[{mark}] {entry.get('tool', '?')}: {entry.get('summary', '')}")
            box.setPlainText("\n".join(lines))
        v.addWidget(box)
        buttons = QDialogButtonBox(QDialogButtonBox.Close)
        buttons.rejected.connect(dlg.reject)
        buttons.accepted.connect(dlg.accept)
        v.addWidget(buttons)
        dlg.exec()
