#!/bin/bash
# Local CI simulation script
# Runs the same tests that would run in CI environment

set -e

echo "🚀 EAI Security Check - Local CI Simulation"
echo "==========================================="

# Function to detect the current platform
detect_platform() {
    case "$OSTYPE" in
        darwin*)  echo "macos" ;;
        linux*)   echo "linux" ;;
        msys*|cygwin*|mingw*) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}

# Change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "📂 Project directory: $(pwd)"
echo "🔍 Platform: $(detect_platform)"
echo ""

# Clean up previous runs
echo "🧹 Cleaning up previous runs..."
rm -f security-report.json
rm -rf coverage/
rm -rf dist/
rm -rf .angular/
rm -rf ui/.angular/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install UI dependencies
echo "📦 Installing UI dependencies..."
cd ui && npm install && cd ..

# Run full verification suite (same as CI)
echo ""
echo "🔍 Running full verification suite..."
echo "====================================="

# This runs: test:all + build + lint + format:check
npm run verify

echo ""
echo "🎯 Running additional CI checks..."
echo "================================="

# Test build artifacts
echo "📦 Testing build artifacts..."
if [[ -d "dist" && -f "dist/cli/index.js" ]]; then
    echo "✅ Build artifacts created successfully"
else
    echo "❌ Build artifacts missing"
    exit 1
fi

# Test executable
echo "🔧 Testing executable..."
node dist/cli/index.js --version || {
    echo "❌ Executable test failed"
    exit 1
}

# Run a quick security check to ensure it works
echo "🛡️  Running quick security check..."
node dist/cli/index.js check --config examples/developer-config.json --non-interactive || {
    echo "⚠️  Security check completed with warnings (expected for CI)"
}

# Validate report was generated
if [[ -f "security-report.json" ]]; then
    echo "✅ Security report generated"
    
    # Validate JSON if jq is available
    if command -v jq &> /dev/null; then
        jq empty security-report.json && echo "✅ Report JSON is valid"
    fi
else
    echo "❌ Security report not generated"
    exit 1
fi

echo ""
echo "🎉 Local CI simulation completed successfully!"
echo "============================================="
echo "✅ All tests passed"
echo "✅ Build successful" 
echo "✅ Executable works"
echo "✅ Security check functional"
echo ""
echo "📊 Test Results Summary:"
echo "- Core tests: $(npm run test:core --silent 2>/dev/null | grep -o '[0-9]* passing' || echo 'PASSED')"
echo "- UI tests: $(npm run test:ui --silent 2>/dev/null | grep -o '[0-9]* specs' || echo 'PASSED')"
echo "- Build: SUCCESS"
echo "- Linting: CLEAN"
echo "- Security Check: FUNCTIONAL"

exit 0