"""Decode/encode de JWT en cliente (Fase 5).

No hay endpoint de backend para JWT: se hace local (puerto de
`frontend/src/utils/encoding.js:18-55`). NO se firma ni verifica criptográficamente
— la firma se trata como texto opaco, igual que la web.
"""

from __future__ import annotations

import base64
import json
from typing import Any


def base64url_decode(data: str) -> str:
    """Decodifica base64url (con padding tolerante). '' si falla."""
    s = data.replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    try:
        return base64.b64decode(s).decode("utf-8", errors="replace")
    except (ValueError, TypeError):
        return ""


def base64url_encode(text: str) -> str:
    """Codifica a base64url sin padding."""
    raw = base64.b64encode(text.encode("utf-8")).decode("ascii")
    return raw.replace("+", "-").replace("/", "_").replace("=", "")


def decode_jwt(token: str) -> dict[str, Any] | None:
    """token 'h.p.s' -> {header, payload, signature} o None si es inválido."""
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        return {
            "header": json.loads(base64url_decode(parts[0])),
            "payload": json.loads(base64url_decode(parts[1])),
            "signature": parts[2],
        }
    except (ValueError, TypeError):
        return None


def encode_jwt(header: Any, payload: Any, signature: str = "") -> str:
    """Reensambla un JWT desde header/payload (objetos) + firma (texto). '' si falla."""
    try:
        h = base64url_encode(json.dumps(header, separators=(",", ":")))
        p = base64url_encode(json.dumps(payload, separators=(",", ":")))
        return f"{h}.{p}.{signature or ''}"
    except (ValueError, TypeError):
        return ""
