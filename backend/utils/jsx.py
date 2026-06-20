#!/usr/bin/env python3
"""
Transpilado JSX → JS on-the-fly para servir componentes/contextos del frontend.

Los módulos de frontend/src/{components,context}/ se escriben en JSX y el navegador
no puede ejecutarlos directamente. Aquí se transpilan con Sucrase (vía node) y se
cachean por mtime para no recompilar en cada request.

Los archivos .js (hooks/services/utils) NO pasan por aquí: se sirven crudos.
"""

import logging
import subprocess
from pathlib import Path
from typing import Dict, Optional, Tuple

from config import FRONTEND_DIR

logger = logging.getLogger('blackwire')

# Cache: ruta absoluta -> (mtime_fuente, codigo_js_transpilado)
_cache: Dict[str, Tuple[float, str]] = {}


def _transpile(source_code: str) -> Optional[str]:
    """Transpila una cadena JSX a JS con Sucrase (transform 'jsx')."""
    node_script = (
        "const {transform}=require('sucrase');"
        "let data='';process.stdin.on('data',c=>data+=c);"
        "process.stdin.on('end',()=>{"
        "const r=transform(data,{transforms:['jsx'],production:true});"
        "process.stdout.write(r.code);});"
    )
    try:
        result = subprocess.run(
            ["node", "-e", node_script],
            input=source_code, capture_output=True, text=True, timeout=30,
            cwd=str(FRONTEND_DIR),
        )
        if result.returncode != 0:
            logger.error("JSX transpile failed: %s", result.stderr[:500])
            return None
        return result.stdout
    except Exception as e:
        logger.error("JSX transpile error: %s", e)
        return None


def resolve_frontend_module(subdir: str, rel_path: str) -> Optional[Path]:
    """Resuelve frontend/src/<subdir>/<rel_path> verificando que no escape del dir."""
    base = (FRONTEND_DIR / "src" / subdir).resolve()
    target = (base / rel_path).resolve()
    if base not in target.parents and target != base:
        return None
    if not target.is_file():
        return None
    return target


def get_module_js(path: Path) -> Optional[str]:
    """Devuelve el JS de un módulo del frontend: .jsx transpilado (cacheado) o .js crudo."""
    if path.suffix == ".js":
        return path.read_text(encoding="utf-8")
    if path.suffix == ".jsx":
        key = str(path)
        mtime = path.stat().st_mtime
        cached = _cache.get(key)
        if cached and cached[0] == mtime:
            return cached[1]
        code = _transpile(path.read_text(encoding="utf-8"))
        if code is not None:
            _cache[key] = (mtime, code)
        return code
    return None
