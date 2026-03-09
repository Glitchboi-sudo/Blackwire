"""
proxy_console.py - Real-time proxy log streaming for Blackwire

Provides:
  - ConsoleLogHandler  : logging.Handler that captures records into a ring buffer
                         and pushes them to connected SSE clients.
  - setup_console_handler() : attach the handler to the 'blackwire' logger.
  - router             : FastAPI APIRouter with GET/DELETE /api/console/logs
                         and GET /api/console/stream (SSE).
"""

import asyncio
import json
import logging
import threading
from collections import deque
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Request, Body
from fastapi.responses import StreamingResponse

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

_MAX_BUFFER = 1000

# Ring buffer of log entries  {ts, level, name, msg}
_buffer: deque = deque(maxlen=_MAX_BUFFER)
_buf_lock = threading.Lock()

# List of (asyncio.Queue, asyncio.AbstractEventLoop) — one per SSE client
_sse_clients: list = []
_clients_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Custom logging handler
# ---------------------------------------------------------------------------

class ConsoleLogHandler(logging.Handler):
    """Captures log records, stores them in the ring buffer, and
    pushes them to any connected SSE clients thread-safely."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            entry = {
                "ts": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "name": record.name,
                "msg": self.format(record),
            }
        except Exception:
            return

        with _buf_lock:
            _buffer.append(entry)

        # Push to each SSE client queue using the stored event loop
        payload = json.dumps(entry)
        with _clients_lock:
            dead = []
            for q, loop in _sse_clients:
                try:
                    if loop.is_running():
                        loop.call_soon_threadsafe(q.put_nowait, payload)
                except Exception:
                    dead.append((q, loop))
            for item in dead:
                _sse_clients.remove(item)


_handler: ConsoleLogHandler | None = None


def setup_console_handler() -> None:
    """Attach ConsoleLogHandler to the blackwire logger.
    Call this once after setup_logging() in the lifespan event."""
    global _handler
    if _handler is not None:
        return  # Already installed
    _handler = ConsoleLogHandler()
    # Minimal format — timestamp and level are already stored as fields
    _handler.setFormatter(logging.Formatter("%(message)s"))
    logging.getLogger("blackwire").addHandler(_handler)


# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/console", tags=["console"])


@router.get("/logs")
async def get_console_logs(limit: int = 500):
    """Return the last *limit* buffered log entries."""
    with _buf_lock:
        entries = list(_buffer)
    entries = entries[-limit:] if limit < len(entries) else entries
    return {"logs": entries}


@router.delete("/logs")
async def clear_console_logs():
    """Clear the in-memory log buffer."""
    with _buf_lock:
        _buffer.clear()
    return {"status": "cleared"}


def _inject_entry(entry: dict) -> None:
    """Push a pre-built entry directly into the buffer and all SSE queues.
    Called from addon_log and can also be used internally without going
    through the Python logging system (avoids any recursion risk)."""
    with _buf_lock:
        _buffer.append(entry)
    payload = json.dumps(entry)
    with _clients_lock:
        dead = []
        for q, loop in _sse_clients:
            try:
                if loop.is_running():
                    loop.call_soon_threadsafe(q.put_nowait, payload)
            except Exception:
                dead.append((q, loop))
        for item in dead:
            _sse_clients.remove(item)


@router.post("/addon_log")
async def addon_log(data: dict = Body(...)):
    """Direct log injection from mitm_addon (bypasses Python logger to avoid
    any recursion — the addon runs in a separate process and uses this endpoint
    to forward mitmproxy ctx.log messages to the frontend console)."""
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": str(data.get("level", "INFO")).upper()[:10],
        "name": str(data.get("name", "mitmproxy"))[:60],
        "msg": str(data.get("msg", ""))[:4000],
    }
    _inject_entry(entry)
    return {"ok": True}


@router.get("/stream")
async def stream_console_logs(request: Request):
    """SSE endpoint.  On connect the full buffer snapshot is sent first,
    then new entries are streamed in real time."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue(maxsize=500)

    with _clients_lock:
        _sse_clients.append((queue, loop))

    async def generate() -> AsyncGenerator[str, None]:
        # 1. Send buffered snapshot so the client gets history immediately
        with _buf_lock:
            snapshot = list(_buffer)
        for entry in snapshot:
            yield f"data: {json.dumps(entry)}\n\n"

        # 2. Stream new entries as they arrive
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive comment so the connection stays open
                    yield ": keepalive\n\n"
        finally:
            with _clients_lock:
                try:
                    _sse_clients.remove((queue, loop))
                except ValueError:
                    pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
