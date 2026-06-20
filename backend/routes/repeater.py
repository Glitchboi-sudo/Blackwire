#!/usr/bin/env python3
"""
Router del Repeater: requests guardados + envío crudo de HTTP.

Depende solo de `get_db` (inyectado desde main.py).
"""

import json
from datetime import datetime

import httpx
from fastapi import APIRouter, Body

from schemas import RepeaterRequest

router = APIRouter()

get_db_func = None


def init_repeater_routes(get_db):
    global get_db_func
    get_db_func = get_db


@router.get("/api/repeater")
async def get_repeater():
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT * FROM repeater ORDER BY id DESC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "method": r[2], "url": r[3], "headers": json.loads(r[4]),
            "body": r[5], "created_at": r[6], "last_response": json.loads(r[7]) if r[7] else None,
            "history": json.loads(r[8]) if len(r) > 8 and r[8] else []} for r in rows]


@router.post("/api/repeater")
async def create_repeater(req: RepeaterRequest):
    async with await get_db_func() as db:
        last_resp = json.dumps(req.last_response) if req.last_response else None
        cursor = await db.execute(
            "INSERT INTO repeater (name, method, url, headers, body, created_at, last_response) VALUES (?,?,?,?,?,?,?)",
            (req.name, req.method, req.url, json.dumps(req.headers), req.body, datetime.now().isoformat(), last_resp))
        await db.commit()
        return {"status": "created", "id": cursor.lastrowid}


@router.put("/api/repeater/{item_id}")
async def update_repeater(item_id: int, data: dict = Body(...)):
    async with await get_db_func() as db:
        if "name" in data:
            await db.execute("UPDATE repeater SET name = ? WHERE id = ?", (data["name"], item_id))
        if "method" in data:
            await db.execute("UPDATE repeater SET method = ? WHERE id = ?", (data["method"], item_id))
        if "url" in data:
            await db.execute("UPDATE repeater SET url = ? WHERE id = ?", (data["url"], item_id))
        if "headers" in data:
            await db.execute("UPDATE repeater SET headers = ? WHERE id = ?", (json.dumps(data["headers"]), item_id))
        if "body" in data:
            await db.execute("UPDATE repeater SET body = ? WHERE id = ?", (data["body"], item_id))
        if "last_response" in data:
            await db.execute("UPDATE repeater SET last_response = ? WHERE id = ?", (json.dumps(data["last_response"]), item_id))
        if "history" in data:
            await db.execute("UPDATE repeater SET history = ? WHERE id = ?", (json.dumps(data["history"]), item_id))
        await db.commit()
        return {"status": "updated"}


@router.delete("/api/repeater/{item_id}")
async def delete_repeater(item_id: int):
    async with await get_db_func() as db:
        await db.execute("DELETE FROM repeater WHERE id = ?", (item_id,))
        await db.commit()
        return {"status": "deleted"}


@router.post("/api/repeater/send-raw")
async def send_raw(data: dict = Body(...)):
    try:
        follow = data.get("follow_redirects", False)
        async with httpx.AsyncClient(verify=False, timeout=30, follow_redirects=follow, max_redirects=30) as client:
            start = datetime.now()
            resp = await client.request(method=data.get("method", "GET"), url=data.get("url", ""),
                headers=data.get("headers", {}), content=data.get("body", "").encode() if data.get("body") else None)
            elapsed = (datetime.now() - start).total_seconds()
            # Detectar redirección (3xx con header Location).
            is_redirect = 300 <= resp.status_code < 400
            redirect_url = resp.headers.get("location", None) if is_redirect else None
            # Si se siguieron redirects, incluir la cadena.
            redirect_chain = []
            if follow and resp.history:
                for hr in resp.history:
                    redirect_chain.append({
                        "status_code": hr.status_code,
                        "url": str(hr.url),
                        "location": hr.headers.get("location", "")
                    })
            return {
                "status_code": resp.status_code, "headers": dict(resp.headers), "body": resp.text,
                "elapsed": elapsed, "size": len(resp.content),
                "is_redirect": is_redirect, "redirect_url": redirect_url,
                "redirect_chain": redirect_chain, "final_url": str(resp.url)
            }
    except Exception as e:
        return {"error": str(e)}
