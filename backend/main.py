#!/usr/bin/env python3
"""
Blackwire - Proxy Interceptor Backend
"""

import asyncio
import logging
import os
import threading
import json
import subprocess
import sys
import hashlib
import re
import shutil
import importlib.util
import shlex
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import aiosqlite
import httpx
from proxy_console import router as console_router, setup_console_handler
from routes.requests import router as requests_v2_router, init_routes
from routes.bypass import router as bypass_router, init_bypass_routes
from routes.rendering import router as rendering_router, init_rendering_routes
from routes.repeater import router as repeater_router, init_repeater_routes
from routes.chepy import router as chepy_router
from routes.websocket import router as websocket_router, init_websocket_routes
from routes.collections import router as collections_router, init_collections_routes
from routes.git import router as git_router, init_git_routes
from routes.intruder import router as intruder_router, init_intruder_routes
from routes.session import router as session_router, init_session_routes
from routes.search import (router as search_router, init_search_routes,
                           REQ_LIST_COLS, row_to_list_item)

# Constantes, paths y validadores: ver backend/config.py
from config import (
    BASE_DIR, PROJECTS_DIR, CURRENT_PROJECT_FILE, EXTENSIONS_DIR,
    EXTENSIONS_UI_COMPILED_DIR, PROXY_CONFIG_PATH, FRONTEND_DIR,
    APP_JSX_PATH, APP_COMPILED_PATH, THEMES_JS_PATH, FRONTEND_HTML_PATH,
    WEBHOOKSITE_BASE, WEBHOOKSITE_API_BASE,
    get_project_path, get_project_db, _SAFE_ID_RE,
    BACKEND_DIR as _BACKEND_DIR,
    validate_id as _validate_id,
    action_file as _action_file,
    action_resp_file as _action_resp_file,
    ALLOWED_PROXY_MODES as _ALLOWED_PROXY_MODES,
    BLOCKED_MITM_FLAGS as _BLOCKED_MITM_FLAGS,
)
# Modelos Pydantic y catálogo Chepy: ver backend/schemas.py
from schemas import (
    Project, ScopeRule, RepeaterRequest, ChepyOperation, ChepyRecipe,
    WsResendRequest, CollectionCreate, CollectionItemCreate, CollectionItemExecute,
    CHEPY_OPERATIONS,
)
# Compilador HTTPQL, GitManager y match_scope: ver backend/utils/
from utils.httpql import (
    compile_httpql_ast, HTTPQL_FIELD_MAP, HTTPQL_NUMERIC,
    HTTPQL_STRING_OPS, HTTPQL_NUMERIC_OPS,
)
from utils.git_manager import GitManager
from utils.scope import match_scope

connections: List[WebSocket] = []
proxy_process: Optional[subprocess.Popen] = None
intercepted_requests: Dict[str, dict] = {}
intercepted_responses: Dict[str, dict] = {}
intercept_enabled: bool = False
intercept_responses_enabled: bool = False
scope_rules: List[dict] = []
current_project: Optional[str] = None
extensions_config: Dict[str, dict] = {}

# --- Logging ---
LOG_LEVEL = os.getenv('BLACKWIRE_LOG_LEVEL', 'INFO').upper()
LOG_FORMAT = os.getenv('BLACKWIRE_LOG_FORMAT', '%(asctime)s %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger('blackwire')

def setup_logging():
    """Configure logging once."""
    if logger.handlers:
        return
    logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format=LOG_FORMAT)
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    logger.info('Logging initialized (level=%s)', LOG_LEVEL)



def get_current_project() -> Optional[str]:
    global current_project
    if current_project:
        return current_project
    if CURRENT_PROJECT_FILE.exists():
        current_project = CURRENT_PROJECT_FILE.read_text().strip()
        return current_project
    return None

def set_current_project(name: Optional[str]):
    global current_project
    current_project = name
    if name:
        CURRENT_PROJECT_FILE.write_text(name)
    elif CURRENT_PROJECT_FILE.exists():
        CURRENT_PROJECT_FILE.unlink()

async def get_project_config(name: str) -> Optional[dict]:
    config_path = get_project_path(name) / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return None

async def save_project_config(name: str, config: dict):
    config_path = get_project_path(name) / "config.json"
    config_path.write_text(json.dumps(config, indent=2))

async def load_project_settings(name: str):
    global scope_rules, intercept_enabled, extensions_config
    config = await get_project_config(name)
    if config:
        scope_rules = config.get("scope_rules", [])
        intercept_enabled = config.get("intercept_enabled", False)
        extensions_config = config.get("extensions", {})


def webhook_headers(api_key: Optional[str]) -> dict:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if api_key:
        headers["Api-Key"] = api_key
    return headers


async def save_extension_config(project: str, name: str, config: dict):
    global extensions_config
    extensions_config[name] = config
    proj_config = await get_project_config(project)
    if not proj_config:
        raise HTTPException(status_code=404, detail="Project not found")
    proj_config["extensions"] = extensions_config
    await save_project_config(project, proj_config)
    await update_proxy_config()


def compile_extension_ui(ui_jsx_path: Path) -> Optional[Path]:
    """
    Compila un archivo .ui.jsx a .ui.js usando Sucrase
    Retorna el path del archivo compilado o None si falla
    """
    try:
        # Crear directorio de salida si no existe
        EXTENSIONS_UI_COMPILED_DIR.mkdir(exist_ok=True)

        # Path de salida - reemplazar .jsx con .js
        output_filename = ui_jsx_path.name.replace('.jsx', '.js')
        output_path = EXTENSIONS_UI_COMPILED_DIR / output_filename

        # Crear temp dir para sucrase
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_src = Path(tmpdir) / "src"
            tmp_build = Path(tmpdir) / "build"
            tmp_src.mkdir()
            tmp_build.mkdir()

            # Copiar archivo fuente
            shutil.copy(ui_jsx_path, tmp_src / ui_jsx_path.name)

            # Compilar con Sucrase
            cmd = [
                "npx", "sucrase",
                str(tmp_src),
                "-d", str(tmp_build),
                "--transforms", "jsx",
                "--jsx-pragma", "React.createElement",
                "--jsx-fragment-pragma", "React.Fragment"
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, cwd=FRONTEND_DIR)

            if result.returncode != 0:
                logger.error(f"Failed to compile {ui_jsx_path.name}: {result.stderr}")
                return None

            # Copiar archivo compilado al directorio de salida
            compiled_file = tmp_build / ui_jsx_path.name.replace('.jsx', '.js')
            if compiled_file.exists():
                shutil.copy(compiled_file, output_path)
                logger.info(f"Compiled extension UI: {ui_jsx_path.name} -> {output_filename}")
                return output_path
            else:
                logger.error(f"Compiled file not found: {compiled_file}")
                return None

    except Exception as e:
        logger.error(f"Error compiling extension UI {ui_jsx_path.name}: {e}")
        return None


def load_extension_metadata() -> List[dict]:
    meta_list: List[dict] = []
    if not EXTENSIONS_DIR.exists():
        return meta_list
    for path in sorted(EXTENSIONS_DIR.glob("*.py")):
        if path.name.startswith("_") or path.name == "__init__.py":
            continue
        meta = {
            "name": path.stem,
            "title": path.stem.replace("_", " ").title(),
            "description": "",
            "tabs": [],
            "ui_schema": None,
            "default_config": {"enabled": False},
            "custom_ui_file": None
        }
        try:
            spec = importlib.util.spec_from_file_location(f"blackwire_ext_meta_{path.stem}", path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if hasattr(module, "EXTENSION_META"):
                    meta.update(module.EXTENSION_META)
                elif hasattr(module, "Extension"):
                    ext = module.Extension()
                    meta["name"] = getattr(ext, "name", meta["name"])
        except Exception as e:
            logger.warning("Failed to load extension metadata from %s: %s", path.name, e)

        # Detectar y compilar archivo .ui.jsx si existe
        ui_jsx_path = EXTENSIONS_DIR / f"{path.stem}.ui.jsx"
        if ui_jsx_path.exists():
            logger.info(f"Found custom UI for extension {path.stem}: {ui_jsx_path.name}")
            compiled_path = compile_extension_ui(ui_jsx_path)
            if compiled_path:
                meta["custom_ui_file"] = compiled_path.name
                logger.info(f"Extension {path.stem} has custom UI: {compiled_path.name}")

        meta_list.append(meta)
    return meta_list


async def init_db(name: str):
    project_path = get_project_path(name)
    project_path.mkdir(parents=True, exist_ok=True)
    db_path = get_project_db(name)
    
    async with aiosqlite.connect(db_path) as db:
        await db.execute("""CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT NOT NULL, url TEXT NOT NULL,
            headers TEXT NOT NULL, body TEXT, response_status INTEGER, response_headers TEXT,
            response_body TEXT, timestamp TEXT NOT NULL, request_type TEXT DEFAULT 'http',
            tags TEXT DEFAULT '[]', notes TEXT, saved INTEGER DEFAULT 0, in_scope INTEGER DEFAULT 1,
            hash TEXT UNIQUE)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS repeater (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, method TEXT NOT NULL,
            url TEXT NOT NULL, headers TEXT NOT NULL, body TEXT, created_at TEXT NOT NULL,
            last_response TEXT)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS webhook_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT, token_id TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE,
            method TEXT, url TEXT, ip TEXT, user_agent TEXT, content TEXT, headers TEXT,
            query TEXT, created_at TEXT, raw_json TEXT)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            description TEXT DEFAULT '', created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS collection_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id INTEGER NOT NULL,
            position INTEGER NOT NULL, method TEXT NOT NULL, url TEXT NOT NULL,
            headers TEXT NOT NULL DEFAULT '{}', body TEXT, var_extracts TEXT DEFAULT '[]',
            created_at TEXT NOT NULL,
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS filter_presets (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            query TEXT NOT NULL, ast_json TEXT NOT NULL, created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS bypass_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL,
            is_regex INTEGER DEFAULT 0, description TEXT, enabled INTEGER DEFAULT 1,
            created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS intruder_attacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            config TEXT NOT NULL, results TEXT NOT NULL,
            total INTEGER DEFAULT 0, created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS session_macros (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            description TEXT DEFAULT '', requests TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS session_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT, enabled INTEGER DEFAULT 1,
            name TEXT NOT NULL, when_stage TEXT NOT NULL, target TEXT NOT NULL,
            header_name TEXT, regex_pattern TEXT NOT NULL, extract_group INTEGER DEFAULT 1,
            variable_name TEXT NOT NULL, created_at TEXT NOT NULL)""")
        # Performance indexes
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_saved ON requests(saved)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_scope ON requests(in_scope)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_type ON requests(request_type)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_ts ON requests(timestamp)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_status ON requests(response_status)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_id_desc ON requests(id DESC)")
        await db.commit()

async def get_db():
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="No project selected")
    return aiosqlite.connect(get_project_db(project))


# HTTPQL Compiler (AST → SQL): movido a backend/utils/httpql.py


async def get_db_with_regex():
    """Get DB connection with HTTPQL_REGEX function for regex operator support."""
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="No project selected")
    db = await aiosqlite.connect(get_project_db(project))
    def _regex_fn(value, pattern):
        if value is None:
            return False
        try:
            return bool(re.search(pattern, str(value)))
        except re.error:
            return False
    await db.create_function("HTTPQL_REGEX", 2, _regex_fn)
    return db


# GitManager: movido a backend/utils/git_manager.py


async def update_proxy_config():
    config = {
        "intercept_enabled": intercept_enabled,
        "scope_rules": scope_rules,
        "project": get_current_project(),
        "extensions": extensions_config,
    }
    PROXY_CONFIG_PATH.write_text(json.dumps(config))
    logger.debug('Proxy config updated at %s: %s', PROXY_CONFIG_PATH, config)


def _stream_pipe(pipe, level_fn, label: str):
    """Read lines from a subprocess pipe and log them.

    NOTE: We spawn mitmproxy with text=True, so readline() returns str, not bytes.
    """
    try:
        if not pipe:
            return
        for line in iter(pipe.readline, ''):  # '' == EOF en text mode
            if not line:
                break
            line = line.rstrip()
            if line:
                level_fn('[%s] %s', label, line)
    except Exception as e:
        logger.debug('Pipe reader for %s stopped: %s', label, e)

async def start_proxy(port: int = 8080, mode: str = "regular", extra_args: str = ""):
    global proxy_process
    logger.debug('start_proxy called (port=%s)', port)
    if proxy_process and proxy_process.poll() is None:
        return {"status": "already_running", "port": port}

    await update_proxy_config()
    addon_path = Path(__file__).parent / "mitm_addon.py"
    logger.info('Starting mitmproxy (port=%s) with addon=%s', port, addon_path)

    # Load bypass rules
    ignore_hosts = None
    try:
        from utils.bypass_manager import BypassManager
        async with await get_db() as db:
            cursor = await db.execute(
                "SELECT id, pattern, is_regex, description, enabled FROM bypass_rules WHERE enabled = 1"
            )
            rows = await cursor.fetchall()
            bypass_rules = [
                {"id": r[0], "pattern": r[1], "is_regex": bool(r[2]),
                 "description": r[3] or "", "enabled": bool(r[4])}
                for r in rows
            ]

        if bypass_rules:
            manager = BypassManager()
            manager.load_rules(bypass_rules)
            ignore_hosts = manager.get_ignore_hosts_pattern()
            if ignore_hosts:
                logger.info(f"Bypass: Loaded {len(bypass_rules)} rules, ignoring hosts matching: {ignore_hosts[:100]}...")
    except Exception as e:
        logger.warning(f"Could not load bypass rules: {e}")

    # Use mitmdump (headless) instead of mitmproxy UI; running the dump module directly does nothing.
    mitmdump_bin = Path(sys.executable).with_name("mitmdump")
    if not mitmdump_bin.exists():
        resolved = shutil.which("mitmdump")
        mitmdump_bin = Path(resolved) if resolved else None
    if not mitmdump_bin:
        logger.error("mitmdump binary not found near current Python. Verify the venv/paths.")
        return {"status": "failed", "error": "mitmdump not found in venv or PATH"}
    extra = shlex.split(extra_args) if extra_args else []
    cmd = [str(mitmdump_bin), "--mode", mode, "-p", str(port),
           "-s", str(addon_path), "--set", "connection_strategy=lazy", "--ssl-insecure"]

    # Add ignore-hosts if we have bypass rules
    if ignore_hosts:
        cmd.extend(["--ignore-hosts", ignore_hosts])

    if extra:
        cmd.extend(extra)
    logger.debug('mitmproxy command: %s', ' '.join(cmd))
    
    logger.debug('Spawning mitmproxy subprocess...')
    logger.info("Launching proxy subprocess: %s", " ".join(map(str, cmd)))
    proxy_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                      env={**os.environ, "PYTHONUNBUFFERED": "1"})
    # Give the process a moment to initialize and bind the port
    await asyncio.sleep(1.0)
    if proxy_process.poll() is None:
        # Stream mitmproxy stdout/stderr into our logs for easier debugging
        threading.Thread(target=_stream_pipe, args=(proxy_process.stdout, logger.info, "mitm:stdout"), daemon=True).start()
        threading.Thread(target=_stream_pipe, args=(proxy_process.stderr, logger.error, "mitm:stderr"), daemon=True).start()
    else:
        # Process already exited; capture whatever it printed
        try:
            stdout, stderr = proxy_process.communicate(timeout=1.0)
        except Exception:
            stdout, stderr = "", ""
        logger.error("Proxy exited immediately (returncode=%s). stdout=%r stderr=%r", proxy_process.returncode, stdout, stderr)
        return {"status": "failed", "error": (stderr or stdout or "Proxy exited immediately")}
    # If still running after startup window, report started
    return {"status": "started", "port": port, "pid": proxy_process.pid}
async def stop_proxy():
    global proxy_process
    logger.debug('stop_proxy called')
    if proxy_process:
        proxy_process.terminate()
        logger.info('Stopping mitmproxy (pid=%s)...', proxy_process.pid)
        try:
            proxy_process.wait(timeout=5)
        except:
            proxy_process.kill()
        proxy_process = None
        return {"status": "stopped"}
    return {"status": "not_running"}


def transpile_jsx():
    """Pre-transpile App.jsx → App.compiled.js using sucrase (fast JSX transform)."""
    if not APP_JSX_PATH.exists():
        return
    node_script = (
        "const {transform}=require('sucrase'),fs=require('fs');"
        f"const code=fs.readFileSync({str(APP_JSX_PATH)!r},'utf8');"
        "const r=transform(code,{transforms:['jsx'],production:true});"
        f"fs.writeFileSync({str(APP_COMPILED_PATH)!r},r.code,'utf8');"
        "console.log('OK:'+r.code.length)"
    )
    try:
        result = subprocess.run(
            ["node", "-e", node_script],
            capture_output=True, text=True, timeout=30, cwd=str(BASE_DIR)
        )
        if result.returncode == 0:
            logging.info("Transpiled App.jsx → App.compiled.js (%s)", result.stdout.strip())
        else:
            logging.error("sucrase transpile failed: %s", result.stderr[:500])
    except Exception as e:
        logging.error("Transpile error: %s", e)

@asynccontextmanager
async def lifespan(app: FastAPI):
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    setup_logging()
    setup_console_handler()
    transpile_jsx()
    project = get_current_project()
    if project:
        await init_db(project)
        await load_project_settings(project)
    yield
    await stop_proxy()

app = FastAPI(title="Blackwire API", lifespan=lifespan)
app.include_router(console_router)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Include optimized request routes
try:
    app.include_router(requests_v2_router)
    logger.info("Optimized request routes loaded successfully")
except Exception as e:
    logger.warning(f"Could not load optimized routes: {e}")

# Include bypass routes
try:
    init_bypass_routes(get_db=get_db)
    app.include_router(bypass_router)
    logger.info("Bypass routes loaded successfully")
except Exception as e:
    logger.warning(f"Could not load bypass routes: {e}")

# Routers por dominio (extraídos de main.py — ver backend/routes/).
# Cada uno recibe sus dependencias por inyección antes de registrarse.
init_rendering_routes(get_db=get_db)
init_repeater_routes(get_db=get_db)
init_websocket_routes(get_db=get_db)
init_collections_routes(get_db=get_db)
init_git_routes(get_current_project=get_current_project)
init_intruder_routes(get_db=get_db)
init_session_routes(get_db=get_db)
init_search_routes(get_db=get_db, get_db_with_regex=get_db_with_regex,
                   get_current_project=get_current_project)
for _domain_router in (rendering_router, repeater_router, chepy_router, websocket_router,
                       collections_router, git_router, intruder_router, session_router,
                       search_router):
    app.include_router(_domain_router)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Usar el frontend.html original que tiene toda la funcionalidad
FRONTEND_HTML_PATH = Path(__file__).parent / "frontend.html"
FRONTEND_HTML = FRONTEND_HTML_PATH.read_text() if FRONTEND_HTML_PATH.exists() else "<h1>Frontend not found</h1>"

@app.get("/", response_class=HTMLResponse)
async def root():
    return HTMLResponse(FRONTEND_HTML)

def _static_headers():
    return {"Cache-Control": "no-cache"}

@app.get("/App.jsx")
async def app_jsx():
    # Auto-recompile if source is newer than compiled
    if APP_JSX_PATH.exists():
        need_compile = not APP_COMPILED_PATH.exists() or APP_JSX_PATH.stat().st_mtime > APP_COMPILED_PATH.stat().st_mtime
        if need_compile:
            transpile_jsx()
    if APP_COMPILED_PATH.exists():
        return FileResponse(APP_COMPILED_PATH, media_type="text/javascript", headers=_static_headers())
    if APP_JSX_PATH.exists():
        return FileResponse(APP_JSX_PATH, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail="App.jsx not found")

@app.get("/App.compiled.js")
async def app_compiled_js():
    # Alias for App.jsx route - serves the compiled file
    return await app_jsx()

@app.get("/themes.js")
async def themes_js():
    if THEMES_JS_PATH.exists():
        return FileResponse(THEMES_JS_PATH, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail="themes.js not found")

@app.get("/src/utils/{filename}")
async def serve_utils(filename: str):
    """Serve utility modules from src/utils/ directory"""
    utils_path = FRONTEND_DIR / "src" / "utils" / filename
    if utils_path.exists() and utils_path.suffix == ".js":
        return FileResponse(utils_path, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail=f"Utility module {filename} not found")

@app.get("/src/services/{filename}")
async def serve_services(filename: str):
    """Serve service modules from src/services/ directory"""
    services_path = FRONTEND_DIR / "src" / "services" / filename
    if services_path.exists() and services_path.suffix == ".js":
        return FileResponse(services_path, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail=f"Service module {filename} not found")

@app.get("/src/hooks/{filename}")
async def serve_hooks(filename: str):
    """Serve custom hooks from src/hooks/ directory"""
    hooks_path = FRONTEND_DIR / "src" / "hooks" / filename
    if hooks_path.exists() and hooks_path.suffix == ".js":
        return FileResponse(hooks_path, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail=f"Hook module {filename} not found")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connections.remove(websocket)

async def broadcast(data: dict):
    for conn in connections:
        try:
            await conn.send_json(data)
        except:
            pass


@app.get("/api/projects")
async def list_projects():
    projects = []
    if PROJECTS_DIR.exists():
        for p in PROJECTS_DIR.iterdir():
            if p.is_dir() and (p / "config.json").exists():
                config = json.loads((p / "config.json").read_text())
                projects.append({"name": p.name, "description": config.get("description", ""),
                    "created_at": config.get("created_at"), "is_current": p.name == get_current_project()})
    return sorted(projects, key=lambda x: x.get("created_at", ""), reverse=True)

@app.post("/api/projects")
async def create_project(project: Project):
    if get_project_path(project.name).exists():
        raise HTTPException(status_code=400, detail="Project exists")
    get_project_path(project.name).mkdir(parents=True)

    # Auto-inicializar todas las extensiones
    extensions_config_init = {}
    meta_list = load_extension_metadata()
    for meta in meta_list:
        ext_name = meta.get("name")
        default_cfg = meta.get("default_config", {"enabled": False})
        extensions_config_init[ext_name] = default_cfg

    config = {"name": project.name, "description": project.description, "scope_rules": [],
        "proxy_port": 8080, "proxy_mode": "regular", "proxy_args": "", "intercept_enabled": False, "created_at": datetime.now().isoformat(),
        "extensions": extensions_config_init}
    await save_project_config(project.name, config)
    await init_db(project.name)
    git = GitManager(project.name)
    await git.init_repo()
    logger.info('Created project %s', project.name)
    return {"status": "created", "name": project.name}

@app.get("/api/projects/current")
async def get_current():
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        return {"project": project, "config": config}
    return {"project": None}

@app.post("/api/projects/{name}/select")
async def select_project(name: str):
    global scope_rules, intercept_enabled, extensions_config
    config = await get_project_config(name)
    if not config:
        raise HTTPException(status_code=404, detail="Project not found")
    set_current_project(name)
    logger.info('Selected project %s', name)
    await init_db(name)
    scope_rules = config.get("scope_rules", [])
    intercept_enabled = config.get("intercept_enabled", False)
    extensions_config = config.get("extensions", {})
    return {"status": "selected", "project": name}

@app.put("/api/projects/{name}")
async def update_project(name: str, config: dict = Body(...)):
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")
    await save_project_config(name, config)
    logger.info('Updated project %s config', name)
    return {"status": "updated", "name": name}


@app.get("/api/extensions")
async def get_extensions():
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    meta_list = load_extension_metadata()
    for meta in meta_list:
        cfg = extensions_config.get(meta.get("name", ""), {})
        meta["config"] = cfg
        meta["enabled"] = cfg.get("enabled", False)
    return {"extensions": meta_list}


@app.put("/api/extensions/{name}")
async def update_extension_config(name: str, config: dict = Body(...)):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    await save_extension_config(project, name, config)
    return {"status": "updated", "name": name, "config": config}


@app.get("/api/extensions/{ext_name}/ui.js")
async def get_extension_ui(ext_name: str):
    """
    Sirve el archivo .ui.js compilado de una extensión
    """
    from fastapi.responses import Response

    # Buscar archivo compilado
    ui_file = EXTENSIONS_UI_COMPILED_DIR / f"{ext_name}.ui.js"

    if not ui_file.exists():
        raise HTTPException(status_code=404, detail=f"Custom UI not found for extension: {ext_name}")

    try:
        with open(ui_file, 'r', encoding='utf-8') as f:
            content = f.read()

        return Response(
            content=content,
            media_type="application/javascript",
            headers={
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*"
            }
        )
    except Exception as e:
        logger.error(f"Error serving extension UI for {ext_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading custom UI: {str(e)}")


@app.post("/api/webhooksite/apikey")
async def update_webhook_apikey(body: dict = Body(default={})):
    """Update API Key without creating a new token"""
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    api_key = body.get("api_key", "")
    cfg["api_key"] = api_key
    await save_extension_config(project, "webhook_site", cfg)
    return {"status": "updated"}


@app.post("/api/webhooksite/token")
async def create_webhook_token(body: dict = Body(default={})):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    api_key = body.get("api_key") or cfg.get("api_key")
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.post(f"{WEBHOOKSITE_API_BASE}/token", headers=webhook_headers(api_key))
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Webhook.site error: {e}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail="Failed to create webhook token")
    data = resp.json()
    token_id = data.get("uuid") or data.get("token") or data.get("id")
    if not token_id:
        raise HTTPException(status_code=500, detail="Webhook token missing")
    token_url = data.get("url") or f"{WEBHOOKSITE_BASE}/{token_id}"
    cfg.update({
        "enabled": cfg.get("enabled", True),
        "token_id": token_id,
        "token_url": token_url,
        "token_created_at": datetime.now().isoformat(),
        "api_key": api_key,
    })
    await save_extension_config(project, "webhook_site", cfg)
    return {"status": "created", "token_id": token_id, "token_url": token_url, "created_at": cfg["token_created_at"]}


@app.post("/api/webhooksite/refresh")
async def refresh_webhook_requests(body: dict = Body(default={})):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    token_id = cfg.get("token_id")
    if not token_id:
        raise HTTPException(status_code=400, detail="No webhook token configured")
    api_key = cfg.get("api_key")
    limit = int(body.get("limit", 50))
    url = f"{WEBHOOKSITE_API_BASE}/token/{token_id}/requests?sorting=newest&per_page={limit}"
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.get(url, headers=webhook_headers(api_key))
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Webhook.site error: {e}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch webhook requests")
    data = resp.json()
    items = data.get("data") if isinstance(data, dict) else data
    if not isinstance(items, list):
        items = []
    async with await get_db() as db:
        for item in items:
            req_id = item.get("uuid") or item.get("request_id") or item.get("id")
            if not req_id:
                continue
            method = item.get("method") or item.get("request_method")
            target_url = item.get("url") or item.get("request_url") or item.get("path")
            ip = item.get("ip")
            user_agent = item.get("user_agent") or item.get("headers", {}).get("User-Agent")
            content = item.get("content") if isinstance(item.get("content"), str) else json.dumps(item.get("content", "")) if item.get("content") is not None else None
            headers = json.dumps(item.get("headers", {}))
            query = json.dumps(item.get("query", {}))
            created_at = item.get("created_at") or item.get("created") or item.get("timestamp")
            raw_json = json.dumps(item)
            await db.execute(
                """INSERT OR IGNORE INTO webhook_requests
                (token_id, request_id, method, url, ip, user_agent, content, headers, query, created_at, raw_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (token_id, req_id, method, target_url, ip, user_agent, content, headers, query, created_at, raw_json)
            )
        await db.commit()
    cfg["last_sync"] = datetime.now().isoformat()
    await save_extension_config(project, "webhook_site", cfg)
    return {"status": "ok", "count": len(items)}


@app.get("/api/webhooksite/requests")
async def get_webhook_requests(limit: int = 200, all_tokens: bool = False):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    token_id = cfg.get("token_id")

    async with await get_db() as db:
        if all_tokens:
            # Mostrar requests de TODOS los tokens
            cursor = await db.execute(
                "SELECT request_id, method, url, ip, user_agent, content, headers, query, created_at, token_id FROM webhook_requests ORDER BY created_at DESC, id DESC LIMIT ?",
                (limit,)
            )
        else:
            # Solo del token actual
            if not token_id:
                return {"requests": []}
            cursor = await db.execute(
                "SELECT request_id, method, url, ip, user_agent, content, headers, query, created_at, token_id FROM webhook_requests WHERE token_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
                (token_id, limit)
            )
        rows = await cursor.fetchall()

    reqs = [{
        "request_id": r[0],
        "method": r[1],
        "url": r[2],
        "ip": r[3],
        "user_agent": r[4],
        "content": r[5],
        "headers": json.loads(r[6]) if r[6] else {},
        "query": json.loads(r[7]) if r[7] else {},
        "created_at": r[8],
        "token_id": r[9],
    } for r in rows]
    return {"requests": reqs}


@app.delete("/api/webhooksite/requests")
async def clear_webhook_requests():
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    token_id = cfg.get("token_id")
    if not token_id:
        return {"status": "ok", "deleted": 0}
    async with await get_db() as db:
        cursor = await db.execute("DELETE FROM webhook_requests WHERE token_id = ?", (token_id,))
        await db.commit()
    return {"status": "ok", "deleted": cursor.rowcount}

@app.delete("/api/projects/{name}")
async def delete_project(name: str):
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Not found")
    if name == get_current_project():
        set_current_project(None)
    shutil.rmtree(get_project_path(name))
    return {"status": "deleted"}

@app.get("/api/projects/{name}/export")
async def export_project(name: str):
    from fastapi.responses import Response
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")

    # Leer config del proyecto (incluye scope_rules)
    config = await get_project_config(name)

    # Leer todos los datos de la DB
    db_path = get_project_db(name)
    async with aiosqlite.connect(db_path) as db:
        # Requests (con TODOS los campos)
        cursor = await db.execute("SELECT * FROM requests")
        requests = []
        for row in await cursor.fetchall():
            requests.append({
                "method": row[1], "url": row[2], "headers": row[3], "body": row[4],
                "response_status": row[5], "response_headers": row[6], "response_body": row[7],
                "timestamp": row[8], "request_type": row[9], "tags": row[10],
                "notes": row[11], "saved": row[12], "in_scope": row[13]
            })

        # Repeater
        cursor = await db.execute("SELECT * FROM repeater")
        repeater = []
        for row in await cursor.fetchall():
            repeater.append({
                "name": row[1], "method": row[2], "url": row[3],
                "headers": row[4], "body": row[5], "created_at": row[6], "last_response": row[7]
            })

        # Collections (con description)
        cursor = await db.execute("SELECT * FROM collections")
        collections = []
        for row in await cursor.fetchall():
            collections.append({"id": row[0], "name": row[1], "description": row[2], "created_at": row[3]})

        # Collection items (estructura correcta)
        cursor = await db.execute("SELECT * FROM collection_items")
        collection_items = []
        for row in await cursor.fetchall():
            collection_items.append({
                "collection_id": row[1], "position": row[2], "method": row[3], "url": row[4],
                "headers": row[5], "body": row[6], "var_extracts": row[7], "created_at": row[8]
            })

        # Filter presets
        cursor = await db.execute("SELECT * FROM filter_presets")
        filter_presets = []
        for row in await cursor.fetchall():
            filter_presets.append({
                "name": row[1], "query": row[2], "ast_json": row[3], "created_at": row[4]
            })

        # Session macros
        cursor = await db.execute("SELECT * FROM session_macros")
        session_macros = []
        for row in await cursor.fetchall():
            session_macros.append({
                "name": row[1], "description": row[2], "requests": row[3], "created_at": row[4]
            })

        # Session rules (nombres de columna correctos)
        cursor = await db.execute("SELECT * FROM session_rules")
        session_rules = []
        for row in await cursor.fetchall():
            session_rules.append({
                "enabled": row[1], "name": row[2], "when_stage": row[3],
                "target": row[4], "header_name": row[5], "regex_pattern": row[6],
                "extract_group": row[7], "variable_name": row[8], "created_at": row[9]
            })

    # Crear JSON de export COMPLETO
    export_data = {
        "version": "1.1",
        "blackwire_version": "1.0.0",
        "project_name": name,
        "exported_at": datetime.now().isoformat(),
        "config": config,
        "data": {
            "requests": requests,
            "repeater": repeater,
            "collections": collections,
            "collection_items": collection_items,
            "filter_presets": filter_presets,
            "session_macros": session_macros,
            "session_rules": session_rules
        },
        "stats": {
            "total_requests": len(requests),
            "total_repeater": len(repeater),
            "total_collections": len(collections),
            "total_filter_presets": len(filter_presets),
            "total_session_macros": len(session_macros),
            "total_session_rules": len(session_rules)
        }
    }

    filename = f"blackwire-{name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    return Response(
        content=json.dumps(export_data, indent=2),
        media_type='application/json',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@app.get("/api/projects/{name}/export-burp")
async def export_project_burp(name: str):
    """Exportar proyecto al formato XML de Burp Suite Pro"""
    from fastapi.responses import Response
    import base64
    from urllib.parse import urlparse

    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")

    # Leer requests de la DB
    db_path = get_project_db(name)
    items_xml = []

    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute("""
            SELECT id, method, url, headers, body, response_status, response_headers,
                   response_body, timestamp
            FROM requests
            ORDER BY id ASC
        """)
        rows = await cursor.fetchall()

        for row in rows:
            req_id, method, url, headers, body, resp_status, resp_headers, resp_body, timestamp = row

            # Parse URL
            try:
                parsed = urlparse(url)
                protocol = parsed.scheme or "http"
                host = parsed.netloc.split(':')[0] if parsed.netloc else "unknown"
                port = parsed.port or (443 if protocol == "https" else 80)
                path = parsed.path + ("?" + parsed.query if parsed.query else "")
                extension = path.split('.')[-1] if '.' in path.split('/')[-1] else "null"
            except:
                protocol, host, port, path, extension = "http", "unknown", 80, "/", "null"

            # Construir request HTTP completo
            request_text = f"{method} {path} HTTP/1.1\r\n"
            if headers:
                try:
                    headers_dict = json.loads(headers) if isinstance(headers, str) else headers
                    for k, v in headers_dict.items():
                        request_text += f"{k}: {v}\r\n"
                except:
                    pass
            request_text += "\r\n"
            if body:
                request_text += body

            # Construir response HTTP completo
            response_text = ""
            resp_length = 0
            mime_type = "text"
            if resp_status:
                response_text = f"HTTP/1.1 {resp_status} OK\r\n"
                if resp_headers:
                    try:
                        resp_headers_dict = json.loads(resp_headers) if isinstance(resp_headers, str) else resp_headers
                        for k, v in resp_headers_dict.items():
                            response_text += f"{k}: {v}\r\n"
                            if k.lower() == "content-type":
                                mime_type = v.split(';')[0].strip().split('/')[-1]
                    except:
                        pass
                response_text += "\r\n"
                if resp_body:
                    response_text += resp_body
                    resp_length = len(resp_body)

            # Base64 encode para evitar problemas con caracteres especiales
            request_b64 = base64.b64encode(request_text.encode('utf-8', errors='replace')).decode('ascii')
            response_b64 = base64.b64encode(response_text.encode('utf-8', errors='replace')).decode('ascii') if response_text else ""

            # Formatear timestamp
            time_str = timestamp if timestamp else datetime.now().isoformat()

            # Crear item XML
            item_xml = f"""  <item>
    <time>{time_str}</time>
    <url><![CDATA[{url}]]></url>
    <host ip="">{host}</host>
    <port>{port}</port>
    <protocol>{protocol}</protocol>
    <method>{method}</method>
    <path><![CDATA[{path}]]></path>
    <extension>{extension}</extension>
    <request base64="true"><![CDATA[{request_b64}]]></request>
    <status>{resp_status or 0}</status>
    <responselength>{resp_length}</responselength>
    <mimetype>{mime_type}</mimetype>
    <response base64="true"><![CDATA[{response_b64}]]></response>
    <comment></comment>
  </item>"""
            items_xml.append(item_xml)

    # Construir XML completo con DTD
    burp_version = "Blackwire-1.0.0"
    export_time = datetime.now().strftime("%a %b %d %H:%M:%S %Z %Y")

    xml_content = f"""<?xml version="1.0"?>
<!DOCTYPE items [
<!ELEMENT items (item*)>
<!ATTLIST items burpVersion CDATA "">
<!ATTLIST items exportTime CDATA "">
<!ELEMENT item (time, url, host, port, protocol, method, path, extension, request, status, responselength, mimetype, response, comment)>
<!ELEMENT time (#PCDATA)>
<!ELEMENT url (#PCDATA)>
<!ELEMENT host (#PCDATA)>
<!ATTLIST host ip CDATA "">
<!ELEMENT port (#PCDATA)>
<!ELEMENT protocol (#PCDATA)>
<!ELEMENT method (#PCDATA)>
<!ELEMENT path (#PCDATA)>
<!ELEMENT extension (#PCDATA)>
<!ELEMENT request (#PCDATA)>
<!ATTLIST request base64 (true|false) "false">
<!ELEMENT status (#PCDATA)>
<!ELEMENT responselength (#PCDATA)>
<!ELEMENT mimetype (#PCDATA)>
<!ELEMENT response (#PCDATA)>
<!ATTLIST response base64 (true|false) "false">
<!ELEMENT comment (#PCDATA)>
]>
<items burpVersion="{burp_version}" exportTime="{export_time}">
{chr(10).join(items_xml)}
</items>
"""

    filename = f"burp-{name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.xml"
    return Response(
        content=xml_content,
        media_type='application/xml',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@app.post("/api/projects/{name}/import-burp")
async def import_burp_xml(name: str, xml_content: str = Body(..., media_type="text/plain")):
    """Importar archivo XML de Burp Suite Pro al proyecto actual"""
    import xml.etree.ElementTree as ET
    import base64

    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")

    try:
        # Parsear XML
        root = ET.fromstring(xml_content)

        if root.tag != 'items':
            raise HTTPException(status_code=400, detail="Invalid Burp Suite XML format")

        items = root.findall('item')
        imported_count = 0

        async with await get_db() as db:
            for item in items:
                try:
                    # Extraer campos del XML
                    url = item.find('url').text if item.find('url') is not None else ''
                    method = item.find('method').text if item.find('method') is not None else 'GET'
                    timestamp = item.find('time').text if item.find('time') is not None else datetime.now().isoformat()
                    status = item.find('status').text if item.find('status') is not None else None

                    # Parsear request (puede estar en base64)
                    request_elem = item.find('request')
                    request_text = ''
                    if request_elem is not None and request_elem.text:
                        if request_elem.get('base64') == 'true':
                            request_text = base64.b64decode(request_elem.text).decode('utf-8', errors='replace')
                        else:
                            request_text = request_elem.text

                    # Parsear response (puede estar en base64)
                    response_elem = item.find('response')
                    response_text = ''
                    if response_elem is not None and response_elem.text:
                        if response_elem.get('base64') == 'true':
                            response_text = base64.b64decode(response_elem.text).decode('utf-8', errors='replace')
                        else:
                            response_text = response_elem.text

                    # Separar headers y body del request
                    request_headers = {}
                    request_body = ''
                    if request_text:
                        parts = request_text.split('\r\n\r\n', 1)
                        header_section = parts[0]
                        request_body = parts[1] if len(parts) > 1 else ''

                        # Parsear headers (saltar la primera línea que es el request line)
                        header_lines = header_section.split('\r\n')[1:]
                        for line in header_lines:
                            if ': ' in line:
                                key, value = line.split(': ', 1)
                                request_headers[key] = value

                    # Separar headers y body del response
                    response_headers = {}
                    response_body = ''
                    if response_text:
                        parts = response_text.split('\r\n\r\n', 1)
                        header_section = parts[0]
                        response_body = parts[1] if len(parts) > 1 else ''

                        # Parsear headers (saltar la primera línea que es el status line)
                        header_lines = header_section.split('\r\n')[1:]
                        for line in header_lines:
                            if ': ' in line:
                                key, value = line.split(': ', 1)
                                response_headers[key] = value

                    # Insertar en la base de datos
                    await db.execute("""
                        INSERT INTO requests (method, url, headers, body, response_status, response_headers,
                            response_body, timestamp, request_type, tags, notes, saved, in_scope)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        method,
                        url,
                        json.dumps(request_headers),
                        request_body,
                        int(status) if status else None,
                        json.dumps(response_headers),
                        response_body,
                        timestamp,
                        'http',
                        '[]',
                        '',
                        0,
                        1
                    ))
                    imported_count += 1
                except Exception as e:
                    # Si falla un item, continuar con el siguiente
                    print(f"Error importing item: {e}")
                    continue

            await db.commit()

        return {
            "status": "success",
            "imported": imported_count,
            "total": len(items)
        }

    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"Invalid XML format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@app.post("/api/projects/import")
async def import_project_create(data: dict = Body(...)):
    """Crear un nuevo proyecto desde un archivo de exportación"""
    # Validar estructura
    if "version" not in data or "data" not in data or "project_name" not in data:
        raise HTTPException(status_code=400, detail="Invalid import format")

    project_name = data["project_name"]

    # Verificar si el proyecto ya existe
    if get_project_path(project_name).exists():
        raise HTTPException(status_code=400, detail=f"Project '{project_name}' already exists. Use merge endpoint instead.")

    # Crear nuevo proyecto
    project_path = get_project_path(project_name)
    project_path.mkdir(parents=True, exist_ok=True)

    # Guardar config
    config_data = data.get("config", {})
    config_data["name"] = project_name
    await save_project_config(project_name, config_data)

    # Inicializar DB
    await init_db(project_name)

    # Inicializar Git
    git = GitManager(project_name)
    await git.init_repo()

    # Importar datos
    db_path = get_project_db(project_name)
    async with aiosqlite.connect(db_path) as db:
        # Importar requests
        for req in data["data"].get("requests", []):
            await db.execute("""
                INSERT INTO requests (method, url, headers, body, response_status, response_headers,
                    response_body, timestamp, request_type, tags, notes, saved, in_scope)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (req["method"], req["url"], req["headers"], req.get("body"),
                  req.get("response_status"), req.get("response_headers"), req.get("response_body"),
                  req["timestamp"], req.get("request_type", "http"), req.get("tags", "[]"),
                  req.get("notes"), req.get("saved", 0), req.get("in_scope", 1)))

        # Importar repeater
        for rep in data["data"].get("repeater", []):
            await db.execute("""
                INSERT INTO repeater (name, method, url, headers, body, created_at, last_response)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (rep["name"], rep["method"], rep["url"], rep["headers"], rep.get("body"),
                  rep["created_at"], rep.get("last_response")))

        # Importar collections (con description) y mapear IDs
        collection_id_map = {}
        for coll in data["data"].get("collections", []):
            cursor = await db.execute("""
                INSERT INTO collections (name, description, created_at) VALUES (?, ?, ?)
            """, (coll["name"], coll.get("description", ""), coll["created_at"]))
            new_id = cursor.lastrowid
            old_id = coll.get("id")
            if old_id is not None:
                collection_id_map[old_id] = new_id

        # Importar collection items (estructura correcta) usando el mapeo de IDs
        for item in data["data"].get("collection_items", []):
            old_coll_id = item["collection_id"]
            new_coll_id = collection_id_map.get(old_coll_id, old_coll_id)
            await db.execute("""
                INSERT INTO collection_items (collection_id, position, method, url, headers, body, var_extracts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (new_coll_id, item["position"], item["method"], item["url"],
                  item.get("headers", "{}"), item.get("body"), item.get("var_extracts", "[]"),
                  item["created_at"]))

        # Importar filter presets
        for preset in data["data"].get("filter_presets", []):
            await db.execute("""
                INSERT INTO filter_presets (name, query, ast_json, created_at) VALUES (?, ?, ?, ?)
            """, (preset["name"], preset["query"], preset["ast_json"], preset["created_at"]))

        # Importar session macros
        for macro in data["data"].get("session_macros", []):
            await db.execute("""
                INSERT INTO session_macros (name, description, requests, created_at) VALUES (?, ?, ?, ?)
            """, (macro["name"], macro.get("description", ""), macro["requests"], macro["created_at"]))

        # Importar session rules (nombres de columna correctos)
        for rule in data["data"].get("session_rules", []):
            await db.execute("""
                INSERT INTO session_rules (enabled, name, when_stage, target, header_name,
                    regex_pattern, extract_group, variable_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (rule["enabled"], rule["name"], rule["when_stage"], rule["target"],
                  rule.get("header_name"), rule["regex_pattern"], rule.get("extract_group", 1),
                  rule["variable_name"], rule["created_at"]))

        await db.commit()

    return {
        "status": "imported",
        "message": f"Successfully created project '{project_name}' from import",
        "stats": data.get("stats", {})
    }

@app.post("/api/projects/{name}/import")
async def import_project_merge(name: str, data: dict = Body(...), clear_existing: bool = False):
    """Importar datos a un proyecto existente (merge o replace)"""
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")

    # Validar estructura
    if "version" not in data or "data" not in data:
        raise HTTPException(status_code=400, detail="Invalid import format")

    db_path = get_project_db(name)
    async with aiosqlite.connect(db_path) as db:
        # Limpiar datos si se solicita
        if clear_existing:
            await db.execute("DELETE FROM requests")
            await db.execute("DELETE FROM repeater")
            await db.execute("DELETE FROM collections")
            await db.execute("DELETE FROM collection_items")
            await db.execute("DELETE FROM filter_presets")
            await db.execute("DELETE FROM session_macros")
            await db.execute("DELETE FROM session_rules")

        # Importar requests
        for req in data["data"].get("requests", []):
            await db.execute("""
                INSERT INTO requests (method, url, headers, body, response_status, response_headers,
                    response_body, timestamp, request_type, tags, notes, saved, in_scope)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (req["method"], req["url"], req["headers"], req.get("body"),
                  req.get("response_status"), req.get("response_headers"), req.get("response_body"),
                  req["timestamp"], req.get("request_type", "http"), req.get("tags", "[]"),
                  req.get("notes"), req.get("saved", 0), req.get("in_scope", 1)))

        # Importar repeater
        for rep in data["data"].get("repeater", []):
            await db.execute("""
                INSERT INTO repeater (name, method, url, headers, body, created_at, last_response)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (rep["name"], rep["method"], rep["url"], rep["headers"], rep.get("body"),
                  rep["created_at"], rep.get("last_response")))

        # Importar collections y mapear IDs
        collection_id_map = {}
        for coll in data["data"].get("collections", []):
            cursor = await db.execute("""
                INSERT INTO collections (name, description, created_at) VALUES (?, ?, ?)
            """, (coll["name"], coll.get("description", ""), coll["created_at"]))
            new_id = cursor.lastrowid
            old_id = coll.get("id")
            if old_id is not None:
                collection_id_map[old_id] = new_id

        # Importar collection items usando el mapeo de IDs
        for item in data["data"].get("collection_items", []):
            old_coll_id = item["collection_id"]
            new_coll_id = collection_id_map.get(old_coll_id, old_coll_id)
            await db.execute("""
                INSERT INTO collection_items (collection_id, position, method, url, headers, body, var_extracts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (new_coll_id, item["position"], item["method"], item["url"],
                  item.get("headers", "{}"), item.get("body"), item.get("var_extracts", "[]"),
                  item["created_at"]))

        # Importar filter presets
        for preset in data["data"].get("filter_presets", []):
            try:
                await db.execute("""
                    INSERT INTO filter_presets (name, query, ast_json, created_at) VALUES (?, ?, ?, ?)
                """, (preset["name"], preset["query"], preset["ast_json"], preset["created_at"]))
            except:
                pass  # Skip duplicates

        # Importar session macros
        for macro in data["data"].get("session_macros", []):
            await db.execute("""
                INSERT INTO session_macros (name, description, requests, created_at) VALUES (?, ?, ?, ?)
            """, (macro["name"], macro.get("description", ""), macro["requests"], macro["created_at"]))

        # Importar session rules
        for rule in data["data"].get("session_rules", []):
            await db.execute("""
                INSERT INTO session_rules (enabled, name, when_stage, target, header_name,
                    regex_pattern, extract_group, variable_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (rule["enabled"], rule["name"], rule["when_stage"], rule["target"],
                  rule.get("header_name"), rule["regex_pattern"], rule.get("extract_group", 1),
                  rule["variable_name"], rule["created_at"]))

        await db.commit()

    # Actualizar config si viene en el import
    if "config" in data:
        current_config = await get_project_config(name)
        # Merge scope_rules si vienen
        if "scope_rules" in data["config"]:
            current_config["scope_rules"] = data["config"]["scope_rules"]
        await save_project_config(name, current_config)

    action = "replaced" if clear_existing else "merged"
    return {
        "status": "imported",
        "message": f"Successfully {action} data in project '{name}'",
        "stats": data.get("stats", {})
    }

@app.get("/api/scope")
async def get_scope():
    return {"rules": scope_rules}

@app.post("/api/scope/rules")
async def add_scope_rule(rule: ScopeRule):
    global scope_rules
    new_rule = {"pattern": rule.pattern, "rule_type": rule.rule_type, "enabled": rule.enabled,
        "id": hashlib.md5(f"{rule.pattern}{datetime.now()}".encode()).hexdigest()[:8]}
    scope_rules.append(new_rule)
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        config["scope_rules"] = scope_rules
        await save_project_config(project, config)
    await update_proxy_config()
    return {"status": "added", "rule": new_rule}

@app.delete("/api/scope/rules/{rule_id}")
async def delete_scope_rule(rule_id: str):
    global scope_rules
    scope_rules = [r for r in scope_rules if r.get("id") != rule_id]
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        config["scope_rules"] = scope_rules
        await save_project_config(project, config)
    await update_proxy_config()
    return {"status": "deleted"}

@app.put("/api/scope/rules/{rule_id}")
async def toggle_scope_rule(rule_id: str):
    global scope_rules
    for rule in scope_rules:
        if rule.get("id") == rule_id:
            rule["enabled"] = not rule.get("enabled", True)
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        config["scope_rules"] = scope_rules
        await save_project_config(project, config)
    await update_proxy_config()
    return {"status": "toggled"}


@app.get("/api/intercept/status")
async def get_intercept_status():
    return {"enabled": intercept_enabled, "pending_count": len(intercepted_requests)}

@app.post("/api/intercept/toggle")
async def toggle_intercept():
    global intercept_enabled
    intercept_enabled = not intercept_enabled
    logger.info('Intercept toggled -> %s', intercept_enabled)
    if not intercept_enabled:
        await forward_all()
    
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        config["intercept_enabled"] = intercept_enabled
        await save_project_config(project, config)
    await update_proxy_config()
    await broadcast({"type": "intercept_status", "enabled": intercept_enabled})
    return {"enabled": intercept_enabled}

@app.get("/api/intercept/pending")
async def get_pending():
    return list(intercepted_requests.values())

@app.post("/api/intercept/{request_id}/forward")
async def forward_request(request_id: str, modified: Optional[dict] = Body(None)):
    if request_id not in intercepted_requests:
        raise HTTPException(status_code=404)
    intercepted_requests.pop(request_id)
    try:
        action_file = _action_file(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request_id")
    action_file.write_text(json.dumps({"action": "forward", "modified": modified}))
    await broadcast({"type": "intercept_forwarded", "request_id": request_id})
    return {"status": "forwarded"}

@app.post("/api/intercept/{request_id}/drop")
async def drop_request(request_id: str):
    if request_id not in intercepted_requests:
        raise HTTPException(status_code=404)
    intercepted_requests.pop(request_id)
    try:
        action_file = _action_file(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request_id")
    action_file.write_text(json.dumps({"action": "drop"}))
    await broadcast({"type": "intercept_dropped", "request_id": request_id})
    return {"status": "dropped"}

@app.post("/api/intercept/forward-all")
async def forward_all():
    for rid in list(intercepted_requests.keys()):
        try:
            _action_file(rid).write_text(json.dumps({"action": "forward"}))
        except ValueError:
            logger.warning("Skipping unsafe request_id in forward-all: %r", rid)
    count = len(intercepted_requests)
    intercepted_requests.clear()
    await broadcast({"type": "intercept_all_forwarded"})
    return {"status": "forwarded", "count": count}

@app.post("/api/intercept/drop-all")
async def drop_all():
    for rid in list(intercepted_requests.keys()):
        try:
            _action_file(rid).write_text(json.dumps({"action": "drop"}))
        except ValueError:
            logger.warning("Skipping unsafe request_id in drop-all: %r", rid)
    count = len(intercepted_requests)
    intercepted_requests.clear()
    return {"status": "dropped", "count": count}

@app.post("/api/intercept/toggle_responses")
async def toggle_intercept_responses():
    global intercept_responses_enabled
    intercept_responses_enabled = not intercept_responses_enabled
    await broadcast({
        "type": "intercept_responses_toggled",
        "enabled": intercept_responses_enabled
    })
    return {"enabled": intercept_responses_enabled}

@app.get("/api/intercept/pending_responses")
async def get_pending_responses():
    return list(intercepted_responses.values())

@app.post("/api/intercept_response/{response_id}/forward")
async def forward_response(response_id: str):
    if response_id in intercepted_responses:
        try:
            _action_resp_file(response_id).write_text(json.dumps({"action": "forward"}))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid response_id")
        del intercepted_responses[response_id]
        await broadcast({"type": "response_forwarded", "id": response_id})
    return {"status": "forwarded"}

@app.post("/api/intercept_response/{response_id}/drop")
async def drop_response(response_id: str):
    if response_id in intercepted_responses:
        try:
            _action_resp_file(response_id).write_text(json.dumps({"action": "drop"}))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid response_id")
        del intercepted_responses[response_id]
        await broadcast({"type": "response_dropped", "id": response_id})
    return {"status": "dropped"}

@app.post("/api/intercept_response/forward-all")
async def forward_all_responses():
    for rid in list(intercepted_responses.keys()):
        try:
            _action_resp_file(rid).write_text(json.dumps({"action": "forward"}))
        except ValueError:
            logger.warning("Skipping unsafe response_id in forward-all: %r", rid)
    count = len(intercepted_responses)
    intercepted_responses.clear()
    await broadcast({"type": "intercept_all_responses_forwarded"})
    return {"status": "forwarded", "count": count}

@app.post("/api/intercept_response/drop-all")
async def drop_all_responses():
    for rid in list(intercepted_responses.keys()):
        try:
            _action_resp_file(rid).write_text(json.dumps({"action": "drop"}))
        except ValueError:
            logger.warning("Skipping unsafe response_id in drop-all: %r", rid)
    count = len(intercepted_responses)
    intercepted_responses.clear()
    return {"status": "dropped", "count": count}


@app.post("/api/proxy/start")
async def api_start_proxy(port: int = 8080, mode: str = "regular", extra: str = ""):
    if not get_current_project():
        raise HTTPException(status_code=400, detail="Select a project first")
    if mode not in _ALLOWED_PROXY_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid proxy mode. Allowed: {sorted(_ALLOWED_PROXY_MODES)}")
    if not (1 <= port <= 65535):
        raise HTTPException(status_code=400, detail="Port must be between 1 and 65535")
    # Strip any flags that could load external scripts or write files to arbitrary paths
    if extra:
        safe_extra_parts = []
        parts = shlex.split(extra)
        i = 0
        while i < len(parts):
            flag = parts[i].split("=")[0]
            if flag in _BLOCKED_MITM_FLAGS:
                logger.warning("Blocked dangerous mitmproxy flag: %r", parts[i])
                i += 2 if (i + 1 < len(parts) and not parts[i + 1].startswith("-")) else 1
                continue
            safe_extra_parts.append(parts[i])
            i += 1
        extra = shlex.join(safe_extra_parts)
    return await start_proxy(port, mode, extra)

@app.post("/api/proxy/stop")
async def api_stop_proxy():
    return await stop_proxy()

@app.get("/api/proxy/status")
async def proxy_status():
    running = proxy_process is not None and proxy_process.poll() is None
    return {"running": running, "intercept_enabled": intercept_enabled}

@app.post("/api/shutdown")
async def shutdown_server():
    """Gracefully shut down the entire server."""
    await stop_proxy()
    # Schedule shutdown after response is sent
    asyncio.get_event_loop().call_later(0.5, lambda: os._exit(0))
    return {"status": "shutting_down"}


# REQ_LIST_COLS y row_to_list_item se definen en routes/search.py (listado de
# requests) y los reutiliza tanto el router de search como el router optimizado.

# Initialize optimized routes
try:
    init_routes(
        get_db=get_db,
        get_project_db=get_project_db,
        get_current_project=get_current_project,
        req_list_cols=REQ_LIST_COLS,
        row_to_list_item=row_to_list_item,
        compile_httpql_ast=compile_httpql_ast
    )
except ImportError as e:
    logger.warning(f"Could not initialize optimized routes: {e}")

@app.get("/api/export")
async def export_data():
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400)
    async with await get_db() as db:
        cursor = await db.execute("SELECT * FROM requests WHERE saved = 1")
        saved = await cursor.fetchall()
        cursor = await db.execute("SELECT * FROM repeater")
        repeater = await cursor.fetchall()
    return {"project": project, "exported_at": datetime.now().isoformat(), "saved_requests": saved, "repeater": repeater}


@app.post("/api/browser/launch")
async def launch_browser(proxy_port: int = 8080):
    profile = Path("/tmp/blackwire_browser")
    profile.mkdir(exist_ok=True)
    for browser in ["chromium-browser", "google-chrome", "chromium", "firefox"]:
        path = shutil.which(browser)
        if not path:
            continue
        
        try:
            if "firefox" in browser:
                cmd = [browser, "-no-remote", "-profile", str(profile)]
            else:
                cmd = [browser, f"--proxy-server=http://127.0.0.1:{proxy_port}",
                    f"--user-data-dir={profile}", "--ignore-certificate-errors", "--no-first-run"]
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"status": "launched", "browser": browser}
        except (FileNotFoundError, PermissionError):
            continue
    return {"status": "failed", "error": "No browser found"}


@app.post("/api/internal/request")
async def receive_request(data: dict = Body(...)):
    project = get_current_project()
    if not project:
        return {"status": "no_project"}
    in_scope = match_scope(data["url"], scope_rules)
    logger.debug('Internal capture: %s %s (in_scope=%s)', data.get('method'), data.get('url'), in_scope)
    async with aiosqlite.connect(get_project_db(project)) as db:
        h = hashlib.md5(f"{data['method']}{data['url']}{data.get('body','')}".encode()).hexdigest()
        try:
            await db.execute("""INSERT INTO requests (method,url,headers,body,response_status,response_headers,
                response_body,timestamp,request_type,in_scope,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (data["method"], data["url"], json.dumps(data.get("headers", {})), data.get("body"),
                data.get("response_status"), json.dumps(data.get("response_headers", {})) if data.get("response_headers") else None,
                data.get("response_body"), datetime.now().isoformat(), data.get("request_type", "http"), 1 if in_scope else 0, h))
            await db.commit()
            cursor = await db.execute("SELECT last_insert_rowid()")
            rid = (await cursor.fetchone())[0]
            await broadcast({"type": "new_request", "data": {"id": rid, "method": data["method"], "url": data["url"],
                "response_status": data.get("response_status"), "request_type": data.get("request_type", "http"),
                "saved": False, "in_scope": in_scope, "timestamp": datetime.now().isoformat()}})
            return {"status": "received", "id": rid}
        except aiosqlite.IntegrityError:
            return {"status": "duplicate"}

@app.post("/api/internal/intercept")
async def receive_intercept(data: dict = Body(...)):
    rid = data.get("request_id", "")
    # Sanitize: only accept IDs matching the safe pattern; generate a fresh one otherwise
    if not _validate_id(rid):
        rid = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12]
    logger.debug('Intercept incoming: %s %s', data.get('method'), data.get('url'))
    intercepted_requests[rid] = {"id": rid, "method": data["method"], "url": data["url"],
        "headers": data.get("headers", {}), "body": data.get("body"), "timestamp": datetime.now().isoformat()}
    await broadcast({"type": "intercept_new", "data": intercepted_requests[rid]})
    return {"status": "intercepted", "request_id": rid}


# --- Intruder Attacks ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
