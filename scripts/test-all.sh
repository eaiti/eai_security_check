#!/bin/bash
# Comprehensive test runner for all platforms
# Detects current platform and runs appropriate tests

set -e

echo "🧪 EAI Security Check - Comprehensive Test Suite"
echo "================================================"

# Function to detect the current platform
detect_platform() {
    case "$OSTYPE" in
        darwin*)  echo "macos" ;;
        linux*)   echo "linux" ;;
        msys*|cygwin*|mingw*) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}

# Function to run tests based on platform
run_platform_tests() {
    local platform=$1
    echo "🔍 Detected platform: $platform"
    
    case $platform in
        "macos")
            echo "Running macOS-specific tests..."
            ./test-macos.sh
            ;;
        "linux")
            echo "Running Linux-specific tests..."
            ./test-linux.sh
            ;;
        "windows")
            echo "Running Windows-specific tests..."
            pwsh -ExecutionPolicy Bypass -File ./test-windows.ps1
            ;;
        *)
            echo "❌ Unsupported platform: $platform"
            echo "Supported platforms: macos, linux, windows"
            exit 1
            ;;
    esac
}

# Change to scripts directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📂 Working directory: $(pwd)"

# Run universal tests first
echo ""
echo "🏗️  Running universal tests..."
echo "------------------------------"

# Change to project root
cd ..

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run linting and formatting checks
echo "🔍 Running code quality checks..."
npm run lint
npm run format:check

# Build the project
echo "📦 Building project..."
npm run build

# Run core tests (Jest)
echo "🧪 Running core tests..."
npm run test:core

# Run UI tests if available
echo "🖥️  Running UI tests..."
npm run test:ui

echo ""
echo "🎯 Running platform-specific tests..."
echo "------------------------------------"

# Change back to scripts directory for platform tests
cd "$SCRIPT_DIR"

# Detect platform and run appropriate tests
PLATFORM=$(detect_platform)
run_platform_tests "$PLATFORM"

echo ""
echo "🎉 All tests completed successfully!"
echo "=========================="
echo "✅ Code quality checks passed"
echo "✅ Core tests passed"
echo "✅ UI tests passed"
echo "✅ Platform-specific tests passed"
echo ""
echo "📝 Security report available in: $(cd .. && pwd)/security-report.json"

exit 0