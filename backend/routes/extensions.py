#!/usr/bin/env python3
"""
Router de extensiones: metadatos + config por proyecto.

La UI web fue retirada (EOL); el servido de UIs custom (`.ui.js`) desapareció.
La app de escritorio nativa consume solo `GET /api/extensions` (meta + config) y
`PUT /api/extensions/{name}` (config plano).
"""

import logging

from fastapi import APIRouter, Body, HTTPException

from services import state
from utils.extensions_loader import load_extension_metadata, save_extension_config

router = APIRouter()

logger = logging.getLogger('blackwire')


@router.get("/api/extensions")
async def get_extensions():
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    meta_list = load_extension_metadata()
    for meta in meta_list:
        cfg = state.extensions_config.get(meta.get("name", ""), {})
        meta["config"] = cfg
        meta["enabled"] = cfg.get("enabled", False)
    return {"extensions": meta_list}


@router.put("/api/extensions/{name}")
async def update_extension_config(name: str, config: dict = Body(...)):
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    await save_extension_config(project, name, config)
    return {"status": "updated", "name": name, "config": config}
