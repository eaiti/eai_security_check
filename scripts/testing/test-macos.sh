#!/bin/bash

# EAI Security Check - macOS Testing Script
# Tests all security checking methods on macOS systems

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI_PATH="$PROJECT_ROOT/dist/cli/index.js"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

echo -e "${CYAN}🍎 EAI Security Check - macOS Testing Suite${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Function to display test header
test_header() {
    echo -e "${BLUE}🔍 Testing: $1${NC}"
    echo -e "${BLUE}$(printf '=%.0s' {1..50})${NC}"
}

# Function to display test result
test_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case "$status" in
        "PASS")
            echo -e "${GREEN}✅ $test_name: PASSED${NC}"
            [ -n "$message" ] && echo -e "   $message"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            ;;
        "FAIL")
            echo -e "${RED}❌ $test_name: FAILED${NC}"
            [ -n "$message" ] && echo -e "   $message"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            ;;
        "SKIP")
            echo -e "${YELLOW}⏭️  $test_name: SKIPPED${NC}"
            [ -n "$message" ] && echo -e "   $message"
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
            ;;
    esac
}

# Function to pause for user interaction
pause_for_user() {
    local message="$1"
    echo ""
    echo -e "${YELLOW}⏸️  $message${NC}"
    
    # Check if running in non-interactive mode (CI, automated, or stdin not a terminal)
    if [ "$CI" = "true" ] || [ "$TESTING_MODE" = "non-interactive" ] || [ ! -t 0 ]; then
        echo -e "${YELLOW}⏭️  Skipping user prompt (non-interactive mode)${NC}"
        echo ""
        return
    fi
    
    echo -e "${YELLOW}Press Enter to continue after making changes, or 'q' to quit...${NC}"
    read -r response
    if [ "$response" = "q" ] || [ "$response" = "Q" ]; then
        echo -e "${CYAN}👋 Testing stopped by user.${NC}"
        exit 0
    fi
    echo ""
}

# Display system information
echo -e "${PURPLE}🖥️  System Information:${NC}"
echo -e "   Hostname: $(hostname)"
echo -e "   macOS Version: $(sw_vers -productVersion)"
echo -e "   Build Version: $(sw_vers -buildVersion)"
echo -e "   Hardware: $(system_profiler SPHardwareDataType | grep "Model Name" | awk -F': ' '{print $2}' | head -1)"
echo -e "   Chip: $(system_profiler SPHardwareDataType | grep "Chip" | awk -F': ' '{print $2}' | head -1)"
echo -e "   Current User: $(whoami)"
echo ""

# Check if CLI tool exists
if [ ! -f "$CLI_PATH" ]; then
    echo -e "${RED}❌ CLI tool not found at: $CLI_PATH${NC}"
    echo -e "${YELLOW}Please run 'npm run build' from the project root first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ CLI tool found and ready for testing${NC}"
echo ""

# Test 1: Platform Detection
test_header "Platform Detection"
if platform_info=$(node "$CLI_PATH" check --quiet 2>&1 | head -5); then
    if echo "$platform_info" | grep -i "macos\|darwin" > /dev/null; then
        test_result "Platform Detection" "PASS" "macOS platform correctly detected"
    else
        test_result "Platform Detection" "FAIL" "macOS platform not detected correctly"
    fi
else
    test_result "Platform Detection" "FAIL" "Failed to run platform detection"
fi
echo ""

# Test 2: FileVault Disk Encryption
test_header "FileVault Disk Encryption"
echo -e "Checking FileVault encryption status..."

if command -v fdesetup >/dev/null 2>&1; then
    filevault_status=$(fdesetup status 2>/dev/null || echo "unknown")
    if echo "$filevault_status" | grep -i "on" > /dev/null; then
        test_result "FileVault" "PASS" "FileVault is enabled"
        echo -e "   Status: $filevault_status"
    else
        test_result "FileVault" "FAIL" "FileVault is not enabled"
        echo -e "   Status: $filevault_status"
        echo -e "${YELLOW}💡 To enable FileVault:${NC}"
        echo -e "   System Preferences > Security & Privacy > FileVault > Turn On FileVault"
        echo -e "   Or use: sudo fdesetup enable"
        pause_for_user "Enable FileVault and then continue testing"
    fi
else
    test_result "FileVault" "SKIP" "fdesetup command not available"
fi
echo ""

# Test 3: Password Protection & Screen Lock
test_header "Password Protection & Screen Lock"
echo -e "Checking screen saver and password settings..."

# Check if password is required for screen saver
ask_password=$(defaults read com.apple.screensaver askForPassword 2>/dev/null || echo "0")
if [ "$ask_password" = "1" ]; then
    test_result "Screen Saver Password" "PASS" "Password required for screen saver"
    
    # Check password delay
    password_delay=$(defaults read com.apple.screensaver askForPasswordDelay 2>/dev/null || echo "300")
    if [ "$password_delay" -le 5 ]; then
        test_result "Password Delay" "PASS" "Password required immediately ($password_delay seconds)"
    else
        test_result "Password Delay" "FAIL" "Password delay too long ($password_delay seconds)"
        echo -e "${YELLOW}💡 To require password immediately:${NC}"
        echo -e "   defaults write com.apple.screensaver askForPasswordDelay -int 0"
        pause_for_user "Adjust password delay and continue testing"
    fi
else
    test_result "Screen Saver Password" "FAIL" "Password not required for screen saver"
    echo -e "${YELLOW}💡 To require password:${NC}"
    echo -e "   defaults write com.apple.screensaver askForPassword -int 1"
    echo -e "   System Preferences > Security & Privacy > General > Require password immediately"
    pause_for_user "Enable screen saver password and continue testing"
fi
echo ""

# Test 4: Application Firewall
test_header "Application Firewall"
echo -e "Checking macOS Application Firewall..."

# Check if Application Firewall is enabled
firewall_state=$(defaults read /Library/Preferences/com.apple.alf globalstate 2>/dev/null || echo "0")
case "$firewall_state" in
    "1")
        test_result "Application Firewall" "PASS" "Firewall enabled for specific services"
        ;;
    "2")
        test_result "Application Firewall" "PASS" "Firewall enabled for essential services"
        ;;
    "0")
        test_result "Application Firewall" "FAIL" "Application Firewall is disabled"
        echo -e "${YELLOW}💡 To enable Application Firewall:${NC}"
        echo -e "   System Preferences > Security & Privacy > Firewall > Turn On Firewall"
        echo -e "   Or use: sudo defaults write /Library/Preferences/com.apple.alf globalstate -int 1"
        pause_for_user "Enable Application Firewall and continue testing"
        ;;
    *)
        test_result "Application Firewall" "SKIP" "Unknown firewall state: $firewall_state"
        ;;
esac

# Check stealth mode
stealth_enabled=$(defaults read /Library/Preferences/com.apple.alf stealthenabled 2>/dev/null || echo "0")
if [ "$stealth_enabled" = "1" ]; then
    test_result "Firewall Stealth Mode" "PASS" "Stealth mode is enabled"
else
    test_result "Firewall Stealth Mode" "FAIL" "Stealth mode is disabled"
    echo -e "${YELLOW}💡 To enable stealth mode:${NC}"
    echo -e "   System Preferences > Security & Privacy > Firewall > Firewall Options > Enable stealth mode"
    echo -e "   Or use: sudo defaults write /Library/Preferences/com.apple.alf stealthenabled -int 1"
fi
echo ""

# Test 5: Gatekeeper
test_header "Gatekeeper (App Store and Identified Developers)"
echo -e "Checking Gatekeeper malware protection..."

if command -v spctl >/dev/null 2>&1; then
    gatekeeper_status=$(spctl --status 2>/dev/null || echo "unknown")
    if echo "$gatekeeper_status" | grep -i "enabled" > /dev/null; then
        test_result "Gatekeeper" "PASS" "Gatekeeper is enabled"
        
        # Check assessment policy
        app_policy=$(spctl --status --verbose 2>/dev/null | grep "assessments enabled" || echo "")
        if [ -n "$app_policy" ]; then
            test_result "Gatekeeper Assessment" "PASS" "App assessments are enabled"
        fi
    else
        test_result "Gatekeeper" "FAIL" "Gatekeeper is disabled"
        echo -e "${YELLOW}💡 To enable Gatekeeper:${NC}"
        echo -e "   sudo spctl --master-enable"
        echo -e "   System Preferences > Security & Privacy > General > Allow apps downloaded from: App Store and identified developers"
        pause_for_user "Enable Gatekeeper and continue testing"
    fi
else
    test_result "Gatekeeper" "SKIP" "spctl command not available"
fi
echo ""

# Test 6: System Integrity Protection (SIP)
test_header "System Integrity Protection (SIP)"
echo -e "Checking System Integrity Protection..."

if command -v csrutil >/dev/null 2>&1; then
    sip_status=$(csrutil status 2>/dev/null || echo "unknown")
    if echo "$sip_status" | grep -i "enabled" > /dev/null; then
        test_result "SIP" "PASS" "System Integrity Protection is enabled"
        echo -e "   Status: $sip_status"
    else
        test_result "SIP" "FAIL" "System Integrity Protection is disabled"
        echo -e "   Status: $sip_status"
        echo -e "${YELLOW}💡 To enable SIP:${NC}"
        echo -e "   1. Boot into Recovery Mode (Command + R during startup)"
        echo -e "   2. Open Terminal from Utilities menu"
        echo -e "   3. Run: csrutil enable"
        echo -e "   4. Restart normally"
        pause_for_user "SIP requires Recovery Mode to enable. Note this for later and continue testing"
    fi
else
    test_result "SIP" "SKIP" "csrutil command not available"
fi
echo ""

# Test 7: Remote Login (SSH)
test_header "Remote Login (SSH)"
echo -e "Checking SSH and remote login settings..."

# Check if SSH is enabled
ssh_enabled=$(systemsetup -getremotelogin 2>/dev/null | grep "On" || echo "")
if [ -z "$ssh_enabled" ]; then
    test_result "SSH Remote Login" "PASS" "SSH remote login is disabled"
else
    test_result "SSH Remote Login" "FAIL" "SSH remote login is enabled"
    echo -e "${YELLOW}💡 To disable SSH:${NC}"
    echo -e "   System Preferences > Sharing > Uncheck Remote Login"
    echo -e "   Or use: sudo systemsetup -setremotelogin off"
    pause_for_user "Disable SSH remote login if not needed and continue testing"
fi
echo ""

# Test 8: Remote Management
test_header "Remote Management"
echo -e "Checking remote management settings..."

# Check for Apple Remote Desktop
ard_enabled=$(ps aux | grep "ARDAgent" | grep -v grep || echo "")
if [ -z "$ard_enabled" ]; then
    test_result "Apple Remote Desktop" "PASS" "Apple Remote Desktop is not running"
else
    test_result "Apple Remote Desktop" "FAIL" "Apple Remote Desktop is running"
    echo -e "${YELLOW}💡 To disable Apple Remote Desktop:${NC}"
    echo -e "   System Preferences > Sharing > Uncheck Remote Management"
fi

# Check for VNC
vnc_enabled=$(ps aux | grep -i vnc | grep -v grep || echo "")
if [ -z "$vnc_enabled" ]; then
    test_result "VNC Server" "PASS" "VNC server is not running"
else
    test_result "VNC Server" "FAIL" "VNC server is running"
    echo -e "${YELLOW}💡 To disable VNC:${NC}"
    echo -e "   System Preferences > Sharing > Uncheck Screen Sharing"
fi
echo ""

# Test 9: Automatic Updates
test_header "Automatic Updates"
echo -e "Checking automatic update settings..."

# Check automatic updates
auto_update=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate.plist AutomaticCheckEnabled 2>/dev/null || echo "0")
if [ "$auto_update" = "1" ]; then
    test_result "Automatic Update Check" "PASS" "Automatic update checking is enabled"
else
    test_result "Automatic Update Check" "FAIL" "Automatic update checking is disabled"
    echo -e "${YELLOW}💡 To enable automatic updates:${NC}"
    echo -e "   System Preferences > Software Update > Advanced > Check for updates"
    echo -e "   Or use: sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate.plist AutomaticCheckEnabled -bool true"
fi

# Check automatic download
auto_download=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate.plist AutomaticDownload 2>/dev/null || echo "0")
if [ "$auto_download" = "1" ]; then
    test_result "Automatic Download" "PASS" "Automatic download is enabled"
else
    test_result "Automatic Download" "FAIL" "Automatic download is disabled"
fi

# Check critical update install
critical_update=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate.plist CriticalUpdateInstall 2>/dev/null || echo "0")
if [ "$critical_update" = "1" ]; then
    test_result "Critical Update Install" "PASS" "Automatic critical updates enabled"
else
    test_result "Critical Update Install" "FAIL" "Automatic critical updates disabled"
fi
echo ""

# Test 10: Sharing Services
test_header "Sharing Services"
echo -e "Checking potentially insecure sharing services..."

# Check file sharing
file_sharing=$(systemsetup -getremoteappleevents 2>/dev/null | grep "On" || echo "")
if [ -z "$file_sharing" ]; then
    test_result "File Sharing" "PASS" "File sharing appears disabled"
else
    test_result "File Sharing" "FAIL" "File sharing may be enabled"
fi

# Check screen sharing
screen_sharing=$(launchctl list | grep com.apple.screensharing || echo "")
if [ -z "$screen_sharing" ]; then
    test_result "Screen Sharing" "PASS" "Screen sharing is not loaded"
else
    test_result "Screen Sharing" "FAIL" "Screen sharing service is loaded"
    echo -e "${YELLOW}💡 To disable screen sharing:${NC}"
    echo -e "   System Preferences > Sharing > Uncheck Screen Sharing"
fi

# Check for media sharing
media_sharing=$(ps aux | grep "Media Sharing" | grep -v grep || echo "")
if [ -z "$media_sharing" ]; then
    test_result "Media Sharing" "PASS" "Media sharing is not running"
else
    test_result "Media Sharing" "FAIL" "Media sharing is running"
fi
echo ""

# Test 11: Privacy & Security Settings
test_header "Privacy & Security Settings"
echo -e "Checking additional privacy settings..."

# Check location services
location_enabled=$(defaults read /var/db/locationd/Library/Preferences/ByHost/com.apple.locationd LocationServicesEnabled 2>/dev/null || echo "unknown")
if [ "$location_enabled" = "1" ]; then
    test_result "Location Services" "FAIL" "Location services are enabled (review apps with access)"
    echo -e "${YELLOW}💡 Review location access:${NC}"
    echo -e "   System Preferences > Security & Privacy > Privacy > Location Services"
else
    test_result "Location Services" "PASS" "Location services configuration appears secure"
fi

# Check if Siri is disabled
siri_enabled=$(defaults read com.apple.assistant.support "Assistant Enabled" 2>/dev/null || echo "0")
if [ "$siri_enabled" = "0" ]; then
    test_result "Siri" "PASS" "Siri is disabled"
else
    test_result "Siri" "FAIL" "Siri is enabled (review privacy implications)"
fi
echo ""

# Test 12: Running EAI Security Check
test_header "EAI Security Check Integration"
echo -e "Running full security check to validate integration..."

temp_output=$(mktemp)
if node "$CLI_PATH" check default --quiet > "$temp_output" 2>&1; then
    test_result "CLI Integration" "PASS" "EAI Security Check ran successfully"
    echo -e "${CYAN}Sample output:${NC}"
    head -10 "$temp_output" | sed 's/^/   /'
else
    test_result "CLI Integration" "FAIL" "EAI Security Check failed to run"
    echo -e "${RED}Error output:${NC}"
    head -5 "$temp_output" | sed 's/^/   /'
fi
rm -f "$temp_output"
echo ""

# Display final summary
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}🏁 macOS Testing Summary${NC}"
echo -e "${CYAN}=========================================${NC}"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED_TESTS${NC}"
echo ""

# Calculate pass rate
if [ $TOTAL_TESTS -gt 0 ]; then
    pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "Pass Rate: ${GREEN}$pass_rate%${NC}"
else
    echo -e "Pass Rate: ${YELLOW}N/A${NC}"
fi

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Your macOS system appears to be well-configured for security.${NC}"
else
    echo -e "${YELLOW}⚠️  Some security settings need attention. Review the failed tests above.${NC}"
    echo -e "${CYAN}💡 Use 'node $CLI_PATH check --help' for more configuration options.${NC}"
fi

echo ""
echo -e "${CYAN}📚 For more information:${NC}"
echo -e "   • Run: node $CLI_PATH check default"
echo -e "   • View: README.md for detailed documentation"
echo -e "   • Configure: Use 'node $CLI_PATH interactive' for guided setup"