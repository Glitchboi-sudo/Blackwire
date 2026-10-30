"""Cliente REST (httpx) del backend de Blackwire para el servidor MCP.

Sin dependencias de Qt ni del paquete de la GUI: el servidor MCP es autónomo.
La única frontera de red vive aquí, igual que `api.py` lo es para la GUI. Los
contratos de endpoint se calcan de `desktop/blackwire_desktop/api.py`.

Para la búsqueda HTTPQL se reutiliza el parser puro de la GUI
(`desktop/blackwire_desktop/httpql.py`) cargado dinámicamente: el backend espera
`query` + su `ast`, y ese parser produce exactamente la forma de AST esperada.
Si no se encuentra (p.ej. empaquetado sin la GUI), la búsqueda por texto queda
deshabilitada con un error claro y `list_recent_requests` sigue funcionando.
"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from typing import Any, Callable, Optional

import httpx

DEFAULT_BASE_URL = "http://127.0.0.1:5000"


def _load_httpql_parser() -> Optional[Callable[[str], tuple]]:
    """Carga `httpql_parse` del paquete de la GUI, o None si no está disponible."""
    # 1) Si el paquete de la GUI es importable (p.ej. build empaquetado que lo
    #    incluye, o `PYTHONPATH=<repo>/desktop`), usar el import normal.
    try:
        from blackwire_desktop.httpql import httpql_parse  # type: ignore
        return httpql_parse
    except Exception:
        pass
    # 2) Si no, cargar el archivo por ruta (desarrollo, sin desktop/ en el path).
    override = os.environ.get("BLACKWIRE_HTTPQL_PATH")
    if override:
        candidate = Path(override).expanduser()
    else:
        # .../Blackwire/mcp_server/rest.py -> parents[1] = Blackwire (raíz del repo).
        candidate = (Path(__file__).resolve().parents[1]
                     / "desktop" / "blackwire_desktop" / "httpql.py")
    if not candidate.exists():
        return None
    try:
        spec = importlib.util.spec_from_file_location("_bw_httpql", candidate)
        if spec is None or spec.loader is None:
            return None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return getattr(module, "httpql_parse", None)
    except Exception:  # pragma: no cover - carga opcional
        return None


class RestError(RuntimeError):
    """Fallo al hablar con el backend de Blackwire."""


class BlackwireRest:
    """Wrapper fino sobre el REST del backend (solo lo que las tools usan)."""

    def __init__(self, base_url: str | None = None, timeout: float | None = None) -> None:
        base = base_url or os.environ.get("BLACKWIRE_BASE_URL", DEFAULT_BASE_URL)
        self.base_url = base.rstrip("/")
        to = timeout if timeout is not None else float(
            os.environ.get("BLACKWIRE_MCP_TIMEOUT", "15"))
        self._client = httpx.Client(base_url=self.base_url, timeout=to)
        self._httpql_parse = _load_httpql_parser()

    def close(self) -> None:
        self._client.close()

    # -- helpers ------------------------------------------------------------ #
    def _get(self, path: str, **params: Any) -> Any:
        return self._call("GET", path, params=params or None)

    def _post(self, path: str, json: Any | None = None, **params: Any) -> Any:
        return self._call("POST", path, json=json, params=params or None)

    def _call(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            resp = self._client.request(method, path, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:300]
            raise RestError(f"{exc.response.status_code} {path}: {detail}") from exc
        except httpx.HTTPError as exc:
            raise RestError(f"{method} {path}: {exc}") from exc

    # -- puerta MCP --------------------------------------------------------- #
    def mcp_status(self) -> dict[str, Any]:
        return self._get("/api/mcp/status")

    def log_activity(self, tool: str, ok: bool, summary: str) -> None:
        """Mejor-esfuerzo: registra la llamada; nunca rompe la herramienta."""
        try:
            self._post("/api/mcp/activity",
                       {"tool": tool, "ok": ok, "summary": summary})
        except RestError:
            pass

    # -- salud / proyecto --------------------------------------------------- #
    def proxy_status(self) -> dict[str, Any]:
        return self._get("/api/proxy/status")

    def projects(self) -> list[dict[str, Any]]:
        return self._get("/api/projects")

    def current_project(self) -> Any:
        return self._get("/api/projects/current")

    # -- historial ---------------------------------------------------------- #
    def list_requests(self, limit: int = 100) -> list[dict[str, Any]]:
        return self._get("/api/requests", limit=limit)

    def search(self, query: str, page_size: int = 200) -> dict[str, Any]:
        """Búsqueda HTTPQL: parsea `query` a AST y lo manda junto al crudo."""
        if self._httpql_parse is None:
            raise RestError(
                "HTTPQL search unavailable (parser not found). "
                "Use list_recent_requests instead, or set BLACKWIRE_HTTPQL_PATH.")
        ast, err = self._httpql_parse(query)
        if err:
            raise RestError(f"Invalid HTTPQL: {err}")
        body = {"page": 1, "page_size": page_size,
                "query": query, "ast": ast,
                "saved_only": False, "in_scope_only": False}
        return self._post("/api/requests/search", body)

    def get_detail(self, rid: int) -> dict[str, Any]:
        return self._get(f"/api/v2/requests/{rid}/detail")

    # -- repeater ----------------------------------------------------------- #
    def repeater_send(self, method: str, url: str,
                      headers: dict[str, Any] | None = None,
                      body: str = "", follow_redirects: bool = False) -> dict[str, Any]:
        payload = {"method": method, "url": url, "headers": headers or {},
                   "body": body or "", "follow_redirects": follow_redirects}
        return self._post("/api/repeater/send-raw", payload)

    # -- scope -------------------------------------------------------------- #
    def get_scope(self) -> list[dict[str, Any]]:
        return self._get("/api/scope").get("rules", [])

    def add_scope_rule(self, pattern: str, rule_type: str = "include",
                       enabled: bool = True) -> dict[str, Any]:
        return self._post("/api/scope/rules",
                          {"pattern": pattern, "rule_type": rule_type,
                           "enabled": enabled})

    # -- decoder (chepy) ---------------------------------------------------- #
    def chepy_bake(self, input_text: str,
                   operations: list[dict[str, Any]]) -> dict[str, Any]:
        return self._post("/api/chepy/bake",
                          {"input": input_text, "operations": operations})
