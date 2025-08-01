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

# Create a non-interactive version by modifying environment
export TESTING_MODE="non-interactive"

case "$OS" in
    "Darwin")
        echo -e "${GREEN}🍎 Running macOS compatibility test...${NC}"
        # Run macOS test with stdin closed to skip interactive prompts
        "$SCRIPT_DIR/test-macos.sh" < /dev/null || true
        ;;
    "Linux")
        echo -e "${GREEN}🐧 Running Linux compatibility test...${NC}"
        # Run Linux test with stdin closed to skip interactive prompts  
        "$SCRIPT_DIR/test-linux.sh" < /dev/null || true
        ;;
    *)
        echo -e "${YELLOW}⚠️  Automated testing not implemented for platform: $OS${NC}"
        echo -e "   Use the interactive test-platform.sh script instead."
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}===============================================${NC}"
echo -e "${GREEN}🎉 Automated testing completed!${NC}"
echo -e "${CYAN}💡 For interactive testing with remediation guidance,${NC}"
echo -e "${CYAN}   run: ./scripts/testing/test-platform.sh${NC}"