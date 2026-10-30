# Blackwire — Dockerfile del backend (API FastAPI + mitmproxy).
#
# La UI web fue retirada (EOL): la imagen contiene SOLO el backend. La interfaz es
# la app de escritorio nativa (desktop/), que corre en el host, gestiona este
# contenedor (ver desktop/blackwire_desktop/docker_runtime.py) y lo consume por
# REST + WebSocket en :5000. El proxy de mitmproxy escucha en :8080.

FROM python:3.11-slim

# Usuario no-root + directorios (incluido el confdir de mitmproxy) para que los
# volúmenes nombrados hereden el owner correcto en el primer montaje.
RUN useradd -m -u 1000 blackwire && \
    mkdir -p /app /data/.mitmproxy /data/projects /home/blackwire/.mitmproxy && \
    chown -R blackwire:blackwire /app /data /home/blackwire

WORKDIR /app

# Dependencias de sistema. Ya NO se instala Node: no hay frontend web ni
# compilación de JSX (las extensiones son Python puro).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Dependencias de Python.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código del backend. El servidor MCP (mcp_server/) NO se incluye: corre en el host
# / en el bundle de escritorio, no en este contenedor.
COPY backend/ ./backend/

# Copia de respaldo de las extensiones integradas para el seeding de primer arranque:
# extensions/ se bind-montea desde el host; extensions_builtin/ queda en la imagen.
RUN cp -r ./backend/extensions ./backend/extensions_builtin

# Pre-generar el CA de mitmproxy como usuario blackwire para que exista en la imagen;
# Docker lo copia a un volumen nombrado nuevo en el primer montaje.
USER blackwire
RUN python3 -c "import pathlib; p=pathlib.Path('/home/blackwire/.mitmproxy'); p.mkdir(parents=True,exist_ok=True); from mitmproxy.certs import CertStore; CertStore.from_store(p,'mitmproxy',2048); print('mitmproxy CA certificates pre-generated')" 2>/dev/null || true

# Volver a root para que el entrypoint ajuste permisos de volúmenes antes de bajar privilegios.
USER root

COPY packaging/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Puertos: 5000 API, 8080 proxy.
EXPOSE 5000 8080

# Health check.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/api/proxy/status || exit 1

# Variables de entorno.
ENV PYTHONUNBUFFERED=1 \
    MITMPROXY_HOME=/data/.mitmproxy \
    BLACKWIRE_DATA=/data/projects

# Volumen de datos.
VOLUME ["/data"]

# cwd en backend/ para que los imports planos funcionen.
WORKDIR /app/backend

ENTRYPOINT ["/entrypoint.sh"]
CMD ["python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
