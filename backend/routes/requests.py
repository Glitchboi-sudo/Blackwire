"""
Optimized request routes with support for large payloads.
This module handles request retrieval with intelligent truncation and lazy loading.
"""

import json
import aiosqlite
from typing import Optional
from fastapi import APIRouter, HTTPException, Body, Query
from pathlib import Path

# Import optimizer
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.response_optimizer import optimize_request_detail, format_size

router = APIRouter()

# These will be injected by main.py
get_db_func = None
get_project_db_func = None
get_current_project_func = None
REQ_LIST_COLS = None
row_to_list_item_func = None
compile_httpql_ast_func = None


def init_routes(get_db, get_project_db, get_current_project, req_list_cols, row_to_list_item, compile_httpql_ast):
    """Initialize route dependencies from main.py"""
    global get_db_func, get_project_db_func, get_current_project_func
    global REQ_LIST_COLS, row_to_list_item_func, compile_httpql_ast_func

    get_db_func = get_db
    get_project_db_func = get_project_db
    get_current_project_func = get_current_project
    REQ_LIST_COLS = req_list_cols
    row_to_list_item_func = row_to_list_item
    compile_httpql_ast_func = compile_httpql_ast


@router.get("/api/v2/requests/{rid}/detail")
async def get_request_detail_optimized(
    rid: int,
    full: bool = Query(False, description="Load full content (not truncated)")
):
    """
    Get request details with optimized payload handling.
    By default, returns truncated preview for large content.
    Use ?full=true to get complete content.
    """
    async with await get_db_func() as db:
        cursor = await db.execute(
            "SELECT id, method, url, headers, body, response_status, "
            "response_headers, response_body, timestamp, request_type, saved, in_scope "
            "FROM requests WHERE id = ?",
            (rid,)
        )
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Request not found")

        # Build base response
        request_data = {
            "id": r[0],
            "method": r[1],
            "url": r[2],
            "headers": json.loads(r[3]) if r[3] else {},
            "body": r[4] or "",
            "response_status": r[5],
            "response_headers": json.loads(r[6]) if r[6] else {},
            "response_body": r[7] or "",
            "timestamp": r[8],
            "request_type": r[9],
            "saved": bool(r[10]),
            "in_scope": bool(r[11])
        }

        # Optimize the response
        optimized = optimize_request_detail(request_data, include_full=full)

        return optimized


@router.get("/api/v2/requests/{rid}/body")
async def get_request_body_full(rid: int):
    """Get full request body (for lazy loading)"""
    async with await get_db_func() as db:
        cursor = await db.execute(
            "SELECT body, headers FROM requests WHERE id = ?",
            (rid,)
        )
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Request not found")

        return {
            "body": r[0] or "",
            "headers": json.loads(r[1]) if r[1] else {}
        }


@router.get("/api/v2/requests/{rid}/response-body")
async def get_response_body_full(rid: int):
    """Get full response body (for lazy loading)"""
    async with await get_db_func() as db:
        cursor = await db.execute(
            "SELECT response_body, response_headers, response_status FROM requests WHERE id = ?",
            (rid,)
        )
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Request not found")

        return {
            "response_body": r[0] or "",
            "response_headers": json.loads(r[1]) if r[1] else {},
            "response_status": r[2]
        }


@router.get("/api/v2/requests/{rid}/sizes")
async def get_request_sizes(rid: int):
    """Get size information for request/response bodies"""
    async with await get_db_func() as db:
        cursor = await db.execute(
            "SELECT body, response_body FROM requests WHERE id = ?",
            (rid,)
        )
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Request not found")

        body_size = len((r[0] or "").encode('utf-8'))
        response_size = len((r[1] or "").encode('utf-8'))

        return {
            "body_size": body_size,
            "response_body_size": response_size,
            "body_size_formatted": format_size(body_size),
            "response_body_size_formatted": format_size(response_size),
            "is_large": body_size > 1_000_000 or response_size > 1_000_000
        }
