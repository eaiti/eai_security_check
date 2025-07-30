#!/bin/bash

# EAI Security Check Daemon Setup Script
# This script helps set up the daemon as a system service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="eai-security-check-daemon"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ -f /etc/systemd/system ]]; then
        echo "linux-systemd"
    else
        echo "unknown"
    fi
}

# Setup for macOS using launchd
setup_macos() {
    log_info "Setting up daemon for macOS using launchd..."
    
    PLIST_FILE="$SCRIPT_DIR/com.eai.security-check.daemon.plist"
    INSTALL_PATH="$HOME/Library/LaunchAgents/com.eai.security-check.daemon.plist"
    
    if [[ ! -f "$PLIST_FILE" ]]; then
        log_error "LaunchAgent plist file not found: $PLIST_FILE"
        exit 1
    fi
    
    # Copy plist file
    cp "$PLIST_FILE" "$INSTALL_PATH"
    log_success "Copied plist file to $INSTALL_PATH"
    
    # Load the service
    launchctl load "$INSTALL_PATH"
    log_success "Loaded daemon service"
    
    # Start the service
    launchctl start com.eai.security-check.daemon
    log_success "Started daemon service"
    
    log_info "Daemon is now running and will start automatically on login"
    log_info "To stop: launchctl stop com.eai.security-check.daemon"
    log_info "To uninstall: launchctl unload $INSTALL_PATH && rm $INSTALL_PATH"
}

# Setup for Linux using systemd
setup_linux_systemd() {
    log_info "Setting up daemon for Linux using systemd..."
    
    SERVICE_FILE="$SCRIPT_DIR/eai-security-check-daemon.service"
    INSTALL_PATH="/etc/systemd/system/eai-security-check-daemon.service"
    
    if [[ ! -f "$SERVICE_FILE" ]]; then
        log_error "Systemd service file not found: $SERVICE_FILE"
        exit 1
    fi
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root for systemd setup"
        log_info "Try: sudo $0 $*"
        exit 1
    fi
    
    # Copy service file
    cp "$SERVICE_FILE" "$INSTALL_PATH"
    log_success "Copied service file to $INSTALL_PATH"
    
    # Reload systemd
    systemctl daemon-reload
    log_success "Reloaded systemd daemon"
    
    # Enable service (start on boot)
    systemctl enable eai-security-check-daemon
    log_success "Enabled daemon service (will start on boot)"
    
    # Start service now
    systemctl start eai-security-check-daemon
    log_success "Started daemon service"
    
    log_info "Daemon is now running and will start automatically on boot"
    log_info "To check status: systemctl status eai-security-check-daemon"
    log_info "To stop: systemctl stop eai-security-check-daemon"
    log_info "To disable: systemctl disable eai-security-check-daemon"
}

# Show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  install    Install daemon as system service"
    echo "  uninstall  Remove daemon system service"
    echo "  status     Show daemon service status"
    echo "  help       Show this help message"
    echo ""
    echo "This script will automatically detect your OS and use the appropriate"
    echo "service management system (launchd for macOS, systemd for Linux)."
}

# Show daemon status
show_status() {
    local os_type=$(detect_os)
    
    case $os_type in
        "macos")
            log_info "Checking macOS launchd service status..."
            if launchctl list | grep -q com.eai.security-check.daemon; then
                log_success "Daemon service is loaded"
                launchctl list com.eai.security-check.daemon
            else
                log_warning "Daemon service is not loaded"
            fi
            ;;
        "linux-systemd")
            log_info "Checking systemd service status..."
            systemctl status eai-security-check-daemon
            ;;
        *)
            log_error "Unsupported operating system"
            exit 1
            ;;
    esac
}

# Uninstall daemon service
uninstall_daemon() {
    local os_type=$(detect_os)
    
    case $os_type in
        "macos")
            log_info "Uninstalling macOS launchd service..."
            INSTALL_PATH="$HOME/Library/LaunchAgents/com.eai.security-check.daemon.plist"
            
            # Stop and unload service
            launchctl stop com.eai.security-check.daemon 2>/dev/null || true
            launchctl unload "$INSTALL_PATH" 2>/dev/null || true
            
            # Remove plist file
            if [[ -f "$INSTALL_PATH" ]]; then
                rm "$INSTALL_PATH"
                log_success "Removed plist file"
            fi
            
            log_success "Daemon service uninstalled"
            ;;
        "linux-systemd")
            log_info "Uninstalling systemd service..."
            
            # Check if running as root
            if [[ $EUID -ne 0 ]]; then
                log_error "This script must be run as root for systemd uninstall"
                log_info "Try: sudo $0 uninstall"
                exit 1
            fi
            
            # Stop and disable service
            systemctl stop eai-security-check-daemon 2>/dev/null || true
            systemctl disable eai-security-check-daemon 2>/dev/null || true
            
            # Remove service file
            INSTALL_PATH="/etc/systemd/system/eai-security-check-daemon.service"
            if [[ -f "$INSTALL_PATH" ]]; then
                rm "$INSTALL_PATH"
                systemctl daemon-reload
                log_success "Removed service file and reloaded systemd"
            fi
            
            log_success "Daemon service uninstalled"
            ;;
        *)
            log_error "Unsupported operating system"
            exit 1
            ;;
    esac
}

# Main script logic
main() {
    local command="${1:-install}"
    
    case $command in
        "install")
            log_info "🔧 EAI Security Check Daemon Setup"
            log_info "Detected OS: $(detect_os)"
            
            # Verify scheduling config exists
            if [[ ! -f "$SCRIPT_DIR/../scheduling-config.json" ]]; then
                log_warning "No scheduling configuration found"
                log_info "Creating sample configuration..."
                node "$SCRIPT_DIR/../dist/index.js" daemon --init
            fi
            
            case $(detect_os) in
                "macos")
                    setup_macos
                    ;;
                "linux-systemd")
                    setup_linux_systemd
                    ;;
                *)
                    log_error "Unsupported operating system: $(detect_os)"
                    log_info "Manual setup required"
                    exit 1
                    ;;
            esac
            ;;
        "uninstall")
            uninstall_daemon
            ;;
        "status")
            show_status
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"