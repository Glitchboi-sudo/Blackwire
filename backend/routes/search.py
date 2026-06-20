#!/usr/bin/env python3
"""
Router de historial de requests: listado, detalle, búsqueda HTTPQL paginada,
presets de filtro y borrado.

`REQ_LIST_COLS` y `row_to_list_item` se definen aquí (columnas del listado) y
también los reutiliza el router optimizado (routes/requests.py) vía init_routes.

Inyectado desde main.py: get_db, get_db_with_regex, get_current_project.
Importa directamente compile_httpql_ast (utils.httpql) y get_project_db (config).
"""

import json
from datetime import datetime

import aiosqlite
from fastapi import APIRouter, Body, HTTPException

from config import get_project_db
from utils.httpql import compile_httpql_ast

router = APIRouter()

# Columnas devueltas en los listados de requests (orden fijo: ver row_to_list_item).
REQ_LIST_COLS = "id, method, url, response_status, timestamp, request_type, saved, in_scope"


def row_to_list_item(r):
    return {"id": r[0], "method": r[1], "url": r[2], "response_status": r[3],
            "timestamp": r[4], "request_type": r[5], "saved": bool(r[6]), "in_scope": bool(r[7])}


get_db_func = None
get_db_with_regex_func = None
get_current_project_func = None


def init_search_routes(get_db, get_db_with_regex, get_current_project):
    global get_db_func, get_db_with_regex_func, get_current_project_func
    get_db_func = get_db
    get_db_with_regex_func = get_db_with_regex
    get_current_project_func = get_current_project


@router.get("/api/requests")
async def get_requests(limit: int = 10000, saved_only: bool = False, in_scope_only: bool = False, search: str = ""):
    async with await get_db_func() as db:
        query = f"SELECT {REQ_LIST_COLS} FROM requests WHERE 1=1"
        params = []
        if saved_only:
            query += " AND saved = 1"
        if in_scope_only:
            query += " AND in_scope = 1"
        if search:
            query += " AND url LIKE ?"
            params.append(f"%{search}%")
        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [row_to_list_item(r) for r in rows]


@router.get("/api/requests/{rid}/detail")
async def get_request_detail(rid: int):
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT id, method, url, headers, body, response_status, response_headers, response_body, timestamp, request_type, saved, in_scope FROM requests WHERE id = ?", (rid,))
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Request not found")
        return {"id": r[0], "method": r[1], "url": r[2], "headers": json.loads(r[3]), "body": r[4],
            "response_status": r[5], "response_headers": json.loads(r[6]) if r[6] else None,
            "response_body": r[7], "timestamp": r[8], "request_type": r[9],
            "saved": bool(r[10]), "in_scope": bool(r[11])}


@router.post("/api/requests/search")
async def search_requests(body: dict = Body(...)):
    ast = body.get("ast")
    saved_only = body.get("saved_only", False)
    in_scope_only = body.get("in_scope_only", False)
    page = body.get("page", 1)
    page_size = body.get("page_size", 500)

    # Solo usar la conexión con regex cuando el AST contiene operadores regex.
    use_regex = ast is not None
    if use_regex:
        db = await get_db_with_regex_func()
    else:
        db = await aiosqlite.connect(get_project_db(get_current_project_func()))
    try:
        # Query base de filtrado.
        base_query = "FROM requests WHERE 1=1"
        params = []
        if saved_only:
            base_query += " AND saved = 1"
        if in_scope_only:
            base_query += " AND in_scope = 1"
        if ast:
            presets_map = {}
            cursor = await db.execute("SELECT name, ast_json FROM filter_presets")
            for row in await cursor.fetchall():
                try:
                    presets_map[row[0]] = json.loads(row[1])
                except Exception:
                    pass
            try:
                where_sql, where_params = compile_httpql_ast(ast, presets_map)
                base_query += f" AND ({where_sql})"
                params.extend(where_params)
            except ValueError as e:
                return {"error": str(e)}

        # Conteo total.
        count_query = f"SELECT COUNT(*) {base_query}"
        cursor = await db.execute(count_query, params)
        total = (await cursor.fetchone())[0]

        # Paginación.
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size

        # Resultados paginados.
        query = f"SELECT {REQ_LIST_COLS} {base_query} ORDER BY id DESC LIMIT ? OFFSET ?"
        params.append(page_size)
        params.append(offset)
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()

        return {
            "requests": [row_to_list_item(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
    finally:
        await db.close()


# --- Filter Presets ---

@router.get("/api/filter-presets")
async def list_filter_presets():
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT id, name, query, created_at FROM filter_presets ORDER BY name ASC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "query": r[2], "created_at": r[3]} for r in rows]


@router.post("/api/filter-presets")
async def create_filter_preset(body: dict = Body(...)):
    async with await get_db_func() as db:
        try:
            await db.execute(
                "INSERT INTO filter_presets (name, query, ast_json, created_at) VALUES (?,?,?,?)",
                (body["name"], body["query"], json.dumps(body["ast"]), datetime.now().isoformat()))
            await db.commit()
            return {"status": "created", "name": body["name"]}
        except Exception:
            return {"error": "Preset name already exists"}


@router.delete("/api/filter-presets/{preset_id}")
async def delete_filter_preset(preset_id: int):
    async with await get_db_func() as db:
        await db.execute("DELETE FROM filter_presets WHERE id = ?", (preset_id,))
        await db.commit()
        return {"status": "deleted"}


@router.put("/api/requests/{rid}/save")
async def toggle_save(rid: int):
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT saved FROM requests WHERE id = ?", (rid,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404)
        await db.execute("UPDATE requests SET saved = ? WHERE id = ?", (0 if row[0] else 1, rid))
        await db.commit()
        return {"saved": not row[0]}


@router.delete("/api/requests/{rid}")
async def delete_req(rid: int):
    async with await get_db_func() as db:
        await db.execute("DELETE FROM requests WHERE id = ?", (rid,))
        await db.commit()
        return {"status": "deleted"}


@router.delete("/api/requests")
async def clear_history(keep_saved: bool = True):
    async with await get_db_func() as db:
        if keep_saved:
            await db.execute("DELETE FROM requests WHERE saved = 0")
        else:
            await db.execute("DELETE FROM requests")
        await db.commit()
        return {"status": "cleared"}
