#!/usr/bin/env python3
"""
Router de la puerta MCP (Model Context Protocol).

El servidor `blackwire-mcp` (proceso stdio aparte, lanzado por el cliente de IA)
NO es parte de este backend: vive en `mcp_server/` y habla con la API por
localhost. Este router expone solo la *puerta* que la GUI nativa controla:

  - estado de la puerta (`enabled`) y conteo de actividad,
  - encender / apagar la puerta,
  - un registro acotado de la actividad de las herramientas MCP que la GUI muestra.

Por diseño NO hay lógica de herramientas aquí: el servidor MCP consulta
`/api/mcp/status` antes de cada llamada y reporta lo que hizo con
`POST /api/mcp/activity`. La puerta arranca DESACTIVADA (state.mcp_enabled).
"""

import time

from fastapi import APIRouter, Body

from services import state

router = APIRouter()

# Herramientas MCP conocidas (whitelist para no registrar basura arbitraria).
_KNOWN_TOOLS = {
    "blackwire_status", "list_recent_requests", "search_requests",
    "get_request", "send_request", "get_scope", "add_scope_rule",
    "decode", "list_projects", "current_project",
}


@router.get("/api/mcp/status")
async def mcp_status():
    """Estado de la puerta MCP. {enabled, activity_count}."""
    return {"enabled": state.mcp_enabled, "activity_count": len(state.mcp_activity)}


@router.post("/api/mcp/enable")
async def mcp_enable():
    """Abre la puerta: los agentes IA pueden usar las herramientas MCP."""
    state.mcp_enabled = True
    return {"enabled": True}


@router.post("/api/mcp/disable")
async def mcp_disable():
    """Cierra la puerta: toda llamada de herramienta MCP será rechazada."""
    state.mcp_enabled = False
    return {"enabled": False}


@router.get("/api/mcp/activity")
async def mcp_activity(limit: int = 100):
    """Últimas entradas de actividad MCP (más recientes primero)."""
    limit = max(1, min(limit, state.MCP_ACTIVITY_MAX))
    return {"activity": list(reversed(state.mcp_activity[-limit:]))}


@router.post("/api/mcp/activity")
async def mcp_log_activity(entry: dict = Body(...)):
    """El servidor MCP registra una llamada de herramienta. {tool, ok, summary}."""
    tool = str(entry.get("tool", "")).strip()
    if tool not in _KNOWN_TOOLS:
        tool = "unknown"
    state.record_mcp_activity({
        "ts": time.time(),
        "tool": tool,
        "ok": bool(entry.get("ok", True)),
        "summary": str(entry.get("summary", ""))[:300],
    })
    return {"status": "ok"}
