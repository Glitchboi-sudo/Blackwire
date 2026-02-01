#!/bin/bash
# Blackwire - Launch with Browser
# Starts backend and automatically opens browser

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if already running
if curl -s http://localhost:5000/api/proxy/status &>/dev/null; then
    xdg-open http://localhost:5000 2>/dev/null || open http://localhost:5000 2>/dev/null &
    exit 0
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    notify-send "Blackwire" "Error: Python 3 not found" 2>/dev/null
    exit 1
fi

# Create venv if needed
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install deps (quiet)
pip install -q -r requirements.txt 2>/dev/null

# Create data dir
mkdir -p data

# Generate mitmproxy certificates if not exist
if [ ! -f "$HOME/.mitmproxy/mitmproxy-ca-cert.pem" ]; then
    python3 -c "from mitmproxy import certs; certs.CertStore.from_store('$HOME/.mitmproxy', 'mitmproxy', 2048)" 2>/dev/null || true
fi

# Start backend as a detached background process
cd backend
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 5000 &>/dev/null &
BACKEND_PID=$!
cd ..

# Save PID for later cleanup
echo $BACKEND_PID > "$SCRIPT_DIR/.backend.pid"

# Wait for backend to be ready (up to 30 attempts)
for i in {1..30}; do
    if curl -s http://localhost:5000/api/proxy/status &>/dev/null; then
        break
    fi
    sleep 0.5
    if [ $i -eq 30 ]; then
        notify-send "Blackwire" "Timeout: server failed to start" 2>/dev/null
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
done

# Disown the backend so it survives after this script exits
disown $BACKEND_PID

# Open browser
xdg-open http://localhost:5000 2>/dev/null || open http://localhost:5000 2>/dev/null &

# Script exits immediately — no terminal stays open
exit 0
