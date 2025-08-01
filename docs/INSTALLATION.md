# Installation Guide

This guide covers all installation methods for the EAI Security Check tool across different platforms.

## 📦 Installation Methods

### Method 1: Standalone Executable (Recommended for End Users)

**Advantages:**
- No Node.js installation required
- Single file, portable
- Code-signed and verified binaries
- Fastest setup

**Download from GitHub Releases:**

```bash
# macOS (Intel/Apple Silicon Universal)
curl -L -o eai-security-check https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-macos
chmod +x eai-security-check
./eai-security-check --version

# Linux (x64)
curl -L -o eai-security-check https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-linux
chmod +x eai-security-check
./eai-security-check --version

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-win.exe -OutFile eai-security-check.exe
.\eai-security-check.exe --version
```

### Method 2: NPM Global Installation

**Advantages:**
- Easy updates via npm
- Integrates with Node.js ecosystem
- Access to development features

**Prerequisites:**
- Node.js 18+ 
- npm (included with Node.js)

```bash
# Install globally
npm install -g eai-security-check

# Verify installation
eai-security-check --version

# Update to latest version
npm update -g eai-security-check
```

### Method 3: Development Installation

**For developers and contributors:**

```bash
# Clone repository
git clone https://github.com/eaiti/eai_security_check.git
cd eai_security_check

# Install dependencies
npm install

# Build the project
npm run build

# Run development version
npm run dev -- --help

# Run tests
npm test
```

## 🔐 Security & Verification

### Download Verification

All releases include cryptographic signatures and checksums for verification:

```bash
# Download verification script
curl -L -o verify-download.sh https://github.com/eaiti/eai_security_check/releases/latest/download/verify-download.sh
chmod +x verify-download.sh

# Verify your download (replace with actual filename)
./verify-download.sh eai-security-check-macos
```

### Code Signing Details

- **macOS**: Binaries are notarized with Apple Developer ID
- **Windows**: Binaries are signed with Authenticode certificate  
- **Linux**: GPG-signed releases with SHA-256 checksums

## 📁 Recommended Installation Locations

After downloading the executable, choose an appropriate location based on your operating system and use case:

### macOS Recommendations

**For Personal Use (Single User):**
```bash
# Option 1: User Applications folder (Recommended)
mkdir -p ~/Applications/eai-security-check
mv eai-security-check ~/Applications/eai-security-check/
cd ~/Applications/eai-security-check

# Option 2: User bin directory  
mkdir -p ~/bin/eai-security-check
mv eai-security-check ~/bin/eai-security-check/
cd ~/bin/eai-security-check
```

**For System-Wide Use (All Users):**
```bash
# Option 1: Local applications (Recommended)
sudo mkdir -p /usr/local/opt/eai-security-check
sudo mv eai-security-check /usr/local/opt/eai-security-check/
cd /usr/local/opt/eai-security-check

# Option 2: Applications folder (requires admin)
sudo mkdir -p /Applications/eai-security-check
sudo mv eai-security-check /Applications/eai-security-check/
cd /Applications/eai-security-check
```

### Linux Recommendations

**For Personal Use (Single User):**
```bash
# Option 1: User local directory (Recommended)
mkdir -p ~/.local/bin/eai-security-check
mv eai-security-check ~/.local/bin/eai-security-check/
cd ~/.local/bin/eai-security-check

# Option 2: User opt directory
mkdir -p ~/opt/eai-security-check  
mv eai-security-check ~/opt/eai-security-check/
cd ~/opt/eai-security-check
```

**For System-Wide Use (All Users):**
```bash
# Option 1: Optional software directory (Recommended)
sudo mkdir -p /opt/eai-security-check
sudo mv eai-security-check /opt/eai-security-check/
cd /opt/eai-security-check

# Option 2: Local system binaries
sudo mkdir -p /usr/local/bin/eai-security-check
sudo mv eai-security-check /usr/local/bin/eai-security-check/
cd /usr/local/bin/eai-security-check
```

### Windows Recommendations

**For Personal Use (Single User):**
```powershell
# Option 1: User AppData directory (Recommended)
New-Item -Path "$env:LOCALAPPDATA\eai-security-check" -ItemType Directory -Force
Move-Item "eai-security-check.exe" "$env:LOCALAPPDATA\eai-security-check\"
Set-Location "$env:LOCALAPPDATA\eai-security-check"

# Option 2: User directory
New-Item -Path "$env:USERPROFILE\eai-security-check" -ItemType Directory -Force  
Move-Item "eai-security-check.exe" "$env:USERPROFILE\eai-security-check\"
Set-Location "$env:USERPROFILE\eai-security-check"
```

**For System-Wide Use (All Users):**
```powershell
# Option 1: Program Files (Recommended - requires admin)
New-Item -Path "${env:ProgramFiles}\eai-security-check" -ItemType Directory -Force
Move-Item "eai-security-check.exe" "${env:ProgramFiles}\eai-security-check\"
Set-Location "${env:ProgramFiles}\eai-security-check"

# Option 2: Program Files (x86) for compatibility
New-Item -Path "${env:ProgramFiles(x86)}\eai-security-check" -ItemType Directory -Force
Move-Item "eai-security-check.exe" "${env:ProgramFiles(x86)}\eai-security-check\"
Set-Location "${env:ProgramFiles(x86)}\eai-security-check"
```

### 💡 Location Selection Tips

**Choose Personal Use if:**
- Only you need access to the tool
- You want easy updates without admin privileges  
- You're testing or evaluating the tool

**Choose System-Wide if:**
- Multiple users on the system need access
- You're deploying in an enterprise environment
- You want the tool available system-wide

**Directory Structure After Setup:**
```
/your/chosen/location/
├── eai-security-check              # Main executable
├── config/                         # Configuration files (auto-created)
├── reports/                        # Generated reports (auto-created)  
└── logs/                          # Application logs (auto-created)
```

## 🌍 Global Installation Setup

After placing the executable in your preferred location, you can optionally set up global access:

### Automatic Setup (Recommended)

```bash
# Run interactive management mode (includes global setup option)
eai-security-check interactive

# During interactive setup, choose "4. Global Installation" option
```

### Manual Global Setup

#### macOS & Linux

```bash
# Create symbolic link (requires sudo)
sudo ln -sf "$(pwd)/eai-security-check" /usr/local/bin/eai-security-check

# Or add to your PATH in ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/your/eai-security-check/directory"
```

#### Windows

**Option 1: Add to PATH (PowerShell as Administrator)**
```powershell
# Add directory to system PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$newPath = $currentPath + ";" + (Get-Location).Path
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
```

**Option 2: Create Desktop/Start Menu Shortcuts**
```powershell
# The interactive command can create these automatically
eai-security-check interactive
```

## 📂 Directory Structure After Installation

The tool uses a **centralized file structure** that keeps all application data organized alongside the executable for better portability and management:

```
# Application files are stored alongside the executable
/path/to/eai-security-check        # Main executable
/path/to/config/                   # Configuration files  
├── security-config.json           # Security profile configuration
├── scheduling-config.json         # Daemon scheduling configuration
├── daemon-state.json             # Daemon state tracking
└── daemon-templates/             # System service templates
    ├── eai-security-check.service (Linux)
    ├── com.eai.security-check.plist (macOS)  
    └── windows-task-scheduler.xml (Windows)

/path/to/reports/                  # Generated security reports
├── security-report-*.txt
├── security-report-*.md
└── security-report-*.json

/path/to/logs/                     # Application logs
├── eai-security-check.log
└── eai-security-check.error.log
```

**Benefits of Centralized Structure:**
✅ **Portable**: Move executable directory, everything moves with it  
✅ **Self-contained**: All files in one location  
✅ **Permission-safe**: No system directory issues  
✅ **Global-compatible**: Works with global installation via symlinks

## 🔧 Platform-Specific Requirements

### macOS Requirements

**For End Users:**
- macOS 10.15+ (Catalina or newer)
- Rosetta 2 for Intel binaries on Apple Silicon (automatically installed)

**For Development:**
- Xcode Command Line Tools: `xcode-select --install`
- Homebrew (optional): `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

### Linux Requirements

**Supported Distributions:**
- **Primary**: Fedora 38+, CentOS Stream 9+, RHEL 9+
- **Limited**: Ubuntu 22.04+, Debian 12+

**System Dependencies:**
```bash
# Fedora/RHEL/CentOS
sudo dnf install -y curl gzip

# Ubuntu/Debian  
sudo apt update && sudo apt install -y curl gzip

# For development
sudo dnf install -y nodejs npm git  # Fedora
sudo apt install -y nodejs npm git  # Ubuntu
```

### Windows Requirements

**For End Users:**
- Windows 10 version 1809+ or Windows 11
- PowerShell 5.1+ (pre-installed on modern Windows)

**For Development:**
- Node.js 18+ (from [nodejs.org](https://nodejs.org))
- Git for Windows (from [git-scm.com](https://git-scm.com))
- Visual Studio Code (recommended)

## 🚀 Post-Installation Steps

### 1. Initialize Configuration

```bash
# Run the interactive setup wizard
eai-security-check interactive

# This will:
# - Guide you through security profile selection
# - Set up configuration directories
# - Optionally configure global installation
# - Set up daemon scheduling (if desired)
# - Provide next steps and usage examples
```

### 2. Run Your First Security Check

```bash
# Quick test with default profile
eai-security-check check

# Verify everything works correctly
eai-security-check check --summary
```

### 3. Optional: Set Up Automated Monitoring

```bash
# Configure daemon for scheduled security audits
eai-security-check daemon --status

# If not configured, the init command above includes daemon setup
```

## 🔄 Updates & Maintenance

### Update Standalone Executable

```bash
# Check current version
eai-security-check --version

# Download latest version (same commands as installation)
curl -L -o eai-security-check-new https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-macos

# Verify and replace
./eai-security-check-new --version
mv eai-security-check-new eai-security-check
```

### Update NPM Installation

```bash
# Update to latest version
npm update -g eai-security-check

# Check for available updates
npm outdated -g eai-security-check
```

### Update Development Installation

```bash
cd eai_security_check
git pull origin main
npm install
npm run build
npm test
```

## 🆘 Troubleshooting

### Common Issues

**"Command not found" error:**
- Ensure the executable is in your PATH or use `./eai-security-check`
- On macOS, you may need to allow the app in System Preferences > Security & Privacy

**Permission denied:**
```bash
# Make executable
chmod +x eai-security-check

# For system-wide installation (macOS/Linux)
sudo chown root:wheel /usr/local/bin/eai-security-check  # macOS
sudo chown root:root /usr/local/bin/eai-security-check   # Linux
```

**macOS Gatekeeper blocking execution:**
```bash
# Allow the app to run
sudo xattr -r -d com.apple.quarantine eai-security-check

# Or use System Preferences > Security & Privacy > Allow
```

**Windows antivirus blocking:**
- Add the executable to your antivirus whitelist
- Some antivirus software flags packaged Node.js applications

### Getting Help

**Check logs and configuration:**
```bash
# Show configuration directory location
eai-security-check interactive
# → Select "1. System Status" to view all configuration paths

# Verbose output for debugging  
eai-security-check check --help

# Test specific features
eai-security-check daemon --status
```

**Report Issues:**
- [GitHub Issues](https://github.com/eaiti/eai_security_check/issues)
- Include your OS version, installation method, and error messages
- For security issues, use responsible disclosure

## 🔗 Next Steps

After successful installation:

1. **[Configuration Guide](CONFIGURATION.md)** - Set up security profiles and requirements
2. **[Usage Examples](USAGE_EXAMPLES.md)** - Learn common use cases and commands  
3. **[Daemon Setup](DAEMON_SETUP.md)** - Configure automated security audits
4. **[Security Documentation](../SECURITY.md)** - Understand the security model