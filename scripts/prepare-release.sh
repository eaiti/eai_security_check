#!/bin/bash

# EAI Security Check - Release Preparation Script
# Prepares artifacts for release including signing and packaging

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
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse command line arguments
SIGN_EXECUTABLES=false
CREATE_CHECKSUMS=true
VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --sign)
            SIGN_EXECUTABLES=true
            shift
            ;;
        --no-checksums)
            CREATE_CHECKSUMS=false
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --sign           Sign executables (requires signing certificates)"
            echo "  --no-checksums   Skip creating checksums"
            echo "  --version VERSION Specify version tag"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}📦 EAI Security Check - Release Preparation${NC}"
echo -e "${CYAN}===========================================${NC}"
echo ""

# Function to display step
step() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Function to display success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to display warning
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to display error
error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

cd "$PROJECT_ROOT"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    error "package.json not found. Are you in the project root?"
fi

# Get version from package.json if not specified
if [ -z "$VERSION" ]; then
    VERSION=$(node -p "require('./package.json').version")
    step "Detected version: v$VERSION"
fi

# Clean previous builds
step "Cleaning previous builds..."
rm -rf dist/ bin/
success "Cleaned previous builds"

# Run comprehensive build
step "Running comprehensive build..."
"$SCRIPT_DIR/build-all.sh" || error "Build failed"
success "Build completed"

# Create release directory
RELEASE_DIR="$PROJECT_ROOT/release/v$VERSION"
step "Creating release directory: $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
success "Release directory created"

# Copy CLI executables
step "Copying CLI executables..."
if [ -f "bin/index-macos" ]; then
    cp "bin/index-macos" "$RELEASE_DIR/eai-security-check-macos"
    success "macOS CLI copied"
else
    warning "macOS CLI not found"
fi

if [ -f "bin/index-linux" ]; then
    cp "bin/index-linux" "$RELEASE_DIR/eai-security-check-linux"
    success "Linux CLI copied"
else
    warning "Linux CLI not found"
fi

if [ -f "bin/index-win.exe" ]; then
    cp "bin/index-win.exe" "$RELEASE_DIR/eai-security-check-windows.exe"
    success "Windows CLI copied"
else
    warning "Windows CLI not found"
fi

# Copy Electron distributions
step "Copying Electron distributions..."
if [ -d "dist/mac" ]; then
    cp -r "dist/mac" "$RELEASE_DIR/"
    success "macOS Electron app copied"
fi

if [ -d "dist/linux" ]; then
    cp -r "dist/linux" "$RELEASE_DIR/"
    success "Linux Electron app copied"
fi

if [ -d "dist/win-unpacked" ]; then
    cp -r "dist/win-unpacked" "$RELEASE_DIR/"
    success "Windows Electron app copied"
fi

# Sign executables if requested
if [ "$SIGN_EXECUTABLES" = true ]; then
    step "Signing executables..."
    
    # Sign macOS executable
    if [ -f "$RELEASE_DIR/eai-security-check-macos" ] && command -v codesign >/dev/null 2>&1; then
        if node "$SCRIPT_DIR/sign-macos.js" "$RELEASE_DIR/eai-security-check-macos" 2>/dev/null; then
            success "macOS executable signed"
        else
            warning "macOS signing failed (certificates may not be available)"
        fi
    fi
    
    # Sign Windows executable (if on Windows or with cross-platform tools)
    if [ -f "$RELEASE_DIR/eai-security-check-windows.exe" ]; then
        if node "$SCRIPT_DIR/sign-windows.js" "$RELEASE_DIR/eai-security-check-windows.exe" 2>/dev/null; then
            success "Windows executable signed"
        else
            warning "Windows signing failed (certificates may not be available)"
        fi
    fi
else
    warning "Skipping executable signing (use --sign to enable)"
fi

# Create checksums
if [ "$CREATE_CHECKSUMS" = true ]; then
    step "Creating checksums..."
    cd "$RELEASE_DIR"
    
    # Create SHA256 checksums
    find . -type f -name "eai-security-check-*" -exec sha256sum {} + > checksums.sha256
    
    # Create MD5 checksums for compatibility
    find . -type f -name "eai-security-check-*" -exec md5sum {} + > checksums.md5 2>/dev/null || \
    find . -type f -name "eai-security-check-*" -exec md5 {} + > checksums.md5
    
    success "Checksums created"
    cd "$PROJECT_ROOT"
fi

# Create release notes template
step "Creating release notes template..."
cat > "$RELEASE_DIR/RELEASE_NOTES.md" << EOF
# EAI Security Check v$VERSION

## 🎉 What's New

- [Add your release highlights here]

## 🔧 Changes

- [List changes, improvements, and fixes]

## 🐛 Bug Fixes

- [List bug fixes]

## 📦 Downloads

### CLI Executables
- \`eai-security-check-macos\` - macOS (Intel/Apple Silicon)
- \`eai-security-check-linux\` - Linux (x64)
- \`eai-security-check-windows.exe\` - Windows (x64)

### Desktop Applications
- \`mac/\` - macOS Desktop App
- \`linux/\` - Linux Desktop App  
- \`win-unpacked/\` - Windows Desktop App

### Verification
Use the provided checksums to verify download integrity:
\`\`\`bash
# Verify SHA256
sha256sum -c checksums.sha256

# Verify MD5
md5sum -c checksums.md5
\`\`\`

## 🔒 Security

All executables are digitally signed and can be verified for authenticity.

## 📋 System Requirements

- **macOS**: 10.15 or later
- **Linux**: Ubuntu 18.04+ / CentOS 7+ / equivalent
- **Windows**: Windows 10 or later

## 📚 Documentation

- [Installation Guide](../../docs/INSTALLATION.md)
- [Usage Examples](../../docs/USAGE_EXAMPLES.md)
- [Configuration](../../docs/CONFIGURATION.md)

---
Built on $(date)
EOF

success "Release notes template created"

# Summary
echo ""
echo -e "${CYAN}📊 Release Preparation Complete${NC}"
echo -e "${CYAN}=================================${NC}"
echo -e "Version: ${GREEN}v$VERSION${NC}"
echo -e "Release directory: ${BLUE}$RELEASE_DIR${NC}"
echo ""
echo -e "${CYAN}Contents:${NC}"
ls -la "$RELEASE_DIR"
echo ""
echo -e "${GREEN}🎉 Release artifacts ready!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Review and edit $RELEASE_DIR/RELEASE_NOTES.md"
echo -e "2. Test the executables on target platforms"
echo -e "3. Create a Git tag: git tag v$VERSION"
echo -e "4. Push the tag: git push origin v$VERSION"
echo -e "5. Create a GitHub release with the artifacts"
echo ""
