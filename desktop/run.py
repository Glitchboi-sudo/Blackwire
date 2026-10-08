#!/usr/bin/env python3
"""Lanzador de la GUI nativa de Blackwire.

Uso:
    python desktop/run.py              # abre la ventana (requiere display)
    python desktop/run.py --selftest   # smoke test headless contra el backend
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from blackwire_desktop.main import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
