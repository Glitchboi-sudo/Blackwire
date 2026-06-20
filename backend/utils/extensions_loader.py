#!/usr/bin/env python3
"""
Carga y compilación de extensiones.

- load_extension_metadata(): descubre extensiones en backend/extensions/, lee su
  EXTENSION_META y compila el .ui.jsx asociado si existe.
- compile_extension_ui(): transpila un .ui.jsx a .ui.js con Sucrase (vía node).
- save_extension_config(): persiste la config de una extensión en el proyecto y
  refresca la config del proxy.

Importa config (paths), services.state (extensions_config), db (config de proyecto)
y services.proxy_control (update_proxy_config).
"""

import importlib.util
import logging
import subprocess
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException

from config import EXTENSIONS_DIR, EXTENSIONS_UI_COMPILED_DIR, FRONTEND_DIR
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


def compile_extension_ui(ui_jsx_path: Path) -> Optional[Path]:
    """Compila un .ui.jsx a .ui.js con Sucrase vía `node` (no requiere `npx`/npm).

    Usa el mismo enfoque que el transpilado de App.jsx: invoca node con require('sucrase'),
    que resuelve sucrase desde node_modules. Devuelve el path compilado o None.
    """
    try:
        EXTENSIONS_UI_COMPILED_DIR.mkdir(exist_ok=True)
        output_path = EXTENSIONS_UI_COMPILED_DIR / ui_jsx_path.name.replace('.jsx', '.js')

        node_script = (
            "const {transform}=require('sucrase'),fs=require('fs');"
            f"const code=fs.readFileSync({str(ui_jsx_path)!r},'utf8');"
            "const r=transform(code,{transforms:['jsx'],jsxPragma:'React.createElement',"
            "jsxFragmentPragma:'React.Fragment',production:true});"
            f"fs.writeFileSync({str(output_path)!r},r.code,'utf8');"
        )
        result = subprocess.run(
            ["node", "-e", node_script],
            capture_output=True, text=True, timeout=30, cwd=str(FRONTEND_DIR)
        )
        if result.returncode != 0:
            logger.error(f"Failed to compile {ui_jsx_path.name}: {result.stderr[:500]}")
            return None
        if output_path.exists():
            logger.info(f"Compiled extension UI: {ui_jsx_path.name} -> {output_path.name}")
            return output_path
        return None
    except Exception as e:
        logger.error(f"Error compiling extension UI {ui_jsx_path.name}: {e}")
        return None


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

        # Detectar y compilar el .ui.jsx si existe.
        ui_jsx_path = EXTENSIONS_DIR / f"{path.stem}.ui.jsx"
        if ui_jsx_path.exists():
            logger.info(f"Found custom UI for extension {path.stem}: {ui_jsx_path.name}")
            compiled_path = compile_extension_ui(ui_jsx_path)
            if compiled_path:
                meta["custom_ui_file"] = compiled_path.name
                logger.info(f"Extension {path.stem} has custom UI: {compiled_path.name}")

        meta_list.append(meta)
    return meta_list
