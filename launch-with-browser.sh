#!/bin/bash
# Blackwire - Launch with Browser
# Starts backend and automatically opens browser

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║           Blackwire Proxy Tool       ║"
echo "  ║     Burp-like interceptor in Python   ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check if already running
if curl -s http://localhost:5000/api/proxy/status &>/dev/null; then
    echo -e "${YELLOW}[!] Backend already running${NC}"
    echo -e "${GREEN}[+] Opening browser...${NC}"
    xdg-open http://localhost:5000 2>/dev/null || open http://localhost:5000 2>/dev/null || echo "Please open http://localhost:5000 in your browser"
    exit 0
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 not found${NC}" >&2
    exit 1
fi

# Create venv if needed
if [ ! -d "venv" ]; then
    echo -e "${CYAN}[*] Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install deps
echo -e "${CYAN}[*] Installing dependencies...${NC}"
pip install -q -r requirements.txt

# Create data dir
mkdir -p data

# Generate mitmproxy certificates if not exist
if [ ! -f "$HOME/.mitmproxy/mitmproxy-ca-cert.pem" ]; then
    echo -e "${CYAN}[*] Generating mitmproxy certificates...${NC}"
    python3 -c "from mitmproxy import certs; certs.CertStore.from_store('$HOME/.mitmproxy', 'mitmproxy', 2048)" 2>/dev/null || true
    echo -e "${GREEN}[+] Certificate: $HOME/.mitmproxy/mitmproxy-ca-cert.pem${NC}"
fi

# Start backend in background
echo -e "${CYAN}[*] Starting backend server...${NC}"
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 5000 &>/dev/null &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo -e "${CYAN}[*] Waiting for server to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:5000/api/proxy/status &>/dev/null; then
        echo -e "${GREEN}[+] Backend ready!${NC}"
        break
    fi
    sleep 0.5
    if [ $i -eq 30 ]; then
        echo -e "${RED}[!] Timeout waiting for backend${NC}"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
done

# Open browser
echo -e "${GREEN}[+] Opening browser at http://localhost:5000${NC}"
xdg-open http://localhost:5000 2>/dev/null || open http://localhost:5000 2>/dev/null || {
    echo -e "${YELLOW}[!] Could not open browser automatically${NC}"
    echo -e "${CYAN}    Please open: http://localhost:5000${NC}"
}

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Backend running: http://localhost:5000                 ║${NC}"
echo -e "${GREEN}║  ✓ Browser opened automatically                           ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  API Docs:        http://localhost:5000/docs              ║${NC}"
echo -e "${GREEN}║  Proxy default:   http://127.0.0.1:8080                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Press Ctrl+C to stop the server${NC}"
echo ""

# Trap to cleanup
trap "echo -e '\n${YELLOW}[*] Stopping backend...${NC}'; kill $BACKEND_PID 2>/dev/null; echo -e '${GREEN}[+] Stopped${NC}'; exit" INT TERM

# Wait for backend process
wait $BACKEND_PID
