#!/usr/bin/env python3
"""
Watchdog de auto-apagado por WebSocket.

Cuando el último cliente WebSocket se desconecta, arma un temporizador de gracia;
si nadie reconecta antes de que expire, apaga el servidor. Así, cerrar la ventana
del navegador termina el backend, pero recargar (F5) NO lo mata porque el cliente
reconecta dentro del margen.

Solo se arma tras una desconexión, por lo que el arranque sin cliente todavía
conectado nunca dispara el apagado. Se puede desactivar con
BLACKWIRE_NO_AUTOSHUTDOWN=1 (p.ej. uso headless / solo API) y ajustar el margen
con BLACKWIRE_SHUTDOWN_GRACE (segundos).
"""

import asyncio
import logging
import os

from services import state
from services.proxy_control import stop_proxy

logger = logging.getLogger('blackwire')

_DISABLED = os.getenv('BLACKWIRE_NO_AUTOSHUTDOWN', '').lower() in ('1', 'true', 'yes')
try:
    _GRACE_SECONDS = float(os.getenv('BLACKWIRE_SHUTDOWN_GRACE', '15'))
except ValueError:
    _GRACE_SECONDS = 15.0

_pending_task: "asyncio.Task | None" = None


def client_connected():
    """Cancela cualquier apagado pendiente cuando un cliente (re)conecta."""
    global _pending_task
    if _pending_task and not _pending_task.done():
        _pending_task.cancel()
        logger.debug('Watchdog: reconnect detected, shutdown cancelled')
    _pending_task = None


def client_disconnected():
    """Arma el temporizador de gracia si ya no quedan clientes conectados."""
    global _pending_task
    if _DISABLED or state.connections:
        return
    if _pending_task and not _pending_task.done():
        return
    logger.info('Watchdog: last client disconnected, shutting down in %ss unless a client reconnects', _GRACE_SECONDS)
    _pending_task = asyncio.create_task(_shutdown_after_grace())


async def _shutdown_after_grace():
    try:
        await asyncio.sleep(_GRACE_SECONDS)
    except asyncio.CancelledError:
        return
    if state.connections:
        # Alguien reconectó justo en el límite; abortar.
        return
    logger.info('Watchdog: no clients reconnected, stopping server')
    await stop_proxy()
    os._exit(0)
