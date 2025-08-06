#!/bin/bash
# Simple platform test runner
# Usage: ./test-platform.sh [platform]
# If no platform specified, auto-detects current platform

set -e

# Function to detect the current platform
detect_platform() {
    case "$OSTYPE" in
        darwin*)  echo "macos" ;;
        linux*)   echo "linux" ;;
        msys*|cygwin*|mingw*) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}

# Get platform from argument or auto-detect
PLATFORM=${1:-$(detect_platform)}

echo "🎯 Running tests for platform: $PLATFORM"

# Change to scripts directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

case $PLATFORM in
    "macos")
        ./test-macos.sh
        ;;
    "linux")
        ./test-linux.sh
        ;;
    "windows")
        if command -v pwsh &> /dev/null; then
            pwsh -ExecutionPolicy Bypass -File ./test-windows.ps1
        else
            echo "❌ PowerShell Core (pwsh) not found. Please install PowerShell Core for Windows testing."
            exit 1
        fi
        ;;
    *)
        echo "❌ Unsupported platform: $PLATFORM"
        echo "Supported platforms: macos, linux, windows"
        echo "Usage: $0 [macos|linux|windows]"
        exit 1
        ;;
esac
