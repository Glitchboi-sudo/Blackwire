"""Control del proxy (mitmdump) desde la GUI: estado + Start/Stop + config.

Se monta en la barra de estado como un widget compacto (dot + `modo:puerto` +
botones). El backend arranca mitmdump como subproceso vía `POST /api/proxy/start`
(parámetros por QUERY) y lo detiene con `/api/proxy/stop`. `GET /api/proxy/status`
solo devuelve `{running, intercept_enabled}` (ni puerto ni pid), así que el widget
recuerda el puerto/modo configurados (persistidos en el config.json del proyecto).

Cambiar el puerto = stop + start (no hay reconfiguración en caliente ni endpoint de
restart). Requiere un proyecto activo (el backend responde 400 si no hay).
"""

from __future__ import annotations

from typing import Any, Callable

from PySide6.QtCore import QTimer, Signal
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QSpinBox,
    QWidget,
)

from .. import browser
from . import icons

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]

_MODES = ["regular", "upstream", "socks5", "transparent"]


class _ProxyConfigDialog(QDialog):
    """Puerto / interfaz de escucha / modo / argumentos extra de mitmproxy."""

    def __init__(
        self, config: dict[str, Any], interfaces: list[str],
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle("Configuración del proxy")
        form = QFormLayout(self)

        self._port = QSpinBox()
        self._port.setRange(1, 65535)
        self._port.setValue(int(config.get("port", 8080)))

        self._listen = QComboBox()
        self._listen.setEditable(True)
        # `/api/proxy/interfaces` devuelve [{label, address}]; mostramos label y
        # guardamos address como data. Editable para una dirección personalizada.
        for iface in interfaces:
            if isinstance(iface, dict):
                addr = iface.get("address", "")
                self._listen.addItem(iface.get("label") or addr, addr)
            else:
                self._listen.addItem(str(iface), str(iface))
        host = config.get("listen_host", "")
        idx = self._listen.findData(host) if host else -1
        if idx >= 0:
            self._listen.setCurrentIndex(idx)
        elif host:
            self._listen.setCurrentText(host)
        elif self._listen.count():
            self._listen.setCurrentIndex(0)

        self._mode = QComboBox()
        self._mode.addItems(_MODES)
        self._mode.setCurrentText(config.get("mode", "regular"))

        self._extra = QLineEdit(config.get("extra", ""))
        self._extra.setPlaceholderText("flags extra de mitmdump (ej. upstream:http://…)")

        form.addRow("Puerto", self._port)
        form.addRow("Escuchar en", self._listen)
        form.addRow("Modo", self._mode)
        form.addRow("Args extra", self._extra)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

    def values(self) -> dict[str, Any]:
        # Si el texto coincide con el item seleccionado, usamos su address (data);
        # si el usuario escribió algo libre, usamos el texto como dirección literal.
        idx = self._listen.currentIndex()
        if idx >= 0 and self._listen.currentText() == self._listen.itemText(idx):
            host = self._listen.itemData(idx) or ""
        else:
            host = self._listen.currentText().strip()
        return {
            "port": self._port.value(),
            "listen_host": host,
            "mode": self._mode.currentText(),
            "extra": self._extra.text().strip(),
        }


class ProxyControl(QWidget):
    """Indicador de estado + Start/Stop + diálogo de configuración del proxy."""

    status_text = Signal(str)

    def __init__(self, api, runner: Runner,
                 tokens: Callable[[], dict] | None = None,
                 parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._tokens = tokens
        self._running = False
        # Config efímera; se siembra desde el config.json del proyecto activo.
        self._cfg: dict[str, Any] = {
            "port": 8080, "listen_host": "", "mode": "regular", "extra": "",
        }
        self._interfaces: list[str] = []

        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(6)

        self._dot = QLabel()
        self._label = QLabel("proxy: —")
        self._toggle_btn = QPushButton("Start")
        icons.apply(self._toggle_btn, "play", 15)
        self._toggle_btn.setMaximumWidth(96)
        self._toggle_btn.clicked.connect(self._toggle)
        self._cfg_btn = QPushButton()
        icons.apply(self._cfg_btn, "settings", 16)
        self._cfg_btn.setMaximumWidth(34)
        self._cfg_btn.setToolTip("Configuración del proxy")
        self._cfg_btn.setAccessibleName("Configuración del proxy")
        self._cfg_btn.clicked.connect(self._open_config)
        self._browser_btn = QPushButton("Navegador")
        icons.apply(self._browser_btn, "globe", 15)
        self._browser_btn.setToolTip(
            "Abrir Chromium apuntando al proxy y confiando en el CA de Blackwire"
        )
        self._browser_btn.clicked.connect(self._launch_browser)

        lay.addWidget(self._dot)
        lay.addWidget(self._label)
        lay.addWidget(self._toggle_btn)
        lay.addWidget(self._cfg_btn)
        lay.addWidget(self._browser_btn)

        self._set_indicator(False)

        # Sondeo periódico del estado (el status no se emite por WS).
        self._timer = QTimer(self)
        self._timer.setInterval(4000)
        self._timer.timeout.connect(self.refresh_status)
        self._timer.start()

    # -- estado ------------------------------------------------------------- #
    def refresh_status(self) -> None:
        self._run(self._api.proxy_status, self._on_status)

    def _on_status(self, status: dict[str, Any]) -> None:
        self._set_indicator(bool(status.get("running")))

    def _state_colors(self) -> tuple[str, str]:
        """Verde/rojo del tema activo (fallback a los tokens de githubdark)."""
        if self._tokens is not None:
            t = self._tokens()
            return t.get("green", "#3fb950"), t.get("red", "#f85149")
        return "#3fb950", "#f85149"

    def refresh_theme(self) -> None:
        """Recolorea el indicador al cambiar de tema (llamado desde el shell)."""
        self._set_indicator(self._running)

    def _set_indicator(self, running: bool) -> None:
        self._running = running
        green, red = self._state_colors()
        color = green if running else red
        # Status dot as a themed filled circle recolored to the run state.
        self._dot.setPixmap(icons.icon("circle", color, 10).pixmap(10, 10))
        if running:
            self._label.setText(f"proxy: {self._cfg['mode']}:{self._cfg['port']}")
            self._toggle_btn.setText("Stop")
            self._toggle_btn.setIcon(icons.icon("stop", size=15))
        else:
            self._label.setText("proxy: detenido")
            self._toggle_btn.setText("Start")
            self._toggle_btn.setIcon(icons.icon("play", size=15))

    # -- siembra de config desde el proyecto activo ------------------------- #
    def load_project_config(self) -> None:
        self._run(self._api.proxy_interfaces, self._on_interfaces)
        self._run(self._api.current_project_detail, self._on_project_detail)

    def _on_interfaces(self, interfaces: list[str]) -> None:
        self._interfaces = interfaces or []

    def _on_project_detail(self, detail: dict[str, Any]) -> None:
        config = (detail or {}).get("config") or {}
        self._cfg.update({
            "port": int(config.get("proxy_port", self._cfg["port"])),
            "mode": config.get("proxy_mode", self._cfg["mode"]),
            "extra": config.get("proxy_args", self._cfg["extra"]),
        })
        self._set_indicator(self._running)

    # -- arranque / parada -------------------------------------------------- #
    def _toggle(self) -> None:
        if self._running:
            self.status_text.emit("Deteniendo proxy…")
            self._run(self._api.proxy_stop, self._on_stopped)
        else:
            self.status_text.emit(f"Arrancando proxy en :{self._cfg['port']}…")
            self._run(
                lambda: self._api.proxy_start(
                    port=self._cfg["port"], mode=self._cfg["mode"],
                    extra=self._cfg["extra"], listen_host=self._cfg["listen_host"],
                ),
                self._on_started,
            )

    def _on_started(self, result: dict[str, Any]) -> None:
        status = result.get("status") if isinstance(result, dict) else None
        if status in ("started", "already_running"):
            port = result.get("port", self._cfg["port"])
            self._set_indicator(True)
            self.status_text.emit(f"Proxy escuchando en :{port} ({status})")
        else:
            err = result.get("error", "desconocido") if isinstance(result, dict) else "?"
            self.status_text.emit(f"No se pudo arrancar el proxy: {err}")
            self.refresh_status()

    def _on_stopped(self, _result: dict[str, Any]) -> None:
        self._set_indicator(False)
        self.status_text.emit("Proxy detenido")

    # -- API pública (comandos del menú) ------------------------------------ #
    def toggle(self) -> None:
        """Inicia o detiene el proxy (equivale al botón ▶/■)."""
        self._toggle()

    def open_config(self) -> None:
        """Abre el diálogo de configuración del proxy (equivale al botón ⚙)."""
        self._open_config()

    # -- navegador con el CA de Blackwire ----------------------------------- #
    def open_browser(self) -> None:
        """API pública (comando del menú): abre el navegador con el CA."""
        self._launch_browser()

    def _launch_browser(self) -> None:
        """Abre Chromium apuntando al proxy actual y confiando en el CA."""
        ok, msg = browser.launch_chromium(
            self._cfg.get("listen_host", ""), self._cfg.get("port", 8080)
        )
        if ok and not self._running:
            msg += " — recuerda iniciar el proxy (Start)"
        self.status_text.emit(msg)

    # -- configuración ------------------------------------------------------ #
    def _open_config(self) -> None:
        dlg = _ProxyConfigDialog(self._cfg, self._interfaces, self)
        if dlg.exec() != QDialog.Accepted:
            return
        self._cfg = dlg.values()
        self._set_indicator(self._running)
        self._persist_config()
        if self._running:
            self.status_text.emit(
                "Config guardada. Reinicia el proxy (Stop/Start) para aplicar el puerto."
            )
        else:
            self.status_text.emit("Config del proxy guardada")

    def _persist_config(self) -> None:
        """Guarda puerto/modo/args en el config.json del proyecto activo."""
        def _save(detail: dict[str, Any]) -> None:
            name = (detail or {}).get("project")
            config = (detail or {}).get("config") or {}
            if not name:
                return
            config["proxy_port"] = self._cfg["port"]
            config["proxy_mode"] = self._cfg["mode"]
            config["proxy_args"] = self._cfg["extra"]
            self._run(lambda: self._api.update_project(name, config), lambda _r: None)

        self._run(self._api.current_project_detail, _save)
