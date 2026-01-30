#!/bin/bash
# Blackwire - Complete Installation Script
# Works on any Linux system with Python 3.8+

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
cat << "EOF"
  ╔═══════════════════════════════════════╗
  ║      Blackwire Installation Tool      ║
  ║    Burp-like Proxy in Python          ║
  ╚═══════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check Python version
echo -e "${CYAN}[*] Checking Python version...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[✗] Python 3 not found${NC}"
    echo -e "${YELLOW}    Please install Python 3.8 or higher${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
REQUIRED_VERSION="3.8"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}[✗] Python $PYTHON_VERSION found, but 3.8+ required${NC}"
    exit 1
fi

echo -e "${GREEN}[✓] Python $PYTHON_VERSION detected${NC}"

# Check pip
echo -e "${CYAN}[*] Checking pip...${NC}"
if ! python3 -m pip --version &> /dev/null; then
    echo -e "${YELLOW}[!] pip not found, attempting to install...${NC}"
    python3 -m ensurepip --default-pip 2>/dev/null || {
        echo -e "${RED}[✗] Could not install pip${NC}"
        echo -e "${YELLOW}    Please install pip manually${NC}"
        exit 1
    }
fi
echo -e "${GREEN}[✓] pip available${NC}"

# Create virtual environment
echo -e "${CYAN}[*] Creating virtual environment...${NC}"
if [ -d "venv" ]; then
    echo -e "${YELLOW}[!] Virtual environment already exists, skipping${NC}"
else
    python3 -m venv venv
    echo -e "${GREEN}[✓] Virtual environment created${NC}"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo -e "${CYAN}[*] Upgrading pip...${NC}"
pip install --upgrade pip -q

# Install dependencies
echo -e "${CYAN}[*] Installing dependencies...${NC}"
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}[✗] requirements.txt not found${NC}"
    exit 1
fi

pip install -r requirements.txt -q
echo -e "${GREEN}[✓] Dependencies installed${NC}"

# Create data directory
mkdir -p data
echo -e "${GREEN}[✓] Data directory created${NC}"

# Initialize mitmproxy certificates
echo -e "${CYAN}[*] Initializing mitmproxy certificates...${NC}"
if [ -f "$HOME/.mitmproxy/mitmproxy-ca-cert.pem" ]; then
    echo -e "${YELLOW}[!] Certificates already exist${NC}"
else
    python3 -c "from mitmproxy import certs; certs.CertStore.from_store('$HOME/.mitmproxy', 'mitmproxy', 2048)" 2>/dev/null || true
    if [ -f "$HOME/.mitmproxy/mitmproxy-ca-cert.pem" ]; then
        echo -e "${GREEN}[✓] Certificates generated${NC}"
        echo -e "${CYAN}    Certificate: $HOME/.mitmproxy/mitmproxy-ca-cert.pem${NC}"
        echo -e "${CYAN}    Import this certificate in your browser for HTTPS interception${NC}"
    else
        echo -e "${YELLOW}[!] Certificate generation skipped (will be created on first proxy start)${NC}"
    fi
fi

# Make scripts executable
echo -e "${CYAN}[*] Making scripts executable...${NC}"
chmod +x start.sh launch-with-browser.sh install-desktop.sh uninstall-desktop.sh 2>/dev/null || true
echo -e "${GREEN}[✓] Scripts ready${NC}"

# Ask about desktop launcher installation
echo ""
echo -e "${CYAN}[?] Install desktop launcher to application menu? [Y/n]${NC}"
read -p "    " INSTALL_DESKTOP
INSTALL_DESKTOP=${INSTALL_DESKTOP:-Y}

if [[ "$INSTALL_DESKTOP" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}[*] Installing desktop launcher...${NC}"
    ./install-desktop.sh
fi

# Installation complete
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Installation complete!                                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Installation directory:${NC} ${SCRIPT_DIR}"
echo ""
echo -e "${CYAN}Quick start:${NC}"
echo -e "  ${GREEN}1.${NC} Launch with browser:    ${YELLOW}./launch-with-browser.sh${NC}"
echo -e "  ${GREEN}2.${NC} Manual start:           ${YELLOW}./start.sh${NC}"
if [[ "$INSTALL_DESKTOP" =~ ^[Yy]$ ]]; then
echo -e "  ${GREEN}3.${NC} Application menu:       ${YELLOW}Search for 'Blackwire'${NC}"
fi
echo ""
echo -e "${CYAN}After launching, open:${NC} ${YELLOW}http://localhost:5000${NC}"
echo ""
echo -e "${CYAN}Documentation:${NC} ${YELLOW}cat README.md${NC}"
echo ""
