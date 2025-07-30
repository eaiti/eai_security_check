# EAI Security Check

A cross-platform Node.js + TypeScript tool for auditing security settings on macOS and Linux systems against configurable security profiles. The tool provides detailed reports with educational explanations and actionable recommendations.

## 🌟 Key Features

### 🖥️ Cross-Platform Support
- **macOS**: Complete support for FileVault, Gatekeeper, SIP, and all macOS security features
- **Linux**: Comprehensive support for LUKS encryption, firewall (ufw/firewalld), SELinux/AppArmor, and package verification
- **Auto-Detection**: Automatically detects the operating system and uses appropriate security checks

### 🔒 Security Checks Performed

| Feature | macOS | Linux | Description |
|---------|-------|-------|-------------|
| **Disk Encryption** | FileVault | LUKS | Full-disk encryption protection |
| **Password Protection** | Screen saver lock | PAM/session lock | Login and screen lock security |
| **Auto-lock Timeout** | Screen saver timeout | GNOME/KDE timeout | Automatic screen locking |
| **Firewall** | Application Firewall | ufw/firewalld/iptables | Network traffic filtering |
| **Package Verification** | Gatekeeper | DNF/APT GPG verification | Code signing and package integrity |
| **System Integrity** | SIP | SELinux/AppArmor | System file protection |
| **Remote Access** | SSH/Remote Desktop | SSH/VNC services | Remote login monitoring |
| **Automatic Updates** | Software Update | DNF/APT auto-updates | Security patch management |
| **Sharing Services** | File/Screen/Media | Samba/NFS/VNC | Network service monitoring |

### 📊 Multiple Output Formats
- **Console**: Colorized terminal output with emojis
- **Plain**: Clean text without colors or formatting
- **Markdown**: Documentation-ready format for sharing
- **JSON**: Structured data for automation and integration
- **Email**: Email-friendly format with proper headers

### 🔐 Advanced Features
- **Clipboard Integration**: Copy results directly to clipboard
- **Cryptographic Verification**: Generate SHA-256 hashes for tamper detection
- **Summary Mode**: One-line status for quick sharing
- **Password Management**: Secure password input with platform-aware prompts
- **Multiple Profiles**: Predefined security configurations (default, strict, relaxed, developer, EAI)

## 🚀 Installation

### For End Users (Standalone Executable - Recommended)

Download the standalone executable for your platform from the [GitHub Releases](https://github.com/eaiti/eai_security_check/releases) page. **No Node.js installation required!**

```bash
# macOS
curl -L -o eai-security-check https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-macos
chmod +x eai-security-check
./eai-security-check --help

# Linux
curl -L -o eai-security-check https://github.com/eaiti/eai_security_check/releases/latest/download/eai-security-check-linux
chmod +x eai-security-check
./eai-security-check --help
```

### For End Users (NPM Global Installation)

```bash
git clone https://github.com/eaiti/eai_security_check.git
cd eai_security_check
npm install
npm run build
npm install -g .
```

### For Development

```bash
git clone https://github.com/eaiti/eai_security_check.git
cd eai_security_check
npm install
npm run build
```

## 🎯 Quick Start

### Basic Security Audit

```bash
# Quick security check with default profile
./eai-security-check check

# Use EAI profile (essential checks only)
./eai-security-check check eai

# Save detailed report to Documents folder
./eai-security-check check eai --output ~/Documents/security-report.txt --password "mypassword"
```

### Advanced Usage Examples

```bash
# Different output formats
./eai-security-check check --format markdown     # Documentation-ready
./eai-security-check check --format json         # Structured data
./eai-security-check check --format email        # Email-friendly

# Clipboard integration
./eai-security-check check --clipboard           # Copy full report
./eai-security-check check --summary --clipboard # Copy summary only

# Tamper-evident reports
./eai-security-check check --hash -o ~/Documents/security-report.txt
./eai-security-check verify ~/Documents/security-report.txt

# Quick summary sharing
./eai-security-check check --summary
# Output: Security Audit: 4/9 passed, 3 failed, 2 warnings (7/30/2025, 6:45:48 PM)
```

## 📋 Command Reference

### Check Command

```bash
./eai-security-check check [options] [profile]
```

**Profiles:**
- `default` - Recommended security settings (7-min auto-lock)
- `strict` - Maximum security (3-min auto-lock, all features enabled)
- `relaxed` - Balanced security (15-min auto-lock)
- `developer` - Developer-friendly (remote access enabled)
- `eai` - EAI focused security (10+ char passwords, essential checks)

**Options:**
- `-c, --config <path>` - Custom configuration file
- `-o, --output <path>` - Save report to file
- `--password <password>` - Administrator password for sudo commands
- `--format <type>` - Output format: console, plain, markdown, json, email
- `--clipboard` - Copy report to clipboard
- `--summary` - Generate summary line only
- `--hash` - Generate cryptographic hash for verification
- `-q, --quiet` - Suppress detailed output

### Verify Command

```bash
./eai-security-check verify <file>
```

Verify the integrity of a tamper-evident security report generated with `--hash`.

### Init Command

```bash
./eai-security-check init [options]
```

Create a sample security configuration file.

**Options:**
- `--profile <name>` - Use predefined profile (default, strict, relaxed, developer, eai)
- `--file <path>` - Custom output filename

## 🖥️ Platform-Specific Examples

### macOS Example

```bash
# Complete macOS security audit with password
./eai-security-check check eai --password "myMacPassword" --output ~/Documents/macos-security.txt

# Check against strict security requirements
./eai-security-check check strict --format email --clipboard
```

### Linux (Fedora) Example

```bash
# Fedora security audit (primary supported distribution)
./eai-security-check check default --password "mySudoPassword" --output ~/Documents/fedora-security.txt

# Quick summary for email sharing
./eai-security-check check eai --summary --clipboard
```

### Ubuntu/Debian Example

```bash
# Ubuntu audit (limited testing - may have false positives)
./eai-security-check check relaxed --format json > ubuntu-security.json

# Verify generated report
./eai-security-check check --hash -o security-report.txt
./eai-security-check verify security-report.txt
```

## 🔧 Configuration

### Generic Configuration Names

The tool uses platform-agnostic configuration names for cross-platform compatibility:

```json
{
  "diskEncryption": {
    "enabled": true
  },
  "packageVerification": {
    "enabled": true
  },
  "systemIntegrityProtection": {
    "enabled": true
  }
}
```

**Legacy Support:** Old macOS-specific names (`filevault`, `gatekeeper`) are still supported for backward compatibility.

### Complete Configuration Example

```json
{
  "diskEncryption": {
    "enabled": true
  },
  "passwordProtection": {
    "enabled": true,
    "requirePasswordImmediately": true
  },
  "autoLock": {
    "maxTimeoutMinutes": 7
  },
  "firewall": {
    "enabled": true,
    "stealthMode": true
  },
  "packageVerification": {
    "enabled": true
  },
  "systemIntegrityProtection": {
    "enabled": true
  },
  "remoteLogin": {
    "enabled": false
  },
  "remoteManagement": {
    "enabled": false
  },
  "automaticUpdates": {
    "enabled": true,
    "automaticSecurityInstall": true,
    "updateMode": "download-only"
  },
  "sharingServices": {
    "fileSharing": false,
    "screenSharing": false,
    "remoteLogin": false
  },
  "osVersion": {
    "targetVersion": "latest"
  },
  "platform": {
    "target": "auto"
  }
}
```

### Security Profiles

Each profile targets different use cases:

- **EAI Profile**: Essential security checks only (disk encryption, password protection, auto-lock)
- **Default Profile**: Recommended security settings for most users
- **Strict Profile**: Maximum security with minimal convenience
- **Relaxed Profile**: Balanced security with convenience
- **Developer Profile**: Development-friendly with necessary remote access

## 📊 Example Output

### Console Format (Default)

```
🔒 Linux Security Audit Summary
📅 7/30/2025, 6:46:01 PM
💻 ubuntu 24.04
⚠️  Version: ubuntu 24.04 (untested - may have false positives/negatives)
❌ FAILED - 3/5 checks passed

🚨 Failed Checks:
   Linux Version Compatibility, Disk Encryption (LUKS)

📋 Security Check Results:
============================================================

❌ FAIL Disk Encryption (LUKS)
   Expected: true
   Actual: false
   Status: Disk encryption is disabled - disk is not encrypted
   📝 What it does: LUKS provides full-disk encryption, protecting your data if your device is lost or stolen.
   💡 Security advice: Should be ENABLED. Without disk encryption, anyone with physical access can read your files.

✅ PASS Password Protection
   Expected: true
   Actual: true
   Status: Password protection is enabled
```

### Summary Format

```bash
./eai-security-check check --summary
# Output: Security Audit: 4/9 passed, 3 failed, 2 warnings (7/30/2025, 6:45:48 PM)
```

### Verification Example

```bash
./eai-security-check check --hash -o ~/Documents/security-report.txt
# 📄 Tamper-evident report saved to: ~/Documents/security-report.txt
# 🔐 Report hash: AD545088
# 🔍 Verify with: eai-security-check verify "~/Documents/security-report.txt"

./eai-security-check verify ~/Documents/security-report.txt
# ✅ Report verification PASSED
# 🔐 Hash: AD545088
# 📅 Generated: 7/30/2025, 6:41:58 PM
# 💻 Platform: linux
```

## 🔐 Password Management

### Interactive Prompts (Recommended)

The tool will prompt for passwords when needed with platform-aware messages:

```bash
./eai-security-check check developer
# 🔐 Enter your macOS password:  (on macOS)
# 🔐 Enter your sudo password:   (on Linux)
```

### Direct Password Input

```bash
# Provide password directly (less secure)
./eai-security-check check developer --password "MySecure123!"
```

### Password Requirements by Profile

- **EAI Profile**: 10+ characters, 180-day expiration
- **Other Profiles**: 8+ characters with complexity requirements
- **Developer Profile**: Full complexity requirements (remote access needs)

## 🐧 Linux Distribution Support

### Primary Support
- **Fedora** (latest versions)

### Limited Testing
- Ubuntu 24.04+
- Debian 12+
- CentOS Stream
- RHEL 9+

⚠️ **Note**: Non-Fedora distributions may have false positives or negatives. The tool will display compatibility warnings.

## 🛠️ Development

```bash
# Development commands
npm run dev                # Run in development mode
npm run build             # Build TypeScript
npm run test              # Run tests
npm run lint              # Lint code
npm run lint:fix          # Fix linting issues

# Package for distribution
npm run pkg:build         # Build standalone executables
```

## 📋 Requirements

### For Standalone Executable Users
- **macOS**: macOS 12+ (tested on macOS 15.5+)
- **Linux**: Any modern distribution with systemd
- **No Node.js installation required!**

### For Development
- Node.js 18+
- TypeScript 5+
- macOS or Linux development environment

## 🔍 Security Implementation

### Command Execution
- Uses Node.js `child_process.exec` for system command execution
- Validates all command outputs and handles failures gracefully
- Secure password handling with non-interactive sudo when possible

### Platform Detection
- Automatic OS detection using system APIs
- Version compatibility checking with warnings
- Graceful fallbacks for unsupported features

### Cryptographic Features
- SHA-256 hashing for tamper detection
- Embedded metadata in reports (platform, hostname, timestamp)
- Secure random hash generation

## 🚪 Exit Codes

- `0`: All security checks passed
- `1`: One or more security checks failed or error occurred

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/eaiti/eai_security_check/issues)
- **Documentation**: See this README and `--help` commands
- **Security Reports**: Please use responsible disclosure for security issues
