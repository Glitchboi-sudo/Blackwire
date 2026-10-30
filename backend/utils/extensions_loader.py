#!/usr/bin/env python3
"""
Carga de extensiones.

- load_extension_metadata(): descubre extensiones en backend/extensions/ y lee su
  EXTENSION_META.
- save_extension_config(): persiste la config de una extensión en el proyecto y
  refresca la config del proxy.

Importa config (paths), services.state (extensions_config), db (config de proyecto)
y services.proxy_control (update_proxy_config).

Nota: la UI web fue retirada (EOL). Las extensiones ya NO compilan `.ui.jsx`; la
app de escritorio nativa genera su UI desde `ui_schema` / la config plana.
"""

import importlib.util
import logging
from typing import List

from fastapi import HTTPException

from config import EXTENSIONS_DIR
from services import state
from db import get_project_config, save_project_config
from services.proxy_control import update_proxy_config

logger = logging.getLogger('blackwire')


async def save_extension_config(project: str, name: str, config: dict):
    state.extensions_config[name] = config
    proj_config = await get_project_config(project)
    if not proj_config:
        raise HTTPException(status_code=404, detail="Project not found")
    proj_config["extensions"] = state.extensions_config
    await save_project_config(project, proj_config)
    await update_proxy_config()


def load_extension_metadata() -> List[dict]:
    meta_list: List[dict] = []
    if not EXTENSIONS_DIR.exists():
        return meta_list
    for path in sorted(EXTENSIONS_DIR.glob("*.py")):
        if path.name.startswith("_") or path.name == "__init__.py":
            continue
        meta = {
            "name": path.stem,
            "title": path.stem.replace("_", " ").title(),
            "description": "",
            "tabs": [],
            "ui_schema": None,
            "default_config": {"enabled": False},
            "custom_ui_file": None
        }
        try:
            spec = importlib.util.spec_from_file_location(f"blackwire_ext_meta_{path.stem}", path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if hasattr(module, "EXTENSION_META"):
                    meta.update(module.EXTENSION_META)
                elif hasattr(module, "Extension"):
                    ext = module.Extension()
                    meta["name"] = getattr(ext, "name", meta["name"])
        except Exception as e:
            logger.warning("Failed to load extension metadata from %s: %s", path.name, e)

        meta_list.append(meta)
    return meta_list
