#!/usr/bin/env python3
"""
Router de integración con webhook.site: gestión de API key/token, sincronización
de requests capturadas y consulta/borrado local.

La config (api_key, token_id, ...) se guarda como config de la extensión
"webhook_site" en el proyecto (services.state.extensions_config).
"""

import json
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Body, HTTPException

from config import WEBHOOKSITE_BASE, WEBHOOKSITE_API_BASE
from services import state
from db import get_db
from utils.extensions_loader import save_extension_config

router = APIRouter()


def webhook_headers(api_key: Optional[str]) -> dict:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if api_key:
        headers["Api-Key"] = api_key
    return headers


@router.post("/api/webhooksite/apikey")
async def update_webhook_apikey(body: dict = Body(default={})):
    """Actualiza la API key sin crear un token nuevo."""
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = state.extensions_config.get("webhook_site", {})
    api_key = body.get("api_key", "")
    cfg["api_key"] = api_key
    await save_extension_config(project, "webhook_site", cfg)
    return {"status": "updated"}


@router.post("/api/webhooksite/token")
async def create_webhook_token(body: dict = Body(default={})):
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = state.extensions_config.get("webhook_site", {})
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


@router.post("/api/webhooksite/refresh")
async def refresh_webhook_requests(body: dict = Body(default={})):
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = state.extensions_config.get("webhook_site", {})
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


@router.get("/api/webhooksite/requests")
async def get_webhook_requests(limit: int = 200, all_tokens: bool = False):
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = state.extensions_config.get("webhook_site", {})
    token_id = cfg.get("token_id")

    async with await get_db() as db:
        if all_tokens:
            # Requests de TODOS los tokens.
            cursor = await db.execute(
                "SELECT request_id, method, url, ip, user_agent, content, headers, query, created_at, token_id FROM webhook_requests ORDER BY created_at DESC, id DESC LIMIT ?",
                (limit,)
            )
        else:
            # Solo del token actual.
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


@router.delete("/api/webhooksite/requests")
async def clear_webhook_requests():
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = state.extensions_config.get("webhook_site", {})
    token_id = cfg.get("token_id")
    if not token_id:
        return {"status": "ok", "deleted": 0}
    async with await get_db() as db:
        cursor = await db.execute("DELETE FROM webhook_requests WHERE token_id = ?", (token_id,))
        await db.commit()
    return {"status": "ok", "deleted": cursor.rowcount}
