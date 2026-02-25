# BlackWire

![Preview del proyecto](Blackwire_banner.png)

<h3 align="center">Security from México to all</h3>

![Estado](https://img.shields.io/badge/status-En_desarrollo-green)
![License](https://img.shields.io/badge/license-GNU_AGPLv3-blue)

---

## ¿Qué es BlackWire?

**BlackWire** es un proxy interceptor HTTP/HTTPS de código abierto diseñado para **pruebas de seguridad**, **análisis de tráfico web** y **debugging de aplicaciones**. Ofrece una alternativa ligera, portable y extensible a herramientas como Burp Suite o OWASP ZAP, con un frontend web moderno y un potente backend basado en mitmproxy.

### Por qué BlackWire

- **Para Pentesters**: Interceptor completo, HTTPQL, Collections, Sensitive Discovery
- **Portable**: Sin instalación compleja - solo `./install.sh` y listo
- **Extensible**: Sistema de plugins en Python con UI auto-generada
- **Moderno**: Frontend React, 15 temas, Import/Export compatible con Burp Suite

---

## Quick Start

```bash
# 1. Clonar e instalar
git clone https://github.com/Glitchboi-sudo/Blackwire.git
cd Blackwire
./install.sh

# 2. Lanzar aplicación
./launch-with-browser.sh
```

**Eso es todo.** Abre en http://localhost:5000

---

## 🔌 Crea tu Primera Extensión (5 minutos)

El sistema de extensiones hace que crear plugins sea **increíblemente simple**. Solo necesitas un archivo Python:

```python
# backend/extensions/custom_header.py
"""Custom Header Injector - Inyecta headers personalizados"""

EXTENSION_META = {
    "name": "custom_header",
    "title": "Custom Header",
    "description": "Inyecta un header personalizado en todas las requests",

    # UI auto-generada desde schema
    "ui_schema": {
        "type": "schema-driven",
        "fields": [
            {
                "name": "header_name",
                "label": "Header Name",
                "type": "text",
                "default": "X-Custom-Header",
                "help": "Nombre del header a inyectar"
            },
            {
                "name": "header_value",
                "label": "Header Value",
                "type": "text",
                "placeholder": "valor..."
            }
        ]
    },

    "default_config": {
        "enabled": False,
        "header_name": "X-Custom-Header",
        "header_value": ""
    }
}

from mitmproxy import http

class CustomHeaderExtension:
    name = "custom_header"

    def on_request(self, flow: http.HTTPFlow, cfg: dict, full_config: dict):
        if cfg.get("enabled") and cfg.get("header_value"):
            flow.request.headers[cfg["header_name"]] = cfg["header_value"]

def register():
    return CustomHeaderExtension()
```

**¡Y listo!** Reinicia el servidor (`./stop.sh && ./start.sh`) y tu extensión aparece automáticamente en la pestaña Extensions con su formulario configurado.

**3 tipos de extensiones:**
1. **Schema-Driven** → Formularios simples auto-generados (ejemplos: [rate_limiter.py](backend/extensions/rate_limiter.py))
2. **Dynamic JSX** → UIs complejas sin recompilar frontend (ejemplos: [webhook_site.ui.jsx](backend/extensions/webhook_site.ui.jsx), [headers_injector.ui.jsx](backend/extensions/headers_injector.ui.jsx))
3. **Custom React** → Componentes hardcoded para casos especiales (legacy)

📚 **Documentación completa**: [Sistema de Extensiones Wiki](https://github.com/Glitchboi-sudo/Blackwire/wiki/07-Sistema-de-Extensiones)

---

## Features Principales

### Core
- **Proxy Interceptor** - Captura y modifica HTTP/HTTPS en tiempo real
- **Repeater** - Reenvía y modifica requests con historial de navegación
- **HTTPQL** - Filtrado avanzado con lenguaje de consulta tipo SQL
- **Scope & Filters** - Reglas include/exclude con regex

### Análisis
- **Site Map** - Vista en árbol de hosts y endpoints
- **Compare** - Diff visual lado a lado con algoritmo LCS
- **Sensitive Discovery** - Escaneo de secrets con 50+ patrones + Shannon Entropy
- **JWT Analyzer** - Decodifica JWTs con doc de ataques comunes

### Herramientas
- **Cipher** - 100+ operaciones encadenables (Base64, hashing, crypto, etc.)
- **Collections** - Workflows automatizados con variables JSONPath
- **Session Rules** - Extracción de tokens con regex
- **WebSocket Viewer** - Captura y reenvío de frames WS

### Extensibilidad
- **Sistema de Plugins** - Crea extensiones en Python sin tocar el frontend
- **UI Schema-Driven** - Formularios auto-generados desde metadata
- **Dynamic JSX** - UIs complejas con archivos `.ui.jsx` sin recompilar
- **Auto-Discovery** - Las extensiones se descubren y configuran automáticamente

### Integración
- **Burp Suite** - Import/Export compatible con formato XML
- **Git Integration** - Control de versiones integrado
- **15 Temas** - Midnight, Gruvbox, Solarized, Noir, Synth, etc.
- **100% Portable** - Sin rutas hardcoded, funciona desde cualquier directorio

## 🏗️ Arquitectura

```
BlackWire/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── proxy_addon.py       # mitmproxy addon
│   ├── extensions/          # Sistema de plugins
│   └── chepy_compat.py      # Motor Cipher
├── frontend/
│   ├── App.jsx              # React app (~5400 líneas)
│   ├── App.compiled.js      # JSX pre-transpilado
│   └── themes.js            # 15 temas de color
├── projects/                # Bases de datos SQLite por proyecto
│   └── {project_name}/
│       ├── config.json      # Configuración
│       └── data.db          # HTTP history, repeater, collections
└── *.sh                     # Scripts de instalación y lanzamiento
```

## Contribuir

Este proyecto es **espacio abierto para aprender y construir juntos**. Contribuciones bienvenidas:

- **Bugs**: Reporta issues con pasos para reproducir
- **Features**: Propón nuevas funcionalidades
- **Extensions**: Crea plugins para automatización/testing
- **Temas**: Agrega esquemas de color
- **Docs**: Mejora documentación y ejemplos

**Proceso:**
1. Fork el repositorio
2. Crea branch: `git checkout -b feature/mi-feature`
3. Commit cambios: `git commit -m "feat: descripción"`
4. Push: `git push origin feature/mi-feature`
5. Abre Pull Request

---

## Troubleshooting

### Problemas Comunes

**Puerto en uso:**
```bash
./stop.sh
# o
lsof -i :5000 && kill <PID>
```

**Certificado SSL no funciona:**
```bash
rm -rf ~/.mitmproxy
./install.sh
```

**Frontend no carga:**
```bash
cd frontend
npx sucrase App.jsx -d . --transforms jsx
```
---

## 💡 Créditos

Proyecto inspirado en [Burp Suite](https://portswigger.net/burp), [OWASP ZAP](https://www.zaproxy.org/), [mitmproxy](https://mitmproxy.org/) y [Caido](https://caido.io/).

Creado por **[Erik Alcantara](https://www.linkedin.com/in/erik-alc%C3%A1ntara-covarrubias-29a97628a/)**.

**Tecnologías:**
- [mitmproxy](https://mitmproxy.org/) — Motor de proxy
- [FastAPI](https://fastapi.tiangolo.com/) — Backend API
- [React](https://react.dev/) — Frontend
- [Sucrase](https://github.com/alangpierce/sucrase) — Transpilación JSX
- [SQLite](https://www.sqlite.org/) — Base de datos

---

<div align="center">

Made with ❤️ in México

</div>
