"""
Bypass routes - Gestiona reglas para excluir URLs del proxy MITM
"""

import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel

router = APIRouter()

# These will be injected by main.py
get_db_func = None


def init_bypass_routes(get_db):
    """Initialize route dependencies from main.py"""
    global get_db_func
    get_db_func = get_db


class BypassRuleCreate(BaseModel):
    pattern: str
    is_regex: bool = False
    description: str = ""
    enabled: bool = True


class BypassRuleUpdate(BaseModel):
    pattern: Optional[str] = None
    is_regex: Optional[bool] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None


@router.get("/api/bypass/rules")
async def get_bypass_rules():
    """Get all bypass rules"""
    async with await get_db_func() as db:
        cursor = await db.execute(
            "SELECT id, pattern, is_regex, description, enabled, created_at "
            "FROM bypass_rules ORDER BY id DESC"
        )
        rows = await cursor.fetchall()
        return {
            "rules": [
                {
                    "id": r[0],
                    "pattern": r[1],
                    "is_regex": bool(r[2]),
                    "description": r[3] or "",
                    "enabled": bool(r[4]),
                    "created_at": r[5]
                }
                for r in rows
            ]
        }


@router.post("/api/bypass/rules")
async def create_bypass_rule(body: BypassRuleCreate):
    """Create a new bypass rule"""
    async with await get_db_func() as db:
        try:
            # Validate regex if applicable
            if body.is_regex:
                import re
                try:
                    re.compile(body.pattern)
                except re.error as e:
                    raise HTTPException(status_code=400, detail=f"Invalid regex: {e}")

            await db.execute(
                "INSERT INTO bypass_rules (pattern, is_regex, description, enabled, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (body.pattern, int(body.is_regex), body.description, int(body.enabled),
                 datetime.now().isoformat())
            )
            await db.commit()

            # Get the created rule
            cursor = await db.execute("SELECT last_insert_rowid()")
            rule_id = (await cursor.fetchone())[0]

            return {
                "status": "created",
                "id": rule_id,
                "pattern": body.pattern,
                "message": "Bypass rule created. Restart proxy for changes to take effect."
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@router.put("/api/bypass/rules/{rule_id}")
async def update_bypass_rule(rule_id: int, body: BypassRuleUpdate):
    """Update a bypass rule"""
    async with await get_db_func() as db:
        # Check if rule exists
        cursor = await db.execute("SELECT id FROM bypass_rules WHERE id = ?", (rule_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Rule not found")

        # Build update query
        updates = []
        params = []

        if body.pattern is not None:
            updates.append("pattern = ?")
            params.append(body.pattern)

        if body.is_regex is not None:
            # Validate regex if changing to regex
            if body.is_regex and body.pattern:
                import re
                try:
                    re.compile(body.pattern)
                except re.error as e:
                    raise HTTPException(status_code=400, detail=f"Invalid regex: {e}")
            updates.append("is_regex = ?")
            params.append(int(body.is_regex))

        if body.description is not None:
            updates.append("description = ?")
            params.append(body.description)

        if body.enabled is not None:
            updates.append("enabled = ?")
            params.append(int(body.enabled))

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        params.append(rule_id)
        query = f"UPDATE bypass_rules SET {', '.join(updates)} WHERE id = ?"

        await db.execute(query, params)
        await db.commit()

        return {
            "status": "updated",
            "id": rule_id,
            "message": "Bypass rule updated. Restart proxy for changes to take effect."
        }


@router.delete("/api/bypass/rules/{rule_id}")
async def delete_bypass_rule(rule_id: int):
    """Delete a bypass rule"""
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT id FROM bypass_rules WHERE id = ?", (rule_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Rule not found")

        await db.execute("DELETE FROM bypass_rules WHERE id = ?", (rule_id,))
        await db.commit()

        return {
            "status": "deleted",
            "message": "Bypass rule deleted. Restart proxy for changes to take effect."
        }


@router.post("/api/bypass/rules/toggle/{rule_id}")
async def toggle_bypass_rule(rule_id: int):
    """Toggle enabled status of a bypass rule"""
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT enabled FROM bypass_rules WHERE id = ?", (rule_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Rule not found")

        new_enabled = 0 if row[0] else 1
        await db.execute("UPDATE bypass_rules SET enabled = ? WHERE id = ?", (new_enabled, rule_id))
        await db.commit()

        return {
            "status": "toggled",
            "enabled": bool(new_enabled),
            "message": "Bypass rule toggled. Restart proxy for changes to take effect."
        }


@router.get("/api/bypass/presets")
async def get_bypass_presets():
    """Get predefined bypass presets"""
    from utils.bypass_manager import ALL_PRESETS
    return {"presets": ALL_PRESETS}


@router.post("/api/bypass/presets/{preset_name}")
async def apply_bypass_preset(preset_name: str):
    """Apply a predefined preset (adds multiple rules)"""
    from utils.bypass_manager import ALL_PRESETS

    if preset_name not in ALL_PRESETS:
        raise HTTPException(status_code=404, detail=f"Preset '{preset_name}' not found")

    preset_rules = ALL_PRESETS[preset_name]

    async with await get_db_func() as db:
        added = 0
        skipped = 0

        for rule_data in preset_rules:
            # Check if rule already exists
            cursor = await db.execute(
                "SELECT id FROM bypass_rules WHERE pattern = ?",
                (rule_data["pattern"],)
            )
            if await cursor.fetchone():
                skipped += 1
                continue

            # Add rule
            await db.execute(
                "INSERT INTO bypass_rules (pattern, is_regex, description, enabled, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (rule_data["pattern"], int(rule_data.get("is_regex", False)),
                 rule_data.get("description", ""), 1, datetime.now().isoformat())
            )
            added += 1

        await db.commit()

        return {
            "status": "applied",
            "preset": preset_name,
            "added": added,
            "skipped": skipped,
            "message": f"Added {added} rules from '{preset_name}' preset. Restart proxy for changes to take effect."
        }


@router.get("/api/bypass/status")
async def get_bypass_status():
    """Get current bypass configuration and status"""
    from utils.bypass_manager import BypassManager

    async with await get_db_func() as db:
        cursor = await db.execute(
            "SELECT id, pattern, is_regex, description, enabled, created_at "
            "FROM bypass_rules WHERE enabled = 1"
        )
        rows = await cursor.fetchall()

        rules_data = [
            {
                "id": r[0],
                "pattern": r[1],
                "is_regex": bool(r[2]),
                "description": r[3] or "",
                "enabled": bool(r[4])
            }
            for r in rows
        ]

    # Generate ignore pattern
    manager = BypassManager()
    manager.load_rules(rules_data)
    ignore_pattern = manager.get_ignore_hosts_pattern()

    return {
        "enabled_rules_count": len(rules_data),
        "ignore_hosts_pattern": ignore_pattern,
        "status": "active" if ignore_pattern else "inactive"
    }
