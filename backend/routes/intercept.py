#!/usr/bin/env python3
"""
Router de interceptación de requests y responses.

Mantiene en services.state los pendientes (intercepted_requests/responses) y los
flags (intercept_enabled / intercept_responses_enabled). La decisión forward/drop
se comunica a mitm_addon.py escribiendo archivos .action_*.json (ver config).
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Body, HTTPException

from config import action_file as _action_file, action_resp_file as _action_resp_file
from services import state
from services.proxy_control import update_proxy_config
from db import get_project_config, save_project_config

router = APIRouter()

logger = logging.getLogger('blackwire')


@router.get("/api/intercept/status")
async def get_intercept_status():
    return {"enabled": state.intercept_enabled, "pending_count": len(state.intercepted_requests)}


@router.post("/api/intercept/toggle")
async def toggle_intercept():
    state.intercept_enabled = not state.intercept_enabled
    logger.info('Intercept toggled -> %s', state.intercept_enabled)
    if not state.intercept_enabled:
        await forward_all()

    project = state.get_current_project()
    if project:
        config = await get_project_config(project)
        config["intercept_enabled"] = state.intercept_enabled
        await save_project_config(project, config)
    await update_proxy_config()
    await state.broadcast({"type": "intercept_status", "enabled": state.intercept_enabled})
    return {"enabled": state.intercept_enabled}


@router.get("/api/intercept/pending")
async def get_pending():
    return list(state.intercepted_requests.values())


@router.post("/api/intercept/{request_id}/forward")
async def forward_request(request_id: str, modified: Optional[dict] = Body(None)):
    if request_id not in state.intercepted_requests:
        raise HTTPException(status_code=404)
    state.intercepted_requests.pop(request_id)
    try:
        action_file = _action_file(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request_id")
    action_file.write_text(json.dumps({"action": "forward", "modified": modified}))
    await state.broadcast({"type": "intercept_forwarded", "request_id": request_id})
    return {"status": "forwarded"}


@router.post("/api/intercept/{request_id}/drop")
async def drop_request(request_id: str):
    if request_id not in state.intercepted_requests:
        raise HTTPException(status_code=404)
    state.intercepted_requests.pop(request_id)
    try:
        action_file = _action_file(request_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid request_id")
    action_file.write_text(json.dumps({"action": "drop"}))
    await state.broadcast({"type": "intercept_dropped", "request_id": request_id})
    return {"status": "dropped"}


@router.post("/api/intercept/forward-all")
async def forward_all():
    for rid in list(state.intercepted_requests.keys()):
        try:
            _action_file(rid).write_text(json.dumps({"action": "forward"}))
        except ValueError:
            logger.warning("Skipping unsafe request_id in forward-all: %r", rid)
    count = len(state.intercepted_requests)
    state.intercepted_requests.clear()
    await state.broadcast({"type": "intercept_all_forwarded"})
    return {"status": "forwarded", "count": count}


@router.post("/api/intercept/drop-all")
async def drop_all():
    for rid in list(state.intercepted_requests.keys()):
        try:
            _action_file(rid).write_text(json.dumps({"action": "drop"}))
        except ValueError:
            logger.warning("Skipping unsafe request_id in drop-all: %r", rid)
    count = len(state.intercepted_requests)
    state.intercepted_requests.clear()
    return {"status": "dropped", "count": count}


@router.post("/api/intercept/toggle_responses")
async def toggle_intercept_responses():
    state.intercept_responses_enabled = not state.intercept_responses_enabled
    await state.broadcast({
        "type": "intercept_responses_toggled",
        "enabled": state.intercept_responses_enabled
    })
    return {"enabled": state.intercept_responses_enabled}


@router.get("/api/intercept/pending_responses")
async def get_pending_responses():
    return list(state.intercepted_responses.values())


@router.post("/api/intercept_response/{response_id}/forward")
async def forward_response(response_id: str):
    if response_id in state.intercepted_responses:
        try:
            _action_resp_file(response_id).write_text(json.dumps({"action": "forward"}))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid response_id")
        del state.intercepted_responses[response_id]
        await state.broadcast({"type": "response_forwarded", "id": response_id})
    return {"status": "forwarded"}


@router.post("/api/intercept_response/{response_id}/drop")
async def drop_response(response_id: str):
    if response_id in state.intercepted_responses:
        try:
            _action_resp_file(response_id).write_text(json.dumps({"action": "drop"}))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid response_id")
        del state.intercepted_responses[response_id]
        await state.broadcast({"type": "response_dropped", "id": response_id})
    return {"status": "dropped"}


@router.post("/api/intercept_response/forward-all")
async def forward_all_responses():
    for rid in list(state.intercepted_responses.keys()):
        try:
            _action_resp_file(rid).write_text(json.dumps({"action": "forward"}))
        except ValueError:
            logger.warning("Skipping unsafe response_id in forward-all: %r", rid)
    count = len(state.intercepted_responses)
    state.intercepted_responses.clear()
    await state.broadcast({"type": "intercept_all_responses_forwarded"})
    return {"status": "forwarded", "count": count}


@router.post("/api/intercept_response/drop-all")
async def drop_all_responses():
    for rid in list(state.intercepted_responses.keys()):
        try:
            _action_resp_file(rid).write_text(json.dumps({"action": "drop"}))
        except ValueError:
            logger.warning("Skipping unsafe response_id in drop-all: %r", rid)
    count = len(state.intercepted_responses)
    state.intercepted_responses.clear()
    return {"status": "dropped", "count": count}
