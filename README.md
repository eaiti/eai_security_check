# EAI Security Check

A cross-platform enterprise security auditing tool built with Node.js, TypeScript, and Angular. Features a unified desktop application that provides both intuitive GUI and integrated CLI functionality for comprehensive security auditing on macOS, Linux, and Windows systems.

**🎯 Unified Architecture**: Single Electron-based desktop application that seamlessly integrates GUI and CLI modes - no separate installations needed.

**🔒 Enterprise Security**: Comprehensive auditing with tamper-proof reports, cryptographic verification, and configurable security profiles.

**🖥️ Modern Desktop UI**: Intuitive Angular-based interface with comprehensive security management, automated scheduling, and professional reporting.
└── examples/                      # Configuration examples
```

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
```urable security profiles.

**🖥️ Modern Desktop Application: Intuitive Angular-based GUI with comprehensive security auditing, report management, and automated monitoring.**

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

#### CLI Mode (Automation)
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

### Basic CLI Usage

```bash
# Show version and help
npx electron . --version
npx electron . --help

# Security checks with different profiles
npx electron . check --profile developer --format human
npx electron . check --profile strict --format json
npx electron . check --profile eai --non-interactive

# Report validation
npx electron . validate security-report.json
npx electron . validate /path/to/any-report.json
```

### CLI Options

```bash
# Security Check Command
npx electron . check [options]

Options:
  --profile <profile>     Security profile (default|strict|relaxed|developer|eai)
  --format <format>       Output format (human|json) 
  --non-interactive       Run without user prompts (for automation)
  --config <path>         Custom configuration file path
  --output <path>         Output report file path

# Validation Command  
npx electron . validate <reportPath>

# Version and Help
npx electron . --version
npx electron . --help
```

### NPM Script Shortcuts

For easier CLI usage during development:

```bash
# Convenient npm scripts
npm run check:dev       # Quick developer profile check
npm run check:strict    # Strict security profile check
npm run version:show    # Show application version
npm run validate        # Validate a report file
```

### Automation Examples

```bash
# Automated security monitoring
npx electron . check --profile strict --non-interactive --format json > daily-security-$(date +%Y-%m-%d).json

# CI/CD integration
if ! npx electron . check --profile developer --non-interactive; then
    echo "Security check failed"
    exit 1
fi

# Report verification pipeline
npx electron . validate security-report.json && echo "Report is valid"
```

### 🔄 Automated Monitoring

Comprehensive daemon management with **automatic system service setup**:

- **One-Click System Service Setup**: Automatically configure daemon as system service (macOS LaunchAgent, Linux systemd, Windows Task Scheduler)
- **Background Execution**: Daemon runs independently in background, no CLI required
- **Setup Wizard**: Step-by-step configuration of automated security monitoring
- **Visual Scheduling**: Easy cron-style scheduling with preset options (daily, weekly, monthly)
- **Email Integration**: Configure SMTP settings for automated report delivery with full authentication support
- **Real-time Status Monitoring**: Live daemon status, system service status, and execution information
- **Integrated Log Viewer**: Access execution logs, clear logs, and troubleshooting information
- **Automatic Startup**: System service ensures daemon starts on system boot
- **Cross-Platform Service Management**: Unified interface for service installation/removal on all platforms

#### Daemon Features

- **🚀 Independent Execution**: Runs as separate Node.js process, not dependent on desktop application
- **⚙️ System Integration**: Automatic service registration with OS service managers
- **📧 Email Notifications**: SMTP configuration with SSL/TLS support and authentication
- **🔄 Flexible Scheduling**: Configure check intervals from daily to annually
- **📊 Report Management**: Automatic report generation, storage, and optional email delivery
- **🛡️ Secure Configuration**: Configuration stored in user directory, isolated from system
- **📱 Remote Management**: Full daemon control from desktop application interface

### � Development & Testing

Built for developers and system administrators:

- **Live Updates**: Real-time status updates and progress indicators
- **Developer Tools**: Access to underlying CLI functionality for automation
- **Cross-Platform**: Consistent experience across Windows, macOS, and Linux
- **Accessibility**: Full keyboard navigation and screen reader support

#### Building from Source

```bash
# Clone repository
git clone https://github.com/eaiti/eai_security_check.git
cd eai_security_check

# Install dependencies
npm install

# Build and run
npm run build
npm start

# Create distributables
npm run dist        # Build for current platform
npm run dist:all    # Build for all platforms
```

#### Development Commands

```bash
# Development mode with hot reload
npm run dev

# Unified application testing
npm run test:all        # All tests (Core + UI)
npm run test:core       # Jest tests only
npm run test:ui         # Angular tests only

# CLI functionality testing
npm run check:dev       # Test CLI security check
npm run version:show    # Test CLI version
npm run validate        # Test CLI report validation

# Quality assurance  
npm run verify          # Full verification (tests + build + lint)
npm run verify:quick    # Quick verification (core tests + lint)
npm run lint            # ESLint check
npm run format:all      # Format and fix all code
```

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

## � File Structure & Storage

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

## �🐧 Platform Support

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

### 🧪 Development & Testing

**Comprehensive Test Suite (305 tests total)**
```bash
# Complete test suite
npm run test:all        # Jest (295) + Angular (10) tests

# Platform testing with npm scripts
npm run test:platform   # Auto-detect and test current platform
npm run test:macos      # macOS-specific security feature tests
npm run test:linux      # Linux-specific security feature tests  
npm run test:windows    # Windows-specific security feature tests

# Integrated application testing
npm run check:dev       # Test unified CLI functionality
npm run version:show    # Test version and help display
npm run validate        # Test report validation features

# Development workflow
npm run verify          # Full verification: tests + build + lint + format
npm run verify:quick    # Quick check: core tests + linting only
npm run format:all      # Format code and fix lint issues
```

**Test Coverage Areas:**
- ✅ **Cross-Platform Security Checkers**: macOS, Linux, Windows platform-specific auditing
- ✅ **Unified Desktop Application**: GUI and CLI integration with full feature parity  
- ✅ **Angular UI Components**: Dashboard, report viewer, configuration editor, daemon management
- ✅ **Security Profile Management**: Profile creation, validation, and switching
- ✅ **Cryptographic Operations**: Report signing, verification, and tamper detection
- ✅ **Automated Scheduling**: Daemon installation, configuration, and lifecycle management
- ✅ **Error Handling & Edge Cases**: Graceful failure handling across all platforms
- ✅ **CI/CD Integration**: Non-interactive automation for enterprise environments

**Platform Testing Strategy:**
```bash
# Unified testing approach using npm scripts
npm run test:platform     # Auto-detects macOS/Linux/Windows and runs appropriate tests
npm run test:all-platforms # Comprehensive testing with platform-specific validation

# Individual platform testing (when on respective platforms)
npm run test:macos        # Tests FileVault, Gatekeeper, macOS-specific features
npm run test:linux        # Tests LUKS, firewalld, Linux distribution variations
npm run test:windows      # Tests BitLocker, Windows Defender, PowerShell integrations

# Non-interactive testing for CI/CD
npm run check:dev -- --non-interactive --format json
npm run test:all        # Full test suite including non-interactive CLI tests
```

## 🚀 Troubleshooting

### Desktop Application Issues

**Application won't start:**
- **macOS**: Right-click → Open to bypass Gatekeeper warnings
- **Linux**: Make AppImage executable: `chmod +x EAI-Security-Check.AppImage`
- **Windows**: Run as Administrator if Windows Defender blocks execution
- Check system requirements: Node.js runtime is included in distributed apps

**Security checks failing:**
- **Permissions**: Some checks require admin privileges - application will prompt when needed
- **Platform Support**: Verify your OS version is supported
- **System Commands**: Ensure system security tools are installed and accessible

**Configuration issues:**
- Use the visual configuration editor to validate settings
- Reset to default profile if custom profiles cause issues
- Check file permissions on configuration directory: `~/.eai-security-check/`

**Automated monitoring not working:**
- Verify daemon configuration in the application's daemon management interface
- Check email settings using the built-in test email function
- Review daemon logs accessible through the application's log viewer

### Development Issues

**Build failures:**
```bash
# Clean and rebuild
npm run clean
rm -rf node_modules
npm install
npm run build
```

**Test failures:**
```bash
# Run specific test suites
npm run test:core       # Node.js/TypeScript tests
npm run test:ui         # Angular component tests
npm run verify:quick    # Quick validation
```

**Linting errors:**
```bash
# Auto-fix most linting issues
npm run format:all      # Format and fix lint issues
npm run lint            # Check remaining issues
```

### Getting Help

- **GitHub Issues**: [Report bugs and request features](https://github.com/eaiti/eai_security_check/issues)
- **Documentation**: Comprehensive guides in the `docs/` directory
- **Built-in Help**: Use the application's help system and tooltips
- **Security Reports**: Please use responsible disclosure for security vulnerabilities