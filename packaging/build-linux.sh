#!/usr/bin/env bash
# Construye instaladores Linux desde la salida onedir de PyInstaller:
#   .deb  y  .rpm  (via fpm),  .tar.gz  (tar),  .AppImage  (appimagetool).
# Uso: packaging/build-linux.sh <version> <dist_dir>
#   <dist_dir> ya debe contener docker-compose.yml + blackwire-image.tar.gz.
# Los formatos "exóticos" no abortan el script (se reporta y se continúa), para
# que el release reciba al menos los que sí compilaron.
set -uo pipefail

VERSION="${1:-2.0.0}"
DIST="${2:-dist/blackwire-desktop}"
ARCH_DEB="amd64"
ARCH_RPM="x86_64"
ICON_PNG=""

rm -rf build/linux
STAGE="build/linux/stage"
mkdir -p "${STAGE}/opt/blackwire-desktop" "${STAGE}/usr/bin" \
         "${STAGE}/usr/share/applications" "${STAGE}/usr/share/icons/hicolor/256x256/apps"

cp -a "${DIST}/." "${STAGE}/opt/blackwire-desktop/"

printf '#!/bin/sh\nexec /opt/blackwire-desktop/blackwire-desktop "$@"\n' > "${STAGE}/usr/bin/blackwire-desktop"
chmod 755 "${STAGE}/usr/bin/blackwire-desktop"

# Icono: SVG -> PNG 256 (rsvg-convert o ImageMagick); best-effort.
ICON_DEST="${STAGE}/usr/share/icons/hicolor/256x256/apps/blackwire.png"
if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w 256 -h 256 assets/icon.svg -o "${ICON_DEST}" && ICON_PNG="${ICON_DEST}"
elif command -v convert >/dev/null 2>&1; then
    convert -background none -resize 256x256 assets/icon.svg "${ICON_DEST}" && ICON_PNG="${ICON_DEST}"
fi

cat > "${STAGE}/usr/share/applications/blackwire.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Blackwire
Comment=HTTP/HTTPS intercepting proxy (native desktop)
Exec=/opt/blackwire-desktop/blackwire-desktop
Icon=blackwire
Terminal=false
Categories=Development;Security;Network;
EOF

# --- .deb + .rpm via fpm ---
FPM_COMMON=(-s dir -n blackwire-desktop -v "${VERSION}" --license "AGPL-3.0"
            --vendor "Blackwire" --url "https://github.com/Glitchboi-sudo/Blackwire"
            --description "Blackwire - native HTTP/HTTPS intercepting proxy (runs its backend in Docker)."
            -C "${STAGE}" .)
fpm "${FPM_COMMON[@]}" -t deb -a "${ARCH_DEB}" --depends "docker.io" \
    -p "blackwire-desktop_${VERSION}_${ARCH_DEB}.deb" || echo "WARN: .deb build failed"
fpm "${FPM_COMMON[@]}" -t rpm -a "${ARCH_RPM}" --depends "docker" \
    -p "blackwire-desktop-${VERSION}.${ARCH_RPM}.rpm" || echo "WARN: .rpm build failed"

# --- .tar.gz (distro-agnóstico) ---
tar -C dist -czf "blackwire-desktop-${VERSION}-linux.tar.gz" blackwire-desktop || echo "WARN: .tar.gz failed"

# --- .AppImage ---
APPDIR="build/linux/Blackwire.AppDir"
mkdir -p "${APPDIR}/usr/bin"
cp -a "${DIST}/." "${APPDIR}/usr/bin/"
cp "${STAGE}/usr/share/applications/blackwire.desktop" "${APPDIR}/blackwire.desktop"
[ -n "${ICON_PNG}" ] && cp "${ICON_PNG}" "${APPDIR}/blackwire.png"
cat > "${APPDIR}/AppRun" <<'EOF'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
exec "${HERE}/usr/bin/blackwire-desktop" "$@"
EOF
chmod +x "${APPDIR}/AppRun"
if [ ! -f appimagetool ]; then
    curl -fsSL -o appimagetool \
      "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage" \
      && chmod +x appimagetool
fi
ARCH=x86_64 ./appimagetool --appimage-extract-and-run "${APPDIR}" \
    "Blackwire-${VERSION}-x86_64.AppImage" || echo "WARN: .AppImage build failed"

echo "=== Linux artifacts ==="
ls -1 ./*.deb ./*.rpm ./*.AppImage ./*.tar.gz 2>/dev/null || true
