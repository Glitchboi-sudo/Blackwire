#!/usr/bin/env python3
"""
Router de proyectos: listar, crear, seleccionar, actualizar y borrar.

Al seleccionar un proyecto se cargan sus ajustes (scope/intercept/extensions) al
estado en memoria (services.state). Importa db, state, config, GitManager y el
loader de extensiones directamente.
"""

import json
import logging
import shutil
from datetime import datetime

from fastapi import APIRouter, Body, HTTPException

from config import PROJECTS_DIR, get_project_path
from db import get_project_config, save_project_config, init_db
from services import state
from utils.git_manager import GitManager
from utils.extensions_loader import load_extension_metadata
from schemas import Project

router = APIRouter()

logger = logging.getLogger('blackwire')


@router.get("/api/projects")
async def list_projects():
    projects = []
    if PROJECTS_DIR.exists():
        current = state.get_current_project()
        for p in PROJECTS_DIR.iterdir():
            cfg_path = p / "config.json"
            if not (p.is_dir() and cfg_path.exists()):
                continue
            # Un config.json ilegible o no-objeto NO debe tumbar toda la lista:
            # se registra y el proyecto se incluye con campos vacíos.
            try:
                config = json.loads(cfg_path.read_text())
                if not isinstance(config, dict):
                    raise ValueError("config.json is not a JSON object")
            except Exception as exc:
                logger.warning("Project %s has an invalid config.json: %s", p.name, exc)
                config = {}
            projects.append({
                "name": p.name,
                "description": config.get("description", ""),
                # Normalizar a "" (nunca None) para que el orden no mezcle None y str.
                "created_at": config.get("created_at") or "",
                "is_current": p.name == current,
            })
    return sorted(projects, key=lambda x: x.get("created_at") or "", reverse=True)


@router.post("/api/projects")
async def create_project(project: Project):
    if get_project_path(project.name).exists():
        raise HTTPException(status_code=400, detail="Project exists")
    get_project_path(project.name).mkdir(parents=True)

    # Auto-inicializar todas las extensiones con su config por defecto.
    extensions_config_init = {}
    meta_list = load_extension_metadata()
    for meta in meta_list:
        ext_name = meta.get("name")
        default_cfg = meta.get("default_config", {"enabled": False})
        extensions_config_init[ext_name] = default_cfg

    config = {"name": project.name, "description": project.description, "scope_rules": [],
        "proxy_port": 8080, "proxy_mode": "regular", "proxy_args": "", "intercept_enabled": False,
        "created_at": datetime.now().isoformat(), "extensions": extensions_config_init}
    await save_project_config(project.name, config)
    await init_db(project.name)
    git = GitManager(project.name)
    await git.init_repo()
    logger.info('Created project %s', project.name)
    return {"status": "created", "name": project.name}


@router.get("/api/projects/current")
async def get_current():
    project = state.get_current_project()
    if project:
        config = await get_project_config(project)
        return {"project": project, "config": config}
    return {"project": None}


@router.post("/api/projects/{name}/select")
async def select_project(name: str):
    config = await get_project_config(name)
    if not config:
        raise HTTPException(status_code=404, detail="Project not found")
    state.set_current_project(name)
    logger.info('Selected project %s', name)
    await init_db(name)
    state.scope_rules = config.get("scope_rules", [])
    state.intercept_enabled = config.get("intercept_enabled", False)
    state.extensions_config = config.get("extensions", {})
    return {"status": "selected", "project": name}


@router.put("/api/projects/{name}")
async def update_project(name: str, config: dict = Body(...)):
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")
    await save_project_config(name, config)
    logger.info('Updated project %s config', name)
    return {"status": "updated", "name": name}


@router.delete("/api/projects/{name}")
async def delete_project(name: str):
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Not found")
    if name == state.get_current_project():
        state.set_current_project(None)
    shutil.rmtree(get_project_path(name))
    return {"status": "deleted"}
