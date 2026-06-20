#!/usr/bin/env python3
"""
Router de Session: macros (secuencias de requests) y rules (extracción de
variables desde respuestas vía regex).

Depende solo de `get_db` (inyectado desde main.py).
"""

import json
from datetime import datetime

import httpx
from fastapi import APIRouter, Body, HTTPException

router = APIRouter()

get_db_func = None


def init_session_routes(get_db):
    global get_db_func
    get_db_func = get_db


# --- Macros ---

@router.get("/api/session/macros")
async def get_session_macros():
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT id, name, description, requests, created_at FROM session_macros ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "description": r[2], "requests": json.loads(r[3]), "created_at": r[4]} for r in rows]


@router.post("/api/session/macros")
async def create_session_macro(data: dict = Body(...)):
    async with await get_db_func() as db:
        cursor = await db.execute(
            "INSERT INTO session_macros (name, description, requests, created_at) VALUES (?, ?, ?, ?)",
            (data["name"], data.get("description", ""), json.dumps(data.get("requests", [])), datetime.now().isoformat())
        )
        await db.commit()
        return {"id": cursor.lastrowid}


@router.put("/api/session/macros/{macro_id}")
async def update_session_macro(macro_id: int, data: dict = Body(...)):
    async with await get_db_func() as db:
        fields = []
        vals = []
        if "name" in data:
            fields.append("name = ?")
            vals.append(data["name"])
        if "description" in data:
            fields.append("description = ?")
            vals.append(data["description"])
        if "requests" in data:
            fields.append("requests = ?")
            vals.append(json.dumps(data["requests"]))
        if fields:
            vals.append(macro_id)
            await db.execute("UPDATE session_macros SET " + ", ".join(fields) + " WHERE id = ?", vals)
            await db.commit()
        return {"status": "updated"}


@router.delete("/api/session/macros/{macro_id}")
async def delete_session_macro(macro_id: int):
    async with await get_db_func() as db:
        await db.execute("DELETE FROM session_macros WHERE id = ?", (macro_id,))
        await db.commit()
        return {"status": "deleted"}


@router.post("/api/session/macros/{macro_id}/execute")
async def execute_session_macro(macro_id: int):
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT requests FROM session_macros WHERE id = ?", (macro_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Macro not found")

        requests_data = json.loads(row[0])
        results = []

        async with httpx.AsyncClient(verify=False, follow_redirects=False, timeout=30.0) as client:
            for req in requests_data:
                try:
                    resp = await client.request(
                        method=req.get("method", "GET"),
                        url=req.get("url", ""),
                        headers=json.loads(req.get("headers", "{}")),
                        content=req.get("body", "").encode() if req.get("body") else None
                    )
                    results.append({
                        "status": "success",
                        "status_code": resp.status_code,
                        "headers": dict(resp.headers),
                        "body": resp.text
                    })
                except Exception as e:
                    results.append({
                        "status": "error",
                        "error": str(e)
                    })

        return {"results": results}


# --- Rules ---

@router.get("/api/session/rules")
async def get_session_rules():
    async with await get_db_func() as db:
        cursor = await db.execute(
            """SELECT id, enabled, name, when_stage, target, header_name, regex_pattern,
               extract_group, variable_name, created_at FROM session_rules ORDER BY created_at DESC"""
        )
        rows = await cursor.fetchall()
        return [{
            "id": r[0], "enabled": bool(r[1]), "name": r[2], "when": r[3],
            "target": r[4], "header": r[5], "regex": r[6],
            "group": r[7], "variable": r[8], "created_at": r[9]
        } for r in rows]


@router.post("/api/session/rules")
async def create_session_rule(data: dict = Body(...)):
    async with await get_db_func() as db:
        cursor = await db.execute(
            """INSERT INTO session_rules (enabled, name, when_stage, target, header_name,
               regex_pattern, extract_group, variable_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data.get("enabled", True), data["name"], data["when"], data["target"],
                data.get("header", ""), data["regex"], data.get("group", 1),
                data["variable"], datetime.now().isoformat()
            )
        )
        await db.commit()
        return {"id": cursor.lastrowid}


@router.put("/api/session/rules/{rule_id}")
async def update_session_rule(rule_id: int, data: dict = Body(...)):
    async with await get_db_func() as db:
        fields = []
        vals = []
        for key, col in [("enabled", "enabled"), ("name", "name"), ("when", "when_stage"),
                         ("target", "target"), ("header", "header_name"), ("regex", "regex_pattern"),
                         ("group", "extract_group"), ("variable", "variable_name")]:
            if key in data:
                fields.append(f"{col} = ?")
                vals.append(data[key])
        if fields:
            vals.append(rule_id)
            await db.execute("UPDATE session_rules SET " + ", ".join(fields) + " WHERE id = ?", vals)
            await db.commit()
        return {"status": "updated"}


@router.delete("/api/session/rules/{rule_id}")
async def delete_session_rule(rule_id: int):
    async with await get_db_func() as db:
        await db.execute("DELETE FROM session_rules WHERE id = ?", (rule_id,))
        await db.commit()
        return {"status": "deleted"}
