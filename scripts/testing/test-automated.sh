#!/bin/bash

# EAI Security Check - Non-Interactive Test Runner
# Runs all platform tests without user interaction for CI/automated testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${CYAN}🔒 EAI Security Check - Automated Testing Suite${NC}"
echo -e "${CYAN}===============================================${NC}"
echo ""

# Build the project if needed
if [ ! -f "$PROJECT_ROOT/dist/cli/index.js" ]; then
    echo -e "${YELLOW}⚠️  CLI tool not built. Building now...${NC}"
    cd "$PROJECT_ROOT"
    npm run build
    echo -e "${GREEN}✅ Build completed${NC}"
    echo ""
fi

# Detect platform
OS=$(uname -s)
echo -e "${BLUE}🔍 Detected Platform: $OS${NC}"

# Create a non-interactive version by setting environment variables
export TESTING_MODE="non-interactive"
export CI="true"

# Platform-specific testing
case "$OS" in
    "Darwin")
        echo -e "${GREEN}🍎 Running macOS compatibility test...${NC}"
        if [ -f "$SCRIPT_DIR/test-macos.sh" ]; then
            chmod +x "$SCRIPT_DIR/test-macos.sh"
            "$SCRIPT_DIR/test-macos.sh"
        else
            echo -e "${RED}❌ macOS test script not found${NC}"
            exit 1
        fi
        ;;
    "Linux")
        echo -e "${GREEN}🐧 Running Linux compatibility test...${NC}"
        if [ -f "$SCRIPT_DIR/test-linux.sh" ]; then
            chmod +x "$SCRIPT_DIR/test-linux.sh"
            "$SCRIPT_DIR/test-linux.sh"
        else
            echo -e "${RED}❌ Linux test script not found${NC}"
            exit 1
        fi
        ;;
    "CYGWIN"*|"MINGW"*|"MSYS"*)
        echo -e "${GREEN}🪟 Running Windows compatibility test...${NC}"
        if [ -f "$SCRIPT_DIR/test-windows.ps1" ]; then
            powershell.exe -ExecutionPolicy Bypass -File "$SCRIPT_DIR/test-windows.ps1" -Quiet
        else
            echo -e "${RED}❌ Windows test script not found${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${YELLOW}⚠️  Automated testing not implemented for platform: $OS${NC}"
        echo -e "   Use the interactive test-platform.sh script instead."
        exit 1
        ;;
esac

# Test pkg executable if available
echo ""
echo -e "${BLUE}🔧 Testing pkg executable (if available)...${NC}"

PKG_BINARY=""
case "$OS" in
    "Darwin")
        PKG_BINARY="$PROJECT_ROOT/bin/index-macos"
        ;;
    "Linux")
        PKG_BINARY="$PROJECT_ROOT/bin/index-linux"
        ;;
    "CYGWIN"*|"MINGW"*|"MSYS"*)
        PKG_BINARY="$PROJECT_ROOT/bin/index-win.exe"
        ;;
esac

if [ -n "$PKG_BINARY" ] && [ -f "$PKG_BINARY" ]; then
    echo -e "${GREEN}✅ Found pkg executable: $PKG_BINARY${NC}"
    
    # Make executable (for Unix-like systems)
    if [ "$OS" != "CYGWIN"* ] && [ "$OS" != "MINGW"* ] && [ "$OS" != "MSYS"* ]; then
        chmod +x "$PKG_BINARY"
    fi
    
    # Test basic commands
    echo -e "${BLUE}   Testing --help command...${NC}"
    if "$PKG_BINARY" --help > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Help command works${NC}"
    else
        echo -e "${RED}   ❌ Help command failed${NC}"
    fi
    
    echo -e "${BLUE}   Testing --version command...${NC}"
    if "$PKG_BINARY" --version > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Version command works${NC}"
    else
        echo -e "${RED}   ❌ Version command failed${NC}"
    fi
    
    echo -e "${BLUE}   Testing profiles command...${NC}"
    if "$PKG_BINARY" check --help > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Check command works${NC}"
    else
        echo -e "${RED}   ❌ Check command failed${NC}"
    fi
    
else
    echo -e "${YELLOW}⚠️  pkg executable not found. Run 'npm run pkg:build' to create it.${NC}"
fi

echo ""
echo -e "${CYAN}===============================================${NC}"
echo -e "${GREEN}🎉 Automated testing completed!${NC}"
echo -e "${CYAN}💡 For interactive testing with remediation guidance,${NC}"
echo -e "${CYAN}   run: ./scripts/testing/test-platform.sh${NC}"