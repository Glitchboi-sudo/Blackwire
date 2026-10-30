# PyInstaller spec — app de escritorio NATIVA de Blackwire (PySide6).
#
# Empaqueta la GUI del host (`desktop/run.py` + paquete `blackwire_desktop`) y el
# servidor MCP (`mcp_server`, accesible con `blackwire-desktop --mcp`). El backend
# NO se empaqueta aquí: corre en Docker y la GUI gestiona el contenedor
# (`docker_runtime.py`). El empaquetado de CI coloca, JUNTO AL EJECUTABLE,
# `docker-compose.yml` y `blackwire-image.tar.gz` (el tarball de la imagen), que
# `docker_runtime._resource_dir()` resuelve primero via `Path(sys.executable).parent`.
#
# Build:   pyinstaller packaging/blackwire-desktop.spec
# Salida:  dist/blackwire-desktop/  (onedir; el ejecutable es `blackwire-desktop`)

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

SPEC_DIR = Path(SPECPATH).resolve()          # .../Blackwire/packaging
REPO = SPEC_DIR.parent                        # .../Blackwire
DESKTOP = REPO / "desktop"

# --- datos empaquetados ---------------------------------------------------- #
# Iconos SVG temáticos que `widgets/icons.py` lee de blackwire_desktop/assets/icons.
datas = [
    (str(DESKTOP / "blackwire_desktop" / "assets"), "blackwire_desktop/assets"),
]
binaries = []
hiddenimports = []

# El SDK `mcp` y su stack HTTP cargan submódulos dinámicamente → recolectar todo.
for pkg in ("mcp", "httpx", "httpcore", "anyio", "h11", "sniffio", "certifi"):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        pass

# Asegurar que todos los módulos de ambos paquetes propios entren aunque el
# análisis estático no los alcance (p.ej. imports perezosos / por nombre).
hiddenimports += collect_submodules("blackwire_desktop")
hiddenimports += collect_submodules("mcp_server")

block_cipher = None

a = Analysis(
    [str(DESKTOP / "run.py")],
    pathex=[str(DESKTOP), str(REPO)],   # blackwire_desktop + mcp_server importables
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "tkinter",
        # Un solo binding Qt: la GUI usa PySide6; excluir los demás evita el error
        # "multiple Qt bindings" cuando el entorno de build también tiene PyQt.
        "PyQt5", "PyQt6", "PySide2",
        "PySide6.QtQml", "PySide6.QtQuick", "PySide6.Qt3DCore",
        # El backend (mitmproxy/uvicorn/fastapi) va en Docker, no en la GUI.
        "mitmproxy", "uvicorn", "fastapi",
    ],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# GUI windowed. OJO Windows: un exe windowed no tiene stdio, así que `--mcp`
# (transporte stdio) funciona en Linux/macOS pero es limitado en Windows; allí
# conviene un build de consola aparte para MCP (pendiente si hace falta).
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="blackwire-desktop",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="blackwire-desktop",
)

# macOS: envolver el onedir en un .app para poder generar un .dmg. El empaquetado
# de CI coloca docker-compose.yml + blackwire-image.tar.gz en Contents/Resources/,
# donde docker_runtime._resource_dir() los resuelve.
if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="Blackwire.app",
        icon=None,
        bundle_identifier="com.blackwire.app",
        info_plist={
            "CFBundleName": "Blackwire",
            "CFBundleDisplayName": "Blackwire",
            "CFBundleShortVersionString": "2.1.0",
            "CFBundleVersion": "2.1.0",
            "NSHighResolutionCapable": True,
        },
    )
