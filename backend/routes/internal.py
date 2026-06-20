#!/usr/bin/env python3
"""
Router interno: endpoints que llama mitm_addon.py para almacenar tráfico
capturado y para registrar requests interceptadas pendientes de decisión.

No expuestos a la UI directamente. Usan el scope y el estado de interceptación.
"""

import hashlib
import json
import logging
from datetime import datetime

import aiosqlite
from fastapi import APIRouter, Body

from config import get_project_db, validate_id as _validate_id
from services import state
from utils.scope import match_scope

router = APIRouter()

logger = logging.getLogger('blackwire')


@router.post("/api/internal/request")
async def receive_request(data: dict = Body(...)):
    project = state.get_current_project()
    if not project:
        return {"status": "no_project"}
    in_scope = match_scope(data["url"], state.scope_rules)
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
            await state.broadcast({"type": "new_request", "data": {"id": rid, "method": data["method"], "url": data["url"],
                "response_status": data.get("response_status"), "request_type": data.get("request_type", "http"),
                "saved": False, "in_scope": in_scope, "timestamp": datetime.now().isoformat()}})
            return {"status": "received", "id": rid}
        except aiosqlite.IntegrityError:
            return {"status": "duplicate"}


@router.post("/api/internal/intercept")
async def receive_intercept(data: dict = Body(...)):
    rid = data.get("request_id", "")
    # Sanitizar: aceptar solo IDs con el patrón seguro; generar uno nuevo si no.
    if not _validate_id(rid):
        rid = hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12]
    logger.debug('Intercept incoming: %s %s', data.get('method'), data.get('url'))
    state.intercepted_requests[rid] = {"id": rid, "method": data["method"], "url": data["url"],
        "headers": data.get("headers", {}), "body": data.get("body"), "timestamp": datetime.now().isoformat()}
    await state.broadcast({"type": "intercept_new", "data": state.intercepted_requests[rid]})
    return {"status": "intercepted", "request_id": rid}
