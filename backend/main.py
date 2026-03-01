#!/usr/bin/env python3
"""
Blackwire - Proxy Interceptor Backend
"""

import asyncio
import logging
import os
import threading
import json
import subprocess
import sys
import hashlib
import re
import shutil
import importlib.util
import shlex
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import aiosqlite
import httpx

BASE_DIR = Path(__file__).parent.parent
PROJECTS_DIR = BASE_DIR / "projects"
CURRENT_PROJECT_FILE = BASE_DIR / ".current_project"
EXTENSIONS_DIR = Path(__file__).parent / "extensions"
EXTENSIONS_UI_COMPILED_DIR = EXTENSIONS_DIR / ".compiled_ui"
FRONTEND_DIR = BASE_DIR / "frontend"
APP_JSX_PATH = FRONTEND_DIR / "App.jsx"
APP_COMPILED_PATH = FRONTEND_DIR / "App.compiled.js"
THEMES_JS_PATH = FRONTEND_DIR / "themes.js"

WEBHOOKSITE_BASE = "https://webhook.site"
WEBHOOKSITE_API_BASE = "https://webhook.site"

connections: List[WebSocket] = []
proxy_process: Optional[subprocess.Popen] = None
intercepted_requests: Dict[str, dict] = {}
intercepted_responses: Dict[str, dict] = {}
intercept_enabled: bool = False
intercept_responses_enabled: bool = False
scope_rules: List[dict] = []
current_project: Optional[str] = None
extensions_config: Dict[str, dict] = {}

# --- Logging ---
LOG_LEVEL = os.getenv('BLACKWIRE_LOG_LEVEL', 'INFO').upper()
LOG_FORMAT = os.getenv('BLACKWIRE_LOG_FORMAT', '%(asctime)s %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger('blackwire')

def setup_logging():
    """Configure logging once."""
    if logger.handlers:
        return
    logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format=LOG_FORMAT)
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    logger.info('Logging initialized (level=%s)', LOG_LEVEL)



class Project(BaseModel):
    name: str
    description: Optional[str] = ""

class ScopeRule(BaseModel):
    pattern: str
    rule_type: str = "include"
    enabled: bool = True

class RepeaterRequest(BaseModel):
    name: str
    method: str
    url: str
    headers: dict
    body: Optional[str] = None
    last_response: Optional[dict] = None

class ChepyOperation(BaseModel):
    name: str
    args: dict = {}

class ChepyRecipe(BaseModel):
    input: str
    operations: List[ChepyOperation]

class WsResendRequest(BaseModel):
    url: str
    message: str
    headers: Optional[dict] = None

class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class CollectionItemCreate(BaseModel):
    method: str
    url: str
    headers: dict = {}
    body: Optional[str] = None
    var_extracts: List[dict] = []
    position: Optional[int] = None

class CollectionItemExecute(BaseModel):
    variables: dict = {}

CHEPY_OPERATIONS = {
    "Encoding": [
        {"name": "base64_encode", "label": "Base64 Encode", "params": []},
        {"name": "base64_decode", "label": "Base64 Decode", "params": []},
        {"name": "url_encode", "label": "URL Encode", "params": []},
        {"name": "url_decode", "label": "URL Decode", "params": []},
        {"name": "html_encode", "label": "HTML Encode", "params": []},
        {"name": "html_decode", "label": "HTML Decode", "params": []},
        {"name": "to_hex", "label": "To Hex", "params": []},
        {"name": "from_hex", "label": "From Hex", "params": []},
        {"name": "to_octal", "label": "To Octal", "params": []},
        {"name": "from_octal", "label": "From Octal", "params": []},
        {"name": "to_binary", "label": "To Binary", "params": []},
        {"name": "from_binary", "label": "From Binary", "params": []},
        {"name": "to_decimal", "label": "To Decimal", "params": []},
        {"name": "from_decimal", "label": "From Decimal", "params": []},
        {"name": "to_charcode", "label": "To Charcode", "params": []},
        {"name": "from_charcode", "label": "From Charcode", "params": [
            {"name": "delimiter", "type": "string", "default": " ", "label": "Delimiter"}
        ]},
    ],
    "Hashing": [
        {"name": "md5", "label": "MD5", "params": []},
        {"name": "sha1", "label": "SHA-1", "params": []},
        {"name": "sha2_256", "label": "SHA-256", "params": []},
        {"name": "sha2_512", "label": "SHA-512", "params": []},
        {"name": "hmac_hash", "label": "HMAC", "params": [
            {"name": "key", "type": "string", "default": "", "label": "Key"},
            {"name": "digest", "type": "select", "default": "sha256",
             "options": ["md5", "sha1", "sha256", "sha512"], "label": "Digest"}
        ]},
        {"name": "crc32_checksum", "label": "CRC32", "params": []},
    ],
    "Encryption": [
        {"name": "rot_13", "label": "ROT13", "params": []},
        {"name": "xor", "label": "XOR", "params": [
            {"name": "key", "type": "string", "default": "", "label": "Key"}
        ]},
        {"name": "jwt_decode", "label": "JWT Decode", "params": []},
    ],
    "Compression": [
        {"name": "zlib_compress", "label": "Zlib Compress", "params": []},
        {"name": "zlib_decompress", "label": "Zlib Decompress", "params": []},
        {"name": "gzip_compress", "label": "Gzip Compress", "params": []},
        {"name": "gzip_decompress", "label": "Gzip Decompress", "params": []},
    ],
    "Data Format": [
        {"name": "str_to_json", "label": "Parse JSON", "params": []},
        {"name": "json_to_yaml", "label": "JSON to YAML", "params": []},
        {"name": "yaml_to_json", "label": "YAML to JSON", "params": []},
    ],
    "String": [
        {"name": "reverse", "label": "Reverse", "params": []},
        {"name": "upper_case", "label": "Uppercase", "params": []},
        {"name": "lower_case", "label": "Lowercase", "params": []},
        {"name": "trim", "label": "Trim", "params": []},
        {"name": "count_occurances", "label": "Count Occurrences", "params": [
            {"name": "pattern", "type": "string", "default": "", "label": "Pattern"}
        ]},
        {"name": "find_replace", "label": "Find / Replace", "params": [
            {"name": "pattern", "type": "string", "default": "", "label": "Find"},
            {"name": "repl", "type": "string", "default": "", "label": "Replace"},
        ]},
        {"name": "regex_search", "label": "Regex Search", "params": [
            {"name": "pattern", "type": "string", "default": "", "label": "Pattern"}
        ]},
        {"name": "length", "label": "Length", "params": []},
        {"name": "escape_string", "label": "Escape String", "params": []},
        {"name": "unescape_string", "label": "Unescape String", "params": []},
    ],
}


def get_project_path(name: str) -> Path:
    return PROJECTS_DIR / name

def get_project_db(name: str) -> Path:
    return get_project_path(name) / "blackwire.db"

def get_current_project() -> Optional[str]:
    global current_project
    if current_project:
        return current_project
    if CURRENT_PROJECT_FILE.exists():
        current_project = CURRENT_PROJECT_FILE.read_text().strip()
        return current_project
    return None

def set_current_project(name: Optional[str]):
    global current_project
    current_project = name
    if name:
        CURRENT_PROJECT_FILE.write_text(name)
    elif CURRENT_PROJECT_FILE.exists():
        CURRENT_PROJECT_FILE.unlink()

async def get_project_config(name: str) -> Optional[dict]:
    config_path = get_project_path(name) / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return None

async def save_project_config(name: str, config: dict):
    config_path = get_project_path(name) / "config.json"
    config_path.write_text(json.dumps(config, indent=2))

async def load_project_settings(name: str):
    global scope_rules, intercept_enabled, extensions_config
    config = await get_project_config(name)
    if config:
        scope_rules = config.get("scope_rules", [])
        intercept_enabled = config.get("intercept_enabled", False)
        extensions_config = config.get("extensions", {})


def webhook_headers(api_key: Optional[str]) -> dict:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if api_key:
        headers["Api-Key"] = api_key
    return headers


async def save_extension_config(project: str, name: str, config: dict):
    global extensions_config
    extensions_config[name] = config
    proj_config = await get_project_config(project)
    if not proj_config:
        raise HTTPException(status_code=404, detail="Project not found")
    proj_config["extensions"] = extensions_config
    await save_project_config(project, proj_config)
    await update_proxy_config()


def compile_extension_ui(ui_jsx_path: Path) -> Optional[Path]:
    """
    Compila un archivo .ui.jsx a .ui.js usando Sucrase
    Retorna el path del archivo compilado o None si falla
    """
    try:
        # Crear directorio de salida si no existe
        EXTENSIONS_UI_COMPILED_DIR.mkdir(exist_ok=True)

        # Path de salida - reemplazar .jsx con .js
        output_filename = ui_jsx_path.name.replace('.jsx', '.js')
        output_path = EXTENSIONS_UI_COMPILED_DIR / output_filename

        # Crear temp dir para sucrase
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_src = Path(tmpdir) / "src"
            tmp_build = Path(tmpdir) / "build"
            tmp_src.mkdir()
            tmp_build.mkdir()

            # Copiar archivo fuente
            shutil.copy(ui_jsx_path, tmp_src / ui_jsx_path.name)

            # Compilar con Sucrase
            cmd = [
                "npx", "sucrase",
                str(tmp_src),
                "-d", str(tmp_build),
                "--transforms", "jsx",
                "--jsx-pragma", "React.createElement",
                "--jsx-fragment-pragma", "React.Fragment"
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, cwd=FRONTEND_DIR)

            if result.returncode != 0:
                logger.error(f"Failed to compile {ui_jsx_path.name}: {result.stderr}")
                return None

            # Copiar archivo compilado al directorio de salida
            compiled_file = tmp_build / ui_jsx_path.name.replace('.jsx', '.js')
            if compiled_file.exists():
                shutil.copy(compiled_file, output_path)
                logger.info(f"Compiled extension UI: {ui_jsx_path.name} -> {output_filename}")
                return output_path
            else:
                logger.error(f"Compiled file not found: {compiled_file}")
                return None

    except Exception as e:
        logger.error(f"Error compiling extension UI {ui_jsx_path.name}: {e}")
        return None


def load_extension_metadata() -> List[dict]:
    meta_list: List[dict] = []
    if not EXTENSIONS_DIR.exists():
        return meta_list
    for path in sorted(EXTENSIONS_DIR.glob("*.py")):
        if path.name.startswith("_") or path.name == "__init__.py":
            continue
        meta = {
            "name": path.stem,
            "title": path.stem.replace("_", " ").title(),
            "description": "",
            "tabs": [],
            "ui_schema": None,
            "default_config": {"enabled": False},
            "custom_ui_file": None
        }
        try:
            spec = importlib.util.spec_from_file_location(f"blackwire_ext_meta_{path.stem}", path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if hasattr(module, "EXTENSION_META"):
                    meta.update(module.EXTENSION_META)
                elif hasattr(module, "Extension"):
                    ext = module.Extension()
                    meta["name"] = getattr(ext, "name", meta["name"])
        except Exception as e:
            logger.warning("Failed to load extension metadata from %s: %s", path.name, e)

        # Detectar y compilar archivo .ui.jsx si existe
        ui_jsx_path = EXTENSIONS_DIR / f"{path.stem}.ui.jsx"
        if ui_jsx_path.exists():
            logger.info(f"Found custom UI for extension {path.stem}: {ui_jsx_path.name}")
            compiled_path = compile_extension_ui(ui_jsx_path)
            if compiled_path:
                meta["custom_ui_file"] = compiled_path.name
                logger.info(f"Extension {path.stem} has custom UI: {compiled_path.name}")

        meta_list.append(meta)
    return meta_list


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
            last_response TEXT)""")
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
        # Performance indexes
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_saved ON requests(saved)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_scope ON requests(in_scope)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_type ON requests(request_type)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_ts ON requests(timestamp)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_status ON requests(response_status)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_req_id_desc ON requests(id DESC)")
        await db.commit()

async def get_db():
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="No project selected")
    return aiosqlite.connect(get_project_db(project))


def match_scope(url: str, rules: List[dict]) -> bool:
    logger.debug('Scope check: url=%s rules=%d', url, len(rules))
    if not rules:
        return True
    parsed = urlparse(url)
    host = parsed.netloc
    in_scope = False
    has_include = any(r.get("rule_type") == "include" and r.get("enabled", True) for r in rules)
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        pattern = rule.get("pattern", "")
        rule_type = rule.get("rule_type", "include")
        regex = pattern.replace(".", r"\.").replace("*", ".*")
        try:
            if re.match(regex, host) or re.match(regex, url):
                if rule_type == "include":
                    in_scope = True
                elif rule_type == "exclude":
                    return False
        except:
            continue
    return in_scope if has_include else True


# --- HTTPQL Compiler (AST → SQL) ---

HTTPQL_FIELD_MAP = {
    ("req", "method"):  "method",
    ("req", "host"):    "SUBSTR(url, INSTR(url, '://') + 3, CASE WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0 THEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1 ELSE LENGTH(SUBSTR(url, INSTR(url, '://') + 3)) END)",
    ("req", "path"):    "CASE WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0 THEN SUBSTR(url, INSTR(url, '://') + 3 + INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1) ELSE '/' END",
    ("req", "port"):    "CAST(CASE WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), ':') > 0 AND INSTR(SUBSTR(url, INSTR(url, '://') + 3), ':') < COALESCE(NULLIF(INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/'), 0), 9999) THEN SUBSTR(SUBSTR(url, INSTR(url, '://') + 3), INSTR(SUBSTR(url, INSTR(url, '://') + 3), ':') + 1, COALESCE(NULLIF(INSTR(SUBSTR(url, INSTR(url, '://') + 3 + INSTR(SUBSTR(url, INSTR(url, '://') + 3), ':')), '/'), 0), 5) - 1) WHEN url LIKE 'https%' THEN '443' ELSE '80' END AS INTEGER)",
    ("req", "ext"):     None,  # special-cased in compiler
    ("req", "query"):   "CASE WHEN INSTR(url, '?') > 0 THEN SUBSTR(url, INSTR(url, '?') + 1) ELSE '' END",
    ("req", "raw"):     "(COALESCE(headers, '') || ' ' || COALESCE(body, ''))",
    ("req", "len"):     "LENGTH(COALESCE(headers, '') || COALESCE(body, ''))",
    ("req", "tls"):     None,  # special-cased
    ("resp", "code"):   "response_status",
    ("resp", "raw"):    "(COALESCE(response_headers, '') || ' ' || COALESCE(response_body, ''))",
    ("resp", "len"):    "LENGTH(COALESCE(response_headers, '') || COALESCE(response_body, ''))",
}

HTTPQL_NUMERIC = {("req", "len"), ("req", "port"), ("resp", "code"), ("resp", "len")}
HTTPQL_STRING_OPS = {"eq", "ne", "cont", "ncont", "like", "nlike", "regex", "nregex"}
HTTPQL_NUMERIC_OPS = {"eq", "ne", "gt", "gte", "lt", "lte"}

def _httpql_compile_comparison(ns: str, field: str, op: str, value: str):
    """Compile a single HTTPQL comparison to (sql_fragment, params)."""
    # Special: req.tls
    if (ns, field) == ("req", "tls"):
        bval = 1 if value.lower() in ("true", "1", "yes") else 0
        if op == "eq":
            return ("(url LIKE 'https%') = ?", [bval])
        elif op == "ne":
            return ("(url LIKE 'https%') != ?", [bval])
        raise ValueError(f"Operator '{op}' not valid for req.tls")

    # Special: req.ext
    if (ns, field) == ("req", "ext"):
        ext_v = value if value.startswith(".") else "." + value
        if op == "eq":
            return ("(url LIKE ? OR url LIKE ?)", [f"%{ext_v}", f"%{ext_v}?%"])
        elif op == "ne":
            return ("(url NOT LIKE ? AND url NOT LIKE ?)", [f"%{ext_v}", f"%{ext_v}?%"])
        elif op == "cont":
            return ("url LIKE ?", [f"%{ext_v}%"])
        elif op == "ncont":
            return ("url NOT LIKE ?", [f"%{ext_v}%"])
        raise ValueError(f"Operator '{op}' not valid for req.ext")

    col = HTTPQL_FIELD_MAP.get((ns, field))
    if col is None:
        raise ValueError(f"Unknown field: {ns}.{field}")

    is_numeric = (ns, field) in HTTPQL_NUMERIC

    if op == "eq":
        return (f"CAST({col} AS INTEGER) = CAST(? AS INTEGER)", [value]) if is_numeric else (f"{col} = ?", [value])
    elif op == "ne":
        return (f"CAST({col} AS INTEGER) != CAST(? AS INTEGER)", [value]) if is_numeric else (f"{col} != ?", [value])
    elif op == "gt":
        return (f"CAST({col} AS INTEGER) > CAST(? AS INTEGER)", [value])
    elif op == "gte":
        return (f"CAST({col} AS INTEGER) >= CAST(? AS INTEGER)", [value])
    elif op == "lt":
        return (f"CAST({col} AS INTEGER) < CAST(? AS INTEGER)", [value])
    elif op == "lte":
        return (f"CAST({col} AS INTEGER) <= CAST(? AS INTEGER)", [value])
    elif op == "cont":
        return (f"{col} LIKE '%' || ? || '%'", [value])
    elif op == "ncont":
        return (f"{col} NOT LIKE '%' || ? || '%'", [value])
    elif op == "like":
        return (f"{col} LIKE ?", [value])
    elif op == "nlike":
        return (f"{col} NOT LIKE ?", [value])
    elif op == "regex":
        return (f"HTTPQL_REGEX({col}, ?)", [value])
    elif op == "nregex":
        return (f"NOT HTTPQL_REGEX({col}, ?)", [value])
    raise ValueError(f"Unknown operator: {op}")


def compile_httpql_ast(node: dict, presets_map: dict = None):
    """Recursively compile an HTTPQL AST node to (sql, params)."""
    t = node.get("type")
    if t == "comparison":
        return _httpql_compile_comparison(node["namespace"], node["field"], node["operator"], node["value"])
    elif t in ("and", "or"):
        parts, params = [], []
        for child in node["children"]:
            sql, p = compile_httpql_ast(child, presets_map)
            parts.append(f"({sql})")
            params.extend(p)
        joiner = " AND " if t == "and" else " OR "
        return (joiner.join(parts), params)
    elif t == "shorthand":
        expanded = {"type": "or", "children": [
            {"type": "comparison", "namespace": "req", "field": "raw", "operator": "cont", "value": node["value"]},
            {"type": "comparison", "namespace": "resp", "field": "raw", "operator": "cont", "value": node["value"]},
        ]}
        return compile_httpql_ast(expanded, presets_map)
    elif t == "preset":
        if presets_map and node["name"] in presets_map:
            return compile_httpql_ast(presets_map[node["name"]], presets_map)
        raise ValueError(f"Unknown preset: '{node['name']}'")
    raise ValueError(f"Unknown AST node type: {t}")


async def get_db_with_regex():
    """Get DB connection with HTTPQL_REGEX function for regex operator support."""
    project = get_current_project()
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


class GitManager:
    def __init__(self, name: str):
        self.repo_path = get_project_path(name)

    async def _ensure_identity(self) -> bool:
        async def _get_config(key: str) -> Optional[str]:
            proc = await asyncio.create_subprocess_exec(
                "git", "config", "--get", key,
                cwd=str(self.repo_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            value = stdout.decode().strip()
            return value or None

        name = await _get_config("user.name")
        email = await _get_config("user.email")
        if name and email:
            return True

        default_name = os.getenv("BLACKWIRE_GIT_NAME", "Blackwire")
        default_email = os.getenv("BLACKWIRE_GIT_EMAIL", "blackwire@local")
        proc = await asyncio.create_subprocess_exec(
            "git", "config", "user.name", default_name,
            cwd=str(self.repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        proc = await asyncio.create_subprocess_exec(
            "git", "config", "user.email", default_email,
            cwd=str(self.repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        return True
    
    async def init_repo(self):
        if not (self.repo_path / ".git").exists():
            proc = await asyncio.create_subprocess_exec("git", "init", cwd=str(self.repo_path),
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await proc.communicate()
            (self.repo_path / ".gitignore").write_text("*.pyc\n__pycache__/\n")
            await self._ensure_identity()
            await self.commit("Initial commit")
    
    async def commit(self, message: str) -> Optional[str]:
        await self._ensure_identity()
        proc = await asyncio.create_subprocess_exec(
            "git", "add", "-A", cwd=str(self.repo_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        proc = await asyncio.create_subprocess_exec(
            "git", "commit", "-m", message, cwd=str(self.repo_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            proc = await asyncio.create_subprocess_exec("git", "rev-parse", "HEAD", cwd=str(self.repo_path),
                stdout=asyncio.subprocess.PIPE)
            stdout, _ = await proc.communicate()
            return stdout.decode().strip()[:8]
        if stderr:
            logger.warning("Git commit failed: %s", stderr.decode().strip())
        return None
    
    async def get_history(self, limit: int = 50) -> List[dict]:
        proc = await asyncio.create_subprocess_exec("git", "log", f"-{limit}", "--pretty=format:%H|%s|%ai",
            cwd=str(self.repo_path), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await proc.communicate()
        commits = []
        for line in stdout.decode().strip().split("\n"):
            if line and "|" in line:
                parts = line.split("|")
                commits.append({"hash": parts[0][:8], "message": parts[1], "date": parts[2] if len(parts) > 2 else ""})
        return commits


async def update_proxy_config():
    config = {
        "intercept_enabled": intercept_enabled,
        "scope_rules": scope_rules,
        "project": get_current_project(),
        "extensions": extensions_config,
    }
    (Path(__file__).parent / ".proxy_config.json").write_text(json.dumps(config))
    logger.debug('Proxy config updated at %s: %s', Path(__file__).parent / '.proxy_config.json', config)


def _stream_pipe(pipe, level_fn, label: str):
    """Read lines from a subprocess pipe and log them.

    NOTE: We spawn mitmproxy with text=True, so readline() returns str, not bytes.
    """
    try:
        if not pipe:
            return
        for line in iter(pipe.readline, ''):  # '' == EOF en text mode
            if not line:
                break
            line = line.rstrip()
            if line:
                level_fn('[%s] %s', label, line)
    except Exception as e:
        logger.debug('Pipe reader for %s stopped: %s', label, e)

async def start_proxy(port: int = 8080, mode: str = "regular", extra_args: str = ""):
    global proxy_process
    logger.debug('start_proxy called (port=%s)', port)
    if proxy_process and proxy_process.poll() is None:
        return {"status": "already_running", "port": port}
    
    await update_proxy_config()
    addon_path = Path(__file__).parent / "mitm_addon.py"
    logger.info('Starting mitmproxy (port=%s) with addon=%s', port, addon_path)
    
    # Use mitmdump (headless) instead of mitmproxy UI; running the dump module directly does nothing.
    mitmdump_bin = Path(sys.executable).with_name("mitmdump")
    if not mitmdump_bin.exists():
        resolved = shutil.which("mitmdump")
        mitmdump_bin = Path(resolved) if resolved else None
    if not mitmdump_bin:
        logger.error("mitmdump binary not found near current Python. Verify the venv/paths.")
        return {"status": "failed", "error": "mitmdump not found in venv or PATH"}
    extra = shlex.split(extra_args) if extra_args else []
    cmd = [str(mitmdump_bin), "--mode", mode, "-p", str(port),
           "-s", str(addon_path), "--set", "connection_strategy=lazy", "--ssl-insecure"]
    if extra:
        cmd.extend(extra)
    logger.debug('mitmproxy command: %s', ' '.join(cmd))
    
    logger.debug('Spawning mitmproxy subprocess...')
    logger.info("Launching proxy subprocess: %s", " ".join(map(str, cmd)))
    proxy_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    # Give the process a moment to initialize and bind the port
    await asyncio.sleep(1.0)
    if proxy_process.poll() is None:
        # Stream mitmproxy stdout/stderr into our logs for easier debugging
        threading.Thread(target=_stream_pipe, args=(proxy_process.stdout, logger.info, "mitm:stdout"), daemon=True).start()
        threading.Thread(target=_stream_pipe, args=(proxy_process.stderr, logger.error, "mitm:stderr"), daemon=True).start()
    else:
        # Process already exited; capture whatever it printed
        try:
            stdout, stderr = proxy_process.communicate(timeout=1.0)
        except Exception:
            stdout, stderr = "", ""
        logger.error("Proxy exited immediately (returncode=%s). stdout=%r stderr=%r", proxy_process.returncode, stdout, stderr)
        return {"status": "failed", "error": (stderr or stdout or "Proxy exited immediately")}
    # If still running after startup window, report started
    return {"status": "started", "port": port, "pid": proxy_process.pid}
async def stop_proxy():
    global proxy_process
    logger.debug('stop_proxy called')
    if proxy_process:
        proxy_process.terminate()
        logger.info('Stopping mitmproxy (pid=%s)...', proxy_process.pid)
        try:
            proxy_process.wait(timeout=5)
        except:
            proxy_process.kill()
        proxy_process = None
        return {"status": "stopped"}
    return {"status": "not_running"}


def transpile_jsx():
    """Pre-transpile App.jsx → App.compiled.js using sucrase (fast JSX transform)."""
    if not APP_JSX_PATH.exists():
        return
    node_script = (
        "const {transform}=require('sucrase'),fs=require('fs');"
        f"const code=fs.readFileSync({str(APP_JSX_PATH)!r},'utf8');"
        "const r=transform(code,{transforms:['jsx'],production:true});"
        "const wrapped='(function(){\\n'+r.code+'\\n})();';"
        f"fs.writeFileSync({str(APP_COMPILED_PATH)!r},wrapped,'utf8');"
        "console.log('OK:'+r.code.length)"
    )
    try:
        result = subprocess.run(
            ["node", "-e", node_script],
            capture_output=True, text=True, timeout=30, cwd=str(BASE_DIR)
        )
        if result.returncode == 0:
            logging.info("Transpiled App.jsx → App.compiled.js (%s)", result.stdout.strip())
        else:
            logging.error("sucrase transpile failed: %s", result.stderr[:500])
    except Exception as e:
        logging.error("Transpile error: %s", e)

@asynccontextmanager
async def lifespan(app: FastAPI):
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    setup_logging()
    transpile_jsx()
    project = get_current_project()
    if project:
        await init_db(project)
        await load_project_settings(project)
    yield
    await stop_proxy()

app = FastAPI(title="Blackwire API", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Usar el frontend.html original que tiene toda la funcionalidad
FRONTEND_HTML_PATH = Path(__file__).parent / "frontend.html"
FRONTEND_HTML = FRONTEND_HTML_PATH.read_text() if FRONTEND_HTML_PATH.exists() else "<h1>Frontend not found</h1>"

@app.get("/", response_class=HTMLResponse)
async def root():
    return HTMLResponse(FRONTEND_HTML)

def _static_headers():
    return {"Cache-Control": "no-cache"}

@app.get("/App.jsx")
async def app_jsx():
    # Auto-recompile if source is newer than compiled
    if APP_JSX_PATH.exists():
        need_compile = not APP_COMPILED_PATH.exists() or APP_JSX_PATH.stat().st_mtime > APP_COMPILED_PATH.stat().st_mtime
        if need_compile:
            transpile_jsx()
    if APP_COMPILED_PATH.exists():
        return FileResponse(APP_COMPILED_PATH, media_type="text/javascript", headers=_static_headers())
    if APP_JSX_PATH.exists():
        return FileResponse(APP_JSX_PATH, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail="App.jsx not found")

@app.get("/themes.js")
async def themes_js():
    if THEMES_JS_PATH.exists():
        return FileResponse(THEMES_JS_PATH, media_type="text/javascript", headers=_static_headers())
    raise HTTPException(status_code=404, detail="themes.js not found")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connections.remove(websocket)

async def broadcast(data: dict):
    for conn in connections:
        try:
            await conn.send_json(data)
        except:
            pass


@app.get("/api/projects")
async def list_projects():
    projects = []
    if PROJECTS_DIR.exists():
        for p in PROJECTS_DIR.iterdir():
            if p.is_dir() and (p / "config.json").exists():
                config = json.loads((p / "config.json").read_text())
                projects.append({"name": p.name, "description": config.get("description", ""),
                    "created_at": config.get("created_at"), "is_current": p.name == get_current_project()})
    return sorted(projects, key=lambda x: x.get("created_at", ""), reverse=True)

@app.post("/api/projects")
async def create_project(project: Project):
    if get_project_path(project.name).exists():
        raise HTTPException(status_code=400, detail="Project exists")
    get_project_path(project.name).mkdir(parents=True)

    # Auto-inicializar todas las extensiones
    extensions_config_init = {}
    meta_list = load_extension_metadata()
    for meta in meta_list:
        ext_name = meta.get("name")
        default_cfg = meta.get("default_config", {"enabled": False})
        extensions_config_init[ext_name] = default_cfg

    config = {"name": project.name, "description": project.description, "scope_rules": [],
        "proxy_port": 8080, "proxy_mode": "regular", "proxy_args": "", "intercept_enabled": False, "created_at": datetime.now().isoformat(),
        "extensions": extensions_config_init}
    await save_project_config(project.name, config)
    await init_db(project.name)
    git = GitManager(project.name)
    await git.init_repo()
    logger.info('Created project %s', project.name)
    return {"status": "created", "name": project.name}

@app.get("/api/projects/current")
async def get_current():
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        return {"project": project, "config": config}
    return {"project": None}

@app.post("/api/projects/{name}/select")
async def select_project(name: str):
    global scope_rules, intercept_enabled, extensions_config
    config = await get_project_config(name)
    if not config:
        raise HTTPException(status_code=404, detail="Project not found")
    set_current_project(name)
    logger.info('Selected project %s', name)
    await init_db(name)
    scope_rules = config.get("scope_rules", [])
    intercept_enabled = config.get("intercept_enabled", False)
    extensions_config = config.get("extensions", {})
    return {"status": "selected", "project": name}

@app.put("/api/projects/{name}")
async def update_project(name: str, config: dict = Body(...)):
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")
    await save_project_config(name, config)
    logger.info('Updated project %s config', name)
    return {"status": "updated", "name": name}


@app.get("/api/extensions")
async def get_extensions():
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    meta_list = load_extension_metadata()
    for meta in meta_list:
        cfg = extensions_config.get(meta.get("name", ""), {})
        meta["config"] = cfg
        meta["enabled"] = cfg.get("enabled", False)
    return {"extensions": meta_list}


@app.put("/api/extensions/{name}")
async def update_extension_config(name: str, config: dict = Body(...)):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    await save_extension_config(project, name, config)
    return {"status": "updated", "name": name, "config": config}


@app.get("/api/extensions/{ext_name}/ui.js")
async def get_extension_ui(ext_name: str):
    """
    Sirve el archivo .ui.js compilado de una extensión
    """
    from fastapi.responses import Response

    # Buscar archivo compilado
    ui_file = EXTENSIONS_UI_COMPILED_DIR / f"{ext_name}.ui.js"

    if not ui_file.exists():
        raise HTTPException(status_code=404, detail=f"Custom UI not found for extension: {ext_name}")

    try:
        with open(ui_file, 'r', encoding='utf-8') as f:
            content = f.read()

        return Response(
            content=content,
            media_type="application/javascript",
            headers={
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*"
            }
        )
    except Exception as e:
        logger.error(f"Error serving extension UI for {ext_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading custom UI: {str(e)}")


@app.post("/api/webhooksite/apikey")
async def update_webhook_apikey(body: dict = Body(default={})):
    """Update API Key without creating a new token"""
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    api_key = body.get("api_key", "")
    cfg["api_key"] = api_key
    await save_extension_config(project, "webhook_site", cfg)
    return {"status": "updated"}


@app.post("/api/webhooksite/token")
async def create_webhook_token(body: dict = Body(default={})):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    api_key = body.get("api_key") or cfg.get("api_key")
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.post(f"{WEBHOOKSITE_API_BASE}/token", headers=webhook_headers(api_key))
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Webhook.site error: {e}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail="Failed to create webhook token")
    data = resp.json()
    token_id = data.get("uuid") or data.get("token") or data.get("id")
    if not token_id:
        raise HTTPException(status_code=500, detail="Webhook token missing")
    token_url = data.get("url") or f"{WEBHOOKSITE_BASE}/{token_id}"
    cfg.update({
        "enabled": cfg.get("enabled", True),
        "token_id": token_id,
        "token_url": token_url,
        "token_created_at": datetime.now().isoformat(),
        "api_key": api_key,
    })
    await save_extension_config(project, "webhook_site", cfg)
    return {"status": "created", "token_id": token_id, "token_url": token_url, "created_at": cfg["token_created_at"]}


@app.post("/api/webhooksite/refresh")
async def refresh_webhook_requests(body: dict = Body(default={})):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    token_id = cfg.get("token_id")
    if not token_id:
        raise HTTPException(status_code=400, detail="No webhook token configured")
    api_key = cfg.get("api_key")
    limit = int(body.get("limit", 50))
    url = f"{WEBHOOKSITE_API_BASE}/token/{token_id}/requests?sorting=newest&per_page={limit}"
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.get(url, headers=webhook_headers(api_key))
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Webhook.site error: {e}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch webhook requests")
    data = resp.json()
    items = data.get("data") if isinstance(data, dict) else data
    if not isinstance(items, list):
        items = []
    async with await get_db() as db:
        for item in items:
            req_id = item.get("uuid") or item.get("request_id") or item.get("id")
            if not req_id:
                continue
            method = item.get("method") or item.get("request_method")
            target_url = item.get("url") or item.get("request_url") or item.get("path")
            ip = item.get("ip")
            user_agent = item.get("user_agent") or item.get("headers", {}).get("User-Agent")
            content = item.get("content") if isinstance(item.get("content"), str) else json.dumps(item.get("content", "")) if item.get("content") is not None else None
            headers = json.dumps(item.get("headers", {}))
            query = json.dumps(item.get("query", {}))
            created_at = item.get("created_at") or item.get("created") or item.get("timestamp")
            raw_json = json.dumps(item)
            await db.execute(
                """INSERT OR IGNORE INTO webhook_requests
                (token_id, request_id, method, url, ip, user_agent, content, headers, query, created_at, raw_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (token_id, req_id, method, target_url, ip, user_agent, content, headers, query, created_at, raw_json)
            )
        await db.commit()
    cfg["last_sync"] = datetime.now().isoformat()
    await save_extension_config(project, "webhook_site", cfg)
    return {"status": "ok", "count": len(items)}


@app.get("/api/webhooksite/requests")
async def get_webhook_requests(limit: int = 200, all_tokens: bool = False):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    token_id = cfg.get("token_id")

    async with await get_db() as db:
        if all_tokens:
            # Mostrar requests de TODOS los tokens
            cursor = await db.execute(
                "SELECT request_id, method, url, ip, user_agent, content, headers, query, created_at, token_id FROM webhook_requests ORDER BY created_at DESC, id DESC LIMIT ?",
                (limit,)
            )
        else:
            # Solo del token actual
            if not token_id:
                return {"requests": []}
            cursor = await db.execute(
                "SELECT request_id, method, url, ip, user_agent, content, headers, query, created_at, token_id FROM webhook_requests WHERE token_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
                (token_id, limit)
            )
        rows = await cursor.fetchall()

    reqs = [{
        "request_id": r[0],
        "method": r[1],
        "url": r[2],
        "ip": r[3],
        "user_agent": r[4],
        "content": r[5],
        "headers": json.loads(r[6]) if r[6] else {},
        "query": json.loads(r[7]) if r[7] else {},
        "created_at": r[8],
        "token_id": r[9],
    } for r in rows]
    return {"requests": reqs}


@app.delete("/api/webhooksite/requests")
async def clear_webhook_requests():
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")
    cfg = extensions_config.get("webhook_site", {})
    token_id = cfg.get("token_id")
    if not token_id:
        return {"status": "ok", "deleted": 0}
    async with await get_db() as db:
        cursor = await db.execute("DELETE FROM webhook_requests WHERE token_id = ?", (token_id,))
        await db.commit()
    return {"status": "ok", "deleted": cursor.rowcount}

@app.delete("/api/projects/{name}")
async def delete_project(name: str):
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Not found")
    if name == get_current_project():
        set_current_project(None)
    shutil.rmtree(get_project_path(name))
    return {"status": "deleted"}

@app.get("/api/projects/{name}/export")
async def export_project(name: str):
    from fastapi.responses import Response
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")

    # Leer config del proyecto (incluye scope_rules)
    config = await get_project_config(name)

    # Leer todos los datos de la DB
    db_path = get_project_db(name)
    async with aiosqlite.connect(db_path) as db:
        # Requests (con TODOS los campos)
        cursor = await db.execute("SELECT * FROM requests")
        requests = []
        for row in await cursor.fetchall():
            requests.append({
                "method": row[1], "url": row[2], "headers": row[3], "body": row[4],
                "response_status": row[5], "response_headers": row[6], "response_body": row[7],
                "timestamp": row[8], "request_type": row[9], "tags": row[10],
                "notes": row[11], "saved": row[12], "in_scope": row[13]
            })

        # Repeater
        cursor = await db.execute("SELECT * FROM repeater")
        repeater = []
        for row in await cursor.fetchall():
            repeater.append({
                "name": row[1], "method": row[2], "url": row[3],
                "headers": row[4], "body": row[5], "created_at": row[6], "last_response": row[7]
            })

        # Collections (con description)
        cursor = await db.execute("SELECT * FROM collections")
        collections = []
        for row in await cursor.fetchall():
            collections.append({"name": row[1], "description": row[2], "created_at": row[3]})

        # Collection items (estructura correcta)
        cursor = await db.execute("SELECT * FROM collection_items")
        collection_items = []
        for row in await cursor.fetchall():
            collection_items.append({
                "collection_id": row[1], "position": row[2], "method": row[3], "url": row[4],
                "headers": row[5], "body": row[6], "var_extracts": row[7], "created_at": row[8]
            })

        # Filter presets
        cursor = await db.execute("SELECT * FROM filter_presets")
        filter_presets = []
        for row in await cursor.fetchall():
            filter_presets.append({
                "name": row[1], "query": row[2], "ast_json": row[3], "created_at": row[4]
            })

        # Session macros
        cursor = await db.execute("SELECT * FROM session_macros")
        session_macros = []
        for row in await cursor.fetchall():
            session_macros.append({
                "name": row[1], "description": row[2], "requests": row[3], "created_at": row[4]
            })

        # Session rules (nombres de columna correctos)
        cursor = await db.execute("SELECT * FROM session_rules")
        session_rules = []
        for row in await cursor.fetchall():
            session_rules.append({
                "enabled": row[1], "name": row[2], "when_stage": row[3],
                "target": row[4], "header_name": row[5], "regex_pattern": row[6],
                "extract_group": row[7], "variable_name": row[8], "created_at": row[9]
            })

    # Crear JSON de export COMPLETO
    export_data = {
        "version": "1.1",
        "blackwire_version": "1.0.0",
        "project_name": name,
        "exported_at": datetime.now().isoformat(),
        "config": config,
        "data": {
            "requests": requests,
            "repeater": repeater,
            "collections": collections,
            "collection_items": collection_items,
            "filter_presets": filter_presets,
            "session_macros": session_macros,
            "session_rules": session_rules
        },
        "stats": {
            "total_requests": len(requests),
            "total_repeater": len(repeater),
            "total_collections": len(collections),
            "total_filter_presets": len(filter_presets),
            "total_session_macros": len(session_macros),
            "total_session_rules": len(session_rules)
        }
    }

    filename = f"blackwire-{name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    return Response(
        content=json.dumps(export_data, indent=2),
        media_type='application/json',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@app.get("/api/projects/{name}/export-burp")
async def export_project_burp(name: str):
    """Exportar proyecto al formato XML de Burp Suite Pro"""
    from fastapi.responses import Response
    import base64
    from urllib.parse import urlparse

    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")

    # Leer requests de la DB
    db_path = get_project_db(name)
    items_xml = []

    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute("""
            SELECT id, method, url, headers, body, response_status, response_headers,
                   response_body, timestamp
            FROM requests
            ORDER BY id ASC
        """)
        rows = await cursor.fetchall()

        for row in rows:
            req_id, method, url, headers, body, resp_status, resp_headers, resp_body, timestamp = row

            # Parse URL
            try:
                parsed = urlparse(url)
                protocol = parsed.scheme or "http"
                host = parsed.netloc.split(':')[0] if parsed.netloc else "unknown"
                port = parsed.port or (443 if protocol == "https" else 80)
                path = parsed.path + ("?" + parsed.query if parsed.query else "")
                extension = path.split('.')[-1] if '.' in path.split('/')[-1] else "null"
            except:
                protocol, host, port, path, extension = "http", "unknown", 80, "/", "null"

            # Construir request HTTP completo
            request_text = f"{method} {path} HTTP/1.1\r\n"
            if headers:
                try:
                    headers_dict = json.loads(headers) if isinstance(headers, str) else headers
                    for k, v in headers_dict.items():
                        request_text += f"{k}: {v}\r\n"
                except:
                    pass
            request_text += "\r\n"
            if body:
                request_text += body

            # Construir response HTTP completo
            response_text = ""
            resp_length = 0
            mime_type = "text"
            if resp_status:
                response_text = f"HTTP/1.1 {resp_status} OK\r\n"
                if resp_headers:
                    try:
                        resp_headers_dict = json.loads(resp_headers) if isinstance(resp_headers, str) else resp_headers
                        for k, v in resp_headers_dict.items():
                            response_text += f"{k}: {v}\r\n"
                            if k.lower() == "content-type":
                                mime_type = v.split(';')[0].strip().split('/')[-1]
                    except:
                        pass
                response_text += "\r\n"
                if resp_body:
                    response_text += resp_body
                    resp_length = len(resp_body)

            # Base64 encode para evitar problemas con caracteres especiales
            request_b64 = base64.b64encode(request_text.encode('utf-8', errors='replace')).decode('ascii')
            response_b64 = base64.b64encode(response_text.encode('utf-8', errors='replace')).decode('ascii') if response_text else ""

            # Formatear timestamp
            time_str = timestamp if timestamp else datetime.now().isoformat()

            # Crear item XML
            item_xml = f"""  <item>
    <time>{time_str}</time>
    <url><![CDATA[{url}]]></url>
    <host ip="">{host}</host>
    <port>{port}</port>
    <protocol>{protocol}</protocol>
    <method>{method}</method>
    <path><![CDATA[{path}]]></path>
    <extension>{extension}</extension>
    <request base64="true"><![CDATA[{request_b64}]]></request>
    <status>{resp_status or 0}</status>
    <responselength>{resp_length}</responselength>
    <mimetype>{mime_type}</mimetype>
    <response base64="true"><![CDATA[{response_b64}]]></response>
    <comment></comment>
  </item>"""
            items_xml.append(item_xml)

    # Construir XML completo con DTD
    burp_version = "Blackwire-1.0.0"
    export_time = datetime.now().strftime("%a %b %d %H:%M:%S %Z %Y")

    xml_content = f"""<?xml version="1.0"?>
<!DOCTYPE items [
<!ELEMENT items (item*)>
<!ATTLIST items burpVersion CDATA "">
<!ATTLIST items exportTime CDATA "">
<!ELEMENT item (time, url, host, port, protocol, method, path, extension, request, status, responselength, mimetype, response, comment)>
<!ELEMENT time (#PCDATA)>
<!ELEMENT url (#PCDATA)>
<!ELEMENT host (#PCDATA)>
<!ATTLIST host ip CDATA "">
<!ELEMENT port (#PCDATA)>
<!ELEMENT protocol (#PCDATA)>
<!ELEMENT method (#PCDATA)>
<!ELEMENT path (#PCDATA)>
<!ELEMENT extension (#PCDATA)>
<!ELEMENT request (#PCDATA)>
<!ATTLIST request base64 (true|false) "false">
<!ELEMENT status (#PCDATA)>
<!ELEMENT responselength (#PCDATA)>
<!ELEMENT mimetype (#PCDATA)>
<!ELEMENT response (#PCDATA)>
<!ATTLIST response base64 (true|false) "false">
<!ELEMENT comment (#PCDATA)>
]>
<items burpVersion="{burp_version}" exportTime="{export_time}">
{chr(10).join(items_xml)}
</items>
"""

    filename = f"burp-{name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.xml"
    return Response(
        content=xml_content,
        media_type='application/xml',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@app.post("/api/projects/{name}/import-burp")
async def import_burp_xml(name: str, xml_content: str = Body(..., media_type="text/plain")):
    """Importar archivo XML de Burp Suite Pro al proyecto actual"""
    import xml.etree.ElementTree as ET
    import base64

    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400, detail="Select a project first")

    try:
        # Parsear XML
        root = ET.fromstring(xml_content)

        if root.tag != 'items':
            raise HTTPException(status_code=400, detail="Invalid Burp Suite XML format")

        items = root.findall('item')
        imported_count = 0

        async with await get_db() as db:
            for item in items:
                try:
                    # Extraer campos del XML
                    url = item.find('url').text if item.find('url') is not None else ''
                    method = item.find('method').text if item.find('method') is not None else 'GET'
                    timestamp = item.find('time').text if item.find('time') is not None else datetime.now().isoformat()
                    status = item.find('status').text if item.find('status') is not None else None

                    # Parsear request (puede estar en base64)
                    request_elem = item.find('request')
                    request_text = ''
                    if request_elem is not None and request_elem.text:
                        if request_elem.get('base64') == 'true':
                            request_text = base64.b64decode(request_elem.text).decode('utf-8', errors='replace')
                        else:
                            request_text = request_elem.text

                    # Parsear response (puede estar en base64)
                    response_elem = item.find('response')
                    response_text = ''
                    if response_elem is not None and response_elem.text:
                        if response_elem.get('base64') == 'true':
                            response_text = base64.b64decode(response_elem.text).decode('utf-8', errors='replace')
                        else:
                            response_text = response_elem.text

                    # Separar headers y body del request
                    request_headers = {}
                    request_body = ''
                    if request_text:
                        parts = request_text.split('\r\n\r\n', 1)
                        header_section = parts[0]
                        request_body = parts[1] if len(parts) > 1 else ''

                        # Parsear headers (saltar la primera línea que es el request line)
                        header_lines = header_section.split('\r\n')[1:]
                        for line in header_lines:
                            if ': ' in line:
                                key, value = line.split(': ', 1)
                                request_headers[key] = value

                    # Separar headers y body del response
                    response_headers = {}
                    response_body = ''
                    if response_text:
                        parts = response_text.split('\r\n\r\n', 1)
                        header_section = parts[0]
                        response_body = parts[1] if len(parts) > 1 else ''

                        # Parsear headers (saltar la primera línea que es el status line)
                        header_lines = header_section.split('\r\n')[1:]
                        for line in header_lines:
                            if ': ' in line:
                                key, value = line.split(': ', 1)
                                response_headers[key] = value

                    # Insertar en la base de datos
                    await db.execute("""
                        INSERT INTO requests (method, url, headers, body, response_status, response_headers,
                            response_body, timestamp, request_type, tags, notes, saved, in_scope)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        method,
                        url,
                        json.dumps(request_headers),
                        request_body,
                        int(status) if status else None,
                        json.dumps(response_headers),
                        response_body,
                        timestamp,
                        'http',
                        '[]',
                        '',
                        0,
                        1
                    ))
                    imported_count += 1
                except Exception as e:
                    # Si falla un item, continuar con el siguiente
                    print(f"Error importing item: {e}")
                    continue

            await db.commit()

        return {
            "status": "success",
            "imported": imported_count,
            "total": len(items)
        }

    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"Invalid XML format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@app.post("/api/projects/import")
async def import_project_create(data: dict = Body(...)):
    """Crear un nuevo proyecto desde un archivo de exportación"""
    # Validar estructura
    if "version" not in data or "data" not in data or "project_name" not in data:
        raise HTTPException(status_code=400, detail="Invalid import format")

    project_name = data["project_name"]

    # Verificar si el proyecto ya existe
    if get_project_path(project_name).exists():
        raise HTTPException(status_code=400, detail=f"Project '{project_name}' already exists. Use merge endpoint instead.")

    # Crear nuevo proyecto
    project_path = get_project_path(project_name)
    project_path.mkdir(parents=True, exist_ok=True)

    # Guardar config
    config_data = data.get("config", {})
    config_data["name"] = project_name
    await save_project_config(project_name, config_data)

    # Inicializar DB
    await init_db(project_name)

    # Importar datos
    db_path = get_project_db(project_name)
    async with aiosqlite.connect(db_path) as db:
        # Importar requests
        for req in data["data"].get("requests", []):
            await db.execute("""
                INSERT INTO requests (method, url, headers, body, response_status, response_headers,
                    response_body, timestamp, request_type, tags, notes, saved, in_scope)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (req["method"], req["url"], req["headers"], req.get("body"),
                  req.get("response_status"), req.get("response_headers"), req.get("response_body"),
                  req["timestamp"], req.get("request_type", "http"), req.get("tags", "[]"),
                  req.get("notes"), req.get("saved", 0), req.get("in_scope", 1)))

        # Importar repeater
        for rep in data["data"].get("repeater", []):
            await db.execute("""
                INSERT INTO repeater (name, method, url, headers, body, created_at, last_response)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (rep["name"], rep["method"], rep["url"], rep["headers"], rep.get("body"),
                  rep["created_at"], rep.get("last_response")))

        # Importar collections (con description)
        for coll in data["data"].get("collections", []):
            await db.execute("""
                INSERT INTO collections (name, description, created_at) VALUES (?, ?, ?)
            """, (coll["name"], coll.get("description", ""), coll["created_at"]))

        # Importar collection items (estructura correcta)
        for item in data["data"].get("collection_items", []):
            await db.execute("""
                INSERT INTO collection_items (collection_id, position, method, url, headers, body, var_extracts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (item["collection_id"], item["position"], item["method"], item["url"],
                  item.get("headers", "{}"), item.get("body"), item.get("var_extracts", "[]"),
                  item["created_at"]))

        # Importar filter presets
        for preset in data["data"].get("filter_presets", []):
            await db.execute("""
                INSERT INTO filter_presets (name, query, ast_json, created_at) VALUES (?, ?, ?, ?)
            """, (preset["name"], preset["query"], preset["ast_json"], preset["created_at"]))

        # Importar session macros
        for macro in data["data"].get("session_macros", []):
            await db.execute("""
                INSERT INTO session_macros (name, description, requests, created_at) VALUES (?, ?, ?, ?)
            """, (macro["name"], macro.get("description", ""), macro["requests"], macro["created_at"]))

        # Importar session rules (nombres de columna correctos)
        for rule in data["data"].get("session_rules", []):
            await db.execute("""
                INSERT INTO session_rules (enabled, name, when_stage, target, header_name,
                    regex_pattern, extract_group, variable_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (rule["enabled"], rule["name"], rule["when_stage"], rule["target"],
                  rule.get("header_name"), rule["regex_pattern"], rule.get("extract_group", 1),
                  rule["variable_name"], rule["created_at"]))

        await db.commit()

    return {
        "status": "imported",
        "message": f"Successfully created project '{project_name}' from import",
        "stats": data.get("stats", {})
    }

@app.post("/api/projects/{name}/import")
async def import_project_merge(name: str, data: dict = Body(...), clear_existing: bool = False):
    """Importar datos a un proyecto existente (merge o replace)"""
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")

    # Validar estructura
    if "version" not in data or "data" not in data:
        raise HTTPException(status_code=400, detail="Invalid import format")

    db_path = get_project_db(name)
    async with aiosqlite.connect(db_path) as db:
        # Limpiar datos si se solicita
        if clear_existing:
            await db.execute("DELETE FROM requests")
            await db.execute("DELETE FROM repeater")
            await db.execute("DELETE FROM collections")
            await db.execute("DELETE FROM collection_items")
            await db.execute("DELETE FROM filter_presets")
            await db.execute("DELETE FROM session_macros")
            await db.execute("DELETE FROM session_rules")

        # Importar requests
        for req in data["data"].get("requests", []):
            await db.execute("""
                INSERT INTO requests (method, url, headers, body, response_status, response_headers,
                    response_body, timestamp, request_type, tags, notes, saved, in_scope)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (req["method"], req["url"], req["headers"], req.get("body"),
                  req.get("response_status"), req.get("response_headers"), req.get("response_body"),
                  req["timestamp"], req.get("request_type", "http"), req.get("tags", "[]"),
                  req.get("notes"), req.get("saved", 0), req.get("in_scope", 1)))

        # Importar repeater
        for rep in data["data"].get("repeater", []):
            await db.execute("""
                INSERT INTO repeater (name, method, url, headers, body, created_at, last_response)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (rep["name"], rep["method"], rep["url"], rep["headers"], rep.get("body"),
                  rep["created_at"], rep.get("last_response")))

        # Importar collections
        for coll in data["data"].get("collections", []):
            await db.execute("""
                INSERT INTO collections (name, description, created_at) VALUES (?, ?, ?)
            """, (coll["name"], coll.get("description", ""), coll["created_at"]))

        # Importar collection items
        for item in data["data"].get("collection_items", []):
            await db.execute("""
                INSERT INTO collection_items (collection_id, position, method, url, headers, body, var_extracts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (item["collection_id"], item["position"], item["method"], item["url"],
                  item.get("headers", "{}"), item.get("body"), item.get("var_extracts", "[]"),
                  item["created_at"]))

        # Importar filter presets
        for preset in data["data"].get("filter_presets", []):
            try:
                await db.execute("""
                    INSERT INTO filter_presets (name, query, ast_json, created_at) VALUES (?, ?, ?, ?)
                """, (preset["name"], preset["query"], preset["ast_json"], preset["created_at"]))
            except:
                pass  # Skip duplicates

        # Importar session macros
        for macro in data["data"].get("session_macros", []):
            await db.execute("""
                INSERT INTO session_macros (name, description, requests, created_at) VALUES (?, ?, ?, ?)
            """, (macro["name"], macro.get("description", ""), macro["requests"], macro["created_at"]))

        # Importar session rules
        for rule in data["data"].get("session_rules", []):
            await db.execute("""
                INSERT INTO session_rules (enabled, name, when_stage, target, header_name,
                    regex_pattern, extract_group, variable_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (rule["enabled"], rule["name"], rule["when_stage"], rule["target"],
                  rule.get("header_name"), rule["regex_pattern"], rule.get("extract_group", 1),
                  rule["variable_name"], rule["created_at"]))

        await db.commit()

    # Actualizar config si viene en el import
    if "config" in data:
        current_config = await get_project_config(name)
        # Merge scope_rules si vienen
        if "scope_rules" in data["config"]:
            current_config["scope_rules"] = data["config"]["scope_rules"]
        await save_project_config(name, current_config)

    action = "replaced" if clear_existing else "merged"
    return {
        "status": "imported",
        "message": f"Successfully {action} data in project '{name}'",
        "stats": data.get("stats", {})
    }

@app.get("/api/scope")
async def get_scope():
    return {"rules": scope_rules}

@app.post("/api/scope/rules")
async def add_scope_rule(rule: ScopeRule):
    global scope_rules
    new_rule = {"pattern": rule.pattern, "rule_type": rule.rule_type, "enabled": rule.enabled,
        "id": hashlib.md5(f"{rule.pattern}{datetime.now()}".encode()).hexdigest()[:8]}
    scope_rules.append(new_rule)
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        config["scope_rules"] = scope_rules
        await save_project_config(project, config)
    await update_proxy_config()
    return {"status": "added", "rule": new_rule}

@app.delete("/api/scope/rules/{rule_id}")
async def delete_scope_rule(rule_id: str):
    global scope_rules
    scope_rules = [r for r in scope_rules if r.get("id") != rule_id]
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        config["scope_rules"] = scope_rules
        await save_project_config(project, config)
    await update_proxy_config()
    return {"status": "deleted"}

@app.put("/api/scope/rules/{rule_id}")
async def toggle_scope_rule(rule_id: str):
    global scope_rules
    for rule in scope_rules:
        if rule.get("id") == rule_id:
            rule["enabled"] = not rule.get("enabled", True)
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        config["scope_rules"] = scope_rules
        await save_project_config(project, config)
    await update_proxy_config()
    return {"status": "toggled"}


@app.get("/api/intercept/status")
async def get_intercept_status():
    return {"enabled": intercept_enabled, "pending_count": len(intercepted_requests)}

@app.post("/api/intercept/toggle")
async def toggle_intercept():
    global intercept_enabled
    intercept_enabled = not intercept_enabled
    logger.info('Intercept toggled -> %s', intercept_enabled)
    if not intercept_enabled:
        await forward_all()
    
    project = get_current_project()
    if project:
        config = await get_project_config(project)
        config["intercept_enabled"] = intercept_enabled
        await save_project_config(project, config)
    await update_proxy_config()
    await broadcast({"type": "intercept_status", "enabled": intercept_enabled})
    return {"enabled": intercept_enabled}

@app.get("/api/intercept/pending")
async def get_pending():
    return list(intercepted_requests.values())

@app.post("/api/intercept/{request_id}/forward")
async def forward_request(request_id: str, modified: Optional[dict] = Body(None)):
    if request_id not in intercepted_requests:
        raise HTTPException(status_code=404)
    intercepted_requests.pop(request_id)
    action_file = Path(__file__).parent / f".action_{request_id}.json"
    action_file.write_text(json.dumps({"action": "forward", "modified": modified}))
    await broadcast({"type": "intercept_forwarded", "request_id": request_id})
    return {"status": "forwarded"}

@app.post("/api/intercept/{request_id}/drop")
async def drop_request(request_id: str):
    if request_id not in intercepted_requests:
        raise HTTPException(status_code=404)
    intercepted_requests.pop(request_id)
    action_file = Path(__file__).parent / f".action_{request_id}.json"
    action_file.write_text(json.dumps({"action": "drop"}))
    await broadcast({"type": "intercept_dropped", "request_id": request_id})
    return {"status": "dropped"}

@app.post("/api/intercept/forward-all")
async def forward_all():
    for rid in list(intercepted_requests.keys()):
        (Path(__file__).parent / f".action_{rid}.json").write_text(json.dumps({"action": "forward"}))
    count = len(intercepted_requests)
    intercepted_requests.clear()
    await broadcast({"type": "intercept_all_forwarded"})
    return {"status": "forwarded", "count": count}

@app.post("/api/intercept/drop-all")
async def drop_all():
    for rid in list(intercepted_requests.keys()):
        (Path(__file__).parent / f".action_{rid}.json").write_text(json.dumps({"action": "drop"}))
    count = len(intercepted_requests)
    intercepted_requests.clear()
    return {"status": "dropped", "count": count}

@app.post("/api/intercept/toggle_responses")
async def toggle_intercept_responses():
    global intercept_responses_enabled
    intercept_responses_enabled = not intercept_responses_enabled
    await broadcast({
        "type": "intercept_responses_toggled",
        "enabled": intercept_responses_enabled
    })
    return {"enabled": intercept_responses_enabled}

@app.get("/api/intercept/pending_responses")
async def get_pending_responses():
    return list(intercepted_responses.values())

@app.post("/api/intercept_response/{response_id}/forward")
async def forward_response(response_id: str):
    if response_id in intercepted_responses:
        (Path(__file__).parent / f".action_resp_{response_id}.json").write_text(json.dumps({"action": "forward"}))
        del intercepted_responses[response_id]
        await broadcast({"type": "response_forwarded", "id": response_id})
    return {"status": "forwarded"}

@app.post("/api/intercept_response/{response_id}/drop")
async def drop_response(response_id: str):
    if response_id in intercepted_responses:
        (Path(__file__).parent / f".action_resp_{response_id}.json").write_text(json.dumps({"action": "drop"}))
        del intercepted_responses[response_id]
        await broadcast({"type": "response_dropped", "id": response_id})
    return {"status": "dropped"}

@app.post("/api/intercept_response/forward-all")
async def forward_all_responses():
    for rid in list(intercepted_responses.keys()):
        (Path(__file__).parent / f".action_resp_{rid}.json").write_text(json.dumps({"action": "forward"}))
    count = len(intercepted_responses)
    intercepted_responses.clear()
    await broadcast({"type": "intercept_all_responses_forwarded"})
    return {"status": "forwarded", "count": count}

@app.post("/api/intercept_response/drop-all")
async def drop_all_responses():
    for rid in list(intercepted_responses.keys()):
        (Path(__file__).parent / f".action_resp_{rid}.json").write_text(json.dumps({"action": "drop"}))
    count = len(intercepted_responses)
    intercepted_responses.clear()
    return {"status": "dropped", "count": count}


@app.post("/api/proxy/start")
async def api_start_proxy(port: int = 8080, mode: str = "regular", extra: str = ""):
    if not get_current_project():
        raise HTTPException(status_code=400, detail="Select a project first")
    return await start_proxy(port, mode, extra)

@app.post("/api/proxy/stop")
async def api_stop_proxy():
    return await stop_proxy()

@app.get("/api/proxy/status")
async def proxy_status():
    running = proxy_process is not None and proxy_process.poll() is None
    return {"running": running, "intercept_enabled": intercept_enabled}

@app.post("/api/shutdown")
async def shutdown_server():
    """Gracefully shut down the entire server."""
    await stop_proxy()
    # Schedule shutdown after response is sent
    asyncio.get_event_loop().call_later(0.5, lambda: os._exit(0))
    return {"status": "shutting_down"}


REQ_LIST_COLS = "id, method, url, response_status, timestamp, request_type, saved, in_scope"

def _row_to_list_item(r):
    return {"id": r[0], "method": r[1], "url": r[2], "response_status": r[3],
            "timestamp": r[4], "request_type": r[5], "saved": bool(r[6]), "in_scope": bool(r[7])}

@app.get("/api/requests")
async def get_requests(limit: int = 500, saved_only: bool = False, in_scope_only: bool = False, search: str = ""):
    async with await get_db() as db:
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
        return [_row_to_list_item(r) for r in rows]

@app.get("/api/requests/{rid}/detail")
async def get_request_detail(rid: int):
    async with await get_db() as db:
        cursor = await db.execute("SELECT id, method, url, headers, body, response_status, response_headers, response_body, timestamp, request_type, saved, in_scope FROM requests WHERE id = ?", (rid,))
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Request not found")
        return {"id": r[0], "method": r[1], "url": r[2], "headers": json.loads(r[3]), "body": r[4],
            "response_status": r[5], "response_headers": json.loads(r[6]) if r[6] else None,
            "response_body": r[7], "timestamp": r[8], "request_type": r[9],
            "saved": bool(r[10]), "in_scope": bool(r[11])}

@app.post("/api/requests/search")
async def search_requests(body: dict = Body(...)):
    ast = body.get("ast")
    saved_only = body.get("saved_only", False)
    in_scope_only = body.get("in_scope_only", False)
    limit = body.get("limit", 500)
    # Only use regex-capable connection when AST contains regex operators
    use_regex = ast is not None
    if use_regex:
        db = await get_db_with_regex()
    else:
        db = await aiosqlite.connect(get_project_db(get_current_project()))
    try:
        query = f"SELECT {REQ_LIST_COLS} FROM requests WHERE 1=1"
        params = []
        if saved_only:
            query += " AND saved = 1"
        if in_scope_only:
            query += " AND in_scope = 1"
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
                query += f" AND ({where_sql})"
                params.extend(where_params)
            except ValueError as e:
                return {"error": str(e)}
        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [_row_to_list_item(r) for r in rows]
    finally:
        await db.close()


# --- Filter Presets ---
@app.get("/api/filter-presets")
async def list_filter_presets():
    async with await get_db() as db:
        cursor = await db.execute("SELECT id, name, query, created_at FROM filter_presets ORDER BY name ASC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "query": r[2], "created_at": r[3]} for r in rows]

@app.post("/api/filter-presets")
async def create_filter_preset(body: dict = Body(...)):
    async with await get_db() as db:
        try:
            await db.execute(
                "INSERT INTO filter_presets (name, query, ast_json, created_at) VALUES (?,?,?,?)",
                (body["name"], body["query"], json.dumps(body["ast"]), datetime.now().isoformat()))
            await db.commit()
            return {"status": "created", "name": body["name"]}
        except Exception:
            return {"error": "Preset name already exists"}

@app.delete("/api/filter-presets/{preset_id}")
async def delete_filter_preset(preset_id: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM filter_presets WHERE id = ?", (preset_id,))
        await db.commit()
        return {"status": "deleted"}


@app.put("/api/requests/{rid}/save")
async def toggle_save(rid: int):
    async with await get_db() as db:
        cursor = await db.execute("SELECT saved FROM requests WHERE id = ?", (rid,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404)
        await db.execute("UPDATE requests SET saved = ? WHERE id = ?", (0 if row[0] else 1, rid))
        await db.commit()
        return {"saved": not row[0]}

@app.delete("/api/requests/{rid}")
async def delete_req(rid: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM requests WHERE id = ?", (rid,))
        await db.commit()
        return {"status": "deleted"}

@app.delete("/api/requests")
async def clear_history(keep_saved: bool = True):
    async with await get_db() as db:
        if keep_saved:
            await db.execute("DELETE FROM requests WHERE saved = 0")
        else:
            await db.execute("DELETE FROM requests")
        await db.commit()
        return {"status": "cleared"}

@app.get("/api/requests/{rid}/render")
async def render_response(rid: int):
    from fastapi.responses import Response
    async with await get_db() as db:
        cursor = await db.execute("SELECT response_body, response_headers FROM requests WHERE id = ?", (rid,))
        row = await cursor.fetchone()
        if not row or not row[0]:
            raise HTTPException(status_code=404, detail="No response body")
        body = row[0]
        headers_json = row[1]
        content_type = "text/html"
        if headers_json:
            try:
                headers = json.loads(headers_json)
                content_type = headers.get("content-type", headers.get("Content-Type", "text/html"))
            except:
                pass
        return Response(
            content=body.encode('utf-8') if isinstance(body, str) else body,
            media_type=content_type
        )

@app.get("/api/requests/{rid}/replay")
async def replay_request(rid: int):
    async with await get_db() as db:
        cursor = await db.execute("SELECT method, url, headers, body FROM requests WHERE id = ?", (rid,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")

        method, url, headers_json, body = row
        headers = json.loads(headers_json) if headers_json else {}

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Replay Request</title>
    <style>
        body {{ font-family: monospace; margin: 20px; background: #1e1e1e; color: #d4d4d4; }}
        h2 {{ color: #4fc3f7; }}
        pre {{ background: #2d2d30; padding: 10px; border-radius: 4px; overflow-x: auto; }}
        button {{ background: #0e639c; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; }}
        button:hover {{ background: #1177bb; }}
        #response {{ margin-top: 20px; }}
    </style>
</head>
<body>
    <h2>Replay Request</h2>
    <pre id="request-info">
Method: {method}
URL: {url}
Headers: {json.dumps(headers, indent=2)}
Body: {body or '(empty)'}
    </pre>
    <button onclick="sendRequest()">Send Request</button>
    <div id="response"></div>

    <script>
        async function sendRequest() {{
            const responseDiv = document.getElementById('response');
            responseDiv.innerHTML = '<p>Sending...</p>';

            try {{
                const resp = await fetch('{url}', {{
                    method: '{method}',
                    headers: {json.dumps(headers)},
                    body: {json.dumps(body) if body else 'null'}
                }});

                const text = await resp.text();
                responseDiv.innerHTML = '<h2>Response</h2><pre>Status: ' + resp.status + '\\n\\n' + text + '</pre>';
            }} catch(e) {{
                responseDiv.innerHTML = '<p style="color: #f48771;">Error: ' + e.message + '</p>';
            }}
        }}
    </script>
</body>
</html>"""
        return HTMLResponse(content=html_content)

@app.get("/api/requests/{rid}/download-body")
async def download_request_body(rid: int):
    from fastapi.responses import Response
    async with await get_db() as db:
        cursor = await db.execute("SELECT body, url FROM requests WHERE id = ?", (rid,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")

        body, url = row
        if not body:
            raise HTTPException(status_code=404, detail="No body in this request")

        # Intentar determinar la extensión del archivo según el tipo de contenido
        filename = f"request_{rid}_body.txt"
        try:
            # Intentar parsear como JSON
            json.loads(body)
            filename = f"request_{rid}_body.json"
        except:
            # Si no es JSON, usar .txt
            pass

        return Response(
            content=body.encode('utf-8') if isinstance(body, str) else body,
            media_type='application/octet-stream',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )

@app.get("/api/repeater")
async def get_repeater():
    async with await get_db() as db:
        cursor = await db.execute("SELECT * FROM repeater ORDER BY id DESC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "method": r[2], "url": r[3], "headers": json.loads(r[4]),
            "body": r[5], "created_at": r[6], "last_response": json.loads(r[7]) if r[7] else None} for r in rows]

@app.post("/api/repeater")
async def create_repeater(req: RepeaterRequest):
    async with await get_db() as db:
        last_resp = json.dumps(req.last_response) if req.last_response else None
        cursor = await db.execute(
            "INSERT INTO repeater (name, method, url, headers, body, created_at, last_response) VALUES (?,?,?,?,?,?,?)",
            (req.name, req.method, req.url, json.dumps(req.headers), req.body, datetime.now().isoformat(), last_resp))
        await db.commit()
        return {"status": "created", "id": cursor.lastrowid}

@app.put("/api/repeater/{item_id}")
async def update_repeater(item_id: int, data: dict = Body(...)):
    async with await get_db() as db:
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
        await db.commit()
        return {"status": "updated"}

@app.delete("/api/repeater/{item_id}")
async def delete_repeater(item_id: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM repeater WHERE id = ?", (item_id,))
        await db.commit()
        return {"status": "deleted"}

@app.post("/api/repeater/send-raw")
async def send_raw(data: dict = Body(...)):
    try:
        follow = data.get("follow_redirects", False)
        async with httpx.AsyncClient(verify=False, timeout=30, follow_redirects=follow, max_redirects=30) as client:
            start = datetime.now()
            resp = await client.request(method=data.get("method", "GET"), url=data.get("url", ""),
                headers=data.get("headers", {}), content=data.get("body", "").encode() if data.get("body") else None)
            elapsed = (datetime.now() - start).total_seconds()
            # Detectar si es una redirección (3xx con Location header)
            is_redirect = 300 <= resp.status_code < 400
            redirect_url = resp.headers.get("location", None) if is_redirect else None
            # Si se siguieron redirects, incluir la cadena
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


# --- Chepy ---
@app.get("/api/chepy/operations")
async def get_chepy_operations():
    return {"operations": CHEPY_OPERATIONS}

@app.post("/api/chepy/bake")
async def bake_chepy(recipe: ChepyRecipe):
    from chepy_compat import run_operation
    try:
        value = recipe.input
        for op in recipe.operations:
            if op.name.startswith("_"):
                return {"error": f"Unknown operation: {op.name}"}
            allowed = False
            for cat_ops in CHEPY_OPERATIONS.values():
                if any(o["name"] == op.name for o in cat_ops):
                    allowed = True
                    break
            if not allowed:
                return {"error": f"Operation not allowed: {op.name}"}
            args = {k: v for k, v in op.args.items() if v != ""}
            value = run_operation(op.name, value, args)
        return {"output": value}
    except Exception as e:
        return {"error": str(e)}


# --- WebSocket Viewer ---
@app.get("/api/websocket/connections")
async def get_ws_connections(limit: int = 500):
    async with await get_db() as db:
        cursor = await db.execute(
            """SELECT url, COUNT(*) as frame_count,
               MIN(timestamp) as first_seen, MAX(timestamp) as last_seen
               FROM requests WHERE request_type = 'websocket'
               GROUP BY url ORDER BY last_seen DESC LIMIT ?""", (limit,))
        rows = await cursor.fetchall()
        return [{"url": r[0], "frame_count": r[1],
                 "first_seen": r[2], "last_seen": r[3]} for r in rows]

@app.get("/api/websocket/frames")
async def get_ws_frames(url: str, limit: int = 500):
    async with await get_db() as db:
        cursor = await db.execute(
            """SELECT id, body, response_body, timestamp
               FROM requests WHERE request_type = 'websocket' AND url = ?
               ORDER BY id ASC LIMIT ?""", (url, limit))
        rows = await cursor.fetchall()
        return [{"id": r[0], "content": r[1],
                 "direction": "up" if "\u2191" in (r[2] or "") else "down",
                 "timestamp": r[3]} for r in rows]

@app.post("/api/websocket/resend")
async def resend_ws_frame(data: WsResendRequest):
    import websockets
    try:
        extra_headers = data.headers or {}
        async with websockets.connect(data.url,
                additional_headers=extra_headers,
                open_timeout=10, close_timeout=5) as ws:
            await ws.send(data.message)
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                return {"status": "sent", "response": str(response)}
            except asyncio.TimeoutError:
                return {"status": "sent", "response": None,
                        "note": "No response within 5s"}
    except Exception as e:
        return {"error": str(e)}


# --- Collections ---
def resolve_jsonpath(data, path):
    """Simple dot-notation path resolver: $.key.subkey.0.field"""
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
    """Replace {{varname}} placeholders with variable values."""
    if not text:
        return text
    for name, value in variables.items():
        text = text.replace('{{' + name + '}}', str(value))
    return text

@app.get("/api/collections")
async def list_collections():
    async with await get_db() as db:
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

@app.post("/api/collections")
async def create_collection(data: CollectionCreate):
    async with await get_db() as db:
        await db.execute(
            "INSERT INTO collections (name, description, created_at) VALUES (?,?,?)",
            (data.name, data.description, datetime.now().isoformat()))
        await db.commit()
        cursor = await db.execute("SELECT last_insert_rowid()")
        cid = (await cursor.fetchone())[0]
        return {"status": "created", "id": cid}

@app.put("/api/collections/{cid}")
async def update_collection(cid: int, data: dict = Body(...)):
    async with await get_db() as db:
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

@app.delete("/api/collections/{cid}")
async def delete_collection(cid: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM collection_items WHERE collection_id = ?", (cid,))
        await db.execute("DELETE FROM collections WHERE id = ?", (cid,))
        await db.commit()
        return {"status": "deleted"}

@app.get("/api/collections/{cid}/items")
async def get_collection_items(cid: int):
    async with await get_db() as db:
        cursor = await db.execute(
            """SELECT id, collection_id, position, method, url, headers, body, var_extracts, created_at
               FROM collection_items WHERE collection_id = ? ORDER BY position ASC""", (cid,))
        rows = await cursor.fetchall()
        return [{"id": r[0], "collection_id": r[1], "position": r[2], "method": r[3],
                 "url": r[4], "headers": json.loads(r[5]), "body": r[6],
                 "var_extracts": json.loads(r[7]), "created_at": r[8]} for r in rows]

@app.post("/api/collections/{cid}/items")
async def add_collection_item(cid: int, data: CollectionItemCreate):
    async with await get_db() as db:
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

@app.put("/api/collections/{cid}/items/{iid}")
async def update_collection_item(cid: int, iid: int, data: dict = Body(...)):
    async with await get_db() as db:
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

@app.delete("/api/collections/{cid}/items/{iid}")
async def delete_collection_item(cid: int, iid: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM collection_items WHERE id = ?", (iid,))
        await db.commit()
        return {"status": "deleted"}

@app.post("/api/collections/{cid}/items/{iid}/execute")
async def execute_collection_item(cid: int, iid: int, data: CollectionItemExecute):
    async with await get_db() as db:
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


@app.post("/api/git/commit")
async def create_commit(message: str):
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400)
    git = GitManager(project)
    h = await git.commit(message)
    return {"status": "committed" if h else "nothing_to_commit", "hash": h}

@app.get("/api/git/history")
async def get_git_history():
    project = get_current_project()
    if not project:
        return []
    return await GitManager(project).get_history()


@app.get("/api/export")
async def export_data():
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400)
    async with await get_db() as db:
        cursor = await db.execute("SELECT * FROM requests WHERE saved = 1")
        saved = await cursor.fetchall()
        cursor = await db.execute("SELECT * FROM repeater")
        repeater = await cursor.fetchall()
    return {"project": project, "exported_at": datetime.now().isoformat(), "saved_requests": saved, "repeater": repeater}


@app.post("/api/browser/launch")
async def launch_browser(proxy_port: int = 8080):
    profile = Path("/tmp/blackwire_browser")
    profile.mkdir(exist_ok=True)
    for browser in ["chromium-browser", "google-chrome", "chromium", "firefox"]:
        path = shutil.which(browser)
        if not path:
            continue
        
        try:
            if "firefox" in browser:
                cmd = [browser, "-no-remote", "-profile", str(profile)]
            else:
                cmd = [browser, f"--proxy-server=http://127.0.0.1:{proxy_port}",
                    f"--user-data-dir={profile}", "--ignore-certificate-errors", "--no-first-run"]
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"status": "launched", "browser": browser}
        except (FileNotFoundError, PermissionError):
            continue
    return {"status": "failed", "error": "No browser found"}


@app.post("/api/internal/request")
async def receive_request(data: dict = Body(...)):
    project = get_current_project()
    if not project:
        return {"status": "no_project"}
    in_scope = match_scope(data["url"], scope_rules)
    logger.debug('Internal capture: %s %s (in_scope=%s)', data.get('method'), data.get('url'), in_scope)
    async with aiosqlite.connect(get_project_db(project)) as db:
        h = hashlib.md5(f"{data['method']}{data['url']}{data.get('body','')}".encode()).hexdigest()
        try:
            await db.execute("""INSERT INTO requests (method,url,headers,body,response_status,response_headers,
                response_body,timestamp,request_type,in_scope,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (data["method"], data["url"], json.dumps(data.get("headers", {})), data.get("body"),
                data.get("response_status"), json.dumps(data.get("response_headers", {})) if data.get("response_headers") else None,
                data.get("response_body"), datetime.now().isoformat(), data.get("request_type", "http"), 1 if in_scope else 0, h))
            await db.commit()
            cursor = await db.execute("SELECT last_insert_rowid()")
            rid = (await cursor.fetchone())[0]
            await broadcast({"type": "new_request", "data": {"id": rid, "method": data["method"], "url": data["url"],
                "response_status": data.get("response_status"), "request_type": data.get("request_type", "http"),
                "saved": False, "in_scope": in_scope, "timestamp": datetime.now().isoformat()}})
            return {"status": "received", "id": rid}
        except aiosqlite.IntegrityError:
            return {"status": "duplicate"}

@app.post("/api/internal/intercept")
async def receive_intercept(data: dict = Body(...)):
    rid = data.get("request_id", hashlib.md5(str(datetime.now()).encode()).hexdigest()[:12])
    logger.debug('Intercept incoming: %s %s', data.get('method'), data.get('url'))
    intercepted_requests[rid] = {"id": rid, "method": data["method"], "url": data["url"],
        "headers": data.get("headers", {}), "body": data.get("body"), "timestamp": datetime.now().isoformat()}
    await broadcast({"type": "intercept_new", "data": intercepted_requests[rid]})
    return {"status": "intercepted", "request_id": rid}


# --- Intruder Attacks ---
@app.get("/api/intruder/attacks")
async def list_intruder_attacks():
    async with await get_db() as db:
        cursor = await db.execute("SELECT id, name, total, created_at FROM intruder_attacks ORDER BY id DESC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "total": r[2], "created_at": r[3]} for r in rows]

@app.post("/api/intruder/attacks")
async def save_intruder_attack(data: dict = Body(...)):
    async with await get_db() as db:
        await db.execute(
            "INSERT INTO intruder_attacks (name, config, results, total, created_at) VALUES (?,?,?,?,?)",
            (data.get("name", "Attack"), json.dumps(data.get("config", {})),
             json.dumps(data.get("results", [])), data.get("total", 0),
             datetime.now().isoformat()))
        await db.commit()
        cursor = await db.execute("SELECT last_insert_rowid()")
        aid = (await cursor.fetchone())[0]
        return {"id": aid, "status": "saved"}

@app.get("/api/intruder/attacks/{aid}")
async def get_intruder_attack(aid: int):
    async with await get_db() as db:
        cursor = await db.execute("SELECT id, name, config, results, total, created_at FROM intruder_attacks WHERE id = ?", (aid,))
        r = await cursor.fetchone()
        if not r:
            return {"error": "not found"}
        return {"id": r[0], "name": r[1], "config": json.loads(r[2]), "results": json.loads(r[3]), "total": r[4], "created_at": r[5]}

@app.put("/api/intruder/attacks/{aid}")
async def update_intruder_attack(aid: int, data: dict = Body(...)):
    async with await get_db() as db:
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

@app.delete("/api/intruder/attacks/{aid}")
async def delete_intruder_attack(aid: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM intruder_attacks WHERE id = ?", (aid,))
        await db.commit()
        return {"status": "deleted"}

# --- Session Macros Endpoints ---

@app.get("/api/session/macros")
async def get_session_macros():
    async with await get_db() as db:
        cursor = await db.execute("SELECT id, name, description, requests, created_at FROM session_macros ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [{"id": r[0], "name": r[1], "description": r[2], "requests": json.loads(r[3]), "created_at": r[4]} for r in rows]

@app.post("/api/session/macros")
async def create_session_macro(data: dict = Body(...)):
    async with await get_db() as db:
        cursor = await db.execute(
            "INSERT INTO session_macros (name, description, requests, created_at) VALUES (?, ?, ?, ?)",
            (data["name"], data.get("description", ""), json.dumps(data.get("requests", [])), datetime.now().isoformat())
        )
        await db.commit()
        return {"id": cursor.lastrowid}

@app.put("/api/session/macros/{macro_id}")
async def update_session_macro(macro_id: int, data: dict = Body(...)):
    async with await get_db() as db:
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

@app.delete("/api/session/macros/{macro_id}")
async def delete_session_macro(macro_id: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM session_macros WHERE id = ?", (macro_id,))
        await db.commit()
        return {"status": "deleted"}

@app.post("/api/session/macros/{macro_id}/execute")
async def execute_session_macro(macro_id: int):
    async with await get_db() as db:
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

# --- Session Rules Endpoints ---

@app.get("/api/session/rules")
async def get_session_rules():
    async with await get_db() as db:
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

@app.post("/api/session/rules")
async def create_session_rule(data: dict = Body(...)):
    async with await get_db() as db:
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

@app.put("/api/session/rules/{rule_id}")
async def update_session_rule(rule_id: int, data: dict = Body(...)):
    async with await get_db() as db:
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

@app.delete("/api/session/rules/{rule_id}")
async def delete_session_rule(rule_id: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM session_rules WHERE id = ?", (rule_id,))
        await db.commit()
        return {"status": "deleted"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
