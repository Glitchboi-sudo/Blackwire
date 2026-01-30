#!/bin/bash
# Blackwire - Start Script
# Launches backend and opens frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments for verbose mode
VERBOSE=0
for arg in "$@"; do
    case $arg in
        -v|--verbose)
            VERBOSE=1
            shift
            ;;
        *)
            ;;
    esac
done

# Output redirection helper
log() {
    if [ "$VERBOSE" -eq 1 ]; then
        echo -e "$@"
    fi
}

# Show banner only in verbose mode
if [ "$VERBOSE" -eq 1 ]; then
    echo -e "${CYAN}"
    echo "  ╔═══════════════════════════════════════╗"
    echo "  ║           Blackwire Proxy Tool       ║"
    echo "  ║     Burp-like interceptor in Python   ║"
    echo "  ╚═══════════════════════════════════════╝"
    echo -e "${NC}"
fi

# Proxy options (defaults)
PROXY_PORT=8080
PROXY_MODE="regular"
PROXY_AUTOSTART=0
PROXY_EXTRA=""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 not found${NC}" >&2
    exit 1
fi

# Create venv if needed
if [ ! -d "venv" ]; then
    log "${CYAN}[*] Creating virtual environment...${NC}"
    if [ "$VERBOSE" -eq 1 ]; then
        python3 -m venv venv
    else
        python3 -m venv venv &>/dev/null
    fi
fi

# Activate venv
source venv/bin/activate

# Install deps
log "${CYAN}[*] Checking dependencies...${NC}"
if [ "$VERBOSE" -eq 1 ]; then
    pip install -q -r requirements.txt
else
    pip install -q -r requirements.txt &>/dev/null
fi

# Create data dir
mkdir -p data

# Generate mitmproxy certificates if not exist
if [ ! -f "$HOME/.mitmproxy/mitmproxy-ca-cert.pem" ]; then
    log "${CYAN}[*] Generating mitmproxy certificates...${NC}"
    if [ "$VERBOSE" -eq 1 ]; then
        python3 -c "from mitmproxy import certs; certs.CertStore.from_store('$HOME/.mitmproxy', 'mitmproxy', 2048)"
        log "${GREEN}[+] Certificate generated at: $HOME/.mitmproxy/mitmproxy-ca-cert.pem${NC}"
        log "${CYAN}    Install this in your browser to intercept HTTPS${NC}"
    else
        python3 -c "from mitmproxy import certs; certs.CertStore.from_store('$HOME/.mitmproxy', 'mitmproxy', 2048)" &>/dev/null
    fi
fi

# Start backend
log "${CYAN}[*] Starting backend on http://localhost:5000${NC}"
cd backend
if [ "$VERBOSE" -eq 1 ]; then
    python3 -m uvicorn main:app --host 0.0.0.0 --port 5000 &
else
    python3 -m uvicorn main:app --host 0.0.0.0 --port 5000 &>/dev/null &
fi
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 2

# Optionally start proxy with custom settings
if [ "$PROXY_AUTOSTART" -eq 1 ]; then
    log "${CYAN}[*] Starting proxy (port=${PROXY_PORT}, mode=${PROXY_MODE})...${NC}"
    curl -s -X POST "http://localhost:5000/api/proxy/start?port=${PROXY_PORT}&mode=${PROXY_MODE}" >/dev/null || true
fi

if [ "$VERBOSE" -eq 1 ]; then
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Backend running: http://localhost:5000                   ║${NC}"
    echo -e "${GREEN}║  API Docs:        http://localhost:5000/docs              ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║  Frontend: Open frontend/App.jsx in your React setup      ║${NC}"
    echo -e "${GREEN}║  Or use the standalone HTML version                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Press Ctrl+C to stop${NC}"
fi

# Trap to cleanup
trap "kill $BACKEND_PID 2>/dev/null; exit" INT TERM

# Wait
wait $BACKEND_PID
