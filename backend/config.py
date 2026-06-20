#!/usr/bin/env python3
"""
Blackwire - Configuración central.

Paths, constantes y validadores puros (sin estado mutable ni dependencias del
resto de la app). Todos los módulos importan de aquí, por lo que NO debe importar
nada de `state`, `db`, routers ni servicios para evitar ciclos.
"""

import os
import re
from pathlib import Path

# --- Paths base ---
BASE_DIR = Path(__file__).parent.parent
# En contenedor se usan volúmenes Docker; en dev, paths locales.
_data_dir = Path(os.getenv("BLACKWIRE_DATA", str(BASE_DIR / "projects")))
_writable_dir = _data_dir.parent

PROJECTS_DIR = _data_dir
CURRENT_PROJECT_FILE = _writable_dir / ".current_project"
EXTENSIONS_DIR = Path(__file__).parent / "extensions"
EXTENSIONS_UI_COMPILED_DIR = _writable_dir / ".compiled_ui"
PROXY_CONFIG_PATH = _writable_dir / ".proxy_config.json"

FRONTEND_DIR = BASE_DIR / "frontend"
APP_JSX_PATH = FRONTEND_DIR / "App.jsx"
APP_COMPILED_PATH = FRONTEND_DIR / "App.compiled.js"
THEMES_JS_PATH = FRONTEND_DIR / "themes.js"
FRONTEND_HTML_PATH = Path(__file__).parent / "frontend.html"

# Directorio del backend (resuelto) — usado para los archivos .action_*.json
# que mitm_addon.py lee en su loop de polling.
BACKEND_DIR = Path(__file__).parent.resolve()

# --- Webhook.site ---
WEBHOOKSITE_BASE = "https://webhook.site"
WEBHOOKSITE_API_BASE = "https://webhook.site"

# --- Seguridad del proxy ---
# IDs de request/response: solo alfanumérico (los genera hashlib.md5).
_SAFE_ID_RE = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')
ALLOWED_PROXY_MODES = {"regular", "upstream", "socks5", "transparent"}
# Flags de mitmproxy que permitirían cargar scripts externos o escribir archivos.
BLOCKED_MITM_FLAGS = {"--scripts", "-s", "--save-stream-file", "--save-stream-filter",
                      "--allow-hosts", "--ignore-hosts", "--ssl-insecure"}


def get_project_path(name: str) -> Path:
    return PROJECTS_DIR / name


def get_project_db(name: str) -> Path:
    return get_project_path(name) / "blackwire.db"


def validate_id(rid: str) -> bool:
    """True solo si rid es un ID alfanumérico seguro (sin separadores ni especiales)."""
    return bool(_SAFE_ID_RE.fullmatch(rid))


def action_file(rid: str) -> Path:
    """Path del archivo de acción, verificando que queda dentro de BACKEND_DIR."""
    if not validate_id(rid):
        raise ValueError(f"Unsafe request_id: {rid!r}")
    path = (BACKEND_DIR / f".action_{rid}.json").resolve()
    if path.parent != BACKEND_DIR:
        raise ValueError(f"Path traversal detected in request_id: {rid!r}")
    return path


def action_resp_file(rid: str) -> Path:
    """Path del archivo de acción de respuesta, verificando que queda dentro de BACKEND_DIR."""
    if not validate_id(rid):
        raise ValueError(f"Unsafe response_id: {rid!r}")
    path = (BACKEND_DIR / f".action_resp_{rid}.json").resolve()
    if path.parent != BACKEND_DIR:
        raise ValueError(f"Path traversal detected in response_id: {rid!r}")
    return path
