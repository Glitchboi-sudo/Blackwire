#!/usr/bin/env python3
"""
Router de integración Git: commit del proyecto actual y consulta de historial.

Usa GitManager (utils/git_manager.py) y `get_current_project` (inyectado desde main.py).
"""

from fastapi import APIRouter, Body, HTTPException

from utils.git_manager import GitManager

router = APIRouter()

get_current_project_func = None


def init_git_routes(get_current_project):
    global get_current_project_func
    get_current_project_func = get_current_project


@router.post("/api/git/commit")
async def create_commit(body: dict = Body(...)):
    message = body.get("message", "")
    if not message:
        raise HTTPException(status_code=422, detail="Commit message required")
    project = get_current_project_func()
    if not project:
        raise HTTPException(status_code=400)
    git = GitManager(project)
    h = await git.commit(message)
    return {"status": "committed" if h else "nothing_to_commit", "hash": h}


@router.get("/api/git/history")
async def get_git_history():
    project = get_current_project_func()
    if not project:
        return []
    return await GitManager(project).get_history()
