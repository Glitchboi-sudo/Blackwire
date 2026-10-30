# Blackwire — comandos de desarrollo del BACKEND.
# La UI web fue retirada (EOL); la interfaz es la app de escritorio nativa
# (ver desktop/README.md: `python desktop/run.py`). Este Makefile gestiona el
# backend (FastAPI + mitmproxy). Requisitos: python3.
# Uso: `make <objetivo>`. `make help` lista todo.

VENV      := venv
PY        := $(VENV)/bin/python
PIP       := $(VENV)/bin/pip
HOST      ?= 0.0.0.0
PORT      ?= 5000
MITM_CERT := $(HOME)/.mitmproxy/mitmproxy-ca-cert.pem

.DEFAULT_GOAL := help
.PHONY: help install venv deps cert serve start stop restart run verify clean

help:  ## Lista los objetivos disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: venv deps cert  ## Crea el venv, instala dependencias y genera el certificado mitmproxy

venv:
	@test -d $(VENV) || python3 -m venv $(VENV)

deps: venv  ## Instala las dependencias de Python (requirements.txt)
	@$(PIP) install --upgrade pip -q
	@$(PIP) install -r requirements.txt -q

cert: venv  ## Genera el certificado CA de mitmproxy si no existe
	@test -f "$(MITM_CERT)" || $(PY) -c "from mitmproxy import certs; certs.CertStore.from_store('$(HOME)/.mitmproxy', 'mitmproxy', 2048)"

serve: venv  ## Inicia el backend en primer plano (Ctrl-C para detener)
	@cd backend && ../$(PY) -m uvicorn main:app --host $(HOST) --port $(PORT)

start: venv  ## Inicia el backend en segundo plano
	@mkdir -p .run
	@cd backend && nohup ../$(PY) -m uvicorn main:app --host $(HOST) --port $(PORT) > ../.run/server.log 2>&1 & echo $$! > .run/backend.pid
	@echo "Blackwire backend en http://localhost:$(PORT)  (logs: .run/server.log)"

stop:  ## Detiene el backend
	@if [ -f .run/backend.pid ]; then kill "$$(cat .run/backend.pid)" 2>/dev/null || true; rm -f .run/backend.pid; fi
	@pid=$$(lsof -ti:$(PORT) 2>/dev/null); if [ -n "$$pid" ]; then kill $$pid 2>/dev/null || true; fi
	@echo "Blackwire detenido"

restart: stop start  ## Reinicia el backend

run: install start  ## Instala y arranca el backend; luego lanza la app de escritorio
	@sleep 2
	@echo "Backend listo. Lanza la app de escritorio con: python desktop/run.py"

verify: venv  ## Verifica que las dependencias del backend están disponibles
	@$(PY) -c "import fastapi, mitmproxy, aiosqlite, httpx; print('dependencias OK')"
	@echo "verificacion OK"

clean:  ## Elimina venv, cachés y artefactos de runtime
	@rm -rf $(VENV) .run
	@find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "limpio"
