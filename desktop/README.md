# Blackwire Desktop (GUI nativa — PySide6)

Reescritura del frontend web a una **app de escritorio nativa** (sin webview).
Ver el plan completo en la memoria del proyecto: `native-rewrite-plan`.

## Organización estilo Burp

El área central es una **barra de herramientas** (pestañas): **Proxy / Repeater /
orden **Scope · Proxy · Collections · Repeater · Intruder · Herramientas**. La
pantalla **Proxy** tiene sub-pestañas estilo Burp: **HTTP history** (un
`QMainWindow` anidado con History + Request/Response y **layout guardable**),
**Intercept** y **WS**. La pestaña **Herramientas** agrupa utilidades en
sub-pestañas: **Sensitive · Session · Match & Replace · Webhook.site · Comparer ·
Decoder**. Import/Export en el
menú **Archivo**. Navegación por el menú `Herramientas` o atajos `Ctrl+Shift+…`.

## Estado: Pulido visual (overhaul de UI) — completo

Overhaul completo del aspecto (enfoque "B"), theme-aware en los 17 temas:
- **QSS global ampliado** (`themes.py`): pestañas con acento inferior en la activa
  (estilo Burp), `QCheckBox`/`QSpinBox`/`QTreeView`/`QToolTip`/`QGroupBox`/
  `QProgressBar` estilados, botones con más padding + variantes `#AccentButton`
  (azul) y `#DangerButton` (rojo), labels con rol (`#SectionTitle`/`#Hint`/
  `#ErrorText`/`#Badge`), estados `:disabled`, scrollbars/splitters pulidos.
- **Sin estilos inline hardcodeados**: se reemplazaron por object-names temáticos
  (se adaptan a tema claro/oscuro).
- **Tarjetas (`QGroupBox`)** envolviendo los formularios de alta en Proyectos,
  Match & Replace, Webhook.site, Bypass y Session; anchos de botón acotados.
- **Acciones primarias en acento** (Enviar, Iniciar ataque, Ejecutar todo, Bake,
  Comparar, Crear URL, Activar/Añadir) y **destructivas en danger** (Eliminar,
  Detener, Limpiar). El badge de proyecto es un "pill".

## Estado: Paridad con la versión web/Tauri — completa

Tras un repaso contra el wiki y la UI web/Tauri, se añadieron las funciones que
faltaban (el resto —Git y el panel genérico de Extensiones— se descartó a pedido):

- **Proyectos** (pestaña al frente + badge de proyecto activo en la barra de estado):
  crear (nombre+descripción), activar (intercambia BD/estado — NO reinicia el proxy),
  eliminar (con confirmación), export JSON / Burp XML e import Burp XML por proyecto,
  y **crear desde archivo** (`POST /api/projects/import`). Al cambiar de proyecto el
  shell recarga todos los datos.
- **Control del proxy** (widget en la barra de estado): indicador dot + `modo:puerto`,
  botón **▶ Start / ■ Stop** (`/api/proxy/start` con **query params**, `/stop`),
  sondeo de estado (`/api/proxy/status`) y **diálogo de config** (puerto, interfaz de
  escucha desde `/api/proxy/interfaces`, modo, args extra), persistido en el
  config.json del proyecto. Cambiar el puerto = Stop/Start (no hay restart en caliente).
- **Acciones de request** (menú contextual del historial): Enviar a Repeater/Intruder,
  Añadir a Collection, Comparar A/B, Copiar URL, **Copiar como cURL**, **Descargar para
  SQLMap** (`rawhttp.to_curl`/`to_sqlmap_request`, cliente), **Render/Replay en
  navegador** (abre el SO), guardar/favorito (`/save`) y eliminar (`DELETE`).
- **Filter Presets** (junto al filtro HTTPQL): guardar/aplicar/eliminar consultas
  (`/api/filter-presets`).
- **Console** (4ª sub-pestaña de Proxy): logs del proxy en vivo (`/api/console/logs`),
  filtro por nivel y texto, auto-scroll, pausa y limpieza. Texto plano (seguro).
- **Proxy Bypass** (sub-pestaña dentro de Scope): reglas `--ignore-hosts` para sitios
  con cert pinning + presets (`/api/bypass/*`). Se aplican al (re)arrancar el proxy.

## Estado: Fase 6 (Match & Replace + Webhook.site como herramientas) — completa

En vez de un panel genérico de "Extensiones" (retirado), las dos extensiones útiles
se integraron como **herramientas nativas propias** dentro de **Herramientas**:

- **Match & Replace**: edita las reglas de la extensión `match_replace` (reescribe
  URL/headers/body en requests/responses dentro de mitmproxy). Tabla de reglas
  `{enabled, when(request/response/both), target(url/headers/body), pattern, replace,
  regex, ignore_case, header}`; cada cambio persiste el **config plano completo**
  `{enabled, rules}` vía `PUT /api/extensions/match_replace` (reemplazo total, sin
  merge). Verificado con round-trip real (regla 0→1 y restaurada).
- **Webhook.site**: crea/regenera el token (`POST /api/webhooksite/token`), muestra
  la URL para copiar, guarda una API key (`/apikey`), sincroniza los requests
  capturados a la BD local (`/refresh`), los lista/inspecciona (`GET /requests`, con
  detalle Request/Headers/Query/Body en **texto plano**) y los limpia (`DELETE`).
  "Enviar al Repeater" clona el request capturado en una pestaña del Repeater. La
  extensión NO toca el proxy: la captura ocurre en los servidores de webhook.site.

## Estado: Fase 5 (resto de herramientas) — completa

- **Collections**: colecciones de requests con pasos; ejecutar un paso o encadenar
  todos pasando `extracted_variables` al siguiente (JSONPath lo resuelve el backend).
- **Decoder**: **Cipher** (recetas Chepy encadenadas vía `/api/chepy/bake`) y **JWT**
  (decode/encode en cliente, sin firmar).
- **Sensitive**: escaneo en cliente (99 patrones + entropía de Shannon) sobre el
  historial, en segundo plano, coloreado por categoría.
- **WebSocket**: conexiones capturadas, frames (up/down), contenido y reenvío.
- **Session**: reglas de extracción por regex a variables.
- **Import/Export** (menú Archivo): export JSON / Burp XML, import Burp XML.

  *(El proyecto se persiste solo en su SQLite; la herramienta Git se retiró.)*

## Estado: Fase 4 (Intruder) — completa

- **Intruder**: plantilla con marcadores **`§name§`** (botón `§ Add §` que marca la
  selección en URL/headers/body — arreglado el bug del selector), tipos de ataque
  **Targeted / Broadcast / Parallel / Matrix**, conjuntos de payloads
  (list/numbers/bruteforce + prefijo/sufijo/URL-encode/base64), ejecución
  **concurrente** (cliente → `send-raw`) con barra de progreso, tabla de resultados
  (#/payload/status/longitud/tiempo/error) y request/response por fila. Guardar y
  cargar ataques (`/api/intruder/attacks`). Verificado con un ataque real headless.

## Estado: Fase 3 (Repeater + Comparer) — completa

- **Repeater**: pestañas múltiples; cada una con editor de request crudo editable,
  envío por el proxy (`POST /api/repeater/send-raw`, verificado 200) y visor de
  respuesta en texto plano. Guardar/cargar/renombrar/cerrar pestañas persistidas
  en `/api/repeater`. "Enviar al Repeater" (Ctrl+R) clona el request seleccionado.
- **Comparer**: diff LCS lado a lado (`diff.py`, puerto de `parsing.js:diffLines`);
  fija A = request actual / B = respuesta actual, o pega texto a mano.

### Flujo del proxy (Fase 2)

Sobre la infraestructura de la Fase 1 añade el flujo del proxy:

- **History con filtro HTTPQL**: barra de consulta que se parsea en el cliente
  (puerto 1:1 de `parsing.js`) a su AST y se envía a `POST /api/requests/search`;
  errores de sintaxis en línea. Filtrado real en servidor (verificado).
- **Site Map**: árbol host → path construido en el cliente desde los resultados.
- **Intercept**: pausar / editar / reenviar o descartar requests, con lista de
  pendientes y editor; reacciona en vivo a los eventos WS de intercept.
- **Scope**: reglas include/exclude que reclasifican el historial; al cambiarlas
  se vuelve a buscar.

### Infraestructura (Fase 1)

- **Docking tipo Burp** (`QMainWindow` + `QDockWidget`): HTTP History arriba,
  Request/Response en el centro, Intercept abajo, Scope a la derecha. Nesting on.
- **17 temas** portados de `frontend/themes.js` a QSS token-driven, conmutables
  **en caliente** desde `Ver › Tema`, más **densidad** (compacta/cómoda/amplia).
- **Layouts persistentes**: geometría y disposición de docks se guardan al cerrar
  (`QSettings`) y se restauran al abrir; además **layouts con nombre**
  (guardar/cargar/restablecer).
- **Command palette (Ctrl+K)** con filtro difuso y **atajos reconfigurables**
  (`CommandRegistry`, persistidos por comando).
- **Historial en vivo por WebSocket** (`/ws`): los requests nuevos se prependen
  en la tabla sin recargar; refresco manual (F5) de respaldo.
- Historial en **tabla virtualizada** (`QAbstractTableModel` + `QTableView`) y
  carga de red en **segundo plano** (`QThreadPool`) — la UI nunca se congela.
- **Render seguro**: el contenido interceptado se muestra en **texto plano**
  (`setPlainText`), nunca como HTML. Elimina la clase de ataque XSS/render web.

El backend (FastAPI + mitmproxy) sigue **aislado en Docker**; esta GUI lo consume
por `http://127.0.0.1:5000` (REST) y `ws://127.0.0.1:5000/ws` (eventos en vivo).

## Requisitos

- Python 3.9+ y `PySide6` + `requests` (ya presentes en el entorno de desarrollo).
- El backend de Blackwire corriendo (hoy: `make run` desde `Blackwire/`; en el
  build final lo levantará el contenedor Docker).

## Ejecutar

```bash
# Con pantalla (abre la ventana):
python desktop/run.py

# Smoke test headless (CI / sin display): valida UI + API end-to-end
QT_QPA_PLATFORM=offscreen python desktop/run.py --selftest
```

Backend en otra URL:

```bash
# editar DEFAULT_BASE_URL en blackwire_desktop/api.py (Fase 1: será configurable)
```

## Estructura

```
desktop/
├── run.py                       # lanzador
└── blackwire_desktop/
    ├── api.py                   # cliente REST (search/scope/intercept/detalle)
    ├── ws_client.py             # cliente WebSocket /ws (historial + intercept)
    ├── httpql.py                # parser HTTPQL -> AST (puerto de parsing.js)
    ├── sitemap.py               # construcción del árbol Site Map (cliente)
    ├── diff.py                  # diff LCS por líneas (puerto de parsing.js:diffLines)
    ├── intruder.py              # §-posiciones, payloads, combos, build (puertos web)
    ├── sensitive.py             # 99 patrones + entropía + escaneo (puertos web)
    ├── jwt_tool.py              # decode/encode JWT en cliente (puerto de encoding.js)
    ├── rawhttp.py               # formato/parseo de request crudo (Repeater+Intercept)
    ├── themes.py                # 17 temas (tokens) + generador de QSS + densidad
    ├── settings.py              # preferencias persistentes (QSettings)
    ├── commands.py              # registro de comandos + command palette (Ctrl+K)
    ├── widgets/
    │   ├── history.py           # modelo + panel History (HTTPQL + Site Map)
    │   ├── intercept.py         # panel Intercept (pausar/editar/forward/drop)
    │   ├── repeater.py          # panel Repeater (pestañas, enviar, persistencia)
    │   ├── intruder.py          # panel Intruder (§, payloads, ataque, resultados)
    │   ├── collections.py       # panel Collections (pasos + ejecución encadenada)
    │   ├── decoder.py           # panel Decoder (Cipher recetas + JWT)
    │   ├── match_replace.py     # herramienta Match & Replace (ext. match_replace)
    │   ├── webhook_site.py      # herramienta Webhook.site (endpoints /webhooksite/*)
    │   ├── projects.py          # panel Proyectos (crear/activar/eliminar/export/import)
    │   ├── proxy_control.py     # control del proxy (start/stop/estado/config)
    │   ├── console.py           # Console: logs del proxy en vivo
    │   ├── bypass.py            # Proxy Bypass (reglas --ignore-hosts + presets)
    │   ├── sensitive.py         # panel Sensitive (escaneo de secretos)
    │   ├── websocket_viewer.py  # panel WebSocket (conexiones/frames/reenvío)
    │   ├── session.py           # panel Session (reglas de extracción por regex)
    │   ├── comparer.py          # panel Comparer (diff lado a lado)
    │   └── scope.py             # panel Scope (reglas include/exclude)
    └── main.py                  # shell: ThemeManager, docks, menús, búsqueda, render
```

## Próximo (Fase 7)

Empaque PyInstaller + orquestación Docker + `.github/workflows/desktop.yml`.
