"""Lógica del Intruder para la GUI nativa (Fase 4).

Puertos 1:1 de la implementación web (toda la ejecución del ataque es en cliente;
el backend solo persiste ataques):
- `parse_positions`  <- `frontend/src/utils/parsing.js:parseIntPositions`
- `generate_payload_list` <- `generators.js:generatePayloadList`
- `generate_attack_combinations` <- `generators.js:generateAttackCombinations`
- `build_int_request` <- `request-utils.js:buildIntRequest`

Marcador de posición de payload: `§...§` (U+00A7). Tipos de ataque:
`targeted` (por defecto, "sniper": una posición a la vez), `broadcast` (mismo
payload en todas), `parallel` (zip), `matrix` (producto cartesiano).
"""

from __future__ import annotations

import base64
import re
from typing import Any
from urllib.parse import quote

MARKER = "§"
_MARKER_RE = re.compile(r"§([^§]*)§")

ATTACK_TYPES = ("targeted", "broadcast", "parallel", "matrix")

# Caps de seguridad (igual que la web).
_BRUTE_CAP = 500_000
_MATRIX_CAP = 1_000_000


def parse_positions(url: str, headers: str, body: str) -> list[dict[str, Any]]:
    """Detecta marcadores `§name§` en url/headers/body. Posiciones indexadas."""
    positions: list[dict[str, Any]] = []
    counter = {"idx": 0}

    def scan(text: str, section: str) -> None:
        for m in _MARKER_RE.finditer(text or ""):
            idx = counter["idx"]
            counter["idx"] += 1
            name = m.group(1) or f"pos{idx + 1}"
            positions.append({
                "idx": idx, "name": name, "section": section,
                "start": m.start(), "end": m.end(),
            })

    scan(url, "url")
    scan(headers, "headers")
    scan(body, "body")
    return positions


def _encode_uri_component(value: str) -> str:
    """Equivalente a JS encodeURIComponent (no codifica -_.!~*'())."""
    return quote(value, safe="-_.!~*'()")


def generate_payload_list(cfg: dict[str, Any]) -> list[str]:
    """Genera un conjunto de payloads desde su config (list/numbers/bruteforce)."""
    cfg = cfg or {}
    ptype = cfg.get("type", "list")
    items: list[str] = []

    if ptype == "list":
        items = [line for line in (cfg.get("items", "") or "").split("\n") if line]
    elif ptype == "numbers":
        frm = int(cfg.get("from", 0) or 0)
        to = int(cfg.get("to", 0) or 0)
        step = max(1, int(cfg.get("step", 1) or 1))
        pad = int(cfg.get("padLen", 0) or 0)
        n = frm
        while n <= to:
            s = str(n)
            if pad > 0:
                s = s.rjust(pad, "0")
            items.append(s)
            n += step
    elif ptype == "bruteforce":
        chars = list(cfg.get("charset", "a") or "a")
        min_l = max(1, int(cfg.get("minLen", 1) or 1))
        max_l = min(8, int(cfg.get("maxLen", 3) or 3))

        def gen(prefix: str, length: int) -> None:
            if len(items) >= _BRUTE_CAP:
                return
            if len(prefix) == length:
                items.append(prefix)
                return
            for c in chars:
                gen(prefix + c, length)

        for length in range(min_l, max_l + 1):
            gen("", length)
        if len(items) > _BRUTE_CAP:
            items = items[:_BRUTE_CAP]

    # Procesamiento (prefijo/sufijo/url-encode/base64).
    prefix = cfg.get("prefix", "")
    suffix = cfg.get("suffix", "")
    url_encode = cfg.get("urlEncode", False)
    b64 = cfg.get("base64", False)
    processed = []
    for v in items:
        if prefix:
            v = prefix + v
        if suffix:
            v = v + suffix
        if url_encode:
            v = _encode_uri_component(v)
        if b64:
            v = base64.b64encode(v.encode("utf-8")).decode("ascii")
        processed.append(v)
    return processed


def generate_attack_combinations(
    url: str,
    headers: str,
    body: str,
    method: str,
    attack_type: str,
    payloads: dict[int, dict[str, Any]] | list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Genera las combinaciones de payloads según el tipo de ataque.

    Cada combo: {"payloads": {idx: valor|None}, "label": str}."""
    positions = parse_positions(url, headers, body)
    if not positions:
        return []

    def payload_cfg(i: int) -> dict[str, Any]:
        if isinstance(payloads, dict):
            return payloads.get(i) or {"type": "list", "items": ""}
        return payloads[i] if i < len(payloads) else {"type": "list", "items": ""}

    sets = [generate_payload_list(payload_cfg(i)) for i in range(len(positions))]
    combos: list[dict[str, Any]] = []

    if attack_type == "broadcast":
        for val in (sets[0] if sets else []):
            combos.append({"payloads": {i: val for i in range(len(positions))},
                           "label": val})
    elif attack_type == "parallel":
        min_len = min((len(s) for s in sets), default=0)
        for j in range(min_len):
            combo_vals = {i: sets[i][j] for i in range(len(positions))}
            combos.append({"payloads": combo_vals,
                           "label": " | ".join(sets[i][j] for i in range(len(positions)))})
    elif attack_type == "matrix":
        def cart(arr: list[list[str]]) -> list[list[str]]:
            if not arr:
                return [[]]
            first, rest = arr[0], arr[1:]
            rest_combos = cart(rest)
            out = []
            for v in first:
                for rc in rest_combos:
                    out.append([v, *rc])
                    if len(out) >= _MATRIX_CAP:
                        return out
            return out

        for combo in cart(sets):
            combos.append({"payloads": {i: combo[i] for i in range(len(positions))},
                           "label": " | ".join(combo)})
            if len(combos) >= _MATRIX_CAP:
                break
    else:  # targeted (default / sniper): una posición a la vez, resto = None
        for pi in range(len(positions)):
            for val in sets[pi]:
                combos.append({
                    "payloads": {i: (val if i == pi else None)
                                 for i in range(len(positions))},
                    "label": val,
                })
    return combos


def _replace_markers(text: str, combo_payloads: dict[int, Any], counter: dict) -> str:
    """Sustituye cada `§...§` por el payload de su índice (None/ausente -> '')."""
    def repl(_m: re.Match) -> str:
        val = combo_payloads.get(counter["idx"])
        counter["idx"] += 1
        return val if val is not None else ""

    return _MARKER_RE.sub(repl, text or "")


def build_int_request(
    combo: dict[str, Any], url: str, headers: str, body: str, method: str
) -> dict[str, Any]:
    """Aplica un combo a la plantilla -> {method, url, headers(dict), body}."""
    counter = {"idx": 0}
    payloads = combo.get("payloads", {})
    out_url = _replace_markers(url, payloads, counter)
    headers_text = _replace_markers(headers, payloads, counter)
    out_body = _replace_markers(body, payloads, counter)

    h: dict[str, str] = {}
    for line in headers_text.split("\n"):
        key, sep, rest = line.partition(":")
        if key.strip() and sep:
            h[key.strip()] = rest.strip()

    # Content-Length automático.
    if out_body:
        length = str(len(out_body.encode("utf-8")))
        cl_key = next((k for k in h if k.lower() == "content-length"), None)
        h[cl_key or "Content-Length"] = length
    else:
        cl_key = next((k for k in h if k.lower() == "content-length"), None)
        if cl_key:
            del h[cl_key]

    return {"method": method, "url": out_url, "headers": h, "body": out_body or None}
