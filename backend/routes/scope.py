#!/usr/bin/env python3
"""
Router de scope: reglas include/exclude que determinan qué tráfico se marca
en-scope. Las reglas se mantienen en services.state.scope_rules, se persisten en
el config del proyecto y se reflejan en la config del proxy.
"""

import hashlib
from datetime import datetime

import aiosqlite
from fastapi import APIRouter

from config import get_project_db
from services import state
from services.proxy_control import update_proxy_config
from db import get_project_config, save_project_config
from schemas import ScopeRule
from utils.scope import match_scope

router = APIRouter()


async def _reapply_scope_to_history(project: str):
    """Recalcula in_scope para las requests ya guardadas, para que los cambios
    de scope sean retroactivos en lugar de aplicar solo a tráfico nuevo."""
    async with aiosqlite.connect(get_project_db(project)) as db:
        cursor = await db.execute("SELECT id, url FROM requests")
        rows = await cursor.fetchall()
        for rid, url in rows:
            in_scope = 1 if match_scope(url, state.scope_rules) else 0
            await db.execute("UPDATE requests SET in_scope = ? WHERE id = ?", (in_scope, rid))
        await db.commit()


async def _persist_scope():
    """Guarda scope_rules en el config del proyecto, refresca la config del
    proxy y reaplica las reglas al historial ya capturado."""
    project = state.get_current_project()
    if project:
        config = await get_project_config(project)
        config["scope_rules"] = state.scope_rules
        await save_project_config(project, config)
        await _reapply_scope_to_history(project)
    await update_proxy_config()


@router.get("/api/scope")
async def get_scope():
    return {"rules": state.scope_rules}


@router.post("/api/scope/rules")
async def add_scope_rule(rule: ScopeRule):
    new_rule = {"pattern": rule.pattern, "rule_type": rule.rule_type, "enabled": rule.enabled,
        "id": hashlib.md5(f"{rule.pattern}{datetime.now()}".encode()).hexdigest()[:8]}
    state.scope_rules.append(new_rule)
    await _persist_scope()
    return {"status": "added", "rule": new_rule}


@router.delete("/api/scope/rules/{rule_id}")
async def delete_scope_rule(rule_id: str):
    state.scope_rules = [r for r in state.scope_rules if r.get("id") != rule_id]
    await _persist_scope()
    return {"status": "deleted"}


@router.put("/api/scope/rules/{rule_id}")
async def toggle_scope_rule(rule_id: str):
    for rule in state.scope_rules:
        if rule.get("id") == rule_id:
            rule["enabled"] = not rule.get("enabled", True)
    await _persist_scope()
    return {"status": "toggled"}
