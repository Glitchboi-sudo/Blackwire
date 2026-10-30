#!/usr/bin/env bash
# Construye instaladores macOS desde el .app que genera PyInstaller (BUNDLE):
#   .dmg (hdiutil)  y  .pkg (pkgbuild).
# Uso: packaging/build-macos.sh <version>
# Requiere dist/Blackwire.app y dist-image/blackwire-image.tar.gz.
set -uo pipefail

VERSION="${1:-2.1.1}"
APP="dist/Blackwire.app"
RES="${APP}/Contents/Resources"

# Recursos que docker_runtime._resource_dir() resuelve en Contents/Resources/.
mkdir -p "${RES}"
cp packaging/docker-compose.runtime.yml "${RES}/docker-compose.yml"
cp dist-image/blackwire-image.tar.gz "${RES}/blackwire-image.tar.gz"

# --- .dmg ---
hdiutil create -volname "Blackwire" -srcfolder "${APP}" -ov -format UDZO \
    "Blackwire-${VERSION}-macos.dmg" || echo "WARN: .dmg build failed"

# --- .pkg (instala el .app en /Applications) ---
pkgbuild --install-location /Applications --component "${APP}" \
    --identifier com.blackwire.app --version "${VERSION}" \
    "Blackwire-${VERSION}-macos.pkg" || echo "WARN: .pkg build failed"

echo "=== macOS artifacts ==="
ls -1 ./*.dmg ./*.pkg 2>/dev/null || true
