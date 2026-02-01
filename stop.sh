#!/bin/bash
# Blackwire - Stop server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.backend.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        rm -f "$PID_FILE"
        notify-send "Blackwire" "Server stopped" 2>/dev/null
        exit 0
    fi
    rm -f "$PID_FILE"
fi

# Fallback: find by port
PID=$(lsof -ti:5000 2>/dev/null)
if [ -n "$PID" ]; then
    kill $PID 2>/dev/null
    notify-send "Blackwire" "Server stopped" 2>/dev/null
    exit 0
fi

echo "Blackwire is not running"
