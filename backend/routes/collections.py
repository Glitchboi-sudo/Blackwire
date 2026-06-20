#!/usr/bin/env python3
"""
Router de Collections: grupos de requests con extracción de variables y ejecución
secuencial con sustitución de placeholders {{var}}.

Depende solo de `get_db` (inyectado desde main.py).
"""

import json
from datetime import datetime

import httpx
from fastapi import APIRouter, Body, HTTPException

from schemas import CollectionCreate, CollectionItemCreate, CollectionItemExecute

router = APIRouter()

get_db_func = None


def init_collections_routes(get_db):
    global get_db_func
    get_db_func = get_db


def resolve_jsonpath(data, path):
    """Resolver de path dot-notation: $.key.subkey.0.field"""
    if not path.startswith('$.'):
        return None
    keys = path[2:].split('.')
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list):
            try:
                current = current[int(key)]
            except (ValueError, IndexError):
                return None
        else:
            return None
        if current is None:
            return None
    return current


def substitute_variables(text, variables):
    """Reemplaza placeholders {{varname}} por sus valores."""
    if not text:
        return text
    for name, value in variables.items():
        text = text.replace('{{' + name + '}}', str(value))
    return text


@router.get("/api/collections")
async def list_collections():
    async with await get_db_func() as db:
        cursor = await db.execute(
            "SELECT id, name, description, created_at FROM collections ORDER BY id DESC")
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            cnt = await db.execute(
                "SELECT COUNT(*) FROM collection_items WHERE collection_id = ?", (r[0],))
            count = (await cnt.fetchone())[0]
            result.append({"id": r[0], "name": r[1], "description": r[2],
                           "created_at": r[3], "item_count": count})
        return result


@router.post("/api/collections")
async def create_collection(data: CollectionCreate):
    async with await get_db_func() as db:
        await db.execute(
            "INSERT INTO collections (name, description, created_at) VALUES (?,?,?)",
            (data.name, data.description, datetime.now().isoformat()))
        await db.commit()
        cursor = await db.execute("SELECT last_insert_rowid()")
        cid = (await cursor.fetchone())[0]
        return {"status": "created", "id": cid}


@router.put("/api/collections/{cid}")
async def update_collection(cid: int, data: dict = Body(...)):
    async with await get_db_func() as db:
        fields, params = [], []
        if "name" in data:
            fields.append("name = ?"); params.append(data["name"])
        if "description" in data:
            fields.append("description = ?"); params.append(data["description"])
        if fields:
            params.append(cid)
            await db.execute(f"UPDATE collections SET {', '.join(fields)} WHERE id = ?", params)
            await db.commit()
        return {"status": "updated"}


@router.delete("/api/collections/{cid}")
async def delete_collection(cid: int):
    async with await get_db_func() as db:
        await db.execute("DELETE FROM collection_items WHERE collection_id = ?", (cid,))
        await db.execute("DELETE FROM collections WHERE id = ?", (cid,))
        await db.commit()
        return {"status": "deleted"}


@router.get("/api/collections/{cid}/items")
async def get_collection_items(cid: int):
    async with await get_db_func() as db:
        cursor = await db.execute(
            """SELECT id, collection_id, position, method, url, headers, body, var_extracts, created_at
               FROM collection_items WHERE collection_id = ? ORDER BY position ASC""", (cid,))
        rows = await cursor.fetchall()
        return [{"id": r[0], "collection_id": r[1], "position": r[2], "method": r[3],
                 "url": r[4], "headers": json.loads(r[5]), "body": r[6],
                 "var_extracts": json.loads(r[7]), "created_at": r[8]} for r in rows]


@router.post("/api/collections/{cid}/items")
async def add_collection_item(cid: int, data: CollectionItemCreate):
    async with await get_db_func() as db:
        if data.position is None:
            cursor = await db.execute(
                "SELECT COALESCE(MAX(position), 0) + 1 FROM collection_items WHERE collection_id = ?", (cid,))
            data.position = (await cursor.fetchone())[0]
        await db.execute(
            """INSERT INTO collection_items (collection_id, position, method, url, headers, body, var_extracts, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (cid, data.position, data.method, data.url, json.dumps(data.headers),
             data.body, json.dumps(data.var_extracts), datetime.now().isoformat()))
        await db.commit()
        return {"status": "created"}


@router.put("/api/collections/{cid}/items/{iid}")
async def update_collection_item(cid: int, iid: int, data: dict = Body(...)):
    async with await get_db_func() as db:
        fields, params = [], []
        for key in ["method", "url", "body"]:
            if key in data:
                fields.append(f"{key} = ?"); params.append(data[key])
        if "headers" in data:
            fields.append("headers = ?"); params.append(json.dumps(data["headers"]))
        if "var_extracts" in data:
            fields.append("var_extracts = ?"); params.append(json.dumps(data["var_extracts"]))
        if "position" in data:
            fields.append("position = ?"); params.append(data["position"])
        if fields:
            params.append(iid)
            await db.execute(f"UPDATE collection_items SET {', '.join(fields)} WHERE id = ?", params)
            await db.commit()
        return {"status": "updated"}


@router.delete("/api/collections/{cid}/items/{iid}")
async def delete_collection_item(cid: int, iid: int):
    async with await get_db_func() as db:
        await db.execute("DELETE FROM collection_items WHERE id = ?", (iid,))
        await db.commit()
        return {"status": "deleted"}


@router.post("/api/collections/{cid}/items/{iid}/execute")
async def execute_collection_item(cid: int, iid: int, data: CollectionItemExecute):
    async with await get_db_func() as db:
        cursor = await db.execute(
            """SELECT method, url, headers, body, var_extracts
               FROM collection_items WHERE id = ? AND collection_id = ?""", (iid, cid))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")

    method = substitute_variables(row[0], data.variables)
    url = substitute_variables(row[1], data.variables)
    headers = json.loads(row[2])
    headers = {k: substitute_variables(v, data.variables) for k, v in headers.items()}
    body = substitute_variables(row[3], data.variables)
    var_extracts = json.loads(row[4])

    try:
        async with httpx.AsyncClient(verify=False, timeout=30) as client:
            start = datetime.now()
            resp = await client.request(method=method, url=url, headers=headers,
                content=body.encode() if body else None)
            elapsed = (datetime.now() - start).total_seconds()

            extracted = {}
            resp_body_text = resp.text
            for ve in var_extracts:
                vname = ve.get("name")
                source = ve.get("source", "body")
                path = ve.get("path", "")
                if not vname or not path:
                    continue
                if source == "body":
                    try:
                        parsed = json.loads(resp_body_text)
                        val = resolve_jsonpath(parsed, path)
                        if val is not None:
                            extracted[vname] = val
                    except json.JSONDecodeError:
                        pass
                elif source == "header":
                    extracted[vname] = resp.headers.get(path, "")

            return {
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
                "body": resp_body_text,
                "elapsed": elapsed,
                "size": len(resp.content),
                "extracted_variables": extracted
            }
    except Exception as e:
        return {"error": str(e)}
