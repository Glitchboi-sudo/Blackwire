#!/bin/bash
# Blackwire - Installation Verification Script
# Checks if everything is properly installed and portable

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${CYAN}"
cat << "EOF"
  ╔═══════════════════════════════════════╗
  ║   Blackwire Installation Verifier     ║
  ╚═══════════════════════════════════════╝
EOF
echo -e "${NC}"

check() {
    local name="$1"
    local cmd="$2"

    if eval "$cmd" &>/dev/null; then
        echo -e "${GREEN}[✓]${NC} $name"
        return 0
    else
        echo -e "${RED}[✗]${NC} $name"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

warn() {
    local name="$1"
    local cmd="$2"

    if eval "$cmd" &>/dev/null; then
        echo -e "${GREEN}[✓]${NC} $name"
        return 0
    else
        echo -e "${YELLOW}[!]${NC} $name (optional)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

info() {
    echo -e "${CYAN}[i]${NC} $1"
}

echo "Checking System Requirements..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "Python 3 installed" "command -v python3"
if command -v python3 &>/dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    info "Python version: $PYTHON_VERSION"
fi

check "pip available" "python3 -m pip --version"

echo ""
echo "Checking Project Structure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "requirements.txt exists" "test -f requirements.txt"
check "backend/ directory" "test -d backend"
check "backend/main.py exists" "test -f backend/main.py"
check "backend/mitm_addon.py exists" "test -f backend/mitm_addon.py"
check "extensions/ directory" "test -d backend/extensions"
warn "data/ directory" "test -d data"
warn "projects/ directory" "test -d projects"

echo ""
echo "Checking Scripts..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "install.sh exists" "test -f install.sh"
check "start.sh exists" "test -f start.sh"
check "launch-with-browser.sh exists" "test -f launch-with-browser.sh"
check "install-desktop.sh exists" "test -f install-desktop.sh"
check "uninstall-desktop.sh exists" "test -f uninstall-desktop.sh"
check "blackwire.desktop template" "test -f blackwire.desktop"

check "install.sh executable" "test -x install.sh"
check "start.sh executable" "test -x start.sh"
check "launch-with-browser.sh executable" "test -x launch-with-browser.sh"
check "install-desktop.sh executable" "test -x install-desktop.sh"
check "uninstall-desktop.sh executable" "test -x uninstall-desktop.sh"

echo ""
echo "Checking Portability..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "Scripts use relative paths" "! grep -r '/home/' *.sh 2>/dev/null | grep -v '#'"
check "Desktop template uses INSTALL_PATH" "grep -q 'INSTALL_PATH' blackwire.desktop"

info "Current directory: $SCRIPT_DIR"

echo ""
echo "Checking Virtual Environment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "venv" ]; then
    check "Virtual environment exists" "test -d venv"
    check "venv/bin/activate exists" "test -f venv/bin/activate"

    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
        warn "FastAPI installed" "python3 -c 'import fastapi' 2>/dev/null"
        warn "mitmproxy installed" "python3 -c 'import mitmproxy' 2>/dev/null"
        warn "uvicorn installed" "python3 -c 'import uvicorn' 2>/dev/null"
        deactivate 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}[!]${NC} Virtual environment not created yet"
    info "Run './install.sh' to create it"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "Checking Optional Components..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

warn "icon.svg exists" "test -f icon.svg"
warn "README.md exists" "test -f README.md"
warn "INSTALL.md exists" "test -f INSTALL.md"
warn "mitmproxy certificates" "test -f $HOME/.mitmproxy/mitmproxy-ca-cert.pem"

if [ -f "$HOME/.local/share/applications/blackwire.desktop" ]; then
    check "Desktop launcher installed" "test -f $HOME/.local/share/applications/blackwire.desktop"
else
    echo -e "${YELLOW}[!]${NC} Desktop launcher not installed (run ./install-desktop.sh)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ All critical checks passed!                            ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Warnings: $WARNINGS (optional components missing)${NC}"
    fi
    echo ""
    echo -e "${CYAN}Ready to use! Launch with:${NC}"
    echo -e "  ${YELLOW}./launch-with-browser.sh${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ Installation incomplete                                 ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Errors: $ERRORS${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo ""
    echo -e "${CYAN}Run the installer to fix issues:${NC}"
    echo -e "  ${YELLOW}./install.sh${NC}"
    echo ""
    exit 1
fi
