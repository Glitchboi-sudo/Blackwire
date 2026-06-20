#!/usr/bin/env python3
"""
Router de control de runtime: arranque/parada/estado del proxy mitmproxy,
apagado del servidor y lanzamiento de un navegador apuntando al proxy.

La lógica del subproceso vive en services.proxy_control; aquí están los endpoints
y la validación de entrada (modo permitido, puerto, flags peligrosos).
"""

import asyncio
import logging
import os
import shlex
import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException

from config import ALLOWED_PROXY_MODES, BLOCKED_MITM_FLAGS
from services import state
from services.proxy_control import start_proxy, stop_proxy

router = APIRouter()

logger = logging.getLogger('blackwire')


@router.post("/api/proxy/start")
async def api_start_proxy(port: int = 8080, mode: str = "regular", extra: str = ""):
    if not state.get_current_project():
        raise HTTPException(status_code=400, detail="Select a project first")
    if mode not in ALLOWED_PROXY_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid proxy mode. Allowed: {sorted(ALLOWED_PROXY_MODES)}")
    if not (1 <= port <= 65535):
        raise HTTPException(status_code=400, detail="Port must be between 1 and 65535")
    # Quitar flags que cargarían scripts externos o escribirían archivos arbitrarios.
    if extra:
        safe_extra_parts = []
        parts = shlex.split(extra)
        i = 0
        while i < len(parts):
            flag = parts[i].split("=")[0]
            if flag in BLOCKED_MITM_FLAGS:
                logger.warning("Blocked dangerous mitmproxy flag: %r", parts[i])
                i += 2 if (i + 1 < len(parts) and not parts[i + 1].startswith("-")) else 1
                continue
            safe_extra_parts.append(parts[i])
            i += 1
        extra = shlex.join(safe_extra_parts)
    return await start_proxy(port, mode, extra)


@router.post("/api/proxy/stop")
async def api_stop_proxy():
    return await stop_proxy()


@router.get("/api/proxy/status")
async def proxy_status():
    running = state.proxy_process is not None and state.proxy_process.poll() is None
    return {"running": running, "intercept_enabled": state.intercept_enabled}


@router.post("/api/shutdown")
async def shutdown_server():
    """Apaga el servidor completo de forma ordenada."""
    await stop_proxy()
    # Programar el apagado tras enviar la respuesta.
    asyncio.get_event_loop().call_later(0.5, lambda: os._exit(0))
    return {"status": "shutting_down"}


@router.post("/api/browser/launch")
async def launch_browser(proxy_port: int = 8080):
    """Lanza un navegador con un perfil dedicado configurado para usar el proxy.

    Chromium/Chrome aceptan el proxy por flag; Firefox necesita prefs en el perfil
    (no admite proxy por CLI), por eso se escribe un user.js. Perfil portable en el
    directorio temporal del sistema (antes estaba hardcodeado a /tmp).
    """
    import tempfile
    profile = Path(tempfile.gettempdir()) / "blackwire_browser"
    profile.mkdir(parents=True, exist_ok=True)

    for browser in ["chromium-browser", "google-chrome", "chromium", "brave-browser", "firefox"]:
        if not shutil.which(browser):
            continue
        try:
            if "firefox" in browser:
                # Firefox: configurar el proxy vía prefs del perfil.
                (profile / "user.js").write_text(
                    'user_pref("network.proxy.type", 1);\n'
                    'user_pref("network.proxy.http", "127.0.0.1");\n'
                    f'user_pref("network.proxy.http_port", {proxy_port});\n'
                    'user_pref("network.proxy.ssl", "127.0.0.1");\n'
                    f'user_pref("network.proxy.ssl_port", {proxy_port});\n'
                    'user_pref("network.proxy.share_proxy_settings", true);\n'
                    'user_pref("network.proxy.allow_hijacking_localhost", true);\n'
                    'user_pref("browser.shell.checkDefaultBrowser", false);\n'
                )
                cmd = [browser, "-no-remote", "-profile", str(profile)]
            else:
                cmd = [browser, f"--proxy-server=http://127.0.0.1:{proxy_port}",
                       f"--user-data-dir={profile}", "--ignore-certificate-errors",
                       "--no-first-run", "--no-default-browser-check"]
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"status": "launched", "browser": browser, "proxy_port": proxy_port}
        except Exception as e:
            logger.warning("Failed to launch %s: %s", browser, e)
            continue
    return {"status": "failed", "error": "No supported browser found (chromium/chrome/brave/firefox)"}
