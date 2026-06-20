#!/usr/bin/env python3
"""
Blackwire — Backend (FastAPI).

App factory delgada: configura logging, ciclo de vida (lifespan), middleware,
registro de routers por dominio y servido del frontend estático. Toda la lógica
de negocio vive en backend/routes/ (endpoints), backend/services/ y backend/db.py
(estado + acceso a datos) y backend/utils/ (helpers).
"""

import logging
import os
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, Response
from starlette.middleware.gzip import GZipMiddleware

from config import (BASE_DIR, PROJECTS_DIR, FRONTEND_DIR, FRONTEND_HTML_PATH,
                    APP_JSX_PATH, APP_COMPILED_PATH, THEMES_JS_PATH, get_project_db)
from services import state
from db import get_db, get_db_with_regex, init_db, load_project_settings
from services.proxy_control import stop_proxy
from utils.httpql import compile_httpql_ast
from utils.jsx import resolve_frontend_module, get_module_js

# --- Routers por dominio ---
from proxy_console import router as console_router, setup_console_handler
# Routers con inyección de dependencias (reciben get_db/etc. antes de registrarse)
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
# Routers con estado (importan sus dependencias directamente; no requieren init)
from routes.projects import router as projects_router
from routes.export_import import router as export_import_router
from routes.extensions import router as extensions_router
from routes.webhook import router as webhook_router
from routes.scope import router as scope_router
from routes.intercept import router as intercept_router
from routes.proxy import router as proxy_router
from routes.internal import router as internal_router

# --- Logging ---
LOG_LEVEL = os.getenv('BLACKWIRE_LOG_LEVEL', 'INFO').upper()
LOG_FORMAT = os.getenv('BLACKWIRE_LOG_FORMAT', '%(asctime)s %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger('blackwire')


def setup_logging():
    """Configura logging una sola vez."""
    if logger.handlers:
        return
    logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format=LOG_FORMAT)
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    logger.info('Logging initialized (level=%s)', LOG_LEVEL)


def transpile_jsx():
    """Pre-transpila App.jsx → App.compiled.js con sucrase (transform JSX rápido)."""
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
    project = state.get_current_project()
    if project:
        await init_db(project)
        await load_project_settings(project)
    yield
    await stop_proxy()


app = FastAPI(title="Blackwire API", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Inyectar dependencias en los routers que lo requieren.
init_routes(get_db=get_db, get_project_db=get_project_db,
            get_current_project=state.get_current_project,
            req_list_cols=REQ_LIST_COLS, row_to_list_item=row_to_list_item,
            compile_httpql_ast=compile_httpql_ast)
init_bypass_routes(get_db=get_db)
init_rendering_routes(get_db=get_db)
init_repeater_routes(get_db=get_db)
init_websocket_routes(get_db=get_db)
init_collections_routes(get_db=get_db)
init_git_routes(get_current_project=state.get_current_project)
init_intruder_routes(get_db=get_db)
init_session_routes(get_db=get_db)
init_search_routes(get_db=get_db, get_db_with_regex=get_db_with_regex,
                   get_current_project=state.get_current_project)

# Registrar todos los routers (incluido el de la consola del proxy).
for _router in (console_router, requests_v2_router, bypass_router,
                rendering_router, repeater_router, chepy_router, websocket_router,
                collections_router, git_router, intruder_router, session_router,
                search_router, projects_router, export_import_router, extensions_router,
                webhook_router, scope_router, intercept_router, proxy_router, internal_router):
    app.include_router(_router)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


# --- Frontend estático ---
FRONTEND_HTML = FRONTEND_HTML_PATH.read_text() if FRONTEND_HTML_PATH.exists() else "<h1>Frontend not found</h1>"


def _static_headers():
    return {"Cache-Control": "no-cache"}


@app.get("/", response_class=HTMLResponse)
async def root():
    return HTMLResponse(FRONTEND_HTML)


@app.get("/App.jsx")
async def app_jsx():
    # Recompilar si el fuente es más nuevo que el compilado.
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
    # Alias de /App.jsx — sirve el archivo compilado.
    return await app_jsx()


@app.get("/themes.js")
async def themes_js():
    if THEMES_JS_PATH.exists():
        return FileResponse(THEMES_JS_PATH, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail="themes.js not found")


def _serve_frontend_module(subdir: str, filename: str):
    """Sirve un módulo .js desde frontend/src/<subdir>/."""
    path = FRONTEND_DIR / "src" / subdir / filename
    if path.exists() and path.suffix == ".js":
        return FileResponse(path, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail=f"Module {subdir}/{filename} not found")


@app.get("/src/utils/{filename}")
async def serve_utils(filename: str):
    return _serve_frontend_module("utils", filename)


@app.get("/src/services/{filename}")
async def serve_services(filename: str):
    return _serve_frontend_module("services", filename)


@app.get("/src/hooks/{filename}")
async def serve_hooks(filename: str):
    return _serve_frontend_module("hooks", filename)


def _serve_frontend_jsx(subdir: str, path: str):
    """Sirve un módulo de frontend/src/<subdir>/ (.jsx transpilado o .js crudo).

    Soporta subcarpetas (p. ej. components/tabs/HistoryPanel.jsx).
    """
    target = resolve_frontend_module(subdir, path)
    if target is None:
        raise HTTPException(status_code=404, detail=f"Module {subdir}/{path} not found")
    code = get_module_js(target)
    if code is None:
        raise HTTPException(status_code=500, detail=f"Could not load module {subdir}/{path}")
    return Response(content=code, media_type="text/javascript", headers=_static_headers())


@app.get("/src/components/{path:path}")
async def serve_components(path: str):
    return _serve_frontend_jsx("components", path)


@app.get("/src/context/{path:path}")
async def serve_context(path: str):
    return _serve_frontend_jsx("context", path)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        state.connections.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
