# Installation Guide

This guide covers installation methods for the EAI Security Check desktop application across different platforms.

## 📦 Installation Methods

### Method 1: Desktop Application (Recommended for All Users)

**Advantages:**
- Modern graphical interface with intuitive controls
- No Node.js installation required  
- Code-signed and verified binaries
- Complete feature set including report management
- Cross-platform consistency

**Download from GitHub Releases:**

**macOS:**
```bash
# Download the .dmg installer
curl -L -o EAI-Security-Check.dmg https://github.com/eaiti/eai_security_check/releases/latest/download/EAI-Security-Check-macOS.dmg

# Mount and install
open EAI-Security-Check.dmg
# Drag application to Applications folder
```

**Linux:**
```bash
# Download AppImage (works on all distributions)
curl -L -o EAI-Security-Check.AppImage https://github.com/eaiti/eai_security_check/releases/latest/download/EAI-Security-Check-Linux.AppImage

# Make executable and run
chmod +x EAI-Security-Check.AppImage
./EAI-Security-Check.AppImage
```

**Windows:**
```powershell
# Download Windows installer
Invoke-WebRequest -Uri https://github.com/eaiti/eai_security_check/releases/latest/download/EAI-Security-Check-Windows-Setup.exe -OutFile EAI-Security-Check-Setup.exe

# Run installer (may require administrator privileges)
.\EAI-Security-Check-Setup.exe
```

### Method 2: Development Build (For Contributors and Advanced Users)

**Prerequisites:**
- Node.js 18+ 
- npm (included with Node.js)
- Git

```bash
# Clone repository
git clone https://github.com/eaiti/eai_security_check.git
cd eai_security_check

# Install dependencies
npm install

# Build and run
npm run build
npm start
```

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

**For Personal Use:**
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

### Linux Recommendations

**For Personal Use:**
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

### Windows Recommendations

**For Personal Use:**
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

### 💡 Location Selection Tips

**Recommended for Personal Use:**
- Easy updates without admin privileges  
- Testing or evaluating the tool
- Single-user environments

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

### Global Setup

#### macOS & Linux

```bash
# Create symbolic link for easy access (optional - requires sudo)
sudo ln -sf "$(pwd)/eai-security-check" /usr/local/bin/eai-security-check

# Or add to your PATH in ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/your/eai-security-check/directory"
```

#### Windows

**Add to PATH (PowerShell as Administrator)**
```powershell
# Add directory to system PATH (optional)
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$newPath = $currentPath + ";" + (Get-Location).Path
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
```

## 📂 Directory Structure After Installation

The tool uses a **user configuration directory** for storing all settings and application data:

```
# Desktop Application: Settings managed by the app
# User configuration directory: ~/.eai-security-check/
~/.eai-security-check/
├── config/                        # Configuration files  
│   ├── security-config.json       # Security profile configuration
│   ├── scheduling-config.json     # Daemon scheduling configuration
│   └── daemon-state.json          # Daemon state tracking
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

### 1. Launch Desktop Application

**For Desktop App Users:**
- Launch the installed EAI Security Check application
- Complete initial setup through the GUI
- Configure security profiles and settings
- Run your first security check

**For Development Build Users:**
- Navigate to your installation directory and run the executable
- Configuration files will be created in `~/.eai-security-check/`

### 2. Run Your First Security Check

**Desktop App:**
- Use the main interface to run security checks
- Results will be displayed in the application

**Development Build:**
```bash
# Quick test with default profile (development builds only)
eai-security-check check

# Verify everything works correctly  
eai-security-check check --summary
```

### 3. Optional: Set Up Automated Monitoring

**Desktop App:**
- Use the daemon configuration section in the app
- Configure email settings and schedules through the GUI

**Development Build:**
```bash
# Configure daemon for scheduled security audits (development builds only)
eai-security-check daemon --status
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
# Check configuration directory location
# Configuration files are located in: ~/.eai-security-check/

# For development builds, use verbose output for debugging  
eai-security-check --version  # Check if executable is working

# Test daemon features (development builds)
ls ~/.eai-security-check/logs/  # Check log files
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