# Blackwire - Multi-stage Dockerfile
# Optimized for production desktop app with security isolation

# ============================================
# Stage 1: Build frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copy only package files first (layer caching)
COPY package*.json ./
RUN npm ci

# Install React UMD builds for vendoring (not in package.json since the app
# previously loaded them from unpkg.com — we now serve them locally).
RUN npm install --no-save react@18 react-dom@18

# Copy frontend source
COPY frontend/ ./frontend/

# Compile frontend directly (no dependency on shell script)
RUN node -e "const {transform}=require('sucrase'),fs=require('fs'); \
    const code=fs.readFileSync('frontend/App.jsx','utf8'); \
    const r=transform(code,{transforms:['jsx'],production:true}); \
    fs.writeFileSync('frontend/App.compiled.js',r.code,'utf8'); \
    console.log('✅ Compiled successfully! Size: '+r.code.length+' bytes')"

# ============================================
# Stage 2: Runtime
# ============================================
FROM python:3.11-slim

# Create non-root user and all directories (including mitmproxy confdir)
# so named volumes inherit correct ownership on first mount.
RUN useradd -m -u 1000 blackwire && \
    mkdir -p /app /data/.mitmproxy /data/projects /home/blackwire/.mitmproxy && \
    chown -R blackwire:blackwire /app /data /home/blackwire

WORKDIR /app

# Install system dependencies including Node.js for extension compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code (includes frontend.html)
COPY backend/ ./backend/

# Copy compiled frontend and all static files
COPY --from=frontend-builder /build/frontend/App.compiled.js ./frontend/
COPY frontend/themes.js ./frontend/
COPY frontend/src/ ./frontend/src/

# Vendor React so the app never loads scripts from unpkg.com or any CDN.
# The frontend.html references these paths via /static/vendor/.
COPY --from=frontend-builder /build/node_modules/react/umd/react.production.min.js ./frontend/vendor/react.js
COPY --from=frontend-builder /build/node_modules/react-dom/umd/react-dom.production.min.js ./frontend/vendor/react-dom.js

# Copy Node.js dependencies for extension UI compilation
COPY --from=frontend-builder /build/package*.json ./
COPY --from=frontend-builder /build/node_modules/ ./node_modules/

# Copy extensions and keep a built-in backup for first-run seeding.
# extensions/ is bind-mounted from the host at runtime; extensions_builtin/
# stays in the image so the entrypoint can seed an empty host directory.
COPY backend/extensions/ ./backend/extensions/
RUN cp -r ./backend/extensions ./backend/extensions_builtin

# Pre-generate mitmproxy CA certificates as blackwire user so they exist
# in the image; Docker copies them into a new named volume on first mount.
USER blackwire
RUN python3 -c "import pathlib; p=pathlib.Path('/home/blackwire/.mitmproxy'); p.mkdir(parents=True,exist_ok=True); from mitmproxy.certs import CertStore; CertStore.from_store(p,'mitmproxy',2048); print('mitmproxy CA certificates pre-generated')" 2>/dev/null || true

# Back to root so the entrypoint can fix volume permissions before dropping privs
USER root

COPY packaging/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
EXPOSE 5000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/api/proxy/status || exit 1

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    MITMPROXY_HOME=/data/.mitmproxy \
    BLACKWIRE_DATA=/data/projects

# Set data volume
VOLUME ["/data"]

# Switch to backend directory for imports to work correctly
WORKDIR /app/backend

ENTRYPOINT ["/entrypoint.sh"]
CMD ["python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
