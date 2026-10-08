"""Formato/parseo de un request HTTP crudo editable (Fase 3).

Comparten este helper el editor de Repeater y el de Intercept: representan un
request como texto editable (línea `MÉTODO URL`, headers `K: V`, línea en blanco,
cuerpo) y lo re-parsean a campos estructurados `{method, url, headers, body}` que
el backend espera (headers como dict, nunca cadena cruda).
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit


def _shell_quote(value: str) -> str:
    """Comilla simple segura para una shell POSIX (envuelve y escapa `'`)."""
    return "'" + str(value).replace("'", "'\\''") + "'"


def to_curl(method: str, url: str, headers: dict[str, Any] | None,
            body: str | None) -> str:
    """Genera un comando `curl` equivalente (para copiar al portapapeles)."""
    parts = ["curl", "-X", (method or "GET").upper(), _shell_quote(url or "")]
    for key, value in (headers or {}).items():
        parts.append("-H")
        parts.append(_shell_quote(f"{key}: {value}"))
    if body:
        parts.append("--data-raw")
        parts.append(_shell_quote(body))
    return " ".join(parts)


def to_sqlmap_request(method: str, url: str, headers: dict[str, Any] | None,
                      body: str | None) -> str:
    """Request HTTP crudo apto para `sqlmap -r archivo.txt`.

    A diferencia de `format_raw`, la línea de petición lleva la RUTA (no la URL
    completa) y se garantiza un header `Host`, como exige sqlmap."""
    split = urlsplit(url or "")
    path = split.path or "/"
    if split.query:
        path = f"{path}?{split.query}"
    hdrs = dict(headers or {})
    if not any(k.lower() == "host" for k in hdrs) and split.netloc:
        hdrs = {"Host": split.netloc, **hdrs}
    lines = [f"{(method or 'GET').upper()} {path} HTTP/1.1"]
    lines.extend(f"{k}: {v}" for k, v in hdrs.items())
    lines.append("")
    if body:
        lines.append(str(body))
    return "\n".join(lines)


def format_raw(
    method: str, url: str, headers: dict[str, Any] | None, body: str | None
) -> str:
    """Campos estructurados -> texto crudo editable."""
    lines = [f"{method or ''} {url or ''}".strip()]
    for key, value in (headers or {}).items():
        lines.append(f"{key}: {value}")
    lines.append("")
    if body:
        lines.append(str(body))
    return "\n".join(lines)


def parse_raw(text: str) -> dict[str, Any]:
    """Texto crudo editable -> {method, url, headers, body}. Inverso de format_raw."""
    lines = text.split("\n")
    method = ""
    url = ""
    if lines:
        first = lines.pop(0).strip()
        parts = first.split(" ", 1)
        method = parts[0] if parts else ""
        url = parts[1].strip() if len(parts) > 1 else ""
    headers: dict[str, str] = {}
    while lines:
        line = lines.pop(0)
        if line.strip() == "":
            break
        idx = line.find(":")
        if idx > 0:
            headers[line[:idx].strip()] = line[idx + 1:].strip()
    body = "\n".join(lines)
    return {"method": method, "url": url, "headers": headers, "body": body}
