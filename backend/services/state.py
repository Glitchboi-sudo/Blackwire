#!/usr/bin/env python3
"""
Estado mutable compartido del backend.

IMPORTANTE — patrón anti-ciclos / anti-rebind:
  Todos los consumidores deben referenciar el estado de forma CUALIFICADA
  (`state.intercept_enabled`, `state.scope_rules`, ...) y NUNCA hacer
  `from state import intercept_enabled`. Así, cuando un módulo reasigna
  `state.intercept_enabled = True`, el resto ve el cambio. Importar el valor
  directamente capturaría una copia del binding y rompería la sincronización.

Solo importa `config` (sin dependencias de db/routers) para no crear ciclos.
"""

import logging
import subprocess
from typing import Dict, List, Optional

from fastapi import WebSocket

from config import CURRENT_PROJECT_FILE

logger = logging.getLogger('blackwire')

# --- Conexiones WebSocket del frontend (para broadcast en tiempo real) ---
connections: List[WebSocket] = []

# --- Proceso mitmproxy ---
proxy_process: Optional[subprocess.Popen] = None

# --- Interceptación (requests/responses en espera + flags) ---
intercepted_requests: Dict[str, dict] = {}
intercepted_responses: Dict[str, dict] = {}
intercept_enabled: bool = False
intercept_responses_enabled: bool = False

# --- Scope y proyecto/extensiones activos ---
scope_rules: List[dict] = []
current_project: Optional[str] = None
extensions_config: Dict[str, dict] = {}


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


async def broadcast(data: dict):
    """Envía un mensaje JSON a todas las conexiones WebSocket activas."""
    for conn in connections:
        try:
            await conn.send_json(data)
        except Exception:
            pass
