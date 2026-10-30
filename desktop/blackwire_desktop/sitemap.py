"""Construcción del árbol de Site Map en el cliente (Fase 2).

El backend no expone endpoint de Site Map: la UI web arma el árbol en el navegador
a partir de los resultados de búsqueda (`frontend/src/utils/sitemap.js`). Aquí se
replica esa lógica: agrupar por origin (esquema+host+puerto) y por segmentos de
path. Cada nodo acumula sus requests, métodos y conteo.
"""

from __future__ import annotations

import csv
import io
import json
from collections import Counter
from typing import Any
from urllib.parse import urlsplit

OTHER_ROOT = "(other)"


def _new_node(label: str) -> dict[str, Any]:
    return {"label": label, "children": {}, "reqs": [], "methods": set(), "count": 0}


def _origin(url: str) -> str | None:
    """origin tipo `scheme://host[:port]`, o None si la URL no parsea."""
    try:
        parts = urlsplit(url)
        if not parts.scheme or not parts.netloc:
            return None
        return f"{parts.scheme}://{parts.netloc}"
    except ValueError:
        return None


def build_site_tree(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Agrupa requests en un árbol host -> segmentos de path.

    Devuelve {origin: nodo-raíz}. Cada nodo: {label, children, reqs, methods, count}.
    """
    tree: dict[str, dict[str, Any]] = {}
    for row in rows:
        url = row.get("url", "") or ""
        origin = _origin(url)
        if origin is None:
            root_key = OTHER_ROOT
            segments: list[str] = []
        else:
            root_key = origin
            path = urlsplit(url).path or "/"
            segments = [s for s in path.split("/") if s]

        node = tree.get(root_key)
        if node is None:
            node = _new_node(root_key)
            tree[root_key] = node

        method = row.get("method", "")
        # El request vive en el nodo hoja del path; los ancestros solo cuentan.
        node["count"] += 1
        if method:
            node["methods"].add(method)
        cursor = node
        for seg in segments:
            key = "/" + seg
            child = cursor["children"].get(key)
            if child is None:
                child = _new_node(key)
                cursor["children"][key] = child
            cursor = child
            cursor["count"] += 1
            if method:
                cursor["methods"].add(method)
        cursor["reqs"].append(row)
    return tree


def collect_node_reqs(node: dict[str, Any]) -> list[dict[str, Any]]:
    """Concatena recursivamente los requests de un nodo y sus descendientes."""
    out = list(node.get("reqs", []))
    for child in node.get("children", {}).values():
        out.extend(collect_node_reqs(child))
    return out


def _ext(url: str) -> str:
    """Extensión del último segmento del path (sin punto), o '(none)'."""
    try:
        path = urlsplit(url).path
    except ValueError:
        return "(none)"
    last = path.rsplit("/", 1)[-1]
    if "." in last:
        return last.rsplit(".", 1)[-1].lower()
    return "(none)"


def node_stats(reqs: list[dict[str, Any]]) -> dict[str, Any]:
    """Estadísticas de un nodo: top métodos, status codes y extensiones."""
    methods = Counter(r.get("method", "") for r in reqs if r.get("method"))
    codes = Counter(
        r.get("response_status") for r in reqs if r.get("response_status")
    )
    exts = Counter(_ext(r.get("url", "") or "") for r in reqs)
    return {
        "total": len(reqs),
        "methods": methods.most_common(),
        "codes": codes.most_common(),
        "exts": exts.most_common(),
    }


_EXPORT_FIELDS = ("id", "method", "response_status", "url")


def node_to_json(reqs: list[dict[str, Any]]) -> str:
    """Serializa los requests del nodo (campos livianos) como JSON."""
    rows = [{k: r.get(k) for k in _EXPORT_FIELDS} for r in reqs]
    return json.dumps(rows, indent=2, ensure_ascii=False)


def node_to_csv(reqs: list[dict[str, Any]]) -> str:
    """Serializa los requests del nodo como CSV (id, método, status, url)."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_EXPORT_FIELDS)
    for r in reqs:
        writer.writerow([r.get(k, "") for k in _EXPORT_FIELDS])
    return buf.getvalue()
