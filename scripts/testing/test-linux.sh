#!/bin/bash

# EAI Security Check - Linux Testing Script
# Tests all security checking methods on Linux systems

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

echo -e "${CYAN}🐧 EAI Security Check - Linux Testing Suite${NC}"
echo -e "${CYAN}==========================================${NC}"
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

# Function to run CLI command and capture result
run_security_check() {
    local check_name="$1"
    local temp_file
    temp_file=$(mktemp)
    
    # Run the security check and capture output
    if node "$CLI_PATH" check --quiet > "$temp_file" 2>&1; then
        # Parse the output to find the specific check result
        if grep -q "$check_name" "$temp_file"; then
            local result
            result=$(grep "$check_name" "$temp_file" | head -1)
            echo "$result"
            rm -f "$temp_file"
            return 0
        else
            echo "Check not found in output"
            rm -f "$temp_file"
            return 1
        fi
    else
        echo "Command failed"
        rm -f "$temp_file"
        return 1
    fi
}

# Display system information
echo -e "${PURPLE}🖥️  System Information:${NC}"
echo -e "   Hostname: $(hostname)"
echo -e "   Kernel: $(uname -r)"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "   Distribution: $PRETTY_NAME"
    echo -e "   Version: $VERSION_ID"
fi
echo -e "   Architecture: $(uname -m)"
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
    if echo "$platform_info" | grep -i "linux" > /dev/null; then
        test_result "Platform Detection" "PASS" "Linux platform correctly detected"
    else
        test_result "Platform Detection" "FAIL" "Linux platform not detected correctly"
    fi
else
    test_result "Platform Detection" "FAIL" "Failed to run platform detection"
fi
echo ""

# Test 2: Disk Encryption (LUKS)
test_header "Disk Encryption (LUKS)"
echo -e "Checking for LUKS disk encryption..."

if command -v lsblk >/dev/null 2>&1; then
    luks_result=$(lsblk -f 2>/dev/null | grep -i "crypto_LUKS" || true)
    if [ -n "$luks_result" ]; then
        test_result "LUKS Detection" "PASS" "LUKS encrypted devices found"
        echo -e "   Encrypted devices: $luks_result"
    else
        test_result "LUKS Detection" "FAIL" "No LUKS encrypted devices found"
        echo -e "${YELLOW}💡 To enable disk encryption:${NC}"
        echo -e "   - During installation: Choose encrypted disk option"
        echo -e "   - Post-installation: Use cryptsetup to encrypt partitions"
        pause_for_user "Enable disk encryption and then continue testing"
    fi
else
    test_result "LUKS Detection" "SKIP" "lsblk command not available"
fi
echo ""

# Test 3: Password Protection & Auto-lock
test_header "Password Protection & Screen Lock"
echo -e "Checking screen lock and password settings..."

# Check for screen lock on GNOME
if command -v gsettings >/dev/null 2>&1; then
    lock_enabled=$(gsettings get org.gnome.desktop.screensaver lock-enabled 2>/dev/null || echo "false")
    if [ "$lock_enabled" = "true" ]; then
        test_result "Screen Lock (GNOME)" "PASS" "Screen lock is enabled"
        
        # Check auto-lock timeout
        idle_delay=$(gsettings get org.gnome.desktop.session idle-delay 2>/dev/null || echo "0")
        test_result "Auto-lock Timeout" "PASS" "Idle delay: $idle_delay seconds"
    else
        test_result "Screen Lock (GNOME)" "FAIL" "Screen lock is disabled"
        echo -e "${YELLOW}💡 To enable screen lock:${NC}"
        echo -e "   gsettings set org.gnome.desktop.screensaver lock-enabled true"
        pause_for_user "Enable screen lock and continue testing"
    fi
elif command -v kwriteconfig5 >/dev/null 2>&1; then
    # Check for KDE screen lock
    test_result "Screen Lock Detection" "PASS" "KDE detected - manual verification needed"
    echo -e "${YELLOW}💡 For KDE, check System Settings > Screen Locking${NC}"
else
    test_result "Screen Lock Detection" "SKIP" "Desktop environment not detected"
fi
echo ""

# Test 4: Firewall
test_header "Firewall"
echo -e "Checking firewall status..."

# Check ufw (Ubuntu/Debian)
if command -v ufw >/dev/null 2>&1; then
    ufw_status=$(sudo ufw status 2>/dev/null | head -1 || echo "unknown")
    if echo "$ufw_status" | grep -i "active" > /dev/null; then
        test_result "UFW Firewall" "PASS" "UFW firewall is active"
    else
        test_result "UFW Firewall" "FAIL" "UFW firewall is inactive"
        echo -e "${YELLOW}💡 To enable UFW firewall:${NC}"
        echo -e "   sudo ufw enable"
        pause_for_user "Enable UFW firewall and continue testing"
    fi
# Check firewalld (Fedora/RHEL/CentOS)
elif command -v firewall-cmd >/dev/null 2>&1; then
    if systemctl is-active --quiet firewalld; then
        test_result "Firewalld" "PASS" "Firewalld is active"
    else
        test_result "Firewalld" "FAIL" "Firewalld is inactive"
        echo -e "${YELLOW}💡 To enable firewalld:${NC}"
        echo -e "   sudo systemctl enable --now firewalld"
        pause_for_user "Enable firewalld and continue testing"
    fi
# Check iptables
elif command -v iptables >/dev/null 2>&1; then
    iptables_rules=$(sudo iptables -L 2>/dev/null | wc -l || echo "0")
    if [ "$iptables_rules" -gt 10 ]; then
        test_result "iptables" "PASS" "iptables rules configured ($iptables_rules lines)"
    else
        test_result "iptables" "FAIL" "iptables has minimal/no rules"
    fi
else
    test_result "Firewall Detection" "SKIP" "No supported firewall found"
fi
echo ""

# Test 5: Package Verification (GPG)
test_header "Package Verification"
echo -e "Checking package manager GPG verification..."

if command -v dnf >/dev/null 2>&1; then
    # Fedora/RHEL - check gpgcheck setting
    gpgcheck=$(grep "^gpgcheck" /etc/dnf/dnf.conf 2>/dev/null | cut -d'=' -f2 || echo "0")
    if [ "$gpgcheck" = "1" ]; then
        test_result "DNF GPG Check" "PASS" "GPG verification enabled in dnf.conf"
    else
        test_result "DNF GPG Check" "FAIL" "GPG verification disabled in dnf.conf"
        echo -e "${YELLOW}💡 To enable GPG verification:${NC}"
        echo -e "   Add 'gpgcheck=1' to /etc/dnf/dnf.conf"
    fi
elif command -v apt >/dev/null 2>&1; then
    # Ubuntu/Debian - GPG keys should be present
    apt_keys=$(apt-key list 2>/dev/null | grep -c "pub" || echo "0")
    if [ "$apt_keys" -gt 0 ]; then
        test_result "APT GPG Keys" "PASS" "$apt_keys GPG keys configured"
    else
        test_result "APT GPG Keys" "FAIL" "No APT GPG keys found"
    fi
else
    test_result "Package Verification" "SKIP" "Supported package manager not found"
fi
echo ""

# Test 6: System Integrity Protection
test_header "System Integrity Protection"
echo -e "Checking system integrity protection..."

# Check SELinux
if command -v getenforce >/dev/null 2>&1; then
    selinux_status=$(getenforce 2>/dev/null || echo "unknown")
    if [ "$selinux_status" = "Enforcing" ]; then
        test_result "SELinux" "PASS" "SELinux is enforcing"
    elif [ "$selinux_status" = "Permissive" ]; then
        test_result "SELinux" "FAIL" "SELinux is permissive (should be enforcing)"
        echo -e "${YELLOW}💡 To enforce SELinux:${NC}"
        echo -e "   sudo setenforce 1"
        echo -e "   Edit /etc/selinux/config and set SELINUX=enforcing"
    else
        test_result "SELinux" "FAIL" "SELinux is disabled"
    fi
# Check AppArmor
elif command -v aa-status >/dev/null 2>&1; then
    if aa-status >/dev/null 2>&1; then
        apparmor_profiles=$(aa-status | grep "profiles are in enforce mode" | awk '{print $1}' || echo "0")
        test_result "AppArmor" "PASS" "$apparmor_profiles profiles in enforce mode"
    else
        test_result "AppArmor" "FAIL" "AppArmor not active"
    fi
else
    test_result "System Integrity" "SKIP" "Neither SELinux nor AppArmor found"
fi
echo ""

# Test 7: SSH Configuration
test_header "SSH Configuration"
echo -e "Checking SSH daemon configuration..."

if systemctl is-active --quiet sshd 2>/dev/null || systemctl is-active --quiet ssh 2>/dev/null; then
    test_result "SSH Daemon" "FAIL" "SSH is running (potential security risk)"
    echo -e "${YELLOW}💡 If SSH is not needed:${NC}"
    echo -e "   sudo systemctl disable --now sshd"
    echo -e "   or configure SSH with key-based auth only"
    pause_for_user "Review SSH configuration and continue testing"
else
    test_result "SSH Daemon" "PASS" "SSH daemon is not running"
fi

# Check SSH config if it exists
if [ -f /etc/ssh/sshd_config ]; then
    password_auth=$(grep "^PasswordAuthentication" /etc/ssh/sshd_config | awk '{print $2}' || echo "yes")
    if [ "$password_auth" = "no" ]; then
        test_result "SSH Password Auth" "PASS" "Password authentication disabled"
    else
        test_result "SSH Password Auth" "FAIL" "Password authentication enabled"
    fi
fi
echo ""

# Test 8: Automatic Updates
test_header "Automatic Updates"
echo -e "Checking automatic update configuration..."

if command -v dnf >/dev/null 2>&1; then
    # Check for dnf-automatic
    if systemctl is-enabled --quiet dnf-automatic.timer 2>/dev/null; then
        test_result "DNF Automatic Updates" "PASS" "dnf-automatic is enabled"
    else
        test_result "DNF Automatic Updates" "FAIL" "dnf-automatic is not enabled"
        echo -e "${YELLOW}💡 To enable automatic updates:${NC}"
        echo -e "   sudo dnf install dnf-automatic"
        echo -e "   sudo systemctl enable --now dnf-automatic.timer"
    fi
elif command -v apt >/dev/null 2>&1; then
    # Check for unattended-upgrades
    if systemctl is-active --quiet unattended-upgrades 2>/dev/null; then
        test_result "Unattended Upgrades" "PASS" "Unattended upgrades active"
    else
        test_result "Unattended Upgrades" "FAIL" "Unattended upgrades not active"
        echo -e "${YELLOW}💡 To enable automatic updates:${NC}"
        echo -e "   sudo apt install unattended-upgrades"
        echo -e "   sudo dpkg-reconfigure -plow unattended-upgrades"
    fi
else
    test_result "Automatic Updates" "SKIP" "Package manager not supported"
fi
echo ""

# Test 9: Network Sharing Services
test_header "Network Sharing Services"
echo -e "Checking for potentially insecure sharing services..."

# Check Samba
if systemctl is-active --quiet smbd 2>/dev/null; then
    test_result "Samba/SMB" "FAIL" "Samba is running (potential security risk)"
    echo -e "${YELLOW}💡 If file sharing is not needed:${NC}"
    echo -e "   sudo systemctl disable --now smbd nmbd"
else
    test_result "Samba/SMB" "PASS" "Samba is not running"
fi

# Check NFS
if systemctl is-active --quiet nfs-server 2>/dev/null; then
    test_result "NFS Server" "FAIL" "NFS server is running (potential security risk)"
else
    test_result "NFS Server" "PASS" "NFS server is not running"
fi

# Check VNC servers
vnc_active=false
for vnc_service in vncserver-x11-serviced x11vnc vino-server; do
    if systemctl is-active --quiet "$vnc_service" 2>/dev/null; then
        test_result "VNC Server" "FAIL" "$vnc_service is running"
        vnc_active=true
        break
    fi
done
if [ "$vnc_active" = false ]; then
    test_result "VNC Server" "PASS" "No VNC servers detected"
fi
echo ""

# Test 10: Running EAI Security Check
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
echo -e "${CYAN}🏁 Linux Testing Summary${NC}"
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
    echo -e "${GREEN}🎉 All tests passed! Your Linux system appears to be well-configured for security.${NC}"
else
    echo -e "${YELLOW}⚠️  Some security settings need attention. Review the failed tests above.${NC}"
    echo -e "${CYAN}💡 Use 'node $CLI_PATH check --help' for more configuration options.${NC}"
fi

echo ""
echo -e "${CYAN}📚 For more information:${NC}"
echo -e "   • Run: node $CLI_PATH check default"
echo -e "   • View: README.md for detailed documentation"
echo -e "   • Configure: Use 'node $CLI_PATH interactive' for guided setup"