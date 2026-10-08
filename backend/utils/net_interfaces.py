#!/usr/bin/env python3
"""
Enumeración best-effort de las direcciones locales donde el proxy puede escuchar.

Sólo usa la stdlib para mantener la portabilidad del proyecto (no depende de
psutil). Siempre ofrece las dos opciones canónicas — todas las interfaces y
localhost — y añade la IP LAN principal y las resueltas por hostname cuando se
pueden detectar. La UI permite además escribir una dirección arbitraria, así que
esta lista es una comodidad, no una restricción.
"""

import socket
from typing import List, Dict

# Opciones fijas siempre disponibles.
ALL_INTERFACES = "0.0.0.0"
LOCALHOST = "127.0.0.1"


def _primary_lan_ip() -> str:
    """Devuelve la IP saliente principal, o '' si no se puede detectar.

    Usa un socket UDP "conectado": no se envía ningún paquete, sólo se consulta
    la dirección local que el sistema elegiría para alcanzar una IP externa.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except Exception:
        return ""
    finally:
        sock.close()


def _hostname_ips() -> List[str]:
    """Direcciones IPv4 asociadas al hostname local (best-effort)."""
    try:
        infos = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
        return [info[4][0] for info in infos]
    except Exception:
        return []


def list_interfaces() -> List[Dict[str, str]]:
    """Lista de interfaces disponibles como dicts {label, address}.

    Sin duplicados y con las opciones canónicas primero.
    """
    interfaces: List[Dict[str, str]] = [
        {"label": "All interfaces", "address": ALL_INTERFACES},
        {"label": "Localhost only", "address": LOCALHOST},
    ]

    seen = {ALL_INTERFACES, LOCALHOST}
    primary = _primary_lan_ip()
    if primary and primary not in seen:
        interfaces.append({"label": f"LAN ({primary})", "address": primary})
        seen.add(primary)

    for ip in _hostname_ips():
        if ip and ip not in seen:
            interfaces.append({"label": ip, "address": ip})
            seen.add(ip)

    return interfaces
