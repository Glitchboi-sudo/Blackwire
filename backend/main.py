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
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from config import PROJECTS_DIR, get_project_db
from services import state, watchdog
from db import get_db, get_db_with_regex, init_db, load_project_settings
from services.proxy_control import stop_proxy
from utils.httpql import compile_httpql_ast

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
from routes.mcp import router as mcp_router

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    setup_logging()
    setup_console_handler()
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
                webhook_router, scope_router, intercept_router, proxy_router, internal_router,
                mcp_router):
    app.include_router(_router)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


# --- Raíz ---
# La UI web fue retirada (EOL): la única interfaz es la app de escritorio nativa
# (`desktop/`), que consume este backend por REST + WebSocket. La raíz devuelve
# solo un descriptor del servicio.
@app.get("/")
async def root():
    return {"service": "blackwire", "api": "ok", "ui": "desktop"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.connections.append(websocket)
    watchdog.client_connected()
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in state.connections:
            state.connections.remove(websocket)
        watchdog.client_disconnected()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
