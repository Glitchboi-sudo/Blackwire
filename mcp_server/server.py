#!/usr/bin/env python3
"""Servidor MCP de Blackwire (stdio).

Expone un subconjunto curado de capacidades de Blackwire como herramientas MCP
para que un agente de IA (Claude Desktop/Code, …) pueda consultar el historial,
inspeccionar peticiones, reenviar peticiones por el proxy (Repeater), gestionar
scope y decodificar datos — siempre a través del REST del backend en localhost.

Lanzamiento (lo hace el cliente de IA):
    blackwire-mcp                     # vía el console-script (pyproject)
    python -m mcp_server.server       # equivalente en desarrollo

Variables de entorno:
    BLACKWIRE_BASE_URL   URL del backend (por defecto http://127.0.0.1:5000)
    BLACKWIRE_MCP_TIMEOUT  timeout HTTP en segundos (por defecto 15)

PUERTA DE SEGURIDAD: antes de CADA herramienta (salvo `blackwire_status`) se
consulta `GET /api/mcp/status`; si la puerta está cerrada la herramienta devuelve
un error y no toca nada. La puerta se enciende/apaga desde la app nativa. El
tráfico interceptado puede contener credenciales/tokens en vivo: ese es el motivo
de que la puerta exista y arranque CERRADA.
"""

from __future__ import annotations

from typing import Any

from .rest import BlackwireRest, RestError

# Compatibilidad: mcp>=2 renombró FastMCP -> MCPServer; soportar ambos.
try:  # mcp >= 2
    from mcp.server.mcpserver import MCPServer as _Server
except ModuleNotFoundError:  # pragma: no cover - mcp 1.x
    from mcp.server.fastmcp import FastMCP as _Server  # type: ignore

_INSTRUCTIONS = (
    "Tools to drive Blackwire, a Burp-Suite-like HTTP/HTTPS intercepting proxy. "
    "Use list_recent_requests / search_requests to find traffic, get_request to "
    "inspect one, and send_request to replay/modify a request through the proxy "
    "(Repeater). Intercepted traffic may contain live secrets — handle with care. "
    "If a tool reports the MCP gate is disabled, ask the user to enable it in the "
    "Blackwire app (status bar → MCP → Enable)."
)

server = _Server("blackwire", instructions=_INSTRUCTIONS)

_GATE_CLOSED = (
    "Blackwire MCP is disabled. Enable it in the Blackwire app "
    "(status bar → MCP → Enable) and try again."
)

# Instancia REST perezosa (se crea al primer uso; una sola por proceso).
_rest_singleton: BlackwireRest | None = None


def _rest() -> BlackwireRest:
    global _rest_singleton
    if _rest_singleton is None:
        _rest_singleton = BlackwireRest()
    return _rest_singleton


def _require_gate(rest: BlackwireRest) -> dict[str, Any] | None:
    """None si la puerta está abierta; si no, un dict de error para devolver."""
    try:
        status = rest.mcp_status()
    except RestError as exc:
        return {"error": f"Cannot reach Blackwire backend: {exc}"}
    if not status.get("enabled"):
        return {"error": _GATE_CLOSED}
    return None


# --- herramientas ---------------------------------------------------------- #

@server.tool()
def blackwire_status() -> dict[str, Any]:
    """Report Blackwire health: MCP gate state, proxy status and active project.

    Always available (does not require the gate). Call this first to check whether
    the MCP gate is enabled before using the other tools."""
    rest = _rest()
    out: dict[str, Any] = {"base_url": rest.base_url}
    try:
        out["mcp"] = rest.mcp_status()
    except RestError as exc:
        return {"error": f"Cannot reach Blackwire backend: {exc}", "base_url": rest.base_url}
    for key, call in (("proxy", rest.proxy_status), ("project", rest.current_project)):
        try:
            out[key] = call()
        except RestError as exc:
            out[key] = {"error": str(exc)}
    return out


@server.tool()
def list_recent_requests(limit: int = 100) -> dict[str, Any]:
    """List the most recent requests captured by the proxy (lightweight rows).

    Returns up to `limit` items with method, url, status and timing. Use
    get_request to fetch full headers/body of one."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    try:
        rows = rest.list_requests(limit=limit)
    except RestError as exc:
        rest.log_activity("list_recent_requests", False, str(exc))
        return {"error": str(exc)}
    rest.log_activity("list_recent_requests", True, f"limit={limit} -> {len(rows)}")
    return {"count": len(rows), "requests": rows}


@server.tool()
def search_requests(query: str, page_size: int = 200) -> dict[str, Any]:
    """Search proxy history with an HTTPQL query (e.g. 'req.method.eq:POST').

    Mirrors the filter bar in the app. Returns matching requests with total count.
    An empty or invalid query returns an error — use list_recent_requests for an
    unfiltered recent view."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    if not query.strip():
        return {"error": "query is empty; use list_recent_requests for recent traffic"}
    try:
        result = rest.search(query, page_size=page_size)
    except RestError as exc:
        rest.log_activity("search_requests", False, f"{query!r}: {exc}")
        return {"error": str(exc)}
    if isinstance(result, dict) and result.get("error"):
        rest.log_activity("search_requests", False, f"{query!r}: {result['error']}")
        return {"error": str(result["error"])}
    rows = result.get("requests", []) if isinstance(result, dict) else []
    total = result.get("total", len(rows)) if isinstance(result, dict) else len(rows)
    rest.log_activity("search_requests", True, f"{query!r} -> {total}")
    return {"total": total, "count": len(rows), "requests": rows}


@server.tool()
def get_request(request_id: int, include_response_body: bool = True) -> dict[str, Any]:
    """Fetch the full detail of one request: headers, body and response.

    Set include_response_body=False to omit a large response body. The returned
    data may contain live credentials, cookies or tokens — handle with care."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    try:
        detail = rest.get_detail(request_id)
    except RestError as exc:
        rest.log_activity("get_request", False, f"id={request_id}: {exc}")
        return {"error": str(exc)}
    if not include_response_body and isinstance(detail, dict):
        for key in ("response_body", "resp_body"):
            detail.pop(key, None)
    rest.log_activity("get_request", True, f"id={request_id}")
    return detail if isinstance(detail, dict) else {"detail": detail}


@server.tool()
def send_request(method: str, url: str, headers: dict[str, Any] | None = None,
                 body: str = "", follow_redirects: bool = False) -> dict[str, Any]:
    """Send a raw HTTP request through the Blackwire proxy (Repeater).

    This is a powerful write action: it issues a real network request via the
    proxy. Returns {status_code, headers, body, elapsed, size, ...} or {error}.
    Use it to replay or fuzz a captured request with modifications."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    try:
        result = rest.repeater_send(method, url, headers=headers, body=body,
                                    follow_redirects=follow_redirects)
    except RestError as exc:
        rest.log_activity("send_request", False, f"{method} {url}: {exc}")
        return {"error": str(exc)}
    ok = not (isinstance(result, dict) and result.get("error"))
    rest.log_activity("send_request", ok, f"{method} {url}")
    return result if isinstance(result, dict) else {"result": result}


@server.tool()
def get_scope() -> dict[str, Any]:
    """List the current scope rules (include/exclude patterns)."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    try:
        rules = rest.get_scope()
    except RestError as exc:
        return {"error": str(exc)}
    rest.log_activity("get_scope", True, f"{len(rules)} rules")
    return {"count": len(rules), "rules": rules}


@server.tool()
def add_scope_rule(pattern: str, rule_type: str = "include") -> dict[str, Any]:
    """Add a scope rule. rule_type is 'include' or 'exclude'."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    if rule_type not in ("include", "exclude"):
        return {"error": "rule_type must be 'include' or 'exclude'"}
    try:
        result = rest.add_scope_rule(pattern, rule_type=rule_type)
    except RestError as exc:
        rest.log_activity("add_scope_rule", False, f"{rule_type}:{pattern}: {exc}")
        return {"error": str(exc)}
    rest.log_activity("add_scope_rule", True, f"{rule_type}:{pattern}")
    return result if isinstance(result, dict) else {"result": result}


@server.tool()
def decode(input_text: str, operations: list[dict[str, Any]]) -> dict[str, Any]:
    """Run a chain of decode/encode/hash operations (Decoder/Cipher).

    `operations` is a list of {"name": <op>, "args": {...}} applied in order,
    e.g. [{"name": "from_base64", "args": {}}]. Returns {output} or {error}."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    try:
        result = rest.chepy_bake(input_text, operations)
    except RestError as exc:
        rest.log_activity("decode", False, str(exc))
        return {"error": str(exc)}
    ok = not (isinstance(result, dict) and result.get("error"))
    rest.log_activity("decode", ok, f"{len(operations)} ops")
    return result if isinstance(result, dict) else {"result": result}


@server.tool()
def list_projects() -> dict[str, Any]:
    """List Blackwire projects (each is an isolated capture database)."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    try:
        projects = rest.projects()
    except RestError as exc:
        return {"error": str(exc)}
    rest.log_activity("list_projects", True, f"{len(projects)} projects")
    return {"count": len(projects), "projects": projects}


@server.tool()
def current_project() -> dict[str, Any]:
    """Return the currently active Blackwire project."""
    rest = _rest()
    gate = _require_gate(rest)
    if gate:
        return gate
    try:
        current = rest.current_project()
    except RestError as exc:
        return {"error": str(exc)}
    rest.log_activity("current_project", True, "")
    return current if isinstance(current, dict) else {"project": current}


def main() -> None:
    """Punto de entrada del console-script `blackwire-mcp` (transport stdio)."""
    server.run()


if __name__ == "__main__":
    main()
