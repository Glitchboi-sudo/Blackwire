#!/usr/bin/env bash
# Parches aplicados SOLO al empaquetar la app de escritorio (no al repo de dev).
# Se ejecutan sobre el workspace efímero de CI antes de construir la imagen Docker.
# Idempotente: re-ejecutarlo no duplica cambios.
#
# 1. Fix de dropdowns (select/option) en WebKitGTK (Tauri en Linux): los popups
#    usan colores del sistema GTK y quedan invisibles en temas oscuros.
# 2. Vendoriza React: la app deja de cargar scripts desde unpkg.com (riesgo de
#    cadena de suministro / MITM). El Dockerfile copia los UMD a frontend/vendor/
#    y routes/vendor.py los sirve en /static/vendor/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[patches] root: $ROOT"

# --- 1. Dropdown CSS fix en App.jsx -------------------------------------------
python3 - <<'PY'
path = 'frontend/App.jsx'
src = open(path, encoding='utf-8').read()
CSS_FIX = (
    '.sel,.mth-sel{-webkit-appearance:none;appearance:none;'
    'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 10 6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%23888888\'/%3E%3C/svg%3E");'
    'background-repeat:no-repeat;background-position:right 8px center;background-size:8px 5px;padding-right:24px}\n'
    'select option{background:var(--bg3);color:var(--txt)}'
)
ANCHOR = '.int-pos-tag{display:inline-flex'
marker = CSS_FIX.split('\n')[0]
if marker not in src:
    if ANCHOR not in src:
        raise SystemExit('[patches] ERROR: dropdown CSS anchor not found in App.jsx')
    src = src.replace(ANCHOR, CSS_FIX + '\n' + ANCHOR, 1)
    open(path, 'w', encoding='utf-8').write(src)
    print('[patches] App.jsx: dropdown CSS fix applied')
else:
    print('[patches] App.jsx: already patched')
PY

# --- 2a. Reemplazar React de CDN por vendor local en frontend.html ------------
sed -i \
    's|<script src="https://unpkg.com/react@18/umd/react.development.js"></script>|<script src="/static/vendor/react.js"></script>|' \
    backend/frontend.html
sed -i \
    's|<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>|<script src="/static/vendor/react-dom.js"></script>|' \
    backend/frontend.html
echo "[patches] backend/frontend.html: React vendorizado"

# --- 2b. Router que sirve los archivos vendorizados ---------------------------
cat > backend/routes/vendor.py <<'VENDOR_EOF'
#!/usr/bin/env python3
"""Sirve los bundles de React vendorizados (solo build de escritorio).

Evita cargar código desde unpkg.com/CDN. Los archivos los coloca el Dockerfile
en frontend/vendor/. Generado por packaging/apply-patches.sh.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

_VENDOR_DIR = Path(__file__).parent.parent.parent / "frontend" / "vendor"


@router.get("/static/vendor/{filename}")
async def serve_vendor(filename: str):
    path = _VENDOR_DIR / filename
    if path.exists() and path.suffix == ".js":
        return FileResponse(path, media_type="text/javascript",
                            headers={"Cache-Control": "max-age=86400"})
    raise HTTPException(status_code=404)
VENDOR_EOF
echo "[patches] backend/routes/vendor.py: creado"

# --- 2c. Conectar el vendor_router en main.py (idempotente) -------------------
python3 - <<'PY'
path = 'backend/main.py'
src = open(path, encoding='utf-8').read()
if 'from routes.vendor' in src:
    print('[patches] main.py: already patched')
else:
    imp_anchor = 'from routes.bypass import router as bypass_router, init_bypass_routes'
    app_anchor = 'app = FastAPI(title="Blackwire API", lifespan=lifespan)'
    if imp_anchor not in src or app_anchor not in src:
        raise SystemExit('[patches] ERROR: main.py anchors not found')
    src = src.replace(imp_anchor,
                      imp_anchor + '\nfrom routes.vendor import router as vendor_router', 1)
    src = src.replace(app_anchor,
                      app_anchor + '\napp.include_router(vendor_router)', 1)
    open(path, 'w', encoding='utf-8').write(src)
    print('[patches] main.py: vendor_router registrado')
PY

echo "[patches] OK"
