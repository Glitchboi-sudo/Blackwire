"""Shell nativo de Blackwire (Fases 0-3).

Organización estilo Burp Suite: una barra de **herramientas** (pestañas) como área
central — Proxy / Repeater / Comparer / Scope — cada una en su propia pantalla. La
pantalla **Proxy** es un `QMainWindow` anidado con docking propio (History arriba,
Request/Response al centro, Intercept abajo) y layout guardable; el resto de
herramientas son pantallas limpias y separadas.

Regla de seguridad transversal: el contenido interceptado se muestra SIEMPRE en
texto plano (`setPlainText`), nunca `setHtml` con datos no confiables.
"""

from __future__ import annotations

import json
import sys
import webbrowser
from typing import Any, Callable

from PySide6.QtCore import QObject, QRunnable, Qt, QThreadPool, Signal
from PySide6.QtGui import QAction, QActionGroup, QGuiApplication
from PySide6.QtWidgets import (
    QApplication,
    QDockWidget,
    QFileDialog,
    QInputDialog,
    QMessageBox,
    QLabel,
    QMainWindow,
    QSplitter,
    QStatusBar,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from . import themes
from . import i18n
from .i18n import t
from .api import ApiError, BlackwireApi
from .commands import Command, CommandPalette, CommandRegistry
from .widgets import icons
from .widgets.nav_rail import NavRail
from .widgets.asset_profile import AssetProfilePanel
from .widgets.bypass import BypassPanel
from .widgets.console import ConsolePanel
from .httpql import httpql_parse
from .settings import Settings
from .widgets.collections import CollectionsPanel
from .widgets.comparer import ComparerPanel
from .widgets.decoder import DecoderPanel
from .widgets.history import HistoryPanel
from .widgets.http_view import HttpView
from .widgets.intercept import InterceptPanel
from .widgets.intruder import IntruderPanel
from .widgets.match_replace import MatchReplacePanel
from .widgets.projects import ProjectsPanel
from .widgets.proxy_control import ProxyControl
from .widgets.mcp_control import McpControl
from .widgets.repeater import RepeaterPanel
from .widgets.scope import ScopePanel
from .widgets.sensitive import SensitivePanel
from .widgets.session import SessionPanel
from .widgets.session_macros import SessionMacrosPanel
from .widgets.webhook_site import WebhookSitePanel
from .widgets.websocket_viewer import WebSocketPanel
from .ws_client import LiveHistoryClient
from .backend_server import BackendServer, BackendError
from .docker_runtime import make_backend_runtime, DockerError


# --------------------------------------------------------------------------- #
# Gestor de tema: aplica el QSS a la QApplication y expone colores derivados.
# --------------------------------------------------------------------------- #
class ThemeManager(QObject):
    """Aplica temas/densidad en caliente y notifica a quien pinte colores."""

    changed = Signal()

    def __init__(self, app: QApplication, settings: Settings) -> None:
        super().__init__()
        self._app = app
        self._settings = settings

    @property
    def tokens(self) -> dict[str, str]:
        return themes.THEMES[self._settings.theme]["tokens"]

    def status_colors(self) -> dict[int, str]:
        return themes.status_colors(self.tokens)

    def highlight_palette(self) -> dict[str, Any]:
        return themes.highlight_palette(self.tokens)

    def apply(self) -> None:
        qss = themes.build_qss(self.tokens, self._settings.density)
        self._app.setStyleSheet(qss)
        self.changed.emit()

    def set_theme(self, key: str) -> None:
        if key in themes.THEMES:
            self._settings.theme = key
            self.apply()

    def set_density(self, key: str) -> None:
        if key in themes.DENSITIES:
            self._settings.density = key
            self.apply()


# --------------------------------------------------------------------------- #
# Tareas en background (no congelar la UI en llamadas de red).
# --------------------------------------------------------------------------- #
class _TaskSignals(QObject):
    ok = Signal(object)
    err = Signal(str)


class _Task(QRunnable):
    def __init__(self, fn: Callable[[], Any]) -> None:
        super().__init__()
        self._fn = fn
        self.signals = _TaskSignals()

    def run(self) -> None:
        try:
            self.signals.ok.emit(self._fn())
        except Exception as exc:  # noqa: BLE001 - reportar a la UI
            self.signals.err.emit(str(exc))


# --------------------------------------------------------------------------- #
# Formateo a texto plano (regla de seguridad: solo texto, sin HTML).
# --------------------------------------------------------------------------- #
def _fmt_headers(headers: dict[str, Any] | None) -> str:
    if not headers:
        return ""
    return "\n".join(f"{k}: {v}" for k, v in headers.items())


def format_request(detail: dict[str, Any]) -> str:
    parts = [f"{detail.get('method', '')} {detail.get('url', '')}".strip()]
    hdrs = _fmt_headers(detail.get("headers"))
    if hdrs:
        parts.append(hdrs)
    body = detail.get("body")
    if body:
        parts.append("")
        parts.append(str(body))
    return "\n".join(parts)


def format_response(detail: dict[str, Any]) -> str:
    status = detail.get("response_status")
    parts = [f"HTTP {status}" if status else "(sin respuesta)"]
    hdrs = _fmt_headers(detail.get("response_headers"))
    if hdrs:
        parts.append(hdrs)
    body = detail.get("response_body")
    if body:
        parts.append("")
        parts.append(str(body))
    return "\n".join(parts)


def _titled(title: str, obj_name: str, inner: QWidget) -> QWidget:
    box = QWidget()
    lay = QVBoxLayout(box)
    lay.setContentsMargins(0, 0, 0, 0)
    lay.setSpacing(0)
    label = QLabel(title)
    label.setObjectName(obj_name)
    label.setProperty("class", "SectionLabel")
    lay.addWidget(label)
    lay.addWidget(inner)
    return box


# --------------------------------------------------------------------------- #
# Pantalla Proxy: QMainWindow anidado con docking propio (layout guardable).
# --------------------------------------------------------------------------- #
class ProxyPage(QWidget):
    """Página Proxy estilo Burp: sub-pestañas 'HTTP history' e 'Intercept'.

    La sub-pestaña 'HTTP history' es un `QMainWindow` anidado (History dock arriba +
    Request/Response al centro) con layout guardable; 'Intercept' es su propia
    sub-pestaña limpia, no un dock apretado al fondo.
    """

    HISTORY_TAB = 0
    INTERCEPT_TAB = 1
    WS_TAB = 2
    CONSOLE_TAB = 3

    def __init__(self, history: HistoryPanel, intercept: InterceptPanel,
                 websocket: QWidget, console: QWidget,
                 palette: dict[str, Any]) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self.sub = QTabWidget()
        self.sub.setDocumentMode(True)

        # Sub-pestaña "HTTP history": QMainWindow anidado con docking propio.
        self._hist_win = QMainWindow()
        self._hist_win.setDockNestingEnabled(True)
        splitter = QSplitter(Qt.Horizontal)
        # Visores Pretty/Raw/Hex con resaltado + menú contextual (estilo Burp).
        self.req_view = HttpView(palette)
        self.resp_view = HttpView(palette)
        self.req_view.set_placeholder(t("Select a request in the history"))
        self.resp_view.set_placeholder(t("No response"))
        splitter.addWidget(_titled("Request", "ReqLabel", self.req_view))
        splitter.addWidget(_titled("Response", "RespLabel", self.resp_view))
        splitter.setSizes([680, 680])
        self._hist_win.setCentralWidget(splitter)
        self.history_dock = self._dock(
            t("HTTP history"), "HistoryDock", history, Qt.TopDockWidgetArea
        )
        self.history_dock.setMinimumHeight(240)

        self.sub.addTab(self._hist_win, t("HTTP history"))
        self.sub.addTab(intercept, t("Intercept"))
        self.sub.addTab(websocket, t("WS"))
        self.sub.addTab(console, t("Console"))
        layout.addWidget(self.sub)

    def _dock(self, title: str, obj_name: str, widget: QWidget, area) -> QDockWidget:
        dock = QDockWidget(title, self._hist_win)
        dock.setObjectName(obj_name)  # necesario para saveState/restoreState
        dock.setWidget(widget)
        dock.setFeatures(
            QDockWidget.DockWidgetMovable | QDockWidget.DockWidgetFloatable
        )
        self._hist_win.addDockWidget(area, dock)
        return dock

    # -- layout del QMainWindow anidado (lo persiste el shell) -------------- #
    def saveState(self) -> Any:  # noqa: N802 - espejo de la API de QMainWindow
        return self._hist_win.saveState()

    def restoreState(self, state) -> bool:  # noqa: N802
        return self._hist_win.restoreState(state)

    def reset_layout(self) -> None:
        self._hist_win.addDockWidget(Qt.TopDockWidgetArea, self.history_dock)
        self.history_dock.setFloating(False)
        self.history_dock.show()
        self.sub.setCurrentIndex(self.HISTORY_TAB)

    def show_history(self) -> None:
        self.sub.setCurrentIndex(self.HISTORY_TAB)

    def show_intercept(self) -> None:
        self.sub.setCurrentIndex(self.INTERCEPT_TAB)

    def show_ws(self) -> None:
        self.sub.setCurrentIndex(self.WS_TAB)

    def show_console(self) -> None:
        self.sub.setCurrentIndex(self.CONSOLE_TAB)


# --------------------------------------------------------------------------- #
# Ventana principal
# --------------------------------------------------------------------------- #
class MainWindow(QMainWindow):
    def __init__(
        self, api: BlackwireApi, settings: Settings, theme: ThemeManager
    ) -> None:
        super().__init__()
        self._api = api
        self._settings = settings
        self._theme = theme
        self._pool = QThreadPool.globalInstance()
        self._commands = CommandRegistry(self, settings)
        self._live: LiveHistoryClient | None = None
        self._current_detail: dict[str, Any] | None = None
        self._backend: BackendServer | None = None

        # Paneles de dominio (Fases 2-3).
        self.history = HistoryPanel()
        self.history.set_status_colors(theme.status_colors())
        self._intercept = InterceptPanel(api, self._run, theme.highlight_palette())
        self._scope = ScopePanel(api, self._run)
        self._repeater = RepeaterPanel(api, self._run, theme.highlight_palette())
        self._comparer = ComparerPanel(tokens=lambda: self._theme.tokens)
        self._intruder = IntruderPanel(api, self._run)
        self._collections = CollectionsPanel(api, self._run)
        self._decoder = DecoderPanel(api, self._run)
        self._sensitive = SensitivePanel(api, self._run, lambda: self._theme.tokens)
        self._assets = AssetProfilePanel(api, self._run, lambda: self._theme.tokens)
        self._websocket = WebSocketPanel(api, self._run, theme.highlight_palette())
        self._session = SessionPanel(api, self._run)
        self._session_macros = SessionMacrosPanel(api, self._run)
        self._match_replace = MatchReplacePanel(api, self._run)
        self._webhook_site = WebhookSitePanel(api, self._run)
        self._projects = ProjectsPanel(api, self._run)
        self._console = ConsolePanel(api, self._run)
        self._bypass = BypassPanel(api, self._run)

        self.setWindowTitle(t("Blackwire — native"))
        self.resize(1360, 860)

        self._build_tools()
        self._build_statusbar()
        self._register_commands()
        self._build_menubar()
        self._wire_signals()

        self._theme.changed.connect(self._on_theme_changed)
        self._restore_layout()

    def _on_theme_changed(self) -> None:
        """Repropaga colores derivados del tema (status + resaltado de visores)."""
        self.history.set_status_colors(self._theme.status_colors())
        palette = self._theme.highlight_palette()
        self.req_view.set_palette(palette)
        self.resp_view.set_palette(palette)
        self._repeater.set_palette(palette)
        self._intercept.set_palette(palette)
        self._websocket.set_palette(palette)
        self._sensitive.set_palette(palette)
        self._proxy_ctl.refresh_theme()
        self._mcp_ctl.refresh_theme()

    # -- construcción de UI -------------------------------------------------- #
    def _build_tools(self) -> None:
        """Área central = rail de navegación (estilo Burp) + stack de páginas.

        Rail plano: cada herramienta es una página de primer nivel (se eliminó
        el anidamiento de dos niveles de pestañas). La única herramienta con
        sub-modos reales es **Proxy** (History / Intercept / WS / Console).
        """
        self.proxy = ProxyPage(self.history, self._intercept, self._websocket,
                               self._console, self._theme.highlight_palette())
        self.req_view = self.proxy.req_view
        self.resp_view = self.proxy.resp_view
        self._wire_detail_context_menus()

        self.tools = NavRail()
        # Config primero: lo primero con lo que interactúas (crear/elegir proyecto,
        # definir scope) — Projects es la página por defecto.
        self.tools.add_section(t("Config"))
        self.tools.addTab(self._projects, t("Projects"), "briefcase")
        self.tools.addTab(self._scope, t("Scope"), "target")
        self.tools.addTab(self._bypass, t("Proxy Bypass"), "shuffle")
        self.tools.add_section(t("Traffic"))
        self.tools.addTab(self.proxy, t("Proxy"), "arrow-left-right")
        self.tools.addTab(self._repeater, t("Repeater"), "repeat")
        self.tools.addTab(self._intruder, t("Intruder"), "crosshair")
        self.tools.addTab(self._collections, t("Collections"), "folder")
        self.tools.add_section(t("Tools"))
        self.tools.addTab(self._decoder, t("Decoder"), "code")
        self.tools.addTab(self._comparer, t("Comparer"), "columns")
        self.tools.addTab(self._sensitive, t("Sensitive"), "shield")
        self.tools.addTab(self._assets, t("Asset Profile"), "layout-grid")
        self.tools.addTab(self._session, t("Session"), "key")
        self.tools.addTab(self._session_macros, t("Macros"), "list")
        self.tools.addTab(self._match_replace, t("Match && Replace"), "replace")
        self.tools.addTab(self._webhook_site, t("Webhook.site"), "link")
        self.tools.finish()
        self.tools.currentChanged.connect(self._on_tool_changed)
        self.setCentralWidget(self.tools)

    def _build_statusbar(self) -> None:
        self.setStatusBar(QStatusBar())
        self._status = QLabel(f"Backend: {self._api.base_url}")
        self._project_label = QLabel(t("project: {name}", name="—"))
        self._project_label.setObjectName("Badge")
        self._proxy_ctl = ProxyControl(
            self._api, self._run, tokens=lambda: self._theme.tokens)
        self._proxy_ctl.status_text.connect(self._status.setText)
        self._mcp_ctl = McpControl(
            self._api, self._run, tokens=lambda: self._theme.tokens)
        self._mcp_ctl.status_text.connect(self._status.setText)
        self._live_dot = QLabel()
        self._live_label = QLabel(t("live: —"))
        self.statusBar().addWidget(self._status)
        self.statusBar().addPermanentWidget(self._project_label)
        self.statusBar().addPermanentWidget(self._proxy_ctl)
        self.statusBar().addPermanentWidget(self._mcp_ctl)
        self.statusBar().addPermanentWidget(self._live_dot)
        self.statusBar().addPermanentWidget(self._live_label)
        self._set_live("txt3", t("live: —"))

    def _set_live(self, color_token: str, text: str) -> None:
        """Indicador de conexión en vivo: punto temático + texto (sin glifos)."""
        tokens = self._theme.tokens
        color = tokens.get(color_token, tokens["txt3"])
        self._live_dot.setPixmap(icons.icon("circle", color, 9).pixmap(9, 9))
        self._live_label.setText(text)

    # -- comandos + menús ---------------------------------------------------- #
    def _register_commands(self) -> None:
        defs = [
            Command("refresh", t("Refresh history"), self.refresh_history, "F5"),
            Command("go_projects", t("Go to Projects"),
                    lambda: self._go(self._projects)),
            Command("palette", t("Command Palette…"), self.open_palette, "Ctrl+K"),
            Command("focus_filter", t("Focus HTTPQL filter"),
                    self._focus_filter, "Ctrl+L"),
            Command("toggle_intercept", t("Intercept: toggle on/off"),
                    self._intercept._toggle, "Ctrl+I"),
            Command("go_proxy", t("Go to Proxy (HTTP history)"),
                    self._go_history, "Ctrl+Shift+P"),
            Command("go_intercept", t("Go to Intercept"),
                    self._go_intercept, "Ctrl+Shift+I"),
            Command("go_repeater", t("Go to Repeater"),
                    lambda: self._go(self._repeater), "Ctrl+Shift+R"),
            Command("go_intruder", t("Go to Intruder"),
                    lambda: self._go(self._intruder)),
            Command("go_collections", t("Go to Collections"),
                    lambda: self._go(self._collections)),
            Command("go_decoder", t("Go to Decoder (Cipher/JWT)"),
                    lambda: self._go_util(self._decoder)),
            Command("go_sensitive", t("Go to Sensitive"),
                    lambda: self._go_util(self._sensitive)),
            Command("go_assets", t("Go to Asset Profile"),
                    lambda: self._go_util(self._assets)),
            Command("go_websocket", t("Go to WebSocket (Proxy)"), self._go_ws),
            Command("go_session", t("Go to Session rules"),
                    lambda: self._go_util(self._session)),
            Command("go_session_macros", t("Go to Session Macros"),
                    lambda: self._go_util(self._session_macros)),
            Command("go_match_replace", t("Go to Match & Replace"),
                    lambda: self._go_util(self._match_replace)),
            Command("go_webhook_site", t("Go to Webhook.site"),
                    lambda: self._go_util(self._webhook_site)),
            Command("go_comparer", t("Go to Comparer"),
                    lambda: self._go_util(self._comparer), "Ctrl+Shift+C"),
            Command("go_scope", t("Go to Scope"),
                    lambda: self._go(self._scope), "Ctrl+Shift+S"),
            Command("go_bypass", t("Go to Proxy Bypass"),
                    self._go_bypass),
            Command("go_console", t("Go to Console (proxy logs)"),
                    self._go_console),
            Command("open_browser", t("Open browser with Blackwire CA"),
                    self._proxy_ctl.open_browser, "Ctrl+Shift+B"),
            Command("mcp_toggle", t("MCP: enable/disable gate"),
                    self._mcp_ctl.toggle, "Ctrl+Shift+M"),
            Command("mcp_copy_config", t("MCP: copy client config"),
                    self._mcp_ctl.copy_config),
            Command("mcp_activity", t("MCP: show activity"),
                    self._mcp_ctl.show_activity),
            Command("send_to_collection", t("Add request to Collections"),
                    self.send_to_collection),
            Command("send_to_repeater", t("Send to Repeater"),
                    self.send_to_repeater, "Ctrl+R"),
            Command("save_repeater", t("Repeater: save tab"),
                    self._repeater.save_current, "Ctrl+S"),
            Command("send_to_intruder", t("Send to Intruder"),
                    self.send_to_intruder, "Ctrl+Shift+J"),
            Command("cmp_a", t("Comparer: set A = current request"),
                    self.compare_set_a),
            Command("cmp_b", t("Comparer: set B = current response"),
                    self.compare_set_b),
            Command("next_theme", t("Theme: next"), self.cycle_theme, "Ctrl+Shift+T"),
            Command("save_layout", t("Save Proxy layout…"),
                    self.save_named_layout),
            Command("load_layout", t("Load Proxy layout…"),
                    self.load_named_layout),
            Command("reset_layout", t("Reset Proxy layout"),
                    self.reset_layout),
            Command("quit", t("Quit"), self.close, "Ctrl+Q"),
        ]
        for cmd in defs:
            self._commands.register(cmd)

    def _build_menubar(self) -> None:
        bar = self.menuBar()

        file_menu = bar.addMenu(t("&File"))
        file_menu.addAction(self._commands.action("refresh"))
        file_menu.addSeparator()

        # Proyecto de trabajo: crear y cambiar (el submenú se puebla al abrirlo).
        act_new_proj = QAction(t("New project…"), self)
        act_new_proj.triggered.connect(self._projects.new_project)
        file_menu.addAction(act_new_proj)
        self._switch_proj_menu = file_menu.addMenu(t("Switch project"))
        self._switch_proj_menu.aboutToShow.connect(self._populate_switch_projects)
        file_menu.addSeparator()

        exp_json = QAction(t("Export project (JSON)…"), self)
        exp_json.triggered.connect(lambda: self._export_project("json"))
        exp_burp = QAction(t("Export project (Burp XML)…"), self)
        exp_burp.triggered.connect(lambda: self._export_project("burp"))
        imp_burp = QAction(t("Import Burp XML…"), self)
        imp_burp.triggered.connect(self._import_burp)
        imp_json = QAction(t("Import into project (JSON)…"), self)
        imp_json.triggered.connect(self._import_project_json)
        file_menu.addAction(exp_json)
        file_menu.addAction(exp_burp)
        file_menu.addAction(imp_burp)
        file_menu.addAction(imp_json)
        file_menu.addSeparator()
        act_shutdown = QAction(t("Shut down backend"), self)
        act_shutdown.triggered.connect(self._shutdown_server)
        file_menu.addAction(act_shutdown)
        file_menu.addAction(self._commands.action("quit"))

        tools_menu = bar.addMenu(t("&Tools"))

        # Proxy ▸ — acciones reales de control del proxy.
        proxy_sub = tools_menu.addMenu(t("Proxy"))
        act_toggle = QAction(t("Start / Stop proxy"), self)
        act_toggle.triggered.connect(self._proxy_ctl.toggle)
        proxy_sub.addAction(act_toggle)
        act_int = QAction(t("Enable / Disable Intercept"), self)
        act_int.triggered.connect(self._intercept.toggle)
        proxy_sub.addAction(act_int)
        proxy_sub.addAction(self._commands.action("open_browser"))
        act_cfg = QAction(t("Proxy settings…"), self)
        act_cfg.triggered.connect(self._proxy_ctl.open_config)
        proxy_sub.addAction(act_cfg)

        # MCP ▸ — puerta para agentes de IA (servidor MCP por stdio).
        mcp_sub = tools_menu.addMenu(t("MCP (AI agents)"))
        mcp_sub.addAction(self._commands.action("mcp_toggle"))
        mcp_sub.addAction(self._commands.action("mcp_copy_config"))
        mcp_sub.addAction(self._commands.action("mcp_activity"))

        tools_menu.addSeparator()

        # Enviar el request seleccionado a otra herramienta.
        send_sub = tools_menu.addMenu(t("Send current request to"))
        send_sub.addAction(self._commands.action("send_to_repeater"))
        send_sub.addAction(self._commands.action("send_to_intruder"))
        send_sub.addAction(self._commands.action("send_to_collection"))

        tools_menu.addSeparator()

        # Utilidades (abren la herramienta directamente, con etiqueta limpia).
        util_decoder = QAction(t("Decoder"), self)
        util_decoder.triggered.connect(lambda: self._go_util(self._decoder))
        util_comparer = QAction(t("Comparer"), self)
        util_comparer.triggered.connect(lambda: self._go_util(self._comparer))
        util_sensitive = QAction(t("Sensitive Discovery"), self)
        util_sensitive.triggered.connect(lambda: self._go_util(self._sensitive))
        tools_menu.addActions([util_decoder, util_comparer, util_sensitive])

        tools_menu.addSeparator()

        # Navegar a… — la vieja lista de 16 pestañas, ahora como submenú demoted.
        nav_sub = tools_menu.addMenu(t("Navigate to"))
        for cid in ("go_projects", "go_scope", "go_bypass", "go_proxy",
                    "go_intercept", "go_websocket", "go_console",
                    "go_collections", "go_repeater", "go_intruder",
                    "go_sensitive", "go_assets", "go_session", "go_session_macros",
                    "go_match_replace",
                    "go_webhook_site", "go_comparer", "go_decoder"):
            nav_sub.addAction(self._commands.action(cid))

        view_menu = bar.addMenu(t("&View"))
        view_menu.addAction(self._commands.action("palette"))
        view_menu.addSeparator()

        theme_menu = view_menu.addMenu(t("Theme"))
        theme_menu.addAction(self._commands.action("next_theme"))
        theme_menu.addSeparator()
        self._theme_group = QActionGroup(self)
        self._theme_group.setExclusive(True)
        current = self._settings.theme
        for key, spec in themes.THEMES.items():
            act = QAction(spec["label"], self, checkable=True)
            act.setChecked(key == current)
            act.triggered.connect(lambda _c, k=key: self._pick_theme(k))
            self._theme_group.addAction(act)
            theme_menu.addAction(act)

        density_menu = view_menu.addMenu(t("Density"))
        self._density_group = QActionGroup(self)
        self._density_group.setExclusive(True)
        cur_density = self._settings.density
        for key, spec in themes.DENSITIES.items():
            act = QAction(t(spec["label"]), self, checkable=True)
            act.setChecked(key == cur_density)
            act.triggered.connect(lambda _c, k=key: self._pick_density(k))
            self._density_group.addAction(act)
            density_menu.addAction(act)

        lang_menu = view_menu.addMenu(t("Language"))
        self._lang_group = QActionGroup(self)
        self._lang_group.setExclusive(True)
        cur_lang = self._settings.language
        for code, label in i18n.LANGUAGES.items():
            act = QAction(label, self, checkable=True)
            act.setChecked(code == cur_lang)
            act.triggered.connect(lambda _c, k=code: self._pick_language(k))
            self._lang_group.addAction(act)
            lang_menu.addAction(act)

        view_menu.addSeparator()
        view_menu.addAction(self._commands.action("save_layout"))
        view_menu.addAction(self._commands.action("load_layout"))
        view_menu.addAction(self._commands.action("reset_layout"))

        # -- Ayuda ---------------------------------------------------------- #
        help_menu = bar.addMenu(t("&Help"))
        act_about = QAction(t("About Blackwire"), self)
        act_about.triggered.connect(self._show_about)
        help_menu.addAction(act_about)
        act_docs = QAction(t("Documentation (Blackwire.wiki)"), self)
        act_docs.triggered.connect(
            lambda: webbrowser.open("https://github.com/Glitchboi-sudo/Blackwire/wiki")
        )
        help_menu.addAction(act_docs)
        act_shortcuts = QAction(t("Keyboard shortcuts…"), self)
        act_shortcuts.triggered.connect(self._show_shortcuts)
        help_menu.addAction(act_shortcuts)

    def _wire_signals(self) -> None:
        self.history.search_requested.connect(self._do_search)
        self.history.request_selected.connect(self._load_detail)
        self.history.context_action.connect(self._on_context_action)
        self.history.preset_apply.connect(self._do_search)
        self.history.preset_save.connect(self._on_preset_save)
        self.history.preset_delete.connect(self._on_preset_delete)
        self.history.clear_requested.connect(self._on_clear_history)
        self._intercept.status_text.connect(self._status.setText)
        self._intruder.status_text.connect(self._status.setText)
        self._intruder.send_to_repeater.connect(self._open_repeater_from_detail)
        self._match_replace.status_text.connect(self._status.setText)
        self._webhook_site.status_text.connect(self._status.setText)
        self._webhook_site.send_to_repeater.connect(self._open_repeater_from_detail)
        self._projects.status_text.connect(self._status.setText)
        self._projects.project_changed.connect(self._on_project_changed)
        self._bypass.status_text.connect(self._status.setText)
        self._scope.scope_changed.connect(self.refresh_history)

    # -- navegación entre herramientas -------------------------------------- #
    def _go(self, widget: QWidget) -> None:
        self.tools.setCurrentWidget(widget)

    def _on_tool_changed(self, index: int) -> None:
        self._settings.last_tool = index

    def _go_history(self) -> None:
        self._go(self.proxy)
        self.proxy.show_history()

    def _go_intercept(self) -> None:
        self._go(self.proxy)
        self.proxy.show_intercept()

    def _go_ws(self) -> None:
        self._go(self.proxy)
        self.proxy.show_ws()

    def _go_console(self) -> None:
        self._go(self.proxy)
        self.proxy.show_console()

    def _go_bypass(self) -> None:
        self._go(self._bypass)

    def _go_util(self, widget: QWidget) -> None:
        """Abre la herramienta (ahora una página de primer nivel del rail)."""
        self._go(widget)

    def _focus_filter(self) -> None:
        self._go_history()
        self.history.focus_filter()

    # -- proyectos ----------------------------------------------------------- #
    def _on_project_changed(self) -> None:
        """El proyecto activo cambió: recargar todos los datos y el badge."""
        self.load_initial()
        self._update_project_badge()

    def _update_project_badge(self) -> None:
        self._run(
            self._api.current_project,
            lambda name: self._project_label.setText(t("project: {name}", name=name or "—")),
        )

    # -- acciones de tema ---------------------------------------------------- #
    def _pick_theme(self, key: str) -> None:
        self._theme.set_theme(key)

    def cycle_theme(self) -> None:
        keys = list(themes.THEMES)
        idx = (keys.index(self._settings.theme) + 1) % len(keys)
        new_key = keys[idx]
        self._theme.set_theme(new_key)
        for act in self._theme_group.actions():
            act.setChecked(act.text() == themes.THEMES[new_key]["label"])
        self._status.setText(t("Theme: {name}", name=themes.THEMES[new_key]["label"]))

    def _pick_density(self, key: str) -> None:
        self._theme.set_density(key)
        self._status.setText(
            t("Density: {name}", name=t(themes.DENSITIES[key]["label"]))
        )

    # -- idioma (requiere reinicio: las cadenas se resuelven al construir) --- #
    def _pick_language(self, code: str) -> None:
        if code == self._settings.language:
            return
        self._settings.language = code
        self._settings.sync()
        self._status.setText(t("Language: {name}", name=i18n.LANGUAGES[code]))
        resp = QMessageBox.question(
            self, t("Restart required"),
            t("The language changes after restarting Blackwire. Restart now?"),
        )
        if resp == QMessageBox.Yes:
            self._restart_app()

    def _restart_app(self) -> None:
        """Persiste el estado y relanza el proceso con los mismos argumentos."""
        from PySide6.QtCore import QProcess
        self._settings.geometry = self.saveGeometry()
        self._settings.window_state = self.proxy.saveState()
        self._settings.last_tool = self.tools.currentIndex()
        self._settings.sync()
        if self._live is not None:
            self._live.stop()
        QProcess.startDetached(sys.executable, sys.argv)
        QApplication.quit()

    # -- menú Archivo: cambiar de proyecto ---------------------------------- #
    def _populate_switch_projects(self) -> None:
        """Rellena el submenú 'Cambiar de proyecto' al abrirlo (lista cacheada)."""
        menu = self._switch_proj_menu
        menu.clear()
        projects = self._projects.known_projects()
        if not projects:
            act = menu.addAction(t("(no projects)"))
            act.setEnabled(False)
            return
        for proj in projects:
            name = proj.get("name", "?")
            act = menu.addAction(name)
            act.setCheckable(True)
            if proj.get("is_current"):
                act.setChecked(True)
                act.setEnabled(False)  # ya es el activo
            else:
                act.triggered.connect(
                    lambda _c=False, n=name: self._projects.activate_by_name(n)
                )

    # -- menú Ayuda --------------------------------------------------------- #
    def _show_about(self) -> None:
        from . import __version__
        QMessageBox.about(
            self, t("About Blackwire"),
            f"<b>Blackwire</b> — GUI (PySide6)<br>"
            f"{t('Version')} {__version__}<br><br>"
            f"{t('Proxy interceptor HTTP/HTTPS for security testing.')}<br>"
            f"Backend: {self._api.base_url}",
        )

    # -- command palette ----------------------------------------------------- #
    def open_palette(self) -> None:
        CommandPalette(self._commands, self).exec()

    def _show_shortcuts(self) -> None:
        """Referencia de atajos: comandos con tecla asignada (antes abría la paleta)."""
        rows = []
        for cmd in self._commands.commands():
            seq = self._commands.shortcut_text(cmd.id)
            if seq:
                rows.append((seq, cmd.title))
        rows.sort(key=lambda r: r[1].lower())
        body = "\n".join(f"{seq}  —  {title}" for seq, title in rows)
        box = QMessageBox(self)
        box.setWindowTitle(t("Keyboard shortcuts"))
        box.setText(t("Keyboard shortcuts"))
        box.setInformativeText(body or t("No shortcuts assigned."))
        box.exec()

    # -- layout del Proxy: persistencia y layouts con nombre ---------------- #
    def _restore_layout(self) -> None:
        geo = self._settings.geometry
        if geo is not None:
            self.restoreGeometry(geo)
        state = self._settings.window_state
        if state is not None:
            self.proxy.restoreState(state)
        self.tools.setCurrentIndex(
            min(self._settings.last_tool, self.tools.count() - 1)
        )

    def reset_layout(self) -> None:
        self.proxy.reset_layout()
        self._go(self.proxy)
        self._status.setText(t("Proxy layout reset"))

    def save_named_layout(self) -> None:
        name, ok = QInputDialog.getText(self, t("Save layout"), t("Layout name:"))
        if ok and name.strip():
            self._settings.save_named_layout(name.strip(), self.proxy.saveState())
            self._status.setText(t("Layout '{name}' saved", name=name.strip()))

    def load_named_layout(self) -> None:
        names = self._settings.layout_names()
        if not names:
            self._status.setText(t("No saved layouts"))
            return
        name, ok = QInputDialog.getItem(
            self, t("Load layout"), t("Layout:"), names, 0, False
        )
        if ok and name:
            state = self._settings.named_layout(name)
            if state is not None:
                self.proxy.restoreState(state)
                self._status.setText(t("Layout '{name}' loaded", name=name))

    # -- búsqueda / historial ----------------------------------------------- #
    def _run(self, fn: Callable[[], Any], on_ok: Callable[[Any], None]) -> None:
        task = _Task(fn)
        task.signals.ok.connect(on_ok)
        task.signals.err.connect(self._on_error)
        self._pool.start(task)

    def refresh_history(self) -> None:
        """Re-ejecuta la búsqueda con el filtro HTTPQL actual (o todo si vacío)."""
        self._do_search(self.history.current_filter())

    def _do_search(self, query: str) -> None:
        ast, err = httpql_parse(query)
        if err:
            self.history.show_error(err)
            return
        self.history.show_error("")
        self._status.setText(t("Searching…"))
        page_size = self.history.page_size()
        self._run(
            lambda: self._api.search(query, ast, page=1, page_size=page_size),
            self._on_search_result,
        )

    def _on_search_result(self, result: Any) -> None:
        if isinstance(result, dict) and result.get("error"):
            self.history.show_error(str(result["error"]))
            return
        rows = result.get("requests", []) if isinstance(result, dict) else []
        self.history.set_rows(rows)
        total = result.get("total", len(rows)) if isinstance(result, dict) else len(rows)
        self._status.setText(f"Backend: {self._api.base_url}   ·   " + t("{n} requests", n=total))

    def _load_detail(self, rid: int) -> None:
        self._run(lambda: self._api.get_detail(rid), self._render_detail)

    def _render_detail(self, detail: dict[str, Any]) -> None:
        # Regla de seguridad: setPlainText, jamás setHtml con datos interceptados.
        self._current_detail = detail
        self._collections.load_from_detail(detail)
        self._session_macros.load_from_detail(detail)
        self.req_view.set_message(format_request(detail))
        self.resp_view.set_message(format_response(detail))

    # -- Repeater / Comparer (Fase 3) --------------------------------------- #
    def send_to_repeater(self) -> None:
        if self._current_detail is None:
            self._status.setText(t("Select a request first"))
            return
        self._repeater.new_tab(self._current_detail)
        self._go(self._repeater)

    def _open_repeater_from_detail(self, detail: dict[str, Any]) -> None:
        """Abre una pestaña de Repeater desde un detalle externo (p. ej. Webhook.site)."""
        self._repeater.new_tab(detail)
        self._go(self._repeater)

    # -- menú contextual de los visores Request/Response -------------------- #
    def _wire_detail_context_menus(self) -> None:
        """Acciones de clic derecho sobre los cuerpos de request/response."""
        self.req_view.set_context_actions([
            ("Enviar a Repeater", lambda _t: self.send_to_repeater()),
            ("Enviar a Intruder", lambda _t: self._detail_action("intruder")),
            ("Copiar como cURL", lambda _t: self._detail_action("copy_curl")),
            ("Guardar para SQLMap…", lambda _t: self._detail_action("sqlmap")),
            ("URL-decode selección", lambda t: self._decode_selection(t, "url")),
            ("Base64-decode selección", lambda t: self._decode_selection(t, "b64")),
        ])
        self.resp_view.set_context_actions([
            ("URL-decode selección", lambda t: self._decode_selection(t, "url")),
            ("Base64-decode selección", lambda t: self._decode_selection(t, "b64")),
        ])

    def _detail_action(self, action: str) -> None:
        """Ejecuta una acción de detalle sobre el request seleccionado actual."""
        if self._current_detail is None:
            self._status.setText(t("Select a request first"))
            return
        self._apply_detail_action(action, self._current_detail)

    def _decode_selection(self, text: str, kind: str) -> None:
        """Decodifica la selección (URL o Base64) y la copia al portapapeles."""
        import base64
        from urllib.parse import unquote
        sample = (text or "").strip()
        if not sample:
            self._status.setText(t("Select text to decode"))
            return
        try:
            if kind == "url":
                out = unquote(sample)
            else:
                pad = "=" * (-len(sample) % 4)
                out = base64.b64decode(sample + pad).decode("utf-8", "replace")
        except (ValueError, UnicodeDecodeError) as exc:
            self._status.setText(t("Could not decode: {err}", err=exc))
            return
        QGuiApplication.clipboard().setText(out)
        self._status.setText(t("Decoded ({kind}) copied to clipboard", kind=kind))

    # -- menú contextual del historial -------------------------------------- #
    def _on_context_action(self, action: str, rid: int, url: str) -> None:
        """Resuelve una acción del menú contextual del historial."""
        if action == "copy_url":
            QGuiApplication.clipboard().setText(url)
            self._status.setText(t("URL copied to clipboard"))
            return
        if action == "render":
            webbrowser.open(self._api.render_url(rid))
            return
        if action == "replay":
            webbrowser.open(self._api.replay_url(rid))
            return
        if action == "save":
            self._run(lambda: self._api.toggle_saved(rid),
                      lambda r: self._status.setText(
                          t("Favorite: {state}",
                            state=t("yes") if r.get("saved") else t("no"))))
            return
        if action == "delete":
            self._run(lambda: self._api.delete_request(rid),
                      lambda _r: self.refresh_history())
            return
        # El resto necesita el detalle completo (headers/body).
        self._run(lambda: self._api.get_detail(rid),
                  lambda detail: self._apply_detail_action(action, detail))

    def _apply_detail_action(self, action: str, detail: dict[str, Any]) -> None:
        from .rawhttp import to_curl, to_sqlmap_request
        if action == "repeater":
            self._repeater.new_tab(detail)
            self._go(self._repeater)
        elif action == "intruder":
            self._intruder.load_from_detail(detail)
            self._go(self._intruder)
        elif action == "collection":
            self._collections.load_from_detail(detail)
            self._go(self._collections)
            self._status.setText(t("Request ready: pick a collection and 'Add current request'"))
        elif action == "compare_a":
            self._comparer.set_a(format_request(detail), detail.get("url", "request"))
            self._go_util(self._comparer)
        elif action == "compare_b":
            self._comparer.set_b(format_response(detail), "respuesta")
            self._go_util(self._comparer)
        elif action == "copy_curl":
            cmd = to_curl(detail.get("method"), detail.get("url"),
                          detail.get("headers"), detail.get("body"))
            QGuiApplication.clipboard().setText(cmd)
            self._status.setText(t("cURL command copied to clipboard"))
        elif action == "sqlmap":
            raw = to_sqlmap_request(detail.get("method"), detail.get("url"),
                                    detail.get("headers"), detail.get("body"))
            path, _ = QFileDialog.getSaveFileName(
                self, "Guardar request para SQLMap", "request.txt"
            )
            if path:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(raw)
                self._status.setText(t("Request saved: sqlmap -r {path}", path=path))

    # -- Filter Presets ----------------------------------------------------- #
    def _load_presets(self) -> None:
        self._run(self._api.filter_presets, self.history.set_presets)

    def _on_preset_save(self) -> None:
        query = self.history.current_filter()
        if not query.strip():
            self._status.setText(t("The filter is empty; nothing to save"))
            return
        ast, err = httpql_parse(query)
        if err:
            self._status.setText(t("Invalid HTTPQL: {err}", err=err))
            return
        name, ok = QInputDialog.getText(self, t("Save preset"), t("Preset name:"))
        if ok and name.strip():
            self._run(
                lambda: self._api.create_filter_preset(name.strip(), query, ast),
                lambda _r: self._load_presets(),
            )

    def _on_preset_delete(self, preset_id: int) -> None:
        self._run(lambda: self._api.delete_filter_preset(preset_id),
                  lambda _r: self._load_presets())

    def _on_clear_history(self) -> None:
        """Vacía el historial no guardado (DELETE /api/requests), con confirmación."""
        resp = QMessageBox.question(
            self, t("Clear history"),
            t("Delete all non-saved requests from the history? "
              "Saved requests are kept."),
        )
        if resp != QMessageBox.Yes:
            return
        self._run(
            lambda: self._api.clear_history(keep_saved=True),
            lambda _r: self.refresh_history(),
        )

    def send_to_intruder(self) -> None:
        if self._current_detail is None:
            self._status.setText(t("Select a request first"))
            return
        self._intruder.load_from_detail(self._current_detail)
        self._go(self._intruder)

    def send_to_collection(self) -> None:
        if self._current_detail is None:
            self._status.setText(t("Select a request first"))
            return
        self._collections.load_from_detail(self._current_detail)
        self._go(self._collections)
        self._status.setText(t("Request ready: pick a collection and 'Add current request'"))

    # -- import / export (Fase 5) ------------------------------------------- #
    def _export_project(self, fmt: str) -> None:
        self._run(self._api.current_project, lambda name: self._do_export(name, fmt))

    def _do_export(self, name: str | None, fmt: str) -> None:
        if not name:
            self._status.setText(t("No active project"))
            return
        ext = "json" if fmt == "json" else "xml"
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar proyecto", f"blackwire-{name}.{ext}"
        )
        if not path:
            return
        fetch = (self._api.export_project_json if fmt == "json"
                 else self._api.export_project_burp)
        self._run(lambda: self._write_bytes(path, fetch(name)),
                  lambda p: self._status.setText(t("Exported to {path}", path=p)))

    @staticmethod
    def _write_bytes(path: str, data: bytes) -> str:
        with open(path, "wb") as fh:
            fh.write(data)
        return path

    def _import_burp(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Importar Burp XML", "", "XML (*.xml);;Todos (*)"
        )
        if not path:
            return
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            xml = fh.read()
        self._run(self._api.current_project,
                  lambda name: self._do_import_burp(name, xml))

    def _do_import_burp(self, name: str | None, xml: str) -> None:
        if not name:
            self._status.setText(t("No active project"))
            return
        self._run(lambda: self._api.import_burp_xml(name, xml), self._on_imported)

    def _on_imported(self, result: dict[str, Any]) -> None:
        imported = result.get("imported", "?")
        total = result.get("total", "?")
        self._status.setText(t("Imported {done}/{total} requests", done=imported, total=total))
        self.refresh_history()

    def _import_project_json(self) -> None:
        """Importa un export JSON de Blackwire al proyecto activo (merge o replace)."""
        path, _ = QFileDialog.getOpenFileName(
            self, t("Import JSON into project"), "", "JSON (*.json);;Todos (*)"
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError) as exc:
            self._status.setText(t("Error: {msg}", msg=str(exc)))
            return
        box = QMessageBox(self)
        box.setWindowTitle(t("Import into project"))
        box.setText(t("Merge into the current project, or replace its contents?"))
        merge_btn = box.addButton(t("Merge"), QMessageBox.AcceptRole)
        replace_btn = box.addButton(t("Replace"), QMessageBox.DestructiveRole)
        box.addButton(QMessageBox.Cancel)
        box.exec()
        clicked = box.clickedButton()
        if clicked not in (merge_btn, replace_btn):
            return
        clear = clicked is replace_btn
        self._run(
            self._api.current_project,
            lambda name: self._do_import_json(name, data, clear),
        )

    def _do_import_json(
        self, name: str | None, data: dict[str, Any], clear: bool
    ) -> None:
        if not name:
            self._status.setText(t("No active project"))
            return
        self._run(
            lambda: self._api.import_project_merge(name, data, clear_existing=clear),
            self._on_imported,
        )

    def _shutdown_server(self) -> None:
        resp = QMessageBox.question(
            self, t("Shut down backend"),
            t("This stops the backend server. The app will no longer work "
              "until it is restarted. Continue?"),
        )
        if resp != QMessageBox.Yes:
            return
        try:
            self._api.shutdown_server()
        except ApiError:
            pass  # el backend puede morir antes de responder; es esperable
        self._status.setText(t("Backend shut down"))

    def compare_set_a(self) -> None:
        if self._current_detail is None:
            return
        self._comparer.set_a(format_request(self._current_detail),
                             self._current_detail.get("url", "request"))
        self._go_util(self._comparer)

    def compare_set_b(self) -> None:
        if self._current_detail is None:
            return
        self._comparer.set_b(format_response(self._current_detail), "respuesta")
        self._go_util(self._comparer)

    # -- historial en vivo + eventos WS ------------------------------------- #
    def start_live(self) -> None:
        if self._live is not None:
            return
        self._live = LiveHistoryClient(self._api.base_url, self)
        self._live.new_request.connect(self._on_live_request)
        self._live.new_request.connect(self._assets.on_live_request)
        self._live.event.connect(self._intercept.on_ws_event)
        self._live.connected.connect(
            lambda: self._set_live("green", t("live: connected"))
        )
        self._live.disconnected.connect(
            lambda _m: self._set_live("orange", t("live: reconnecting…"))
        )
        self._live.start()

    def _on_live_request(self, row: dict[str, Any]) -> None:
        # Frames WS llegan como new_request con request_type 'websocket': refrescan
        # el visor WS en vivo en lugar de sumarse al historial HTTP.
        if row.get("request_type") == "websocket":
            self._websocket.on_live_frame(row.get("url", ""))
            return
        # Con un filtro HTTPQL activo no prependemos: evita filas que no casan.
        if not self.history.current_filter().strip():
            self.history.prepend_row(row)

    def _on_error(self, msg: str) -> None:
        self._status.setText(t("Error: {msg}", msg=msg))

    # -- arranque del backend ----------------------------------------------- #
    def ensure_backend(self) -> None:
        """Arranca el backend si no responde ya, y espera a que esté listo.

        Sin backend cualquier petición falla, así que esto corre antes de
        `load_initial()`. Reutiliza un backend ya en marcha (no abre otro).
        """
        if self._api.ping():
            return
        self._status.setText(t("Starting backend…"))
        QApplication.processEvents()
        self._backend = make_backend_runtime(self._api.base_url)
        try:
            self._backend.start()
        except (BackendError, DockerError) as exc:
            self._backend = None
            QMessageBox.critical(
                self, t("Backend error"),
                t("Could not start the backend:\n{err}", err=str(exc)),
            )
            return
        ready = self._backend.wait_ready(
            self._api.ping, timeout=30.0, on_tick=QApplication.processEvents
        )
        if ready:
            self._status.setText(f"Backend: {self._api.base_url}")
        else:
            QMessageBox.warning(
                self, t("Backend error"),
                t("The backend did not respond in time. Check the log:\n{log}",
                  log=str(self._backend.log_path)),
            )

    # -- arranque de datos --------------------------------------------------- #
    def load_initial(self) -> None:
        self._projects.reload()
        self._update_project_badge()
        self._proxy_ctl.load_project_config()
        self._proxy_ctl.refresh_status()
        self._load_presets()
        self.refresh_history()
        self._intercept.refresh_status()
        self._intercept.refresh_pending()
        self._scope.reload()
        self._repeater.load_saved()
        self._intruder.load_attacks()
        self._collections.reload()
        self._decoder.load_operations()
        self._session.reload()
        self._session_macros.reload()
        self._websocket.reload()
        self._match_replace.reload()
        self._webhook_site.reload()
        self._bypass.reload()
        self._console.reload()

    # -- ciclo de vida ------------------------------------------------------- #
    def closeEvent(self, event) -> None:  # noqa: N802 - API de Qt
        self._settings.geometry = self.saveGeometry()
        self._settings.window_state = self.proxy.saveState()
        self._settings.last_tool = self.tools.currentIndex()
        self._settings.sync()
        if self._live is not None:
            self._live.stop()
        if self._backend is not None:
            self._backend.stop()
        super().closeEvent(event)


# --------------------------------------------------------------------------- #
# Entrypoints
# --------------------------------------------------------------------------- #
def _make_app() -> QApplication:
    app = QApplication.instance() or QApplication(sys.argv)
    app.setApplicationName("Blackwire Desktop")
    return app


def _build(settings: Settings | None = None) -> tuple[QApplication, "MainWindow"]:
    settings = settings or Settings()
    i18n.set_language(settings.language)
    app = _make_app()
    theme = ThemeManager(app, settings)
    # Themed icons follow the active theme's text color (recolor on theme change).
    icons.install(lambda: theme.tokens["txt"])
    theme.changed.connect(icons.refresh)
    theme.apply()
    api = BlackwireApi(settings.base_url)
    win = MainWindow(api, settings, theme)
    return app, win


def selftest() -> int:
    """Smoke test headless (QT_QPA_PLATFORM=offscreen): valida tema, settings,
    navegación de herramientas, búsqueda HTTPQL, Site Map, Intercept, Scope,
    Repeater, Comparer y render seguro."""
    settings = Settings()
    app, win = _build(settings)

    assert app.styleSheet(), "QSS vacío tras aplicar tema"
    win._theme.set_theme("dracula")
    assert "#282a36" in app.styleSheet(), "tema no cambió en caliente"
    print(f"SELFTEST: temas={len(themes.THEMES)} densidad={settings.density}")

    # Navegación de herramientas (pestañas): Scope/Proxy/Collections/Repeater/
    # Intruder/Herramientas; WS dentro de Proxy; Sensitive/Session/Comparer/Decoder
    # dentro de Herramientas.
    assert win.tools.count() == 15, "el rail debe exponer 15 herramientas planas"
    assert win.proxy.sub.count() == 4, "Proxy debe tener 4 sub-pestañas (incl. WS/Console)"
    win._go(win._intruder)
    assert win.tools.currentWidget() is win._intruder, "no cambió a Intruder"
    win._go(win.proxy)
    print(f"SELFTEST: herramientas={win.tools.count()} "
          f"(proxy anidado docks={len(win.proxy.findChildren(QDockWidget))})")

    palette = CommandPalette(win._commands, win)
    palette._populate("inter")
    assert palette._list.count() >= 1, "paleta no filtró comandos"
    print(f"SELFTEST: comandos={len(win._commands.commands())}")

    ok_ast, ok_err = httpql_parse("req.method.eq:GET AND resp.code.gte:400")
    assert ok_ast and not ok_err, "HTTPQL válido falló"
    _, bad_err = httpql_parse("req.bad.eq:x")
    assert bad_err, "HTTPQL inválido no reportó error"
    print("SELFTEST: HTTPQL ok/err OK")

    if not win._api.ping():
        print("SELFTEST: backend no responde en", win._api.base_url)
        return 1

    result = win._api.search(page=1, page_size=50)
    rows = result.get("requests", [])
    win.history.set_rows(rows)
    print(f"SELFTEST: search rows={len(rows)} total={result.get('total')} "
          f"sitemap_hosts={win.history.tree.topLevelItemCount()}")
    detail = None
    if rows:
        detail = win._api.get_detail(rows[0]["id"])
        win._render_detail(detail)
        assert len(win.req_view.text()) > 0, "request vacío"
        assert win.req_view._tabs.count() == 4, "visor sin Pretty/Raw/Hex"
        assert win.resp_view._tabs.count() == 4, "resp sin Pretty/Raw/Hex"
        print(f"SELFTEST: detail id={rows[0]['id']} "
              f"req_chars={len(win.req_view.text())} views=Pretty/Raw/Hex/Render")

    status = win._api.intercept_status()
    scope = win._api.get_scope()
    print(f"SELFTEST: intercept enabled={status.get('enabled')} "
          f"pending={status.get('pending_count')} · scope rules={len(scope)}")

    win._intercept.on_ws_event("intercept_new", {"type": "intercept_new", "data": {
        "id": "abc123", "method": "POST", "url": "http://x/", "headers": {}, "body": ""}})
    assert win._intercept._list.count() == 1, "intercept_new no agregó pendiente"
    # Respuesta interceptada (Burp-style): aparece en la MISMA cola etiquetada RESP.
    win._intercept.on_ws_event("intercept_response_new", {
        "type": "intercept_response_new", "data": {
            "id": "resp9999", "method": "GET", "url": "http://x/",
            "status_code": 200, "headers": {"content-type": "application/json"},
            "body": '{"ok": true}'}})
    assert win._intercept._list.count() == 2, "intercept_response_new no agregó pendiente"
    from .widgets.intercept import (format_intercepted_response as _fr,
                                    parse_intercepted_response as _pr)
    _round = _pr(_fr({"status_code": 503, "headers": {"X-A": "1"}, "body": "hi"}))
    assert _round["status_code"] == 503 and _round["headers"].get("X-A") == "1", \
        "response round-trip falló"
    win._intercept.on_ws_event("response_forwarded", {"id": "resp9999"})
    assert win._intercept._list.count() == 1, "response_forwarded no quitó pendiente"
    print("SELFTEST: intercept WS event OK (req+resp, resp round-trip OK)")

    if detail:
        tab = win._repeater.new_tab(detail)
        assert tab.request_fields()["method"] == detail.get("method"), "repeater parse"
    send = win._api.repeater_send("GET", win._api.base_url + "/", {}, "", False)
    print(f"SELFTEST: repeater send status={send.get('status_code')} "
          f"err={send.get('error')}")

    win._comparer.set_a("linea1\nlinea2\nlinea3")
    win._comparer.set_b("linea1\nMODIFICADA\nlinea3\nlinea4")
    win._comparer.compare()
    assert win._comparer._diff.rowCount() > 0, "comparer no produjo diff"
    print(f"SELFTEST: comparer diff rows={win._comparer._diff.rowCount()}")

    # Intruder: marcadores, posiciones y combos.
    intr = win._intruder
    base = win._api.base_url
    # Regresión: el botón "Add §" no debe robar el foco (NoFocus), o _add_marker
    # no encontraría el editor con la selección. Probar inserción vía selección.
    from PySide6.QtWidgets import QPushButton as _QPB
    _addb = next(b for b in intr.findChildren(_QPB) if "Add" in b.text())
    assert int(_addb.focusPolicy()) == 0, "botón Add del Intruder robaría el foco"
    intr.body.setPlainText('{"u":"admin"}')
    _c = intr.body.textCursor(); _c.setPosition(6)
    _c.setPosition(11, _c.MoveMode.KeepAnchor); intr.body.setTextCursor(_c)
    intr.body.setFocus(); _addb.click()
    assert intr.body.toPlainText() == '{"u":"§admin§"}', "Add § no insertó marcadores"
    intr._clear_markers()
    intr.url.setText(base + "/api/requests?limit=§n§")
    intr._on_pos_changed(0)
    intr.payload_editor.type.setCurrentText("numbers")
    intr.payload_editor.n_from.setValue(1)
    intr.payload_editor.n_to.setValue(3)
    assert len(intr._positions) == 1, "intruder no detectó la posición §"
    combos = __import__("blackwire_desktop.intruder", fromlist=["x"]).\
        generate_attack_combinations(*[intr._template()[k] for k in
        ("url", "headers", "body", "method", "attack_type", "payloads")])
    print(f"SELFTEST: intruder positions={len(intr._positions)} combos={len(combos)}")
    assert len(combos) == 3, "intruder combos esperados=3"

    # Ataque real headless: ejecutar y esperar a finished.
    from PySide6.QtCore import QEventLoop, QTimer
    loop = QEventLoop()
    intr._runner.finished.connect(loop.quit)
    QTimer.singleShot(8000, loop.quit)  # timeout de seguridad
    intr._start()
    loop.exec()
    print(f"SELFTEST: intruder attack results={len(intr._results)} "
          f"status0={intr._results[0]['status'] if intr._results else 'n/a'}")
    assert len(intr._results) == 3, "intruder no completó los 3 requests"

    # Fase 5: Cipher (bake real), JWT round-trip, Collections/Session/Git/WS.
    from .jwt_tool import decode_jwt, encode_jwt
    from . import sensitive as _sens
    catalog = win._api.chepy_operations()
    bake = win._api.chepy_bake("hello", [{"name": "base64_encode", "args": {}}])
    print(f"SELFTEST: chepy cats={len(catalog)} base64(hello)={bake.get('output')}")
    assert bake.get("output") == "aGVsbG8=", "chepy base64 incorrecto"
    tok = encode_jwt({"alg": "none", "typ": "JWT"}, {"sub": "x", "exp": 9999999999}, "")
    dec = decode_jwt(tok)
    assert dec and dec["payload"]["sub"] == "x", "jwt round-trip falló"
    print(f"SELFTEST: jwt alg={dec['header']['alg']} sub={dec['payload']['sub']} "
          f"sensitive_patterns={len(_sens.DEFAULT_PATTERNS)}")
    if detail:
        finding = {"patternName": "X", "category": "secret", "match": "m",
                   "section": "body", "method": "GET", "url": "u",
                   "entropy": "4.0", "requestId": rows[0]["id"]}
        win._sensitive._results = [finding]
        win._sensitive._append_row(finding)
        win._sensitive._render_detail(detail)
        assert win._sensitive._req_view.text(), "sensitive req vacío"
        assert win._sensitive._resp_view._tabs.count() == 4, "sensitive resp sin tabs"
        print("SELFTEST: sensitive detail OK req_chars="
              f"{len(win._sensitive._req_view.text())}")
    colls = win._api.collections_list()
    rules = win._api.session_rules()
    conns = win._api.ws_connections()
    proj = win._api.current_project()
    print(f"SELFTEST: collections={len(colls)} session_rules={len(rules)} "
          f"ws_conns={len(conns)} project={proj}")

    # Match & Replace: round-trip de config (lee -> añade regla -> persiste -> relee).
    mr = win._match_replace
    ext_mr = win._api.extension_get("match_replace")
    mr._on_ext(ext_mr)
    before = len(mr._rules)
    test_rule = {"enabled": True, "when": "request", "target": "url",
                 "pattern": "selftest-xyz", "replace": "", "regex": False,
                 "ignore_case": False, "header": ""}
    saved = win._api.extension_update_config(
        "match_replace",
        {"enabled": bool((ext_mr or {}).get("config", {}).get("enabled")),
         "rules": list((ext_mr or {}).get("config", {}).get("rules", [])) + [test_rule]},
    )
    reloaded = win._api.extension_get("match_replace")
    after = len(reloaded.get("config", {}).get("rules", []))
    assert after == before + 1, "match_replace no persistió la regla"
    # Restaurar: dejar las reglas como estaban (sin la de prueba).
    win._api.extension_update_config(
        "match_replace", (ext_mr or {}).get("config") or {"enabled": False, "rules": []}
    )
    print(f"SELFTEST: match_replace rules {before}->{after} status={saved.get('status')}")

    # Webhook.site: leer extensión y listar requests locales (sin crear token real).
    ws_ext = win._api.extension_get("webhook_site")
    win._webhook_site._on_ext(ws_ext)
    wh_reqs = win._api.webhooksite_requests()
    print(f"SELFTEST: webhook_site token={'sí' if (ws_ext or {}).get('config',{}).get('token_id') else 'no'} "
          f"local_requests={len(wh_reqs)}")

    # Proyectos: listar y poblar el panel (sin crear/borrar para no ensuciar).
    projs = win._api.projects()
    win._projects._on_projects(projs)
    cur = win._api.current_project()
    print(f"SELFTEST: projects={len(projs)} current={cur} "
          f"list_rows={win._projects._list.count()}")
    assert win._projects._list.count() == len(projs), "panel de proyectos no pobló"

    # Menús: Ayuda existe, submenú 'Cambiar de proyecto' se puebla, densidad avisa.
    menus = {a.text(): a.menu() for a in win.menuBar().actions()}
    assert "A&yuda" in menus, "falta el menú Ayuda"
    win._populate_switch_projects()
    assert win._switch_proj_menu.actions(), "submenú 'Cambiar de proyecto' vacío"
    win._pick_density(win._settings.density)
    print(f"SELFTEST: menús={list(menus)} switch_proj={len(win._switch_proj_menu.actions())}")

    # Control del proxy: estado + siembra de config (sin arrancar mitmdump real).
    pstat = win._api.proxy_status()
    win._proxy_ctl._on_status(pstat)
    win._proxy_ctl.load_project_config()
    ifaces = win._api.proxy_interfaces()
    print(f"SELFTEST: proxy running={pstat.get('running')} "
          f"interfaces={len(ifaces)} cfg_port={win._proxy_ctl._cfg['port']}")
    # Diálogo de config: interfaces como [{label,address}] (regresión del TypeError).
    from .widgets.proxy_control import _ProxyConfigDialog
    dlg_ifaces = [{"label": "All interfaces", "address": "0.0.0.0"},
                  {"label": "Localhost only", "address": "127.0.0.1"}]
    dlg = _ProxyConfigDialog({"port": 8080, "mode": "regular", "extra": "",
                              "listen_host": "127.0.0.1"}, dlg_ifaces)
    assert dlg.values()["listen_host"] == "127.0.0.1", "proxy config dialog host"
    print("SELFTEST: proxy config dialog OK")

    # Acciones de request (cliente): cURL y SQLMap desde un detalle.
    from .rawhttp import to_curl, to_sqlmap_request
    sample = {"method": "POST", "url": "http://ex.com/a?x=1",
              "headers": {"Content-Type": "application/json"}, "body": "{\"k\":1}"}
    curl = to_curl(sample["method"], sample["url"], sample["headers"], sample["body"])
    sqlr = to_sqlmap_request(sample["method"], sample["url"], sample["headers"],
                             sample["body"])
    assert curl.startswith("curl -X POST") and "Content-Type" in curl, "cURL mal formado"
    assert sqlr.startswith("POST /a?x=1 HTTP/1.1") and "Host: ex.com" in sqlr, "SQLMap mal"
    print(f"SELFTEST: curl_len={len(curl)} sqlmap_hostline={'Host: ex.com' in sqlr}")

    # Filter presets: crear -> listar -> poblar menú -> eliminar.
    pq = "req.method.eq:GET"
    past, _ = httpql_parse(pq)
    win._api.create_filter_preset("selftest-preset", pq, past)
    presets = win._api.filter_presets()
    win.history.set_presets(presets)
    made = next((p for p in presets if p["name"] == "selftest-preset"), None)
    print(f"SELFTEST: filter_presets={len(presets)} created={bool(made)}")
    if made:
        win._api.delete_filter_preset(made["id"])

    # Console + Bypass: listar logs y reglas/presets.
    logs = win._api.console_logs(100)
    win._console._on_logs(logs)
    brules = win._api.bypass_rules()
    bpresets = win._api.bypass_presets()
    win._bypass._on_rules(brules)
    win._bypass._on_presets(bpresets)
    print(f"SELFTEST: console_logs={len(logs)} bypass_rules={len(brules)} "
          f"bypass_presets={len(bpresets)}")

    from . import browser as _br
    assert any(c.id == "open_browser" for c in win._commands.commands()), \
        "falta el comando open_browser"
    _ca = _br.resolve_ca_path()
    print(f"SELFTEST: browser bin={_br.find_browser() is not None} "
          f"ca={_ca is not None} spki={_br.compute_spki(_ca) is not None if _ca else False}")

    # Puerta MCP: comando/widget + round-trip enable/disable + config de cliente.
    assert any(c.id == "mcp_toggle" for c in win._commands.commands()), \
        "falta el comando mcp_toggle"
    assert win._mcp_ctl is not None, "falta el widget McpControl"
    mcp_before = win._api.mcp_status()
    mcp_en = win._api.mcp_enable()
    assert mcp_en.get("enabled") is True, "mcp_enable no activó la puerta"
    win._mcp_ctl._on_status(win._api.mcp_status())
    win._api.mcp_activity(10)
    mcp_dis = win._api.mcp_disable()
    assert mcp_dis.get("enabled") is False, "mcp_disable no cerró la puerta"
    mcp_cfg = win._mcp_ctl._client_config()
    # Dev usa `-m mcp_server.server`; el build empaquetado usa `--mcp` (mismo binario).
    assert "mcpServers" in mcp_cfg and (
        "mcp_server.server" in mcp_cfg or "--mcp" in mcp_cfg), \
        "config de cliente MCP mal formado"
    print(f"SELFTEST: mcp before={mcp_before.get('enabled')} "
          f"enable={mcp_en.get('enabled')} disable={mcp_dis.get('enabled')} cfg_ok=True")

    # Backend runtime: selección host/docker + resolución del compose (sin Docker).
    import os as _os
    from . import docker_runtime as _dr
    from .backend_server import BackendServer as _BS
    _prev = _os.environ.get("BLACKWIRE_BACKEND_MODE")
    _os.environ["BLACKWIRE_BACKEND_MODE"] = "host"
    assert isinstance(_dr.make_backend_runtime("http://127.0.0.1:5000"), _BS), \
        "host mode debe dar BackendServer"
    _os.environ["BLACKWIRE_BACKEND_MODE"] = "docker"
    _rt = _dr.make_backend_runtime("http://127.0.0.1:5000")
    assert isinstance(_rt, _dr.DockerRuntime), "docker mode debe dar DockerRuntime"
    if _prev is None:
        _os.environ.pop("BLACKWIRE_BACKEND_MODE", None)
    else:
        _os.environ["BLACKWIRE_BACKEND_MODE"] = _prev
    _res = _dr._resource_dir()
    print(f"SELFTEST: backend_runtime host->BackendServer docker->DockerRuntime "
          f"compose_dir={'found' if _res else 'MISSING'}")

    win.close()
    app.quit()
    print("SELFTEST: OK")
    return 0


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    app, win = _build()
    win.show()
    win.ensure_backend()
    win.load_initial()
    win.start_live()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
