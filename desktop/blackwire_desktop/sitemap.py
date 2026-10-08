"""Construcción del árbol de Site Map en el cliente (Fase 2).

El backend no expone endpoint de Site Map: la UI web arma el árbol en el navegador
a partir de los resultados de búsqueda (`frontend/src/utils/sitemap.js`). Aquí se
replica esa lógica: agrupar por origin (esquema+host+puerto) y por segmentos de
path. Cada nodo acumula sus requests, métodos y conteo.
"""

from __future__ import annotations

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
