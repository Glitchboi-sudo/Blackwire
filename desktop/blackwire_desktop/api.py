"""Cliente REST del backend de Blackwire para la GUI nativa.

El backend (FastAPI + mitmproxy) corre aislado en Docker; esta GUI nativa en el
host lo consume por localhost. Mantener este módulo como la ÚNICA frontera de red
HTTP de la UI simplifica aplicar timeouts, reintentos y manejo de errores.
"""

from __future__ import annotations

from typing import Any

import requests

DEFAULT_BASE_URL = "http://127.0.0.1:5000"


class ApiError(RuntimeError):
    """Fallo al hablar con el backend de Blackwire."""


class BlackwireApi:
    """Wrapper fino sobre el REST existente del backend."""

    def __init__(self, base_url: str = DEFAULT_BASE_URL, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()

    # -- helpers de red ----------------------------------------------------- #
    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        kwargs.setdefault("timeout", self.timeout)
        try:
            resp = self._session.request(method, f"{self.base_url}{path}", **kwargs)
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:  # pragma: no cover - red real
            raise ApiError(str(exc)) from exc

    def _get(self, path: str, **params: Any) -> requests.Response:
        return self._request("GET", path, params=params or None)

    def _post(self, path: str, json: Any | None = None) -> requests.Response:
        return self._request("POST", path, json=json)

    def _put(self, path: str, json: Any | None = None) -> requests.Response:
        return self._request("PUT", path, json=json)

    def _delete(self, path: str, **params: Any) -> requests.Response:
        return self._request("DELETE", path, params=params or None)

    # -- salud + historial -------------------------------------------------- #
    def ping(self) -> bool:
        """Devuelve True si el backend responde en la raíz."""
        try:
            self._get("/")
            return True
        except ApiError:
            return False

    def list_requests(self, limit: int = 300) -> list[dict[str, Any]]:
        """Lista el historial de requests (items livianos para la tabla)."""
        return self._get("/api/requests", limit=limit).json()

    def search(
        self,
        query: str = "",
        ast: dict[str, Any] | None = None,
        page: int = 1,
        page_size: int = 500,
        saved_only: bool = False,
        in_scope_only: bool = False,
    ) -> dict[str, Any]:
        """Búsqueda HTTPQL paginada (`POST /api/requests/search`).

        Igual que la UI web: solo manda `query`+`ast` cuando hay consulta; si no,
        devuelve todo paginado. La respuesta trae `requests`/`total`/`page`/… o,
        ante HTTPQL inválido, `{"error": ...}` (que se propaga tal cual)."""
        body: dict[str, Any] = {
            "page": page, "page_size": page_size,
            "saved_only": saved_only, "in_scope_only": in_scope_only,
        }
        if query and ast is not None:
            body["query"] = query
            body["ast"] = ast
        return self._post("/api/requests/search", body).json()

    def get_detail(self, rid: int) -> dict[str, Any]:
        """Detalle completo de un request: headers, body, response_*."""
        return self._get(f"/api/v2/requests/{rid}/detail").json()

    def toggle_saved(self, rid: int) -> dict[str, Any]:
        """Alterna 'saved'/favorito de un request. {"saved": bool}."""
        return self._put(f"/api/requests/{rid}/save").json()

    def delete_request(self, rid: int) -> dict[str, Any]:
        """Elimina un request del historial. {"status": "deleted"}."""
        return self._delete(f"/api/requests/{rid}").json()

    def clear_history(self, keep_saved: bool = True) -> dict[str, Any]:
        """Limpia el historial (por defecto conserva los guardados). {status}."""
        return self._delete("/api/requests", keep_saved=keep_saved).json()

    def render_url(self, rid: int) -> str:
        """URL del render del response (abrible en el navegador del SO)."""
        return f"{self.base_url}/api/requests/{rid}/render"

    def replay_url(self, rid: int) -> str:
        """URL de la página de replay (abrible en el navegador del SO)."""
        return f"{self.base_url}/api/requests/{rid}/replay"

    # -- filter presets (HTTPQL guardado) ----------------------------------- #
    def filter_presets(self) -> list[dict[str, Any]]:
        """[{id, name, query, created_at}] ordenados por nombre."""
        return self._get("/api/filter-presets").json()

    def create_filter_preset(
        self, name: str, query: str, ast: dict[str, Any] | None
    ) -> dict[str, Any]:
        """Guarda un preset HTTPQL {name, query, ast}. {status} o {error}."""
        body = {"name": name, "query": query, "ast": ast}
        return self._post("/api/filter-presets", body).json()

    def delete_filter_preset(self, preset_id: int) -> dict[str, Any]:
        return self._delete(f"/api/filter-presets/{preset_id}").json()

    # -- control del proxy (mitmdump) --------------------------------------- #
    def proxy_interfaces(self) -> list[dict[str, Any]]:
        """Interfaces para 'listen on': [{label, address}] (`/api/proxy/interfaces`)."""
        return self._get("/api/proxy/interfaces").json().get("interfaces", [])

    def proxy_status(self) -> dict[str, Any]:
        """{"running": bool, "intercept_enabled": bool}. NO devuelve puerto ni pid."""
        return self._get("/api/proxy/status").json()

    def proxy_start(
        self,
        port: int = 8080,
        mode: str = "regular",
        extra: str = "",
        listen_host: str = "",
    ) -> dict[str, Any]:
        """Arranca mitmdump. OJO: los parámetros van como QUERY, no como body.

        Devuelve {status:'started',port,pid} | {status:'already_running',port} |
        {status:'failed',error}. Requiere proyecto activo (400 si no)."""
        params = {"port": port, "mode": mode, "extra": extra,
                  "listen_host": listen_host}
        return self._request("POST", "/api/proxy/start", params=params).json()

    def proxy_stop(self) -> dict[str, Any]:
        """Detiene el proxy. {status:'stopped'|'not_running'}."""
        return self._post("/api/proxy/stop").json()

    def shutdown_server(self) -> dict[str, Any]:
        """Apaga el backend (`POST /api/shutdown`). Tras esto el backend muere."""
        return self._post("/api/shutdown").json()

    # -- puerta MCP (Model Context Protocol) -------------------------------- #
    def mcp_status(self) -> dict[str, Any]:
        """Estado de la puerta MCP. {"enabled": bool, "activity_count": int}."""
        return self._get("/api/mcp/status").json()

    def mcp_enable(self) -> dict[str, Any]:
        """Abre la puerta MCP (los agentes IA pueden usar las herramientas)."""
        return self._post("/api/mcp/enable").json()

    def mcp_disable(self) -> dict[str, Any]:
        """Cierra la puerta MCP (rechaza toda llamada de herramienta)."""
        return self._post("/api/mcp/disable").json()

    def mcp_activity(self, limit: int = 100) -> list[dict[str, Any]]:
        """Actividad reciente de las herramientas MCP (más reciente primero)."""
        return self._get("/api/mcp/activity", limit=limit).json().get("activity", [])

    # -- console (logs del proxy en vivo) ----------------------------------- #
    def console_logs(self, limit: int = 500) -> list[dict[str, Any]]:
        """Entradas de log: [{ts, level, name, msg}] (`GET /api/console/logs`)."""
        return self._get("/api/console/logs", limit=limit).json().get("logs", [])

    def clear_console_logs(self) -> dict[str, Any]:
        """Vacía el buffer de logs. {"status": "cleared"}."""
        return self._delete("/api/console/logs").json()

    # -- proxy bypass (sitios que rechazan el cert MITM) -------------------- #
    def bypass_rules(self) -> list[dict[str, Any]]:
        """[{id, pattern, is_regex, description, enabled, created_at}]."""
        return self._get("/api/bypass/rules").json().get("rules", [])

    def bypass_add_rule(
        self, pattern: str, is_regex: bool = False,
        description: str = "", enabled: bool = True,
    ) -> dict[str, Any]:
        body = {"pattern": pattern, "is_regex": is_regex,
                "description": description, "enabled": enabled}
        return self._post("/api/bypass/rules", body).json()

    def bypass_toggle_rule(self, rule_id: int) -> dict[str, Any]:
        """Alterna enabled (`POST /api/bypass/rules/toggle/{id}`)."""
        return self._post(f"/api/bypass/rules/toggle/{rule_id}").json()

    def bypass_delete_rule(self, rule_id: int) -> dict[str, Any]:
        return self._delete(f"/api/bypass/rules/{rule_id}").json()

    def bypass_presets(self) -> dict[str, Any]:
        """{nombre: [reglas]} de presets predefinidos."""
        return self._get("/api/bypass/presets").json().get("presets", {})

    def bypass_apply_preset(self, name: str) -> dict[str, Any]:
        """Aplica un preset (añade varias reglas). {added, skipped, ...}."""
        return self._post(f"/api/bypass/presets/{name}").json()

    # -- scope -------------------------------------------------------------- #
    def get_scope(self) -> list[dict[str, Any]]:
        """Reglas de scope: lista de {pattern, rule_type, enabled, id}."""
        return self._get("/api/scope").json().get("rules", [])

    def add_scope_rule(
        self, pattern: str, rule_type: str = "include", enabled: bool = True
    ) -> dict[str, Any]:
        body = {"pattern": pattern, "rule_type": rule_type, "enabled": enabled}
        return self._post("/api/scope/rules", body).json()

    def delete_scope_rule(self, rule_id: str) -> dict[str, Any]:
        return self._delete(f"/api/scope/rules/{rule_id}").json()

    def toggle_scope_rule(self, rule_id: str) -> dict[str, Any]:
        """Alterna `enabled` de una regla (`PUT /api/scope/rules/{id}`)."""
        return self._put(f"/api/scope/rules/{rule_id}").json()

    # -- intercept (requests) ----------------------------------------------- #
    def intercept_status(self) -> dict[str, Any]:
        """{"enabled": bool, "pending_count": int}."""
        return self._get("/api/intercept/status").json()

    def intercept_toggle(self) -> dict[str, Any]:
        """Alterna intercept on/off. Devuelve {"enabled": bool}."""
        return self._post("/api/intercept/toggle").json()

    def intercept_pending(self) -> list[dict[str, Any]]:
        """Requests pausados: [{id, method, url, headers, body, timestamp}]."""
        return self._get("/api/intercept/pending").json()

    def intercept_forward(
        self, request_id: str, modified: dict[str, Any] | None = None,
        intercept_response: bool = False,
    ) -> dict[str, Any]:
        """Reenvía un request pausado, opcionalmente modificado (edit-then-forward).

        `intercept_response=True` marca el flow para pausar TAMBIÉN su respuesta
        (Burp-style 'intercept this response'); va por QUERY, no en el body.
        """
        return self._request(
            "POST", f"/api/intercept/{request_id}/forward",
            params={"intercept_response": str(intercept_response).lower()},
            json=modified,
        ).json()

    def intercept_drop(self, request_id: str) -> dict[str, Any]:
        return self._post(f"/api/intercept/{request_id}/drop").json()

    def intercept_forward_all(self) -> dict[str, Any]:
        return self._post("/api/intercept/forward-all").json()

    def intercept_drop_all(self) -> dict[str, Any]:
        return self._post("/api/intercept/drop-all").json()

    # -- intercept (responses, Burp-style 'intercept this response') -------- #
    def intercept_pending_responses(self) -> list[dict[str, Any]]:
        """Responses pausadas: [{id, method, url, status_code, headers, body,
        req_headers, req_body, timestamp}]."""
        return self._get("/api/intercept/pending_responses").json()

    def intercept_forward_response(
        self, response_id: str, modified: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Reenvía una response pausada, opcionalmente modificada {status_code,
        headers, body}."""
        return self._post(
            f"/api/intercept_response/{response_id}/forward", modified
        ).json()

    def intercept_drop_response(self, response_id: str) -> dict[str, Any]:
        return self._post(f"/api/intercept_response/{response_id}/drop").json()

    def intercept_toggle_responses(self) -> dict[str, Any]:
        """Alterna el intercept GLOBAL de respuestas. {"enabled": bool}."""
        return self._post("/api/intercept/toggle_responses").json()

    def intercept_forward_all_responses(self) -> dict[str, Any]:
        """Reenvía todas las respuestas pausadas. {status, count}."""
        return self._post("/api/intercept_response/forward-all").json()

    def intercept_drop_all_responses(self) -> dict[str, Any]:
        """Descarta todas las respuestas pausadas. {status, count}."""
        return self._post("/api/intercept_response/drop-all").json()

    # -- repeater ----------------------------------------------------------- #
    def repeater_send(
        self,
        method: str,
        url: str,
        headers: dict[str, Any] | None = None,
        body: str | None = None,
        follow_redirects: bool = False,
    ) -> dict[str, Any]:
        """Envía un request crudo por el proxy (`POST /api/repeater/send-raw`).

        Respuesta: {status_code, headers, body, elapsed, size, is_redirect,
        redirect_url, redirect_chain, final_url} o {"error": ...} (HTTP 200)."""
        payload = {
            "method": method, "url": url, "headers": headers or {},
            "body": body or "", "follow_redirects": follow_redirects,
        }
        return self._post("/api/repeater/send-raw", payload).json()

    def repeater_list(self) -> list[dict[str, Any]]:
        """Pestañas de Repeater guardadas (orden id DESC)."""
        return self._get("/api/repeater").json()

    def repeater_save(
        self,
        name: str,
        method: str,
        url: str,
        headers: dict[str, Any] | None = None,
        body: str | None = None,
        last_response: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        body_payload = {
            "name": name, "method": method, "url": url,
            "headers": headers or {}, "body": body, "last_response": last_response,
        }
        return self._post("/api/repeater", body_payload).json()

    def repeater_update(self, item_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Actualización parcial de una pestaña (name/method/url/headers/body/…)."""
        return self._put(f"/api/repeater/{item_id}", data).json()

    def repeater_delete(self, item_id: int) -> dict[str, Any]:
        return self._delete(f"/api/repeater/{item_id}").json()

    # -- intruder (solo persistencia; el ataque se ejecuta en el cliente) --- #
    def intruder_list(self) -> list[dict[str, Any]]:
        """Ataques guardados: [{id, name, total, created_at}] (orden id DESC)."""
        return self._get("/api/intruder/attacks").json()

    def intruder_save(
        self,
        name: str,
        config: dict[str, Any],
        results: list[dict[str, Any]] | None = None,
        total: int = 0,
    ) -> dict[str, Any]:
        """Guarda un ataque. Devuelve {id, status}."""
        body = {"name": name, "config": config,
                "results": results or [], "total": total}
        return self._post("/api/intruder/attacks", body).json()

    def intruder_load(self, aid: int) -> dict[str, Any]:
        """Carga un ataque: {id, name, config, results, total, created_at} o {error}."""
        return self._get(f"/api/intruder/attacks/{aid}").json()

    def intruder_update(self, aid: int, data: dict[str, Any]) -> dict[str, Any]:
        """Actualización parcial (name/config/results). Al fijar results, total=len."""
        return self._put(f"/api/intruder/attacks/{aid}", data).json()

    def intruder_delete(self, aid: int) -> dict[str, Any]:
        return self._delete(f"/api/intruder/attacks/{aid}").json()

    # -- collections -------------------------------------------------------- #
    def collections_list(self) -> list[dict[str, Any]]:
        """[{id, name, description, created_at, item_count}]."""
        return self._get("/api/collections").json()

    def collection_create(self, name: str, description: str = "") -> dict[str, Any]:
        return self._post("/api/collections",
                          {"name": name, "description": description}).json()

    def collection_delete(self, cid: int) -> dict[str, Any]:
        return self._delete(f"/api/collections/{cid}").json()

    def collection_items(self, cid: int) -> list[dict[str, Any]]:
        """Pasos de la colección ordenados por position."""
        return self._get(f"/api/collections/{cid}/items").json()

    def collection_add_item(
        self,
        cid: int,
        method: str,
        url: str,
        headers: dict[str, Any] | None = None,
        body: str | None = None,
        var_extracts: list[dict[str, Any]] | None = None,
        position: int | None = None,
    ) -> dict[str, Any]:
        """Añade un paso (campos planos; NO anidados en 'request')."""
        payload = {
            "method": method, "url": url, "headers": headers or {},
            "body": body, "var_extracts": var_extracts or [], "position": position,
        }
        return self._post(f"/api/collections/{cid}/items", payload).json()

    def collection_update_item(
        self, cid: int, iid: int, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Actualiza/reordena un paso (keys: method/url/body/headers/var_extracts/position)."""
        return self._put(f"/api/collections/{cid}/items/{iid}", data).json()

    def collection_delete_item(self, cid: int, iid: int) -> dict[str, Any]:
        return self._delete(f"/api/collections/{cid}/items/{iid}").json()

    def collection_execute_item(
        self, cid: int, iid: int, variables: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Ejecuta un paso con variables {{name}}. Devuelve respuesta + extracted."""
        return self._post(f"/api/collections/{cid}/items/{iid}/execute",
                          {"variables": variables or {}}).json()

    # -- session macros (secuencias de requests ejecutadas server-side) ----- #
    def session_macros(self) -> list[dict[str, Any]]:
        """[{id, name, description, requests, created_at}] (orden created_at DESC).

        Cada item de `requests` es {method, url, headers(JSON str), body}."""
        return self._get("/api/session/macros").json()

    def session_create_macro(
        self, name: str, description: str = "",
        requests: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Crea una macro. Devuelve {id}."""
        body = {"name": name, "description": description,
                "requests": requests or []}
        return self._post("/api/session/macros", body).json()

    def session_update_macro(self, mid: int, data: dict[str, Any]) -> dict[str, Any]:
        """Actualización parcial (name/description/requests). {status}."""
        return self._put(f"/api/session/macros/{mid}", data).json()

    def session_delete_macro(self, mid: int) -> dict[str, Any]:
        return self._delete(f"/api/session/macros/{mid}").json()

    def session_execute_macro(self, mid: int) -> dict[str, Any]:
        """Ejecuta la macro en orden (server-side). {results: [...]} o 404."""
        return self._post(f"/api/session/macros/{mid}/execute").json()

    # -- session rules (extracción por regex) ------------------------------- #
    def session_rules(self) -> list[dict[str, Any]]:
        """[{id, enabled, name, when, target, header, regex, group, variable, created_at}]."""
        return self._get("/api/session/rules").json()

    def session_add_rule(self, rule: dict[str, Any]) -> dict[str, Any]:
        """rule requiere: name, when, target, regex, variable (+ enabled/header/group)."""
        return self._post("/api/session/rules", rule).json()

    def session_update_rule(self, rule_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Actualización parcial; toggle = {'enabled': bool}."""
        return self._put(f"/api/session/rules/{rule_id}", data).json()

    def session_delete_rule(self, rule_id: int) -> dict[str, Any]:
        return self._delete(f"/api/session/rules/{rule_id}").json()

    # -- cipher / chepy ----------------------------------------------------- #
    def chepy_operations(self) -> dict[str, Any]:
        """Catálogo: {operations: {categoría: [{name, label, params}]}}."""
        return self._get("/api/chepy/operations").json().get("operations", {})

    def chepy_bake(
        self, input_text: str, operations: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Ejecuta una receta (cadena de ops). Devuelve {output} o {error}."""
        return self._post("/api/chepy/bake",
                          {"input": input_text, "operations": operations}).json()

    # -- websocket viewer --------------------------------------------------- #
    def ws_connections(self, limit: int = 500) -> list[dict[str, Any]]:
        """[{url, frame_count, first_seen, last_seen}]."""
        return self._get("/api/websocket/connections", limit=limit).json()

    def ws_frames(self, url: str, limit: int = 500) -> list[dict[str, Any]]:
        """[{id, content, direction(up/down), timestamp}] de una conexión."""
        return self._get("/api/websocket/frames", url=url, limit=limit).json()

    def ws_resend(
        self, url: str, message: str, headers: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        body = {"url": url, "message": message, "headers": headers}
        return self._post("/api/websocket/resend", body).json()

    # -- extensiones (config schema-driven; la ejecución es server-side) ---- #
    def extensions_list(self) -> list[dict[str, Any]]:
        """Extensiones cargadas por el backend (requiere proyecto activo).

        Cada item: {name, title, description, tabs, ui_schema|None,
        default_config, custom_ui_file|None, config, enabled}. La ejecución de la
        lógica ocurre dentro de mitmproxy; la GUI solo lee/escribe `config`."""
        return self._get("/api/extensions").json().get("extensions", [])

    def extension_get(self, name: str) -> dict[str, Any] | None:
        """Devuelve la extensión `name` (con su `config`/`enabled`) o None.

        No hay GET por extensión en el backend: filtramos la lista completa."""
        for ext in self.extensions_list():
            if ext.get("name") == name:
                return ext
        return None

    def extension_update_config(
        self, name: str, config: dict[str, Any]
    ) -> dict[str, Any]:
        """Persiste el config PLANO completo de una extensión (incluir `enabled`).

        El body es el objeto crudo de nivel superior (sin envolver) y REEMPLAZA el
        config entero (no hay merge). Devuelve {status, name, config}. No hay
        endpoint de toggle: activar/desactivar es este mismo PUT con `enabled`."""
        return self._put(f"/api/extensions/{name}", config).json()

    # -- webhook.site (endpoints dedicados; la extensión no toca el proxy) --- #
    def webhooksite_set_apikey(self, api_key: str) -> dict[str, Any]:
        """Guarda la API key en el config de la extensión. {"status":"updated"}."""
        return self._post("/api/webhooksite/apikey", {"api_key": api_key}).json()

    def webhooksite_create_token(self, api_key: str = "") -> dict[str, Any]:
        """Crea/regenera un token de Webhook.site (opcionalmente con API key).

        Devuelve {status, token_id, token_url, created_at} o error HTTP."""
        return self._post("/api/webhooksite/token", {"api_key": api_key}).json()

    def webhooksite_refresh(self, limit: int = 50) -> dict[str, Any]:
        """Jala los requests capturados remotos a la BD local. {status, count}."""
        return self._post("/api/webhooksite/refresh", {"limit": limit}).json()

    def webhooksite_requests(
        self, limit: int = 200, all_tokens: bool = False
    ) -> list[dict[str, Any]]:
        """Requests capturados desde la BD local. Item: {request_id, method, url,
        ip, user_agent, content, headers, query, created_at, token_id}."""
        return self._get(
            "/api/webhooksite/requests", limit=limit, all_tokens=all_tokens
        ).json().get("requests", [])

    def webhooksite_delete_requests(self) -> dict[str, Any]:
        """Borra el historial local del token actual. {status, deleted}."""
        return self._delete("/api/webhooksite/requests").json()

    # -- proyectos / import-export ------------------------------------------ #
    def projects(self) -> list[dict[str, Any]]:
        """Lista de proyectos: [{name, description, created_at, is_current}] (desc)."""
        return self._get("/api/projects").json()

    def current_project(self) -> str | None:
        """Nombre del proyecto activo (o None)."""
        return self._get("/api/projects/current").json().get("project")

    def current_project_detail(self) -> dict[str, Any]:
        """{"project": name|None, "config": {...}} del proyecto activo."""
        return self._get("/api/projects/current").json()

    def create_project(self, name: str, description: str = "") -> dict[str, Any]:
        """Crea un proyecto (dir + BD + git + extensiones). {status, name} o 400."""
        return self._post("/api/projects",
                          {"name": name, "description": description}).json()

    def select_project(self, name: str) -> dict[str, Any]:
        """Activa un proyecto (intercambia BD/estado; NO reinicia el proxy)."""
        return self._post(f"/api/projects/{name}/select").json()

    def update_project(self, name: str, config: dict[str, Any]) -> dict[str, Any]:
        """Sobrescribe el config.json COMPLETO del proyecto (sin merge)."""
        return self._put(f"/api/projects/{name}", config).json()

    def delete_project(self, name: str) -> dict[str, Any]:
        """Elimina el proyecto (rmtree). {status: 'deleted'} o 404."""
        return self._delete(f"/api/projects/{name}").json()

    def import_project_json(self, data: bytes) -> dict[str, Any]:
        """Crea un proyecto NUEVO desde un export Blackwire JSON (body crudo)."""
        resp = self._request(
            "POST", "/api/projects/import", data=data,
            headers={"Content-Type": "application/json"},
        )
        return resp.json()

    def import_project_merge(
        self, name: str, data: dict[str, Any], clear_existing: bool = False
    ) -> dict[str, Any]:
        """Importa datos a un proyecto EXISTENTE (`POST /api/projects/{name}/import`).

        `clear_existing=True` reemplaza el contenido; False hace merge. Devuelve
        {status: 'merged'|'replaced', ...}."""
        return self._request(
            "POST", f"/api/projects/{name}/import",
            params={"clear_existing": str(clear_existing).lower()},
            json=data,
        ).json()

    def export_project_json(self, name: str) -> bytes:
        """Descarga el export nativo JSON del proyecto (bytes)."""
        return self._get(f"/api/projects/{name}/export").content

    def export_project_burp(self, name: str) -> bytes:
        """Descarga el export Burp XML del proyecto (bytes)."""
        return self._get(f"/api/projects/{name}/export-burp").content

    def import_burp_xml(self, name: str, xml_content: str) -> dict[str, Any]:
        """Importa un XML de Burp al proyecto (body text/plain)."""
        resp = self._request(
            "POST", f"/api/projects/{name}/import-burp",
            data=xml_content.encode("utf-8"),
            headers={"Content-Type": "text/plain"},
        )
        return resp.json()
