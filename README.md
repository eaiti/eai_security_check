# EAI Security Check

A cross-platform enterprise security auditing tool built with Node.js, TypeScript, and Angular. Features a unified desktop application that provides both intuitive GUI and integrated CLI functionality for comprehensive security auditing on macOS, Linux, and Windows systems.

**🎯 Unified Architecture**: Single Electron-based desktop application that seamlessly integrates GUI and CLI modes - no separate installations needed.

**🔒 Enterprise Security**: Comprehensive auditing with tamper-proof reports, cryptographic verification, and configurable security profiles.

**🖥️ Modern Desktop UI**: Intuitive Angular-based interface with comprehensive security management, automated scheduling, and professional reporting.

## 📁 File Structure & Configuration

### Configuration Files

- **`security-config.json`**: Active security profile with platform-specific settings
- **`daemon-config.json`**: Automated scheduling and email notification settings  
- **`profiles/*.json`**: Custom and built-in security profiles (default, strict, relaxed, etc.)

### Report Storage

- **Format**: JSON with optional format conversion capabilities
- **Naming**: Timestamped files with format: `YYYY-MM-DD_security-report.json`
- **Integrity**: Optional HMAC-SHA256 signatures for tamper detection
- **Export**: Convert to HTML, Markdown, CSV, or Plain Text as needed

### Cross-Platform Locations

| Platform | Configuration Directory | Application Data |
|----------|------------------------|------------------|
| **macOS** | `~/.eai-security-check/` | `~/Library/Application Support/EAI-Security-Check/` |
| **Linux** | `~/.eai-security-check/` | `~/.local/share/EAI-Security-Check/` |  
| **Windows** | `%USERPROFILE%\.eai-security-check\` | `%APPDATA%\EAI-Security-Check\` |

## 🧪 Testing & Development

### Comprehensive Test Suite

The project includes extensive testing with **305 total tests** across dual frameworks:

```bash
# Run all tests (295 Jest + 10 Angular tests)
npm run test:all        # Complete test suite

# Individual test frameworks  
npm run test:core       # Jest tests (295) - Core Node.js/TypeScript functionality
npm run test:ui         # Angular/Jasmine tests (10) - UI components and services

# Development workflow
npm run verify          # Full verification: tests + build + lint + format check
npm run verify:quick    # Quick verification: core tests + linting only
```

### Platform Testing

Cross-platform validation using npm scripts that auto-detect the current platform:

```bash
# Auto-detect current platform and run appropriate tests
npm run test:platform

# Platform-specific testing (runs on respective platforms)
npm run test:macos      # macOS security features testing
npm run test:linux      # Linux security features testing  
npm run test:windows    # Windows security features testing

# Comprehensive platform testing
npm run test:all-platforms    # Runs unified test suite for current platform
```

### Integrated CLI Testing

The unified application provides both GUI and CLI functionality. Test CLI features directly:

```bash
# CLI functionality testing
npm run version:show           # Test CLI version and help display
npm run check:dev              # Test security check with developer profile
npm run check:strict -- --non-interactive  # Test automated security checking

# Report validation testing
npm run validate security-report.json      # Test report validation functionality
```

### Code Quality Assurance

```bash
# Code quality and consistency
npm run lint              # ESLint validation
npm run format:all        # Format code and fix lint issues automatically
npm run build            # TypeScript compilation check
npm run format:check     # Verify code formatting compliance
```

## 🌟 Key Features

### 🖥️ Cross-Platform Desktop Application with Integrated CLI
- **Unified Architecture**: Single Electron application with dual-mode operation
- **GUI Mode**: Modern Angular 20+ interface with Material Design components
- **CLI Mode**: Full command-line interface for automation and scripting
- **Seamless Integration**: Same security engine powers both GUI and CLI operations
- **Cross-Platform**: Native executables for Windows, macOS, and Linux
- **No Installation Complexity**: Single executable with all dependencies included

### 🔒 Comprehensive Security Auditing

| Feature | macOS | Linux | Windows | Description |
|---------|-------|-------|---------|-------------|
| **Disk Encryption** | FileVault | LUKS | BitLocker | Full-disk encryption protection |
| **Password Protection** | Screen saver lock | PAM/session lock | Windows lock screen | Login and screen lock security |
| **Auto-lock Timeout** | Screen saver timeout | GNOME/KDE timeout | Screen saver timeout | Automatic screen locking |
| **Firewall** | Application Firewall | ufw/firewalld/iptables | Windows Defender Firewall | Network traffic filtering |
| **Package Verification** | Gatekeeper | DNF/APT GPG verification | Windows Defender SmartScreen | Code signing and package integrity |
| **System Integrity** | SIP | SELinux/AppArmor | Windows Defender + Tamper Protection | System file protection |
| **Remote Access** | SSH/Remote Desktop | SSH/VNC services | RDP/SSH services | Remote login monitoring |
| **Automatic Updates** | Software Update | DNF/APT auto-updates | Windows Update | Security patch management |
| **Sharing Services** | File/Screen/Media | Samba/NFS/VNC | File/Media/RDP sharing | Network service monitoring |

### 📊 Advanced Desktop Features
- **Dashboard Overview**: Real-time system security status and recent audit history
- **Report Management**: View, convert, and export reports in multiple formats (JSON, HTML, Markdown, CSV, Plain Text)
- **Clipboard Integration**: One-click copying of audit results and reports
- **Configuration Editor**: Visual security profile editor with real-time validation
- **Daemon Management**: Automated scheduling with email notifications setup wizard
- **Cryptographic Verification**: Tamper-proof reports with HMAC-SHA256 signatures
- **Multiple Security Profiles**: Predefined configurations (default, strict, relaxed, developer, EAI)

## 🚀 Quick Start

### 🖥️ Desktop Application (Unified GUI + CLI)

**Recommended for All Users**

Download the unified desktop application from [GitHub Releases](https://github.com/eaiti/eai_security_check/releases):

```bash
# macOS
curl -L -o EAI-Security-Check.dmg https://github.com/eaiti/eai_security_check/releases/latest/download/EAI-Security-Check-macOS.dmg

# Linux  
curl -L -o EAI-Security-Check.AppImage https://github.com/eaiti/eai_security_check/releases/latest/download/EAI-Security-Check-Linux.AppImage

# Windows
# Download EAI-Security-Check-Windows-Setup.exe from releases page
```

### 🎯 Usage Modes

The same application works in two modes:

#### GUI Mode (Interactive)
```bash
# Launch the desktop application normally:
./EAI-Security-Check           # Linux
open EAI-Security-Check.app    # macOS
# Double-click .exe on Windows
```

#### CLI Mode (Automation & Scripting)
```bash
# Use the same application as a CLI tool:
npx electron . --version                    # Show version information
npx electron . --help                       # Display help and usage

# Security auditing
npx electron . check --profile developer --format human
npx electron . check --profile strict --format json --non-interactive

# Report management
npx electron . validate /path/to/security-report.json

# Automated usage example
npx electron . check --profile developer --non-interactive --format json > security-report.json
```

### 🛠️ Development Setup

**For Developers and Contributors**

```bash
# Clone and build from source
git clone https://github.com/eaiti/eai_security_check.git
cd eai_security_check
npm install
npm run build

# Development mode with hot reload
npm run dev:start              # Start development mode with live reload

# Testing and verification
npm run verify                 # Full test suite, build, and quality checks
npm run test:all              # Run all tests (Jest + Angular)

# CLI development testing
npm run check:dev             # Test security check functionality
npm run version:show          # Test CLI version display
```

### ⚡ First Launch

#### GUI Mode (Interactive)
1. **Launch the Application**: Double-click the downloaded application or run from terminal
2. **Dashboard Overview**: View your system's current security status with real-time indicators
3. **Run Security Audit**: Click "Run Security Check" and select a security profile
4. **Review Results**: View detailed findings with explanations and actionable recommendations
5. **Generate Reports**: Export results to multiple formats (JSON, HTML, Markdown, CSV)
6. **Configure Settings**: Customize security profiles, scheduling, and notification preferences

#### CLI Mode (Automation)
1. **Verify Installation**: `npx electron . --version`
2. **Run First Check**: `npx electron . check --profile developer --format human`
3. **Review Output**: Check console output for security findings
4. **Automate**: Integrate into scripts with `--non-interactive` flag for automated environments

```bash
# Quick security check
npx electron . check --profile developer --format human

# Non-interactive automation
npx electron . check --profile strict --non-interactive --format json

# Get help
npx electron . --help
```

## 🎛️ Desktop Application Features

### 🏠 Dashboard Overview

The main dashboard provides a comprehensive view of your system's security status:

- **System Information**: Current version, installation status, and platform details
- **Security Status**: Real-time overview of critical security settings with color-coded indicators
- **Recent Audits**: Timeline of security checks with quick access to detailed reports
- **Quick Actions**: One-click access to run audits, view reports, and manage settings

### 📊 Advanced Report Management

The Report Viewer provides powerful report management capabilities:

- **Multiple Format Support**: View reports in JSON, HTML, Markdown, CSV, or Plain Text
- **Format Conversion**: Convert any report between all supported formats with one click
- **Copy to Clipboard**: Instantly copy reports in any format for sharing
- **Download Reports**: Save reports locally with proper file extensions
- **Report Verification**: Verify cryptographic signatures and tamper-evident integrity
- **Report History**: Browse and manage all historical security audit reports

### ⚙️ Visual Configuration

Intuitive configuration management with full feature parity:

- **Security Profile Editor**: Create, edit, and manage security profiles visually
- **Real-time Validation**: Immediate feedback on configuration changes
- **Import/Export**: Load configurations from files or save custom profiles
- **Profile Templates**: Start with predefined profiles (default, strict, relaxed, developer, EAI)

## 🖲️ Command Line Interface

The unified Electron application provides a comprehensive CLI interface for automation and scripting:

```bash
# Basic usage
npx electron . --version                    # Show version
npx electron . check --profile developer    # Run security check
npx electron . validate report.json         # Validate report

# Automation
npx electron . check --profile strict --non-interactive --format json
```

**For detailed CLI usage, examples, and automation guides, see [Usage Examples](docs/USAGE_EXAMPLES.md).**

### 🔄 Automated Monitoring

Set up automated security auditing with the desktop application's daemon management:
- **System Service Integration**: Automatic setup for macOS LaunchAgent, Linux systemd, Windows Task Scheduler
- **Visual Scheduling**: Easy scheduling with preset intervals (daily, weekly, monthly)  
- **Email Notifications**: SMTP configuration for automated report delivery
- **Background Execution**: Runs independently without requiring the desktop app to be open

**For detailed daemon setup instructions, see [Daemon Setup Guide](docs/DAEMON_SETUP.md).**

### 🔧 Development & Testing

For developers and contributors:

```bash
# Clone and setup
git clone https://github.com/eaiti/eai_security_check.git
cd eai_security_check && npm install

# Development
npm run dev              # Development mode with hot reload
npm run verify           # Full verification (tests + build + lint)
npm run test:all         # Run all tests (295 Jest + 10 Angular)
npm run dist             # Create distributables
```

**For complete build instructions and development workflow, see the [Installation Guide](docs/INSTALLATION.md).**

## 📚 Documentation

### Quick Reference
- **[FAQ](FAQ.md)** - Frequently asked questions and troubleshooting
- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions for all platforms
- **[Configuration Guide](docs/CONFIGURATION.md)** - Complete security configuration options and examples  
- **[Usage Examples](docs/USAGE_EXAMPLES.md)** - Comprehensive examples for different use cases
- **[Daemon Setup](docs/DAEMON_SETUP.md)** - Automated scheduling and system service setup

### Security & Implementation
- **[Security Documentation](SECURITY.md)** - Complete security analysis, threat model, and implementation details
- **[Signing Implementation](SIGNING_IMPLEMENTATION.md)** - Cryptographic verification and tamper detection

## 🎯 Example Output

### Desktop Application

The desktop application displays security audit results in an intuitive interface with:

- **Color-coded Status Indicators**: Green (✅), Yellow (⚠️), Red (❌) 
- **Detailed Explanations**: Click any check for educational information
- **Actionable Recommendations**: Step-by-step remediation guidance
- **Progress Tracking**: Real-time status updates during audits
- **Export Options**: Save results in multiple formats

### Sample Audit Results

```
🔒 EAI Security Check Results 🔒

Platform: macOS 14.0 (Apple Silicon)
Profile: default
Timestamp: 2025-08-06 14:25:33

✅ Disk Encryption: FileVault enabled
✅ Password Protection: Screen saver requires password immediately  
✅ Auto-lock Timeout: 5 minutes (≤ 7 min required)
✅ Firewall: Application Firewall enabled
⚠️  Package Verification: Gatekeeper enabled, consider strict mode
❌  System Integrity Protection: SIP disabled (CRITICAL SECURITY RISK)
✅ Remote Login: SSH disabled
✅ Automatic Updates: Download and install enabled  
✅ Sharing Services: All sharing services disabled

📊 Summary: 7/9 checks passed, 1 failed, 1 warning
🚨 OVERALL: FAILED (due to critical SIP requirement)

💡 Recommendations:
   1. Enable System Integrity Protection in Recovery mode
   2. Consider enabling Gatekeeper strict mode for enhanced security
   3. Review security profile settings for your use case
```

## 🔧 Security Profiles

| Profile | Description | Auto-lock | Password | Use Case |
|---------|-------------|-----------|----------|----------|
| **default** | Recommended security settings | 7 min | 8+ chars | General users |
| **strict** | Maximum security | 3 min | 12+ chars | High-security environments |
| **relaxed** | Balanced security | 15 min | 6+ chars | Convenience-focused |
| **developer** | Developer-friendly | 10 min | 8+ chars | Development workstations |
| **eai** | EAI-specific requirements | 7 min | 10+ chars | EAI organization |

## 📁 File Structure & Storage

EAI Security Check uses a **centralized file structure** that keeps all application data organized alongside the executable for easy management and portability.

### Directory Structure

```
# Development (npm start):
./bin/
├── config/              # Configuration files
│   ├── security-config.json
│   └── scheduling-config.json
├── reports/             # Security audit reports
│   └── *.{txt,md,json}
└── logs/               # Daemon and error logs
    ├── eai-security-check.log
    └── eai-security-check.error.log

# Production (compiled executable):
/path/to/executable/
├── eai-security-check   # Main executable
├── config/              # Configuration files
├── reports/             # Security reports
└── logs/               # Application logs

# Global Installation:
/usr/local/bin/eai-security-check → /path/to/actual/executable
# (All files still stored alongside actual executable, not in /usr/local/bin)
```

### Key Benefits

✅ **Self-contained**: All app data lives with the executable  
✅ **Portable**: Move the executable directory, everything moves with it  
✅ **Permission-safe**: No `/var/log/` or system directory issues  
✅ **Cross-platform**: Same structure on macOS, Linux, and Windows  
✅ **Global access**: Works with system-wide installation via symlinks  
✅ **Daemon-compatible**: Services can reliably locate logs and config files  

### Previous Installation Locations

**Note**: Previous versions used OS-specific configuration directories. Current versions use a centralized structure alongside the executable for better portability and organization. The legacy locations are no longer used.

## 🐧 Platform Support

### Primary Support (Fully Tested)
- **macOS**: All versions, complete feature support
- **Linux (Fedora)**: Primary testing distribution, full feature set

### Limited Testing  
- **Linux (Ubuntu/Debian)**: Basic testing, may have false positives
- **Windows**: Core features implemented, expanding support

## 🚪 Exit Codes

- `0`: All security checks passed
- `1`: One or more security checks failed or error occurred

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests to ensure everything works: `npm test`
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 🚀 Troubleshooting

**Common Issues:**
- **macOS**: Right-click → Open to bypass Gatekeeper warnings
- **Linux**: Make AppImage executable: `chmod +x EAI-Security-Check.AppImage` 
- **Windows**: Run as Administrator if Windows Defender blocks execution
- **Permissions**: Some security checks require admin privileges

**Development Issues:**
```bash
npm run verify:quick    # Quick validation
npm run format:all      # Fix linting issues
```

**For detailed troubleshooting, see the [FAQ](FAQ.md) and [GitHub Issues](https://github.com/eaiti/eai_security_check/issues).**
- **Security Reports**: Please use responsible disclosure for security vulnerabilities