# EAI Security Check

A cross-platform Node.js + TypeScript tool for auditing security settings on macOS, Linux, and Windows systems against configurable security profiles. The tool provides detailed reports with educational explanations and actionable recommendations.

## 🌟 Key Features

### 🖥️ Cross-Platform Support
- **macOS**: Complete support for FileVault, Gatekeeper, SIP, and all macOS security features
- **Linux**: Comprehensive support for LUKS encryption, firewall (ufw/firewalld), SELinux/AppArmor, and package verification
- **Windows**: Full support for BitLocker, Windows Defender, Windows Firewall, and Windows security features
- **Auto-Detection**: Automatically detects the operating system and uses appropriate security checks

### 🔒 Security Checks Performed

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

### 📊 Advanced Features
- **Multiple Output Formats**: Console, plain, markdown, JSON, email
- **Clipboard Integration**: Copy results directly to clipboard
- **Cryptographic Verification**: Enhanced tamper detection with HMAC-SHA256 signatures
- **Scheduled Audits**: Automated daemon mode with email notifications
- **Multiple Profiles**: Predefined security configurations (default, strict, relaxed, developer, EAI)

## 🚀 Quick Start

### 1. Download & Install

**For End Users (Standalone Executable - Recommended)**

Download the standalone executable for your platform from the [GitHub Releases](https://github.com/eaiti/eai_security_check/releases) page. **No Node.js installation required!**

```bash
# macOS
curl -L -o eai-security-check https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-macos
chmod +x eai-security-check

# Linux  
curl -L -o eai-security-check https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-linux
chmod +x eai-security-check

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-win.exe -OutFile eai-security-check.exe
```

**For Developers/Advanced Users (NPM)**

```bash
npm install -g eai-security-check
```

### 2. Setup Configuration

```bash
# Interactive management mode - guides you through all configuration options
eai-security-check interactive

# What interactive mode does:
# 1. Profile Selection: Choose from 5 security profiles with detailed explanations
# 2. Directory Setup: Create OS-appropriate configuration directory
# 3. Global Installation: Optionally install for system-wide access
# 4. Daemon Configuration: Optionally set up automated scheduling with SMTP email
# 5. Management Options: Full control over all aspects of your security checks
# 6. System Status: View comprehensive system information and status
```

### 3. Run Your First Security Audit

```bash
# Quick security check (uses centralized config)
eai-security-check check

# Use specific profile
eai-security-check check strict

# Generate tamper-evident report for sharing
eai-security-check check --hash --format markdown -o ~/Documents/security-report.md
```

### 4. Optional: Set Up Automated Monitoring  

```bash
# Start daemon for scheduled security audits
eai-security-check daemon

# Check daemon status
eai-security-check daemon --status

# Force immediate security check and email
eai-security-check daemon --check-now
```

## 📚 Documentation

### Quick Reference
- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation instructions for all platforms
- **[Configuration Guide](docs/CONFIGURATION.md)** - Complete security configuration options and examples
- **[Usage Examples](docs/USAGE_EXAMPLES.md)** - Comprehensive examples for different use cases
- **[Daemon Setup](docs/DAEMON_SETUP.md)** - Automated scheduling and system service setup

### Security & Implementation
- **[Security Documentation](SECURITY.md)** - Complete security analysis, threat model, and implementation details
- **[Signing Implementation](SIGNING_IMPLEMENTATION.md)** - Cryptographic verification and tamper detection
- **[Changelog](CHANGELOG.md)** - Version history and updates

## 🎯 Example Output

```
🔒 EAI Security Check Results 🔒

Platform: macOS 14.0 (Intel)
Profile: default

✅ Disk Encryption: FileVault enabled
✅ Password Protection: Screen saver requires password immediately
✅ Auto-lock Timeout: 7 minutes (≤ 7 min required)
✅ Firewall: Application Firewall enabled
⚠️  Package Verification: Gatekeeper enabled, but not enforcing strict mode
❌  System Integrity Protection: SIP disabled (CRITICAL SECURITY RISK)
✅ Remote Login: SSH disabled
✅ Automatic Updates: Download and install enabled
✅ Sharing Services: All sharing services disabled

📊 Summary: 6/9 checks passed, 1 failed, 2 warnings
🚨 OVERALL: FAILED (due to critical SIP requirement)

💡 Next Steps:
   1. Enable System Integrity Protection in Recovery mode
   2. Consider enabling Gatekeeper strict mode for enhanced security
   3. Generate tamper-evident report: eai-security-check check --hash -o report.txt
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

### Migration from Legacy Locations

For backward compatibility, the tool also checks legacy OS-specific locations:
- **macOS**: `~/Library/Application Support/eai-security-check/`
- **Linux**: `~/.config/eai-security-check/` or `$XDG_CONFIG_HOME/eai-security-check/`
- **Windows**: `%APPDATA%/eai-security-check/`

However, new installations automatically use the centralized structure for better organization.

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

**Comprehensive Test Suite (283 tests)**
```bash
# Run all tests
npm test

# Run linting
npm run lint

# Run formatting check
npm run format:check

# Build project
npm run build
```

**Test Coverage Areas:**
- ✅ Cross-platform security checkers (macOS, Linux, Windows)
- ✅ CLI interactive mode (36 comprehensive tests)
- ✅ Configuration management and profiles
- ✅ Cryptographic verification and tamper detection
- ✅ Daemon automation and scheduling
- ✅ Error handling and edge cases

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/eaiti/eai_security_check/issues)
- **Documentation**: See detailed guides in the `docs/` directory
- **Security Reports**: Please use responsible disclosure for security issues