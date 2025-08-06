#!/bin/bash

# EAI Security Check - Cross-Platform Build Script
# Builds CLI executables and UI for all platforms

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

echo -e "${CYAN}🔧 EAI Security Check - Cross-Platform Build${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Function to display step
step() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Function to display success
success() {
    echo -e "${GREEN}✅ $1${NC}"
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

step "Installing dependencies..."
npm ci || error "Failed to install dependencies"
success "Dependencies installed"

step "Running linting..."
npm run lint || error "Linting failed"
success "Linting passed"

step "Running tests..."
npm run test:core || error "Core tests failed"
success "Core tests passed"

step "Building TypeScript..."
npm run build || error "TypeScript build failed"
success "TypeScript built"

step "Building UI..."
npm run build:dev || error "UI build failed"
success "UI built"

# Build CLI executables for all platforms
step "Building CLI executables..."

# macOS
step "Building macOS executable..."
npm run pkg:macos || error "macOS build failed"
success "macOS executable built"

# Linux
step "Building Linux executable..."
npm run pkg:linux || error "Linux build failed"
success "Linux executable built"

# Windows
step "Building Windows executable..."
npm run pkg:windows || error "Windows build failed"
success "Windows executable built"

step "Building Electron distributions..."

# Build Electron for all platforms
npm run dist:mac || error "macOS Electron build failed"
success "macOS Electron app built"

npm run dist:linux || error "Linux Electron build failed"
success "Linux Electron app built"

npm run dist:win || error "Windows Electron build failed"
success "Windows Electron app built"

echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo ""
echo -e "${CYAN}Built artifacts:${NC}"
echo -e "  📁 CLI executables: ./bin/"
echo -e "  📁 UI distribution: ./dist/ui/"
echo -e "  📁 Electron apps: ./dist/"
echo ""
