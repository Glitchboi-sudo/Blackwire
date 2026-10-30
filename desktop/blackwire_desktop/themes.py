"""Catálogo de temas de la GUI nativa + generador de QSS (Fase 1).

Porta los 17 temas de `frontend/themes.js`. Cada tema es un mapa de *tokens* de
color (mismos nombres que las CSS vars del frontend web). `build_qss()` genera la
hoja de estilo Qt desde esos tokens y una `density`, igual que el frontend
aplicaba las CSS vars sobre `.app` — mismo enfoque, distinto motor.
"""

from __future__ import annotations

from typing import Any

# Stacks de fuentes (Qt resuelve a la primera disponible en el sistema).
MONO_FAMILY = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace'
SANS_FAMILY = '"Inter", "Segoe UI", system-ui, sans-serif'

DEFAULT_THEME = "githubdark"

# Tokens de cada tema. 14 colores + 2 fuentes, idénticos a themes.js.
# Claves limpias (sin el prefijo CSS `--`).
THEMES: dict[str, dict[str, Any]] = {
    "githubdark": {"label": "GitHub Dark", "tokens": {
        "bg": "#0d1117", "bg2": "#010409", "bg3": "#161b22", "bgh": "#21262d",
        "brd": "#30363d", "txt": "#e6edf3", "txt2": "#c9d1d9", "txt3": "#8b949e",
        "blue": "#58a6ff", "green": "#3fb950", "red": "#f85149", "orange": "#d29922",
        "purple": "#bc8cff", "cyan": "#56d4dd"}},
    "dracula": {"label": "Dracula", "tokens": {
        "bg": "#282a36", "bg2": "#21222c", "bg3": "#343746", "bgh": "#44475a",
        "brd": "#44475a", "txt": "#f8f8f2", "txt2": "#c0c3cf", "txt3": "#8491b6",
        "blue": "#bd93f9", "green": "#50fa7b", "red": "#ff5555", "orange": "#ffb86c",
        "purple": "#ff79c6", "cyan": "#8be9fd"}},
    "nord": {"label": "Nord", "tokens": {
        "bg": "#2e3440", "bg2": "#272c36", "bg3": "#3b4252", "bgh": "#434c5e",
        "brd": "#4c566a", "txt": "#eceff4", "txt2": "#d8dee9", "txt3": "#949ca9",
        "blue": "#88c0d0", "green": "#a3be8c", "red": "#bf616a", "orange": "#d08770",
        "purple": "#b48ead", "cyan": "#8fbcbb"}},
    "tokyonight": {"label": "Tokyo Night", "tokens": {
        "bg": "#1a1b26", "bg2": "#16161e", "bg3": "#24283b", "bgh": "#2f334d",
        "brd": "#3b4261", "txt": "#c0caf5", "txt2": "#a9b1d6", "txt3": "#7881ac",
        "blue": "#7aa2f7", "green": "#9ece6a", "red": "#f7768e", "orange": "#ff9e64",
        "purple": "#bb9af7", "cyan": "#7dcfff"}},
    "catppuccin": {"label": "Catppuccin Mocha", "tokens": {
        "bg": "#1e1e2e", "bg2": "#181825", "bg3": "#313244", "bgh": "#45475a",
        "brd": "#45475a", "txt": "#cdd6f4", "txt2": "#bac2de", "txt3": "#81869e",
        "blue": "#89b4fa", "green": "#a6e3a1", "red": "#f38ba8", "orange": "#fab387",
        "purple": "#cba6f7", "cyan": "#94e2d5"}},
    "onedark": {"label": "One Dark", "tokens": {
        "bg": "#282c34", "bg2": "#21252b", "bg3": "#2c313a", "bgh": "#3b4048",
        "brd": "#3e4451", "txt": "#c8ccd4", "txt2": "#abb2bf", "txt3": "#8e939e",
        "blue": "#61afef", "green": "#98c379", "red": "#e06c75", "orange": "#d19a66",
        "purple": "#c678dd", "cyan": "#56b6c2"}},
    "monokai": {"label": "Monokai", "tokens": {
        "bg": "#272822", "bg2": "#1f201b", "bg3": "#32332c", "bgh": "#3e3d32",
        "brd": "#49483e", "txt": "#f8f8f2", "txt2": "#cfcfc2", "txt3": "#928f7f",
        "blue": "#66d9ef", "green": "#a6e22e", "red": "#f92672", "orange": "#fd971f",
        "purple": "#ae81ff", "cyan": "#66d9ef"}},
    "gruvbox": {"label": "Gruvbox Dark", "tokens": {
        "bg": "#282828", "bg2": "#1d2021", "bg3": "#3c3836", "bgh": "#504945",
        "brd": "#504945", "txt": "#ebdbb2", "txt2": "#d5c4a1", "txt3": "#9b8c7a",
        "blue": "#83a598", "green": "#b8bb26", "red": "#fb4934", "orange": "#fe8019",
        "purple": "#d3869b", "cyan": "#8ec07c"}},
    "solarizeddark": {"label": "Solarized Dark", "tokens": {
        "bg": "#002b36", "bg2": "#01242e", "bg3": "#073642", "bgh": "#0a4451",
        "brd": "#0a4451", "txt": "#93a1a1", "txt2": "#839496", "txt3": "#7f9092",
        "blue": "#268bd2", "green": "#859900", "red": "#dc322f", "orange": "#cb4b16",
        "purple": "#6c71c4", "cyan": "#2aa198"}},
    "rosepine": {"label": "Rosé Pine", "tokens": {
        "bg": "#191724", "bg2": "#1f1d2e", "bg3": "#26233a", "bgh": "#2a273f",
        "brd": "#403d52", "txt": "#e0def4", "txt2": "#c8c5dd", "txt3": "#87849e",
        "blue": "#3e8fb0", "green": "#5faaa0", "red": "#eb6f92", "orange": "#f6c177",
        "purple": "#c4a7e7", "cyan": "#9ccfd8"}},
    "everforest": {"label": "Everforest", "tokens": {
        "bg": "#2d353b", "bg2": "#272e33", "bg3": "#343f44", "bgh": "#3d484d",
        "brd": "#475258", "txt": "#d3c6aa", "txt2": "#beb499", "txt3": "#979e91",
        "blue": "#7fbbb3", "green": "#a7c080", "red": "#e67e80", "orange": "#e69875",
        "purple": "#d699b6", "cyan": "#83c092"}},
    "nightowl": {"label": "Night Owl", "tokens": {
        "bg": "#011627", "bg2": "#010e1a", "bg3": "#0b2942", "bgh": "#1d3b53",
        "brd": "#1d3b53", "txt": "#d6deeb", "txt2": "#a5b3c9", "txt3": "#708284",
        "blue": "#82aaff", "green": "#addb67", "red": "#ef5350", "orange": "#f78c6c",
        "purple": "#c792ea", "cyan": "#7fdbca"}},
    "ayu": {"label": "Ayu Dark", "tokens": {
        "bg": "#0d1017", "bg2": "#0b0e14", "bg3": "#131721", "bgh": "#1b1f2b",
        "brd": "#1f2430", "txt": "#bfbdb6", "txt2": "#9a9791", "txt3": "#7a7c81",
        "blue": "#59c2ff", "green": "#aad94c", "red": "#f26d78", "orange": "#ffb454",
        "purple": "#d2a6ff", "cyan": "#95e6cb"}},
    "cobalt": {"label": "Cobalt2", "tokens": {
        "bg": "#193549", "bg2": "#122738", "bg3": "#1e415e", "bgh": "#234e6d",
        "brd": "#0d3a58", "txt": "#ffffff", "txt2": "#aabfd0", "txt3": "#889db0",
        "blue": "#3b8eea", "green": "#3ad900", "red": "#ff628c", "orange": "#ffc600",
        "purple": "#fb94ff", "cyan": "#80fcff"}},
    "githublight": {"label": "GitHub Light", "tokens": {
        "bg": "#ffffff", "bg2": "#f6f8fa", "bg3": "#eaeef2", "bgh": "#eef1f4",
        "brd": "#d0d7de", "txt": "#1f2328", "txt2": "#57606a", "txt3": "#6b737b",
        "blue": "#0969da", "green": "#1a7f37", "red": "#cf222e", "orange": "#bc4c00",
        "purple": "#8250df", "cyan": "#1b7c83"}},
    "solarizedlight": {"label": "Solarized Light", "tokens": {
        "bg": "#fdf6e3", "bg2": "#eee8d5", "bg3": "#e7e0cc", "bgh": "#dcd5c0",
        "brd": "#d8d0bb", "txt": "#586e75", "txt2": "#657b83", "txt3": "#677171",
        "blue": "#268bd2", "green": "#859900", "red": "#dc322f", "orange": "#cb4b16",
        "purple": "#6c71c4", "cyan": "#2aa198"}},
    "kervoid": {"label": "Kervoid (OLED)", "tokens": {
        "bg": "#000000", "bg2": "#050505", "bg3": "#0d0d0d", "bgh": "#161616",
        "brd": "#262626", "txt": "#ffffff", "txt2": "#b0b0b0", "txt3": "#777777",
        "blue": "#2979ff", "green": "#00e676", "red": "#ff1744", "orange": "#ffab00",
        "purple": "#ff4081", "cyan": "#ff5c77"}},
}

# Densidades: afectan padding y tamaño de fuente (tipografía/densidad pedida).
DENSITIES = {
    "compact": {"label": "Compact", "pad_v": 2, "pad_h": 5, "font": 11, "mono": 11},
    "comfortable": {"label": "Comfortable", "pad_v": 4, "pad_h": 8, "font": 12, "mono": 12},
    "spacious": {"label": "Spacious", "pad_v": 6, "pad_h": 11, "font": 13, "mono": 13},
}
DEFAULT_DENSITY = "comfortable"


def status_colors(tokens: dict[str, str]) -> dict[int, str]:
    """Color por familia de status HTTP (2xx/3xx/4xx/5xx) según el tema."""
    return {
        2: tokens["green"], 3: tokens["blue"],
        4: tokens["orange"], 5: tokens["red"],
    }


def highlight_palette(tokens: dict[str, str]) -> dict[str, Any]:
    """Paleta de resaltado para `HttpHighlighter`, derivada de los tokens del tema.

    No se añaden colores nuevos a los temas: reutilizamos los tokens semánticos
    existentes (mismo criterio que `status_colors`) para que el resaltado siga al
    tema automáticamente. `status` mapea familia HTTP (2/3/4/5) -> color.
    """
    return {
        "method": tokens["purple"],
        "url": tokens["blue"],
        "http": tokens["txt3"],
        "status": status_colors(tokens),
        "header_name": tokens["cyan"],
        "header_value": tokens["txt2"],
        "key": tokens["blue"],
        "string": tokens["green"],
        "number": tokens["orange"],
        "literal": tokens["purple"],
        "comment": tokens["txt3"],
    }


def build_qss(tokens: dict[str, str], density: str = DEFAULT_DENSITY) -> str:
    """Genera el QSS completo desde los tokens de un tema y una densidad."""
    d = DENSITIES.get(density, DENSITIES[DEFAULT_DENSITY])
    ctx = {
        **tokens,
        "mono": MONO_FAMILY, "sans": SANS_FAMILY,
        "pv": d["pad_v"], "ph": d["pad_h"], "fs": d["font"], "ms": d["mono"],
        # Derivados: botones/pestañas más holgados y tamaños de título/hint.
        "bpv": d["pad_v"] + 2, "bph": d["pad_h"] + 6, "tph": d["pad_h"] + 6,
        "fs_title": d["font"] + 3, "fs_small": max(d["font"] - 1, 9),
    }
    return _QSS_TEMPLATE.format(**ctx)


# Plantilla QSS token-driven. Las llaves dobles son literales para str.format.
_QSS_TEMPLATE = """
* {{ font-family: {sans}; font-size: {fs}px; }}
QMainWindow, QWidget, QDialog {{ background: {bg}; color: {txt}; }}
QMainWindow::separator {{ background: {brd}; width: 2px; height: 2px; }}
QToolTip {{
    background: {bg2}; color: {txt}; border: 1px solid {brd};
    padding: 4px 6px; border-radius: 4px;
}}

QMenuBar {{ background: {bg2}; color: {txt2}; border-bottom: 1px solid {brd}; }}
QMenuBar::item {{ padding: {pv}px {ph}px; background: transparent; }}
QMenuBar::item:selected {{ background: {bg3}; color: {txt}; }}
QMenu {{ background: {bg2}; color: {txt}; border: 1px solid {brd}; padding: 4px; }}
QMenu::item {{ padding: {pv}px {ph}px; border-radius: 4px; }}
QMenu::item:selected {{ background: {bgh}; }}
QMenu::separator {{ height: 1px; background: {brd}; margin: 4px 6px; }}

QDockWidget {{ color: {txt2}; titlebar-close-icon: none; }}
QDockWidget::title {{
    background: {bg2}; padding: {pv}px {ph}px; border-bottom: 1px solid {brd};
    font-weight: 600; color: {txt2};
}}

/* -- Pestañas: acento inferior en la activa (estilo Burp) ----------------- */
QTabWidget::pane {{ border: 1px solid {brd}; top: -1px; background: {bg}; }}
QTabBar {{ background: transparent; qproperty-drawBase: 0; }}
QTabBar::tab {{
    background: transparent; color: {txt3}; padding: {bpv}px {tph}px;
    border: none; border-bottom: 2px solid transparent; margin-right: 1px;
}}
QTabBar::tab:hover {{ color: {txt2}; background: {bg3}; }}
QTabBar::tab:selected {{ color: {txt}; border-bottom: 2px solid {blue}; }}
QTabBar::scroller {{ width: 16px; }}
QTabBar QToolButton {{ background: {bg2}; border: 1px solid {brd}; }}

QTableView {{
    background: {bg}; alternate-background-color: {bg2};
    gridline-color: {brd}; border: none; selection-background-color: {bgh};
    selection-color: {txt}; outline: none;
}}
QTableView::item {{ padding: {pv}px {ph}px; border: none; }}
QHeaderView::section {{
    background: {bg2}; color: {txt3}; padding: {pv}px {ph}px; border: none;
    border-right: 1px solid {brd}; border-bottom: 1px solid {brd}; font-weight: 600;
}}
QTableCornerButton::section {{ background: {bg2}; border: none; }}

/* -- Árbol (Site Map) ----------------------------------------------------- */
QTreeView {{
    background: {bg}; color: {txt}; border: none; outline: none;
    alternate-background-color: {bg2}; selection-background-color: {bgh};
    selection-color: {txt};
}}
QTreeView::item {{ padding: {pv}px 2px; }}
QTreeView::item:selected {{ background: {bgh}; color: {txt}; }}

QPlainTextEdit, QTextEdit {{
    background: {bg}; color: {txt}; border: 1px solid {brd}; border-radius: 4px;
    font-family: {mono}; font-size: {ms}px; selection-background-color: {bgh};
    selection-color: {txt};
}}
QLineEdit {{
    background: {bg3}; color: {txt}; border: 1px solid {brd}; border-radius: 4px;
    padding: {pv}px {ph}px; selection-background-color: {bgh};
}}
QLineEdit:focus {{ border: 1px solid {blue}; }}
QLineEdit:disabled {{ color: {txt3}; background: {bg2}; }}

QSpinBox {{
    background: {bg3}; color: {txt}; border: 1px solid {brd}; border-radius: 4px;
    padding: {pv}px {ph}px;
}}
QSpinBox:focus {{ border: 1px solid {blue}; }}
QSpinBox::up-button, QSpinBox::down-button {{
    background: {bg3}; border-left: 1px solid {brd}; width: 16px;
}}
QSpinBox::up-button:hover, QSpinBox::down-button:hover {{ background: {bgh}; }}

/* -- Checkboxes ----------------------------------------------------------- */
QCheckBox {{ spacing: 6px; color: {txt}; }}
QCheckBox::indicator {{
    width: 15px; height: 15px; border: 1px solid {brd}; border-radius: 3px;
    background: {bg3};
}}
QCheckBox::indicator:hover {{ border: 1px solid {blue}; }}
QCheckBox::indicator:checked {{ background: {blue}; border: 1px solid {blue}; }}

/* -- Tarjetas / agrupadores ---------------------------------------------- */
QGroupBox {{
    border: 1px solid {brd}; border-radius: 6px; margin-top: 10px;
    padding: 10px 8px 8px 8px; background: {bg2};
}}
QGroupBox::title {{
    subcontrol-origin: margin; left: 10px; padding: 0 4px;
    color: {txt3}; font-weight: 600;
}}

QProgressBar {{
    border: 1px solid {brd}; border-radius: 4px; background: {bg3};
    text-align: center; color: {txt};
}}
QProgressBar::chunk {{ background: {blue}; border-radius: 3px; }}

/* -- Etiquetas con rol --------------------------------------------------- */
QLabel#SectionLabel {{ color: {txt3}; font-weight: 600; padding: {pv}px {ph}px; }}
QLabel#SectionTitle {{ color: {txt}; font-size: {fs_title}px; font-weight: 700; padding: 2px 0; }}
QLabel#Hint {{ color: {txt3}; font-size: {fs_small}px; }}
QLabel#FieldHelp {{ color: {txt3}; font-size: {fs_small}px; }}
QLabel#ErrorText {{ color: {red}; }}
QLabel#FilterError {{ color: {red}; }}
QLabel#Badge {{
    background: {bg3}; color: {txt2}; border: 1px solid {brd};
    border-radius: 9px; padding: 1px 9px;
}}
QLabel#ReqLabel {{ color: {cyan}; }}
QLabel#RespLabel {{ color: {green}; }}

QToolBar {{ background: {bg2}; border-bottom: 1px solid {brd}; spacing: 6px; padding: 3px; }}
QToolButton {{ color: {txt}; padding: {pv}px {ph}px; border-radius: 4px; }}
QToolButton:hover {{ background: {bg3}; }}
QToolButton:pressed {{ background: {bgh}; }}
QToolButton::menu-indicator {{ width: 0; }}

QComboBox {{
    background: {bg3}; color: {txt}; border: 1px solid {brd}; border-radius: 4px;
    padding: {pv}px {ph}px;
}}
QComboBox:disabled {{ color: {txt3}; background: {bg2}; }}
QComboBox::drop-down {{ border: none; width: 18px; }}
QComboBox QAbstractItemView {{
    background: {bg2}; color: {txt}; border: 1px solid {brd};
    selection-background-color: {bgh}; outline: none;
}}

/* -- Botones -------------------------------------------------------------- */
QPushButton {{
    background: {bg3}; color: {txt}; border: 1px solid {brd}; border-radius: 4px;
    padding: {bpv}px {bph}px;
}}
QPushButton:hover {{ background: {bgh}; }}
QPushButton:pressed {{ background: {bg2}; }}
QPushButton:disabled {{ color: {txt3}; background: {bg2}; border: 1px solid {brd}; }}
QPushButton:default {{ border: 1px solid {blue}; }}
QPushButton#AccentButton {{
    background: {blue}; color: {bg}; border: 1px solid {blue}; font-weight: 600;
}}
QPushButton#AccentButton:hover {{ background: {cyan}; border: 1px solid {cyan}; }}
QPushButton#AccentButton:disabled {{ background: {bg2}; color: {txt3}; border: 1px solid {brd}; }}
QPushButton#DangerButton {{ color: {red}; border: 1px solid {brd}; background: {bg3}; }}
QPushButton#DangerButton:hover {{ background: {red}; color: {bg}; border: 1px solid {red}; }}

/* -- Rail de navegación (shell principal) --------------------------------- */
QWidget#NavRail {{ background: {bg2}; border-right: 1px solid {brd}; }}
QPushButton#NavItem {{
    text-align: left; background: transparent; border: none;
    border-left: 2px solid transparent; color: {txt2};
    padding: {bpv}px {bph}px; border-radius: 5px;
}}
QPushButton#NavItem:hover {{ background: {bg3}; color: {txt}; }}
QPushButton#NavItem:checked {{
    background: {bg3}; color: {txt}; border-left: 2px solid {blue}; font-weight: 600;
}}
QPushButton#NavItem:focus {{ border-left: 2px solid {blue}; }}
QLabel#NavSectionLabel {{
    color: {txt3}; font-size: {fs_small}px; font-weight: 700;
    padding: 6px 8px 2px 10px;
}}
QFrame#NavSep {{ background: {brd}; max-height: 1px; border: none; margin: 5px 6px; }}

/* -- Indicador de foco de teclado (accesibilidad 2.4.7) ------------------- */
/* Qt omite el rect de foco nativo bajo un QSS completo; lo restituimos con un
   borde de acento en cada control interactivo (QLineEdit/QSpinBox ya lo tenían). */
QPushButton:focus, QToolButton:focus, QComboBox:focus {{ border: 1px solid {blue}; }}
QCheckBox:focus {{ color: {blue}; }}
QCheckBox::indicator:focus {{ border: 1px solid {blue}; }}
QTabBar::tab:focus {{ color: {txt}; background: {bg3}; }}
QTableView:focus, QTreeView:focus, QListView:focus, QListWidget:focus {{
    border: 1px solid {blue};
}}

QListView, QListWidget {{
    background: {bg}; color: {txt}; border: none; outline: none;
    selection-background-color: {bgh}; selection-color: {txt};
}}
QListView::item, QListWidget::item {{ padding: {pv}px {ph}px; }}
QListView::item:hover, QListWidget::item:hover {{ background: {bg3}; }}

QStatusBar {{ background: {bg2}; color: {txt3}; border-top: 1px solid {brd}; }}
QStatusBar::item {{ border: none; }}
QStatusBar QLabel {{ color: {txt3}; }}

QSplitter::handle {{ background: {brd}; }}
QSplitter::handle:hover {{ background: {blue}; }}
QScrollBar:vertical {{ background: {bg}; width: 10px; margin: 0; }}
QScrollBar::handle:vertical {{ background: {brd}; border-radius: 5px; min-height: 24px; }}
QScrollBar::handle:vertical:hover {{ background: {bgh}; }}
QScrollBar:horizontal {{ background: {bg}; height: 10px; margin: 0; }}
QScrollBar::handle:horizontal {{ background: {brd}; border-radius: 5px; min-width: 24px; }}
QScrollBar::handle:horizontal:hover {{ background: {bgh}; }}
QScrollBar::add-line, QScrollBar::sub-line {{ height: 0; width: 0; }}
QScrollBar::add-page, QScrollBar::sub-page {{ background: transparent; }}
"""
