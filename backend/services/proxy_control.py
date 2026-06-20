#!/usr/bin/env python3
"""
Control del proceso mitmproxy y persistencia de su configuración.

`update_proxy_config()` escribe `.proxy_config.json`, que mitm_addon.py lee en su
loop de polling — NO cambiar su formato ni añadir otros puntos de escritura.

Importa config (paths), services.state (proceso + flags) y db (get_db, para cargar
las reglas de bypass al arrancar el proxy).
"""

import asyncio
import json
import logging
import os
import shlex
import shutil
import subprocess
import sys
import threading
from pathlib import Path

from config import PROXY_CONFIG_PATH, BACKEND_DIR
from services import state
from db import get_db

logger = logging.getLogger('blackwire')


async def update_proxy_config():
    config = {
        "intercept_enabled": state.intercept_enabled,
        "scope_rules": state.scope_rules,
        "project": state.get_current_project(),
        "extensions": state.extensions_config,
    }
    PROXY_CONFIG_PATH.write_text(json.dumps(config))
    logger.debug('Proxy config updated at %s: %s', PROXY_CONFIG_PATH, config)


def _stream_pipe(pipe, level_fn, label: str):
    """Lee líneas de un pipe del subproceso y las loguea.

    NOTA: mitmproxy se lanza con text=True, así que readline() devuelve str.
    """
    try:
        if not pipe:
            return
        for line in iter(pipe.readline, ''):  # '' == EOF en modo texto
            if not line:
                break
            line = line.rstrip()
            if line:
                level_fn('[%s] %s', label, line)
    except Exception as e:
        logger.debug('Pipe reader for %s stopped: %s', label, e)


async def start_proxy(port: int = 8080, mode: str = "regular", extra_args: str = ""):
    logger.debug('start_proxy called (port=%s)', port)
    if state.proxy_process and state.proxy_process.poll() is None:
        return {"status": "already_running", "port": port}

    await update_proxy_config()
    addon_path = BACKEND_DIR / "mitm_addon.py"
    logger.info('Starting mitmproxy (port=%s) with addon=%s', port, addon_path)

    # Cargar reglas de bypass.
    ignore_hosts = None
    try:
        from utils.bypass_manager import BypassManager
        async with await get_db() as db:
            cursor = await db.execute(
                "SELECT id, pattern, is_regex, description, enabled FROM bypass_rules WHERE enabled = 1"
            )
            rows = await cursor.fetchall()
            bypass_rules = [
                {"id": r[0], "pattern": r[1], "is_regex": bool(r[2]),
                 "description": r[3] or "", "enabled": bool(r[4])}
                for r in rows
            ]

        if bypass_rules:
            manager = BypassManager()
            manager.load_rules(bypass_rules)
            ignore_hosts = manager.get_ignore_hosts_pattern()
            if ignore_hosts:
                logger.info(f"Bypass: Loaded {len(bypass_rules)} rules, ignoring hosts matching: {ignore_hosts[:100]}...")
    except Exception as e:
        logger.warning(f"Could not load bypass rules: {e}")

    # Usar mitmdump (headless) en vez de mitmproxy UI.
    mitmdump_bin = Path(sys.executable).with_name("mitmdump")
    if not mitmdump_bin.exists():
        resolved = shutil.which("mitmdump")
        mitmdump_bin = Path(resolved) if resolved else None
    if not mitmdump_bin:
        logger.error("mitmdump binary not found near current Python. Verify the venv/paths.")
        return {"status": "failed", "error": "mitmdump not found in venv or PATH"}
    extra = shlex.split(extra_args) if extra_args else []
    cmd = [str(mitmdump_bin), "--mode", mode, "-p", str(port),
           "-s", str(addon_path), "--set", "connection_strategy=lazy", "--ssl-insecure"]

    # Añadir ignore-hosts si hay reglas de bypass.
    if ignore_hosts:
        cmd.extend(["--ignore-hosts", ignore_hosts])

    if extra:
        cmd.extend(extra)
    logger.debug('mitmproxy command: %s', ' '.join(cmd))

    logger.debug('Spawning mitmproxy subprocess...')
    logger.info("Launching proxy subprocess: %s", " ".join(map(str, cmd)))
    state.proxy_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                           env={**os.environ, "PYTHONUNBUFFERED": "1"})
    # Dar un momento para inicializar y enlazar el puerto.
    await asyncio.sleep(1.0)
    if state.proxy_process.poll() is None:
        # Volcar stdout/stderr de mitmproxy a nuestros logs para depurar.
        threading.Thread(target=_stream_pipe, args=(state.proxy_process.stdout, logger.info, "mitm:stdout"), daemon=True).start()
        threading.Thread(target=_stream_pipe, args=(state.proxy_process.stderr, logger.error, "mitm:stderr"), daemon=True).start()
    else:
        # El proceso ya salió; capturar lo que imprimió.
        try:
            stdout, stderr = state.proxy_process.communicate(timeout=1.0)
        except Exception:
            stdout, stderr = "", ""
        logger.error("Proxy exited immediately (returncode=%s). stdout=%r stderr=%r", state.proxy_process.returncode, stdout, stderr)
        return {"status": "failed", "error": (stderr or stdout or "Proxy exited immediately")}
    return {"status": "started", "port": port, "pid": state.proxy_process.pid}


async def stop_proxy():
    logger.debug('stop_proxy called')
    if state.proxy_process:
        state.proxy_process.terminate()
        logger.info('Stopping mitmproxy (pid=%s)...', state.proxy_process.pid)
        try:
            state.proxy_process.wait(timeout=5)
        except Exception:
            state.proxy_process.kill()
        state.proxy_process = None
        return {"status": "stopped"}
    return {"status": "not_running"}
