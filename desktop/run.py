#!/usr/bin/env python3
"""Lanzador de la GUI nativa de Blackwire.

Uso:
    python desktop/run.py              # abre la ventana (requiere display)
    python desktop/run.py --selftest   # smoke test headless contra el backend
"""

import faulthandler
import os
import sys

faulthandler.enable()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Repo root (parent of desktop/) para que `mcp_server` sea importable en modo --mcp.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)


def _run_mcp() -> int:
    """Lanza el servidor MCP (stdio) desde este mismo binario.

    Permite que un cliente de IA arranque el MCP del build empaquetado sin un
    venv: `blackwire-desktop --mcp`. En desarrollo equivale a
    `python -m mcp_server.server`.
    """
    from mcp_server.server import main as mcp_main
    mcp_main()
    return 0


if __name__ == "__main__":
    if "--mcp" in sys.argv:
        raise SystemExit(_run_mcp())
    from blackwire_desktop.main import main  # noqa: E402
    raise SystemExit(main())
