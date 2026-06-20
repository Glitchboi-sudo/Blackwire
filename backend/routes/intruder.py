#!/usr/bin/env python3
"""
Router de Intruder: guardado y consulta de ataques automatizados y sus resultados.

Depende solo de `get_db` (inyectado desde main.py). La ejecución del ataque vive
en el frontend; aquí solo se persisten config y resultados.
"""

import json
from datetime import datetime

from fastapi import APIRouter, Body

router = APIRouter()

get_db_func = None


def init_intruder_routes(get_db):
    global get_db_func
    get_db_func = get_db


@router.get("/api/intruder/attacks")
async def list_intruder_attacks():
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT id, name, total, created_at FROM intruder_attacks ORDER BY id DESC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "total": r[2], "created_at": r[3]} for r in rows]


@router.post("/api/intruder/attacks")
async def save_intruder_attack(data: dict = Body(...)):
    async with await get_db_func() as db:
        await db.execute(
            "INSERT INTO intruder_attacks (name, config, results, total, created_at) VALUES (?,?,?,?,?)",
            (data.get("name", "Attack"), json.dumps(data.get("config", {})),
             json.dumps(data.get("results", [])), data.get("total", 0),
             datetime.now().isoformat()))
        await db.commit()
        cursor = await db.execute("SELECT last_insert_rowid()")
        aid = (await cursor.fetchone())[0]
        return {"id": aid, "status": "saved"}


@router.get("/api/intruder/attacks/{aid}")
async def get_intruder_attack(aid: int):
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT id, name, config, results, total, created_at FROM intruder_attacks WHERE id = ?", (aid,))
        r = await cursor.fetchone()
        if not r:
            return {"error": "not found"}
        return {"id": r[0], "name": r[1], "config": json.loads(r[2]), "results": json.loads(r[3]), "total": r[4], "created_at": r[5]}


@router.put("/api/intruder/attacks/{aid}")
async def update_intruder_attack(aid: int, data: dict = Body(...)):
    async with await get_db_func() as db:
        fields = []
        vals = []
        if "name" in data:
            fields.append("name = ?"); vals.append(data["name"])
        if "results" in data:
            fields.append("results = ?"); vals.append(json.dumps(data["results"]))
            fields.append("total = ?"); vals.append(len(data["results"]))
        if "config" in data:
            fields.append("config = ?"); vals.append(json.dumps(data["config"]))
        if fields:
            vals.append(aid)
            await db.execute("UPDATE intruder_attacks SET " + ", ".join(fields) + " WHERE id = ?", vals)
            await db.commit()
        return {"status": "updated"}


@router.delete("/api/intruder/attacks/{aid}")
async def delete_intruder_attack(aid: int):
    async with await get_db_func() as db:
        await db.execute("DELETE FROM intruder_attacks WHERE id = ?", (aid,))
        await db.commit()
        return {"status": "deleted"}
