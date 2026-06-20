#!/usr/bin/env python3
"""
Router de renderizado y descarga de requests/responses.

Endpoints para renderizar una respuesta en el navegador, generar una página de
replay y descargar bodies. Depende solo de `get_db` (inyectado desde main.py).
"""

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response

router = APIRouter()

get_db_func = None


def init_rendering_routes(get_db):
    global get_db_func
    get_db_func = get_db


@router.get("/api/requests/{rid}/render")
async def render_response(rid: int):
    async with await get_db_func() as db:
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
            except Exception:
                pass
        return Response(
            content=body.encode('utf-8') if isinstance(body, str) else body,
            media_type=content_type
        )


@router.get("/api/requests/{rid}/replay")
async def replay_request(rid: int):
    async with await get_db_func() as db:
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


@router.get("/api/requests/{rid}/download-body")
async def download_request_body(rid: int):
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT body, url FROM requests WHERE id = ?", (rid,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")

        body, url = row
        if not body:
            raise HTTPException(status_code=404, detail="No body in this request")

        # Determinar la extensión del archivo según el contenido.
        filename = f"request_{rid}_body.txt"
        try:
            json.loads(body)
            filename = f"request_{rid}_body.json"
        except Exception:
            pass

        return Response(
            content=body.encode('utf-8') if isinstance(body, str) else body,
            media_type='application/octet-stream',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )


@router.get("/api/requests/{rid}/download-response-body")
async def download_response_body(rid: int):
    async with await get_db_func() as db:
        cursor = await db.execute("SELECT response_body, response_headers FROM requests WHERE id = ?", (rid,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")

        body, headers_json = row
        if not body:
            raise HTTPException(status_code=404, detail="No response body in this request")

        # Determinar la extensión del archivo según el contenido / Content-Type.
        filename = f"response_{rid}_body.txt"
        try:
            json.loads(body)
            filename = f"response_{rid}_body.json"
        except Exception:
            try:
                headers = json.loads(headers_json) if headers_json else {}
                ct = headers.get('Content-Type', headers.get('content-type', ''))
                if 'html' in ct.lower():
                    filename = f"response_{rid}_body.html"
                elif 'xml' in ct.lower():
                    filename = f"response_{rid}_body.xml"
                elif 'css' in ct.lower():
                    filename = f"response_{rid}_body.css"
                elif 'javascript' in ct.lower() or 'js' in ct.lower():
                    filename = f"response_{rid}_body.js"
            except Exception:
                pass

        return Response(
            content=body.encode('utf-8') if isinstance(body, str) else body,
            media_type='application/octet-stream',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
