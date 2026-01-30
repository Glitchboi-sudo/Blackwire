#!/bin/bash
# Uninstall Blackwire desktop launcher

INSTALL_DIR="$HOME/.local/share/applications"
DESKTOP_INSTALLED="$INSTALL_DIR/blackwire.desktop"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Blackwire Desktop Launcher Uninstall ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if installed
if [ ! -f "$DESKTOP_INSTALLED" ]; then
    echo -e "${YELLOW}[!] Blackwire launcher not found in application menu${NC}"
    echo -e "${CYAN}    Nothing to uninstall${NC}"
    exit 0
fi

# Remove desktop file
rm "$DESKTOP_INSTALLED"
echo -e "${GREEN}[✓] Removed: ${DESKTOP_INSTALLED}${NC}"

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$INSTALL_DIR" 2>/dev/null
    echo -e "${GREEN}[✓] Updated desktop database${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Successfully uninstalled Blackwire launcher            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Note: Project files remain intact${NC}"
echo -e "      You can still run: ./launch-with-browser.sh"
