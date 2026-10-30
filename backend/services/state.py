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

# --- MCP (Model Context Protocol) ---
# Puerta de acceso: el servidor `blackwire-mcp` (stdio, lanzado por el cliente de
# IA) consulta este flag antes de CADA llamada de herramienta y la rechaza si está
# en False. Es el control real que la GUI enciende/apaga: gobierna si un agente
# externo puede leer el tráfico interceptado (credenciales/tokens en vivo) o
# disparar peticiones por el proxy. Por defecto DESACTIVADO.
mcp_enabled: bool = False
# Registro acotado de la actividad de las herramientas MCP (para mostrarla en la
# GUI). El servidor MCP lo alimenta vía POST /api/mcp/activity.
mcp_activity: List[dict] = []
MCP_ACTIVITY_MAX = 200


def record_mcp_activity(entry: dict) -> None:
    """Añade una entrada de actividad MCP, recortando el buffer al máximo."""
    mcp_activity.append(entry)
    if len(mcp_activity) > MCP_ACTIVITY_MAX:
        del mcp_activity[: len(mcp_activity) - MCP_ACTIVITY_MAX]


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
