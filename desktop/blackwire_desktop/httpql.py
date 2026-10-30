"""Parser de HTTPQL para la GUI nativa (Fase 2).

Puerto 1:1 de `frontend/src/utils/parsing.js` (`httpqlTokenize` + `httpqlParse`).
El backend (`POST /api/requests/search`) espera tanto el `query` crudo como su
`ast`; este módulo produce ese AST con exactamente la misma forma de nodos para
que el backend lo interprete igual que desde la UI web.

Nodos del AST:
    {"type": "and",  "children": [...]}
    {"type": "or",   "children": [...]}
    {"type": "comparison", "namespace": "req|resp", "field", "operator", "value"}
    {"type": "shorthand", "value": <str>}   (cadena entre comillas suelta)
    {"type": "preset", "name": <str>}
"""

from __future__ import annotations

import re
from typing import Any

HTTPQL_REQ_FIELDS = ["method", "host", "path", "port", "ext", "query", "raw", "len", "tls"]
HTTPQL_RESP_FIELDS = ["code", "raw", "len"]
HTTPQL_STR_OPS = ["eq", "ne", "cont", "ncont", "like", "nlike", "regex", "nregex"]
HTTPQL_NUM_OPS = ["eq", "ne", "gt", "gte", "lt", "lte"]
HTTPQL_BOOL_OPS = ["eq", "ne"]
# Unión de todos los operadores, para reconocer la forma natural `ns.field OP value`.
HTTPQL_ALL_OPS = set(HTTPQL_STR_OPS) | set(HTTPQL_NUM_OPS) | set(HTTPQL_BOOL_OPS)

_WORD_RE = re.compile(r"[a-zA-Z0-9_.%*?\-/&+=@:]+")


class HttpqlError(ValueError):
    """Error de sintaxis HTTPQL, con posición cuando se conoce."""


def httpql_tokenize(input_str: str) -> tuple[list[dict[str, Any]], str | None]:
    """Tokeniza la consulta. Devuelve (tokens, error)."""
    tokens: list[dict[str, Any]] = []
    i = 0
    n = len(input_str)
    while i < n:
        ch = input_str[i]
        if ch.isspace():
            i += 1
            continue
        if ch == "(":
            tokens.append({"type": "LPAREN", "pos": i})
            i += 1
            continue
        if ch == ")":
            tokens.append({"type": "RPAREN", "pos": i})
            i += 1
            continue
        if ch == ":":
            tokens.append({"type": "COLON", "pos": i})
            i += 1
            continue
        if ch == '"':
            s = ""
            j = i + 1
            esc = False
            while j < n:
                c = input_str[j]
                if esc:
                    s += c
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == '"':
                    break
                else:
                    s += c
                j += 1
            if j >= n:
                return tokens, f"Unterminated string at position {i}"
            tokens.append({"type": "STRING", "value": s, "pos": i})
            i = j + 1
            continue
        m = _WORD_RE.match(input_str, i)
        if m:
            w = m.group(0)
            colon_idx = w.find(":")
            if colon_idx > 0:
                word = w[:colon_idx]
                tokens.append({"type": "IDENT", "value": word, "pos": i})
                i += colon_idx
                continue
            upper = w.upper()
            if upper == "AND":
                tokens.append({"type": "AND", "pos": i})
            elif upper == "OR":
                tokens.append({"type": "OR", "pos": i})
            else:
                tokens.append({"type": "IDENT", "value": w, "pos": i})
            i += len(w)
            continue
        return tokens, f"Unexpected character '{ch}' at position {i}"
    tokens.append({"type": "EOF", "pos": i})
    return tokens, None


def httpql_parse(input_str: str) -> tuple[dict[str, Any] | None, str | None]:
    """Parsea la consulta a AST. Devuelve (ast, error). AST None si vacío/erróneo."""
    text = input_str.strip()
    if not text:
        return None, None
    tokens, tok_err = httpql_tokenize(text)
    if tok_err:
        return None, tok_err

    state = {"pos": 0}

    def peek() -> dict[str, Any]:
        return tokens[state["pos"]] if state["pos"] < len(tokens) else {"type": "EOF"}

    def advance() -> dict[str, Any]:
        tok = tokens[state["pos"]]
        state["pos"] += 1
        return tok

    def parse_or() -> dict[str, Any]:
        left = parse_and()
        while peek()["type"] == "OR":
            advance()
            right = parse_and()
            if left.get("type") == "or":
                left["children"].append(right)
            else:
                left = {"type": "or", "children": [left, right]}
        return left

    def merge_and(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
        if left.get("type") == "and":
            left["children"].append(right)
            return left
        return {"type": "and", "children": [left, right]}

    def parse_and() -> dict[str, Any]:
        left = parse_atom()
        while True:
            p = peek()
            if p["type"] == "AND":
                advance()
                left = merge_and(left, parse_atom())
                continue
            if p["type"] in ("IDENT", "STRING", "LPAREN"):
                left = merge_and(left, parse_atom())
                continue
            break
        return left

    def parse_value() -> str:
        tok = peek()
        if tok["type"] in ("STRING", "IDENT"):
            advance()
            return tok["value"]
        raise HttpqlError(f"Expected value at position {tok.get('pos')}")

    def parse_atom() -> dict[str, Any]:
        tok = peek()
        if tok["type"] == "LPAREN":
            advance()
            expr = parse_or()
            if peek()["type"] != "RPAREN":
                raise HttpqlError(f"Expected ) at position {peek().get('pos')}")
            advance()
            return expr
        if tok["type"] == "STRING":
            advance()
            return {"type": "shorthand", "value": tok["value"]}
        if tok["type"] == "IDENT":
            ident = tok["value"]
            advance()
            if ident == "preset" and peek()["type"] == "COLON":
                advance()
                return {"type": "preset", "name": parse_value()}
            # Dos formas equivalentes de comparación:
            #   - Caido:   `ns.field.op:value`   -> IDENT de 3 partes + ':'  + valor
            #   - natural: `ns.field op value`    -> IDENT de 2 partes + op (IDENT) + valor
            # El operador puede ir en mayúsculas y el valor tras ':' o un espacio.
            parts = ident.split(".")
            if len(parts) == 3:
                ns, field, op = parts
                op = op.lower()
            elif len(parts) == 2:
                nxt = peek()
                op_word = (nxt.get("value") or "").lower() if nxt["type"] == "IDENT" else ""
                if op_word not in HTTPQL_ALL_OPS:
                    raise HttpqlError(
                        f'Expected an operator (eq, ne, cont, gt…) after "{ident}" '
                        f"at position {nxt.get('pos')}"
                    )
                ns, field = parts
                op = op_word
                advance()  # consume el operador
            else:
                raise HttpqlError(
                    f"Expected namespace.field.operator at position {tok['pos']}, "
                    f'got "{ident}"'
                )
            if ns not in ("req", "resp"):
                raise HttpqlError(f'Unknown namespace "{ns}" at position {tok["pos"]}')
            valid_fields = HTTPQL_REQ_FIELDS if ns == "req" else HTTPQL_RESP_FIELDS
            if field not in valid_fields:
                raise HttpqlError(
                    f'Unknown field "{ns}.{field}" at position {tok["pos"]}'
                )
            is_num = field in ("port", "len", "code")
            is_bool = field == "tls"
            valid_ops = (
                HTTPQL_BOOL_OPS if is_bool else HTTPQL_NUM_OPS if is_num else HTTPQL_STR_OPS
            )
            if op not in valid_ops:
                raise HttpqlError(f'Operator "{op}" not valid for {ns}.{field}')
            # El valor va tras ':' (forma Caido) o separado por un espacio (natural).
            if peek()["type"] == "COLON":
                advance()
            return {
                "type": "comparison", "namespace": ns, "field": field,
                "operator": op, "value": parse_value(),
            }
        raise HttpqlError(f"Unexpected token at position {tok.get('pos')}")

    try:
        ast = parse_or()
        if peek()["type"] != "EOF":
            raise HttpqlError(f"Unexpected input at position {peek().get('pos')}")
        return ast, None
    except HttpqlError as exc:
        return None, str(exc)
