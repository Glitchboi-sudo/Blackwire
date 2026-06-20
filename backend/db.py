#!/usr/bin/env python3
"""
Acceso a la base de datos por proyecto (SQLite) y configuración de proyecto.

Cada proyecto tiene su propia DB (blackwire.db) y un config.json. Aquí viven el
esquema (init_db), las conexiones (get_db / get_db_with_regex) y la carga de
ajustes del proyecto al estado en memoria (load_project_settings).

Importa config (paths) y services.state (proyecto activo + estado mutable).
"""

import json
import re

import aiosqlite
from fastapi import HTTPException

from config import get_project_path, get_project_db
from services import state


async def get_project_config(name: str):
    config_path = get_project_path(name) / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return None


async def save_project_config(name: str, config: dict):
    config_path = get_project_path(name) / "config.json"
    config_path.write_text(json.dumps(config, indent=2))


async def load_project_settings(name: str):
    """Carga scope/intercept/extensions del config.json del proyecto al estado en memoria."""
    config = await get_project_config(name)
    if config:
        state.scope_rules = config.get("scope_rules", [])
        state.intercept_enabled = config.get("intercept_enabled", False)
        state.extensions_config = config.get("extensions", {})


async def init_db(name: str):
    project_path = get_project_path(name)
    project_path.mkdir(parents=True, exist_ok=True)
    db_path = get_project_db(name)

    async with aiosqlite.connect(db_path) as db:
        await db.execute("""CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT NOT NULL, url TEXT NOT NULL,
            headers TEXT NOT NULL, body TEXT, response_status INTEGER, response_headers TEXT,
            response_body TEXT, timestamp TEXT NOT NULL, request_type TEXT DEFAULT 'http',
            tags TEXT DEFAULT '[]', notes TEXT, saved INTEGER DEFAULT 0, in_scope INTEGER DEFAULT 1,
            hash TEXT UNIQUE)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS repeater (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, method TEXT NOT NULL,
            url TEXT NOT NULL, headers TEXT NOT NULL, body TEXT, created_at TEXT NOT NULL,
            last_response TEXT, history TEXT)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS webhook_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT, token_id TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE,
            method TEXT, url TEXT, ip TEXT, user_agent TEXT, content TEXT, headers TEXT,
            query TEXT, created_at TEXT, raw_json TEXT)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            description TEXT DEFAULT '', created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS collection_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id INTEGER NOT NULL,
            position INTEGER NOT NULL, method TEXT NOT NULL, url TEXT NOT NULL,
            headers TEXT NOT NULL DEFAULT '{}', body TEXT, var_extracts TEXT DEFAULT '[]',
            created_at TEXT NOT NULL,
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS filter_presets (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            query TEXT NOT NULL, ast_json TEXT NOT NULL, created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS bypass_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL,
            is_regex INTEGER DEFAULT 0, description TEXT, enabled INTEGER DEFAULT 1,
            created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS intruder_attacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            config TEXT NOT NULL, results TEXT NOT NULL,
            total INTEGER DEFAULT 0, created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS session_macros (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            description TEXT DEFAULT '', requests TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL)""")
        await db.execute("""CREATE TABLE IF NOT EXISTS session_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT, enabled INTEGER DEFAULT 1,
            name TEXT NOT NULL, when_stage TEXT NOT NULL, target TEXT NOT NULL,
            header_name TEXT, regex_pattern TEXT NOT NULL, extract_group INTEGER DEFAULT 1,
            variable_name TEXT NOT NULL, created_at TEXT NOT NULL)""")
        # Índices de rendimiento
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_saved ON requests(saved)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_scope ON requests(in_scope)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_type ON requests(request_type)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_ts ON requests(timestamp)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_status ON requests(response_status)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_id_desc ON requests(id DESC)")
        # Migración idempotente: columna history (timeline de respuestas del repeater)
        # para DBs creadas antes de añadir la columna.
        try:
            await db.execute("ALTER TABLE repeater ADD COLUMN history TEXT")
        except Exception:
            pass
        await db.commit()


async def get_db():
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="No project selected")
    return aiosqlite.connect(get_project_db(project))


async def get_db_with_regex():
    """Conexión con la función SQL HTTPQL_REGEX para soportar el operador regex."""
    project = state.get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="No project selected")
    db = await aiosqlite.connect(get_project_db(project))

    def _regex_fn(value, pattern):
        if value is None:
            return False
        try:
            return bool(re.search(pattern, str(value)))
        except re.error:
            return False

    await db.create_function("HTTPQL_REGEX", 2, _regex_fn)
    return db
