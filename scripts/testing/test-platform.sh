#!/bin/bash

# EAI Security Check - Platform Testing Script
# This script automatically detects the current platform and runs the appropriate test script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${CYAN}🔒 EAI Security Check - Platform Testing Suite${NC}"
echo -e "${CYAN}==============================================${NC}"
echo ""

# Detect platform
OS=$(uname -s)
ARCH=$(uname -m)

echo -e "${BLUE}🔍 Platform Detection:${NC}"
echo -e "   OS: $OS"
echo -e "   Architecture: $ARCH"

case "$OS" in
    "Darwin")
        PLATFORM="macOS"
        TEST_SCRIPT="test-macos.sh"
        MACOS_VERSION=$(sw_vers -productVersion 2>/dev/null || echo "Unknown")
        echo -e "   macOS Version: $MACOS_VERSION"
        ;;
    "Linux")
        PLATFORM="Linux"
        TEST_SCRIPT="test-linux.sh"
        if [ -f /etc/os-release ]; then
            LINUX_DISTRO=$(grep '^PRETTY_NAME=' /etc/os-release | cut -d'"' -f2)
            echo -e "   Distribution: $LINUX_DISTRO"
        fi
        ;;
    "CYGWIN"*|"MINGW"*|"MSYS"*)
        PLATFORM="Windows"
        TEST_SCRIPT="test-windows.ps1"
        echo -e "   Windows (via $OS)"
        ;;
    *)
        echo -e "${RED}❌ Unsupported platform: $OS${NC}"
        echo -e "   This testing suite supports macOS, Linux, and Windows only."
        exit 1
        ;;
esac

echo -e "   Detected Platform: ${GREEN}$PLATFORM${NC}"
echo ""

# Check if the CLI tool is built
if [ ! -f "$PROJECT_ROOT/dist/cli/index.js" ]; then
    echo -e "${YELLOW}⚠️  CLI tool not built. Building now...${NC}"
    cd "$PROJECT_ROOT"
    npm run build
    echo -e "${GREEN}✅ Build completed${NC}"
    echo ""
fi

# Check if the appropriate test script exists
TEST_SCRIPT_PATH="$SCRIPT_DIR/$TEST_SCRIPT"
if [ ! -f "$TEST_SCRIPT_PATH" ]; then
    echo -e "${RED}❌ Test script not found: $TEST_SCRIPT_PATH${NC}"
    echo -e "   Available test scripts:"
    ls -la "$SCRIPT_DIR"/test-*.sh 2>/dev/null || echo "   No test scripts found"
    exit 1
fi

# Make the test script executable
chmod +x "$TEST_SCRIPT_PATH"

echo -e "${GREEN}🚀 Running $PLATFORM test script...${NC}"
echo -e "${CYAN}===========================================${NC}"
echo ""

# Execute the platform-specific test script
if [ "$PLATFORM" = "Windows" ]; then
    # For Windows, we need to run PowerShell
    powershell.exe -ExecutionPolicy Bypass -File "$TEST_SCRIPT_PATH"
else
    # For macOS and Linux, run bash script
    "$TEST_SCRIPT_PATH"
fi

echo ""
echo -e "${CYAN}===========================================${NC}"
echo -e "${GREEN}🎉 Platform testing completed!${NC}"