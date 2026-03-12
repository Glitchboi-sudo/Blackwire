# CLAUDE.md — Blackwire

### Regla principal
**Minimizar toques a `App.jsx` y `main.py`.** Ambos tienen >4000 líneas. Cada modificación directa es riesgo de romper algo y conflicto de merge.

### Estrategia de expansión
Antes de modificar `App.jsx` o `main.py`, evaluar en este orden:

1. **¿Es lógica de proxy/HTTP?** → Extensión en `backend/extensions/`
2. **¿Es un endpoint nuevo de API?** → Crear `backend/routers/{feature}.py` e importar en main.py con una sola línea (`app.include_router(...)`)
3. **¿Es un componente UI nuevo?** → Crear `frontend/components/{Feature}.jsx`, importar en App.jsx con una sola línea
4. **¿Es utilidad/helper reutilizable?** → Crear `backend/utils/{util}.py` o `frontend/utils/{util}.js`
5. **Solo si no hay alternativa** → Modificar App.jsx o main.py directamente, con el mínimo diff posible

### Estructura objetivo de expansión
```
backend/
├── routers/          # APIRouters de FastAPI por feature
│   └── {feature}.py  # Router autocontenido
├── utils/            # Helpers reutilizables
└── extensions/       # Ya existe

frontend/
├── components/       # Componentes React extraídos
│   └── {Feature}.jsx # Autocontenido con su lógica
└── utils/            # Helpers JS reutilizables
```

### Al crear archivos nuevos
- El archivo debe ser **reutilizable** — si solo sirve para un uso puntual, no merece archivo propio.
- **Nada de archivos `_temp`, `_test`, `_draft`, `notas`, `TODO`** — el repo es público.
- **Nada de archivos `.md` explicativos** sobre qué se hizo o cómo funciona un cambio — eso va en el commit message o en este CLAUDE.md si es convención permanente.
- Los archivos que se creen deben poder vivir en el repo indefinidamente como parte del proyecto.

### Ejemplo de integración limpia
**Mal** — modificar 50 líneas en main.py para agregar endpoints de una feature:
```python
# main.py — 50 líneas nuevas mezcladas
@app.get("/api/nueva-feature/...")
def handler(): ...
```

**Bien** — crear `backend/routers/nueva_feature.py` y una línea en main.py:
```python
# backend/routers/nueva_feature.py — autocontenido
router = APIRouter(prefix="/api/nueva-feature")
@router.get("/...")
def handler(): ...

# main.py — solo esto:
from backend.routers.nueva_feature import router as nueva_feature_router
app.include_router(nueva_feature_router)
```

## Reglas de desarrollo

### Frontend (CRÍTICO)
- El frontend carga en `http://localhost:5000` servido por FastAPI como static files.

### Backend
- FastAPI en `main.py` expone la API REST que consume el frontend.
- `proxy_addon.py` corre dentro del proceso mitmproxy — tiene su propio ciclo de vida.
- Los proyectos son bases de datos SQLite independientes por nombre de proyecto.

### Sistema de extensiones
Tres tipos, en orden de preferencia para nuevas extensiones:
1. **Schema-Driven** (`backend/extensions/*.py`) — solo Python, UI auto-generada desde `EXTENSION_META["ui_schema"]`
2. **Dynamic JSX** (`backend/extensions/*.ui.jsx`) — UI compleja sin recompilar frontend
3. **Custom React** — legacy, evitar

Estructura mínima de una extensión:
```python
EXTENSION_META = {"name": "...", "title": "...", "description": "...", "ui_schema": {...}, "default_config": {...}}
class MyExtension:
    name = "..."
    def on_request(self, flow, cfg, full_config): ...
def register(): return MyExtension()
```

Tras crear/modificar extensión: `./stop.sh && ./start.sh`

## Versión Desktop
Para empaquetar Blackwire como aplicación standalone con Tauri + Docker (instaladores .deb/.dmg/.msi), ver: **[Blackwire-compile](https://github.com/yourusername/Blackwire-compile)**

## Comandos frecuentes
```bash
./install.sh              # Setup inicial (modo desarrollo local)
./launch-with-browser.sh  # Start completo + abrir browser
./stop.sh && ./start.sh   # Reinicio (necesario tras cambios en extensiones/backend)
./compile-frontend.sh     # Compilar el frontend
lsof -i :5000 | kill      # Si el puerto queda ocupado
```

## Convenciones de código
- Python: snake_case, sin type hints estrictos en extensiones (compatibilidad mitmproxy)
- JS/React: componentes funcionales, hooks, sin separar CSS/JS (todo en App.jsx)
- Commits: `feat:`, `fix:`, `refactor:`, `ext:` (para extensiones)

## Contexto de seguridad
- Herramienta de pentesting — los inputs son payloads HTTP arbitrarios, no sanitizar en exceso.
- Las extensiones tienen acceso completo a `mitmproxy.http.HTTPFlow` — pueden leer/modificar request y response.
- SQLite almacena historial completo incluyendo credenciales capturadas — no loggear en consola.

## Lo que NO hacer
- No hardcodear puertos o paths absolutos (el proyecto es 100% portable).
- No editar `App.compiled.js` directamente.
- No mezclar lógica de proxy en `main.py` — eso va en `proxy_addon.py` o extensiones.
- No crear extensiones con dependencias externas sin actualizar `requirements.txt`.

## Estado actual del proyecto
- En desarrollo activo.
- Frontend monolítico en App.jsx — al agregar features, mantener el patrón existente de tabs/componentes inline.
- El sistema de extensiones es el punto de extensibilidad principal — preferir plugins sobre modificar el core.