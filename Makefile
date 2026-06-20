# Blackwire — comandos de desarrollo.
# Reemplaza los antiguos scripts .sh. Requisitos: python3 y node (para sucrase).
# Uso: `make <objetivo>`. `make help` lista todo.

VENV      := venv
PY        := $(VENV)/bin/python
PIP       := $(VENV)/bin/pip
HOST      ?= 0.0.0.0
PORT      ?= 5000
MITM_CERT := $(HOME)/.mitmproxy/mitmproxy-ca-cert.pem

.DEFAULT_GOAL := help
.PHONY: help install venv deps cert compile serve start stop restart run verify clean

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

compile:  ## Transpila frontend/App.jsx -> App.compiled.js (sucrase)
	@node -e "const{transform}=require('sucrase'),fs=require('fs');const c=fs.readFileSync('frontend/App.jsx','utf8');fs.writeFileSync('frontend/App.compiled.js',transform(c,{transforms:['jsx'],production:true}).code);console.log('compiled -> frontend/App.compiled.js')"

serve: venv  ## Inicia el backend en primer plano (Ctrl-C para detener)
	@cd backend && ../$(PY) -m uvicorn main:app --host $(HOST) --port $(PORT)

start: venv  ## Inicia el backend en segundo plano
	@mkdir -p .run
	@cd backend && nohup ../$(PY) -m uvicorn main:app --host $(HOST) --port $(PORT) > ../.run/server.log 2>&1 & echo $$! > .run/backend.pid
	@echo "Blackwire en http://localhost:$(PORT)  (logs: .run/server.log)"

stop:  ## Detiene el backend
	@if [ -f .run/backend.pid ]; then kill "$$(cat .run/backend.pid)" 2>/dev/null || true; rm -f .run/backend.pid; fi
	@pid=$$(lsof -ti:$(PORT) 2>/dev/null); if [ -n "$$pid" ]; then kill $$pid 2>/dev/null || true; fi
	@echo "Blackwire detenido"

restart: stop start  ## Reinicia el backend

run: install compile start  ## Instala, compila, arranca y abre el navegador
	@sleep 2; (xdg-open http://localhost:$(PORT) 2>/dev/null || open http://localhost:$(PORT) 2>/dev/null) || true

verify: venv  ## Verifica dependencias y que el frontend compila
	@$(PY) -c "import fastapi, mitmproxy, aiosqlite, httpx; print('dependencias OK')"
	@$(MAKE) -s compile
	@echo "verificacion OK"

clean:  ## Elimina venv, cachés y artefactos de runtime
	@rm -rf $(VENV) .run frontend/App.compiled.js
	@find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "limpio"
