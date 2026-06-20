#!/bin/bash
set -e

# Seed built-in extensions on first run.
# extensions_builtin/ is baked into the image; extensions/ is bind-mounted from the host.
if [ -d /app/backend/extensions_builtin ] && [ -z "$(ls -A /app/backend/extensions 2>/dev/null)" ]; then
    echo "[Blackwire] First run: seeding built-in extensions into ~/Blackwire/extensions"
    cp -r /app/backend/extensions_builtin/. /app/backend/extensions/
fi

# Ensure expected subdirectories exist inside the /data bind mount
mkdir -p /data/projects /data/.compiled_ui

# Fix ownership of all bind-mounted directories
chown -R blackwire:blackwire \
    /home/blackwire/.mitmproxy \
    /data \
    /app/backend/extensions \
    2>/dev/null || true

# Drop to unprivileged user and exec the application
exec runuser -u blackwire -- "$@"
