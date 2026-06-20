#!/usr/bin/env python3
"""
Router de extensiones: metadatos + config por proyecto y servido de la UI custom
(.ui.js) compilada de cada extensión.
"""

import logging

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import Response

from config import EXTENSIONS_UI_COMPILED_DIR
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


@router.get("/api/extensions/{ext_name}/ui.js")
async def get_extension_ui(ext_name: str):
    """Sirve el archivo .ui.js compilado de una extensión."""
    ui_file = EXTENSIONS_UI_COMPILED_DIR / f"{ext_name}.ui.js"

    if not ui_file.exists():
        raise HTTPException(status_code=404, detail=f"Custom UI not found for extension: {ext_name}")

    try:
        with open(ui_file, 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(
            content=content,
            media_type="application/javascript",
            headers={"Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*"}
        )
    except Exception as e:
        logger.error(f"Error serving extension UI for {ext_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading custom UI: {str(e)}")
