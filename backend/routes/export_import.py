#!/usr/bin/env python3
"""
Router de exportación/importación de proyectos.

- Export JSON nativo (1.1) con requests, repeater, collections, presets, macros y rules.
- Export/Import en formato XML de Burp Suite Pro.
- Import como proyecto nuevo o merge/replace sobre uno existente.

Importa directamente sus dependencias (db, state, config, GitManager); no usa
inyección porque esos módulos no dependen de los routers.
"""

import json
from datetime import datetime

import aiosqlite
from fastapi import APIRouter, Body, HTTPException

from config import get_project_path, get_project_db
from db import get_db, init_db, get_project_config, save_project_config
from services.state import get_current_project
from utils.git_manager import GitManager

router = APIRouter()


# (clave en el export, query, mapeo fila->dict) — el orden define el JSON de salida.
_EXPORT_TABLES = [
    ("requests", "SELECT * FROM requests",
     lambda r: {"method": r[1], "url": r[2], "headers": r[3], "body": r[4],
                "response_status": r[5], "response_headers": r[6], "response_body": r[7],
                "timestamp": r[8], "request_type": r[9], "tags": r[10],
                "notes": r[11], "saved": r[12], "in_scope": r[13]}),
    ("repeater", "SELECT * FROM repeater",
     lambda r: {"name": r[1], "method": r[2], "url": r[3], "headers": r[4],
                "body": r[5], "created_at": r[6], "last_response": r[7]}),
    ("collections", "SELECT * FROM collections",
     lambda r: {"id": r[0], "name": r[1], "description": r[2], "created_at": r[3]}),
    ("collection_items", "SELECT * FROM collection_items",
     lambda r: {"collection_id": r[1], "position": r[2], "method": r[3], "url": r[4],
                "headers": r[5], "body": r[6], "var_extracts": r[7], "created_at": r[8]}),
    ("filter_presets", "SELECT * FROM filter_presets",
     lambda r: {"name": r[1], "query": r[2], "ast_json": r[3], "created_at": r[4]}),
    ("session_macros", "SELECT * FROM session_macros",
     lambda r: {"name": r[1], "description": r[2], "requests": r[3], "created_at": r[4]}),
    ("session_rules", "SELECT * FROM session_rules",
     lambda r: {"enabled": r[1], "name": r[2], "when_stage": r[3], "target": r[4],
                "header_name": r[5], "regex_pattern": r[6], "extract_group": r[7],
                "variable_name": r[8], "created_at": r[9]}),
]


@router.get("/api/projects/{name}/export")
async def export_project(name: str):
    """Export streaming: serializa el JSON fila por fila para mantener la memoria
    plana sin importar el tamaño del historial (antes materializaba todo en RAM)."""
    from fastapi.responses import StreamingResponse
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")

    config = await get_project_config(name)
    db_path = get_project_db(name)

    async def generate():
        head = {"version": "1.1", "blackwire_version": "1.0.0", "project_name": name,
                "exported_at": datetime.now().isoformat(), "config": config}
        yield json.dumps(head)[:-1] + ', "data": {'   # abre el objeto, deja "data" abierto
        stats = {}
        async with aiosqlite.connect(db_path) as db:
            for ti, (key, query, mapper) in enumerate(_EXPORT_TABLES):
                yield ('' if ti == 0 else ', ') + json.dumps(key) + ': ['
                count = 0
                async with db.execute(query) as cur:
                    async for row in cur:   # una fila a la vez, sin fetchall()
                        yield ('' if count == 0 else ',') + json.dumps(mapper(row))
                        count += 1
                yield ']'
                stats['total_' + key] = count
        yield '}, "stats": ' + json.dumps(stats) + '}'

    filename = f"blackwire-{name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    return StreamingResponse(
        generate(),
        media_type='application/json',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

def _burp_item_xml(row) -> str:
    """Construye un <item> de Burp XML a partir de una fila de requests."""
    import base64
    from urllib.parse import urlparse
    req_id, method, url, headers, body, resp_status, resp_headers, resp_body, timestamp = row

    try:
        parsed = urlparse(url)
        protocol = parsed.scheme or "http"
        host = parsed.netloc.split(':')[0] if parsed.netloc else "unknown"
        port = parsed.port or (443 if protocol == "https" else 80)
        path = parsed.path + ("?" + parsed.query if parsed.query else "")
        extension = path.split('.')[-1] if '.' in path.split('/')[-1] else "null"
    except Exception:
        protocol, host, port, path, extension = "http", "unknown", 80, "/", "null"

    request_text = f"{method} {path} HTTP/1.1\r\n"
    if headers:
        try:
            headers_dict = json.loads(headers) if isinstance(headers, str) else headers
            for k, v in headers_dict.items():
                request_text += f"{k}: {v}\r\n"
        except Exception:
            pass
    request_text += "\r\n"
    if body:
        request_text += body

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
            except Exception:
                pass
        response_text += "\r\n"
        if resp_body:
            response_text += resp_body
            resp_length = len(resp_body)

    request_b64 = base64.b64encode(request_text.encode('utf-8', errors='replace')).decode('ascii')
    response_b64 = base64.b64encode(response_text.encode('utf-8', errors='replace')).decode('ascii') if response_text else ""
    time_str = timestamp if timestamp else datetime.now().isoformat()

    return f"""  <item>
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
  </item>
"""


_BURP_DTD = """<?xml version="1.0"?>
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
"""


@router.get("/api/projects/{name}/export-burp")
async def export_project_burp(name: str):
    """Export Burp XML en streaming: emite el DTD y luego cada <item> fila por fila,
    sin acumular toda la lista en memoria (antes hacía fetchall() + join)."""
    from fastapi.responses import StreamingResponse
    if not get_project_path(name).exists():
        raise HTTPException(status_code=404, detail="Project not found")

    db_path = get_project_db(name)
    burp_version = "Blackwire-1.0.0"
    export_time = datetime.now().strftime("%a %b %d %H:%M:%S %Z %Y")

    async def generate():
        yield _BURP_DTD
        yield f'<items burpVersion="{burp_version}" exportTime="{export_time}">\n'
        async with aiosqlite.connect(db_path) as db:
            async with db.execute(
                "SELECT id, method, url, headers, body, response_status, "
                "response_headers, response_body, timestamp FROM requests ORDER BY id ASC"
            ) as cur:
                async for row in cur:
                    yield _burp_item_xml(row)
        yield "</items>\n"

    filename = f"burp-{name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.xml"
    return StreamingResponse(
        generate(),
        media_type='application/xml',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@router.post("/api/projects/{name}/import-burp")
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

@router.post("/api/projects/import")
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

    # Inicializar Git
    git = GitManager(project_name)
    await git.init_repo()

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

        # Importar collections (con description) y mapear IDs
        collection_id_map = {}
        for coll in data["data"].get("collections", []):
            cursor = await db.execute("""
                INSERT INTO collections (name, description, created_at) VALUES (?, ?, ?)
            """, (coll["name"], coll.get("description", ""), coll["created_at"]))
            new_id = cursor.lastrowid
            old_id = coll.get("id")
            if old_id is not None:
                collection_id_map[old_id] = new_id

        # Importar collection items (estructura correcta) usando el mapeo de IDs
        for item in data["data"].get("collection_items", []):
            old_coll_id = item["collection_id"]
            new_coll_id = collection_id_map.get(old_coll_id, old_coll_id)
            await db.execute("""
                INSERT INTO collection_items (collection_id, position, method, url, headers, body, var_extracts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (new_coll_id, item["position"], item["method"], item["url"],
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

@router.post("/api/projects/{name}/import")
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

        # Importar collections y mapear IDs
        collection_id_map = {}
        for coll in data["data"].get("collections", []):
            cursor = await db.execute("""
                INSERT INTO collections (name, description, created_at) VALUES (?, ?, ?)
            """, (coll["name"], coll.get("description", ""), coll["created_at"]))
            new_id = cursor.lastrowid
            old_id = coll.get("id")
            if old_id is not None:
                collection_id_map[old_id] = new_id

        # Importar collection items usando el mapeo de IDs
        for item in data["data"].get("collection_items", []):
            old_coll_id = item["collection_id"]
            new_coll_id = collection_id_map.get(old_coll_id, old_coll_id)
            await db.execute("""
                INSERT INTO collection_items (collection_id, position, method, url, headers, body, var_extracts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (new_coll_id, item["position"], item["method"], item["url"],
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


@router.get("/api/export")
async def export_data():
    """Export ligero (legacy): requests guardados + repeater del proyecto actual."""
    project = get_current_project()
    if not project:
        raise HTTPException(status_code=400)
    async with await get_db() as db:
        cursor = await db.execute("SELECT * FROM requests WHERE saved = 1")
        saved = await cursor.fetchall()
        cursor = await db.execute("SELECT * FROM repeater")
        repeater = await cursor.fetchall()
    return {"project": project, "exported_at": datetime.now().isoformat(), "saved_requests": saved, "repeater": repeater}
