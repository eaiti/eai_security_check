#!/bin/bash

# Integration test script for daemon functionality
# This script tests the daemon implementation without actually sending emails

set -e

echo "🧪 Testing EAI Security Check Daemon Implementation"
echo "=================================================="

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Build the project
log_info "Building project..."
npm run build
log_success "Build completed"

# Test 1: Verify daemon help works
log_info "Testing daemon help command..."
node dist/index.js daemon --help > /dev/null
log_success "Daemon help command works"

# Test 2: Create daemon configuration
log_info "Testing daemon configuration creation..."
rm -f /tmp/test-daemon-config.json
cd /tmp
node /home/runner/work/eai_security_check/eai_security_check/dist/index.js daemon --init -c test-daemon-config.json
if [ -f "test-daemon-config.json" ]; then
    log_success "Daemon configuration created successfully"
else
    log_error "Failed to create daemon configuration"
    exit 1
fi

# Test 3: Check daemon status (should create state file)
log_info "Testing daemon status command..."
cd /home/runner/work/eai_security_check/eai_security_check
node dist/index.js daemon --status -c /tmp/test-daemon-config.json -s /tmp/test-daemon-state.json > /dev/null
if [ -f "/tmp/test-daemon-state.json" ]; then
    log_success "Daemon state tracking works"
else
    log_error "Failed to create daemon state file"
    exit 1
fi

# Test 4: Test that scheduling service can be instantiated
log_info "Testing SchedulingService unit tests..."
npm test src/__tests__/scheduling-service.test.ts --silent > /dev/null 2>&1
log_success "SchedulingService tests pass"

# Test 5: Verify system service files exist
log_info "Testing system service files..."
if [ -f "examples/eai-security-check-daemon.service" ] && [ -f "examples/com.eai.security-check.daemon.plist" ]; then
    log_success "System service files are present"
else
    log_error "System service files are missing"
    exit 1
fi

# Test 6: Verify setup script exists and is executable
log_info "Testing setup script..."
if [ -x "examples/setup-daemon.sh" ]; then
    # Test the help command
    ./examples/setup-daemon.sh help > /dev/null
    log_success "Setup script is executable and functional"
else
    log_error "Setup script is not executable"
    exit 1
fi

# Test 7: Verify all CLI commands still work
log_info "Testing existing CLI commands still work..."
node dist/index.js --help > /dev/null
node dist/index.js check --help > /dev/null
node dist/index.js init --help > /dev/null
node dist/index.js verify --help > /dev/null
log_success "All CLI commands functional"

# Test 8: Verify documentation is updated
log_info "Testing documentation updates..."
if grep -q "daemon" README.md; then
    log_success "Documentation includes daemon information"
else
    log_error "Documentation not updated with daemon info"
    exit 1
fi

# Clean up test files
rm -f /tmp/test-daemon-config.json /tmp/test-daemon-state.json

echo ""
echo "🎉 All integration tests passed!"
echo "✨ Daemon implementation is ready for use"
echo ""
echo "Summary of implemented features:"
echo "  • Daemon command with scheduling functionality"
echo "  • Email notifications using SMTP"
echo "  • Configurable intervals and security profiles"
echo "  • State persistence and duplicate prevention"
echo "  • System service integration (systemd/launchd)"
echo "  • Comprehensive CLI options and help text"
echo "  • Updated documentation and examples"
echo ""
echo "Usage example:"
echo "  eai-security-check daemon --init    # Create config"
echo "  eai-security-check daemon           # Start daemon"