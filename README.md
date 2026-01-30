# BlackWire

<h3 align="center">
  <pre>
 ██████╗ ██╗     ██╗████████╗ ██████╗██╗  ██╗██████╗  ██████╗ ██╗
██╔════╝ ██║     ██║╚══██╔══╝██╔════╝██║  ██║██╔══██╗██╔═══██╗██║
██║  ███╗██║     ██║   ██║   ██║     ███████║██████╔╝██║   ██║██║
██║   ██║██║     ██║   ██║   ██║     ██╔══██║██╔══██╗██║   ██║██║
╚██████╔╝███████╗██║   ██║   ╚██████╗██║  ██║██████╔╝╚██████╔╝██║
 ╚═════╝ ╚══════╝╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝
  </pre>
</h3>
<h3 align="center">Security from México to all</h3>

![Estado](https://img.shields.io/badge/status-En_desarrollo-green)
![License](https://img.shields.io/badge/license-GNU_AGPLv3-blue)

---

## Descripción

**BlackWire** es un proxy interceptor HTTP/HTTPS de código abierto diseñado para pruebas de seguridad, análisis de tráfico web y debugging de aplicaciones. Ofrece una alternativa ligera, portable y extensible a herramientas como Burp Suite o OWASP ZAP, con un frontend web moderno y un potente backend basado en mitmproxy. Permite interceptar, modificar y reenviar peticiones en tiempo real, gestionar múltiples proyectos, y extender funcionalidades mediante plugins personalizados.

---

## Características

- **Proxy Interceptor**: Captura y modifica peticiones/respuestas HTTP/HTTPS en tiempo real
- **Gestión de Proyectos**: Organiza tus sesiones de trabajo con proyectos independientes
- **Repeater**: Reenvía y modifica peticiones capturadas para pruebas iterativas
- **Scope/Filtros**: Define reglas de alcance para interceptar solo el tráfico relevante
- **Sistema de Extensiones**: Amplía funcionalidades con plugins personalizados en Python
- **Interface Web Moderna**: Frontend intuitivo accesible desde el navegador
- **100% Portable**: Funciona desde cualquier directorio sin instalación del sistema
- **Base de Datos SQLite**: Cada proyecto almacena su historial localmente
- **Cross-Platform**: Compatible con cualquier distribución Linux

---

## Instalación

### Instalación Rápida

```bash
# 1. Descarga el proyecto
git clone https://github.com/Glitchboi-sudo/Blackwire.git
cd blackwire

# 2. Ejecuta el instalador
chmod +x install.sh
./install.sh

# 3. Lanza la aplicación
./launch-with-browser.sh
```

¡Eso es todo! El instalador se encarga de todo automáticamente.

---

### Requisitos

#### Dependencias del Sistema
```bash
# Ubuntu/Debian
sudo apt install python3 python3-pip python3-venv

# Fedora/RHEL/CentOS
sudo dnf install python3 python3-pip

# Arch Linux
sudo pacman -S python python-pip
```

---

### Métodos de Instalación

#### Método 1: Instalador Automático (Recomendado)

El script `install.sh` realiza todas las configuraciones necesarias:

```bash
chmod +x install.sh
./install.sh
```

**Qué hace el instalador:**
1. Verifica versión de Python (3.8+)
2. Verifica/instala pip
3. Crea entorno virtual
4. Instala dependencias desde requirements.txt
5. Crea directorios necesarios
6. Genera certificados SSL de mitmproxy
7. Hace ejecutables todos los scripts
8. Opcionalmente instala launcher en el menú

#### Método 2: Instalación Manual

Si prefieres control total sobre la instalación:

```bash
# 1. Crear entorno virtual
python3 -m venv venv

# 2. Activar entorno
source venv/bin/activate

# 3. Actualizar pip
pip install --upgrade pip

# 4. Instalar dependencias
pip install -r requirements.txt

# 5. Crear directorios
mkdir -p data projects

# 6. Hacer scripts ejecutables
chmod +x *.sh

# 7. Iniciar
./launch-with-browser.sh
```

---

### Desktop Launcher

#### Instalar Launcher en el Menú

```bash
./install-desktop.sh
```

Después de instalarlo, puedes:
- Buscar "Blackwire" en el menú de aplicaciones
- Fijarlo al dock/panel
- Asignarle un atajo de teclado

#### Desinstalar Launcher

```bash
./uninstall-desktop.sh
```

---

### Certificados SSL

BlackWire usa **mitmproxy** para interceptar tráfico HTTPS. Necesitas instalar el certificado CA:

#### Ubicación del Certificado

```bash
~/.mitmproxy/mitmproxy-ca-cert.pem
```

#### Instalar en Navegador

**Firefox:**
1. Preferencias → Privacidad y Seguridad → Certificados → Ver Certificados
2. Autoridades → Importar
3. Selecciona: `~/.mitmproxy/mitmproxy-ca-cert.pem`
4. Confía para: "Identificar sitios web"

**Chrome/Chromium:**
1. Configuración → Privacidad y Seguridad → Seguridad → Gestionar certificados
2. Autoridades → Importar
3. Selecciona: `~/.mitmproxy/mitmproxy-ca-cert.pem`

**Sistema (Linux):**
```bash
# Ubuntu/Debian
sudo cp ~/.mitmproxy/mitmproxy-ca-cert.pem /usr/local/share/ca-certificates/mitmproxy.crt
sudo update-ca-certificates

# Fedora/RHEL
sudo cp ~/.mitmproxy/mitmproxy-ca-cert.pem /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust
```

---

## Uso
### Inicio Rápido

```bash
# Opción 1: Launcher automático (abre navegador)
./launch-with-browser.sh

# Opción 2: Start manual
./start.sh
```

Una vez iniciado:
- **Frontend**: http://localhost:5000
- **Proxy**: http://localhost:8080 (configura este proxy en tu navegador/herramienta)

### Gestión de Proyectos

BlackWire organiza el trabajo en **proyectos** independientes. Cada proyecto tiene su propia base de datos y configuración.

**Funcionalidades:**
- Crear/eliminar proyectos
- Cambiar entre proyectos activos
- Exportar/importar datos de proyectos
- Cada proyecto mantiene su propio historial aislado

### Proxy Interceptor

1. **Iniciar Proxy**: Botón "Start Proxy" en la interfaz
2. **Configurar Navegador**: Proxy HTTP en `localhost:8080`
3. **Habilitar Intercept**: Activa el interceptor para pausar peticiones
4. **Modificar Peticiones**: Edita headers, body, método, URL
5. **Forward/Drop**: Envía o descarta la petición modificada

**Características:**
- Intercepta HTTP y HTTPS
- Modifica peticiones y respuestas en tiempo real
- Historial completo de tráfico
- Búsqueda y filtrado de peticiones
- Exportación de datos

### Repeater

Reenvía peticiones capturadas para pruebas iterativas:

1. Selecciona una petición del historial
2. Envíala al Repeater
3. Modifica parámetros, headers o body
4. Reenvía múltiples veces
5. Compara respuestas

Ideal para:
- Testing de parámetros
- Fuzzing manual
- Bypass de validaciones
- Análisis de respuestas

### Scope

Define reglas para filtrar qué tráfico interceptar:

```json
{
  "pattern": "example.com",
  "rule_type": "include",
  "enabled": true
}
```

**Tipos de reglas:**
- **Include**: Solo intercepta URLs que coincidan
- **Exclude**: Ignora URLs que coincidan
- Soporta regex y wildcards

**Ejemplo:**
```
Include: *.example.com/*      (solo example.com)
Exclude: *.google.com/*       (ignora Google)
Include: /api/.*              (solo endpoints de API)
```

### Extensiones

BlackWire soporta plugins personalizados en Python para extender funcionalidades.

**Ubicación:** `backend/extensions/`

**Ejemplo de extensión:**
```python
# backend/extensions/mi_extension.py

def on_request(flow):
    """Se ejecuta en cada petición"""
    if "Authorization" in flow.request.headers:
        print(f"Token detectado: {flow.request.headers['Authorization']}")

def on_response(flow):
    """Se ejecuta en cada respuesta"""
    if flow.response.status_code == 500:
        print(f"Error 500 en: {flow.request.url}")
```

**Hooks disponibles:**
- `on_request(flow)`: Antes de enviar la petición
- `on_response(flow)`: Después de recibir la respuesta
- `on_error(flow)`: Cuando hay un error

Las extensiones tienen acceso completo al objeto `flow` de mitmproxy.

---

## Portabilidad

BlackWire es **100% portable**. Todos los scripts detectan automáticamente su ubicación.

### Características Portables

- **Detección Automática de Rutas**: Sin rutas hardcoded
- **Desktop Launcher Dinámico**: Se actualiza automáticamente
- **Sin Dependencias del Sistema**: Todo en el directorio del proyecto

### Ejemplos de Uso Portable

**Mover a otro directorio:**
```bash
mv blackwire /opt/blackwire
cd /opt/blackwire
./launch-with-browser.sh
```

**Copiar a otra máquina:**
```bash
# En máquina origen
tar -czf blackwire.tar.gz blackwire/

# En máquina destino
tar -xzf blackwire.tar.gz
cd blackwire
./install.sh
```

**Ejecutar desde USB:**
```bash
cd /media/usb/blackwire
./launch-with-browser.sh
```

**Reinstalar desktop launcher tras mover:**
```bash
./uninstall-desktop.sh
./install-desktop.sh
```

### Limitaciones

⚠️ **Entorno Virtual no portable**: El `venv/` contiene rutas absolutas.

**Solución:**
```bash
rm -rf venv
./install.sh
```

⚠️ **Desktop Launcher**: Actualizar después de mover el proyecto.

**Solución:**
```bash
./uninstall-desktop.sh
./install-desktop.sh
```

---

## Verificación y Troubleshooting

### Verificar Instalación

```bash
python3 --version
# Debe ser ≥ 3.8

source venv/bin/activate
pip list | grep -E "(fastapi|mitmproxy|uvicorn)"
./verify-install.sh
```

### Troubleshooting Común

#### Problema: Python version too old

```bash
# Solución: Instala Python 3.8+ o usa pyenv
curl https://pyenv.run | bash
pyenv install 3.11.0
pyenv local 3.11.0
```

#### Problema: pip not found

```bash
# Ubuntu/Debian
sudo apt install python3-pip

# get-pip
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3 get-pip.py --user
```

#### Problema: Permission denied

```bash
# Haz los scripts ejecutables
chmod +x *.sh
sudo chown -R $USER:$USER .
```

#### Problema: Port already in use

```bash
# Backend (5000)
lsof -i :5000
kill -9 <PID>

# Proxy (8080)
lsof -i :8080
kill -9 <PID>
```

#### Problema: Certificado no funciona

```bash
# Regenera certificados
rm -rf ~/.mitmproxy
./install.sh  # Los regenera automáticamente
```

---

## Contribuir

Este proyecto no solo es un repositorio: es un espacio abierto para aprender, experimentar y construir juntos. **Buscamos activamente contribuciones**, ya sea en la parte técnica o incluso en la documentación.

- **En funcionalidades:** Si tienes ideas para nuevas características (integraciones con otras herramientas, mejoras en el interceptor, nuevos tipos de análisis), ¡compártelas!
- **En software:** Desde corrección de bugs, optimización de rendimiento, hasta mejoras en la legibilidad del código o documentación; todo aporte, grande o pequeño, suma muchísimo.
- **En extensiones:** Crea y comparte plugins para automatizar tareas específicas de pentesting o análisis.

No necesitas ser experto para ayudar: si crees que algo puede explicarse mejor, que el código puede ser más claro, o que hay una forma más elegante de hacer algo, **cuéntanos o abre un Pull Request**.

---

## Créditos

Proyecto inspirado en herramientas como [Burp Suite](https://portswigger.net/burp), [OWASP ZAP](https://www.zaproxy.org/) y [mitmproxy](https://mitmproxy.org/).

Creado por **[Erik Alcantara](https://www.linkedin.com/in/erik-alc%C3%A1ntara-covarrubias-29a97628a/)**.

**Tecnologías utilizadas:**
- [mitmproxy](https://mitmproxy.org/) - Motor de proxy interceptor
- [FastAPI](https://fastapi.tiangolo.com/) - Backend API
- [React](https://react.dev/) - Frontend web
- [SQLite](https://www.sqlite.org/) - Base de datos
