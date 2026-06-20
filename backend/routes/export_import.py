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


@router.get("/api/projects/{name}/export")
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
            collections.append({"id": row[0], "name": row[1], "description": row[2], "created_at": row[3]})

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

@router.get("/api/projects/{name}/export-burp")
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
