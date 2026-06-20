#!/usr/bin/env python3
"""
Compilador HTTPQL: AST (dict) → SQL parametrizado.

Módulo puro, sin estado ni dependencias internas. El AST lo produce el parser
del frontend; aquí solo se traduce a SQL para SQLite. El operador `regex` usa
la función SQL `HTTPQL_REGEX`, que se registra en la conexión (ver db.get_db_with_regex).
"""

HTTPQL_FIELD_MAP = {
    ("req", "method"):  "method",
    ("req", "host"):    "SUBSTR(url, INSTR(url, '://') + 3, CASE WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0 THEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1 ELSE LENGTH(SUBSTR(url, INSTR(url, '://') + 3)) END)",
    ("req", "path"):    "CASE WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0 THEN SUBSTR(url, INSTR(url, '://') + 3 + INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1) ELSE '/' END",
    ("req", "port"):    "CAST(CASE WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), ':') > 0 AND INSTR(SUBSTR(url, INSTR(url, '://') + 3), ':') < COALESCE(NULLIF(INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/'), 0), 9999) THEN SUBSTR(SUBSTR(url, INSTR(url, '://') + 3), INSTR(SUBSTR(url, INSTR(url, '://') + 3), ':') + 1, COALESCE(NULLIF(INSTR(SUBSTR(url, INSTR(url, '://') + 3 + INSTR(SUBSTR(url, INSTR(url, '://') + 3), ':')), '/'), 0), 5) - 1) WHEN url LIKE 'https%' THEN '443' ELSE '80' END AS INTEGER)",
    ("req", "ext"):     None,  # caso especial en el compilador
    ("req", "query"):   "CASE WHEN INSTR(url, '?') > 0 THEN SUBSTR(url, INSTR(url, '?') + 1) ELSE '' END",
    ("req", "raw"):     "(COALESCE(headers, '') || ' ' || COALESCE(body, ''))",
    ("req", "len"):     "LENGTH(COALESCE(headers, '') || COALESCE(body, ''))",
    ("req", "tls"):     None,  # caso especial
    ("resp", "code"):   "response_status",
    ("resp", "raw"):    "(COALESCE(response_headers, '') || ' ' || COALESCE(response_body, ''))",
    ("resp", "len"):    "LENGTH(COALESCE(response_headers, '') || COALESCE(response_body, ''))",
}

HTTPQL_NUMERIC = {("req", "len"), ("req", "port"), ("resp", "code"), ("resp", "len")}
HTTPQL_STRING_OPS = {"eq", "ne", "cont", "ncont", "like", "nlike", "regex", "nregex"}
HTTPQL_NUMERIC_OPS = {"eq", "ne", "gt", "gte", "lt", "lte"}


def _compile_comparison(ns: str, field: str, op: str, value: str):
    """Compila una comparación HTTPQL a (fragmento_sql, params)."""
    # Especial: req.tls
    if (ns, field) == ("req", "tls"):
        bval = 1 if value.lower() in ("true", "1", "yes") else 0
        if op == "eq":
            return ("(url LIKE 'https%') = ?", [bval])
        elif op == "ne":
            return ("(url LIKE 'https%') != ?", [bval])
        raise ValueError(f"Operator '{op}' not valid for req.tls")

    # Especial: req.ext
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
    """Compila recursivamente un nodo del AST HTTPQL a (sql, params)."""
    t = node.get("type")
    if t == "comparison":
        return _compile_comparison(node["namespace"], node["field"], node["operator"], node["value"])
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
