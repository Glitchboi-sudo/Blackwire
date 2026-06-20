#!/usr/bin/env python3
"""
Router del visor de WebSocket: conexiones, frames capturados y reenvío de frames.

Los frames se almacenan en la tabla `requests` con request_type = 'websocket'.
Depende solo de `get_db` (inyectado desde main.py).
"""

import asyncio

from fastapi import APIRouter

from schemas import WsResendRequest

router = APIRouter()

get_db_func = None


def init_websocket_routes(get_db):
    global get_db_func
    get_db_func = get_db


@router.get("/api/websocket/connections")
async def get_ws_connections(limit: int = 500):
    async with await get_db_func() as db:
        cursor = await db.execute(
            """SELECT url, COUNT(*) as frame_count,
               MIN(timestamp) as first_seen, MAX(timestamp) as last_seen
               FROM requests WHERE request_type = 'websocket'
               GROUP BY url ORDER BY last_seen DESC LIMIT ?""", (limit,))
        rows = await cursor.fetchall()
        return [{"url": r[0], "frame_count": r[1],
                 "first_seen": r[2], "last_seen": r[3]} for r in rows]


@router.get("/api/websocket/frames")
async def get_ws_frames(url: str, limit: int = 500):
    async with await get_db_func() as db:
        cursor = await db.execute(
            """SELECT id, body, response_body, timestamp
               FROM requests WHERE request_type = 'websocket' AND url = ?
               ORDER BY id ASC LIMIT ?""", (url, limit))
        rows = await cursor.fetchall()
        return [{"id": r[0], "content": r[1],
                 "direction": "up" if "↑" in (r[2] or "") else "down",
                 "timestamp": r[3]} for r in rows]


@router.post("/api/websocket/resend")
async def resend_ws_frame(data: WsResendRequest):
    import websockets
    try:
        extra_headers = data.headers or {}
        async with websockets.connect(data.url,
                additional_headers=extra_headers,
                open_timeout=10, close_timeout=5) as ws:
            await ws.send(data.message)
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                return {"status": "sent", "response": str(response)}
            except asyncio.TimeoutError:
                return {"status": "sent", "response": None,
                        "note": "No response within 5s"}
    except Exception as e:
        return {"error": str(e)}
