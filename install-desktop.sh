#!/bin/bash
# Install Blackwire desktop launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_TEMPLATE="$SCRIPT_DIR/blackwire.desktop"
INSTALL_DIR="$HOME/.local/share/applications"
DESKTOP_INSTALLED="$INSTALL_DIR/blackwire.desktop"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Blackwire Desktop Launcher Install  ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if template exists
if [ ! -f "$DESKTOP_TEMPLATE" ]; then
    echo -e "${RED}Error: blackwire.desktop template not found${NC}"
    exit 1
fi

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

echo -e "${CYAN}[*] Installing from: ${SCRIPT_DIR}${NC}"
echo -e "${CYAN}[*] Install location: ${INSTALL_DIR}${NC}"
echo ""

# Create desktop file with correct paths
sed "s|INSTALL_PATH|${SCRIPT_DIR}|g" "$DESKTOP_TEMPLATE" > "$DESKTOP_INSTALLED"

# Make desktop file executable
chmod +x "$DESKTOP_INSTALLED"

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$INSTALL_DIR" 2>/dev/null
    echo -e "${GREEN}[✓] Updated desktop database${NC}"
fi

# Check if icon exists
if [ ! -f "$SCRIPT_DIR/icon.svg" ]; then
    echo -e "${YELLOW}[!] Warning: icon.svg not found${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Successfully installed Blackwire launcher              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Launch options:${NC}"
echo -e "  ${GREEN}1.${NC} Search for 'Blackwire' in your application menu"
echo -e "  ${GREEN}2.${NC} Run directly: ${SCRIPT_DIR}/launch-with-browser.sh"
echo -e "  ${GREEN}3.${NC} Double-click: ${SCRIPT_DIR}/blackwire.desktop"
echo ""
echo -e "${CYAN}To uninstall:${NC}"
echo -e "  rm \"${DESKTOP_INSTALLED}\""
echo -e "  update-desktop-database \"${INSTALL_DIR}\""
