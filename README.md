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
- **Cryptographic Verification**: Enhanced tamper detection with HMAC-SHA256 signatures
- **Summary Mode**: One-line status for quick sharing
- **Password Management**: Secure password input with platform-aware prompts
- **Multiple Profiles**: Predefined security configurations (default, strict, relaxed, developer, EAI)
- **Scheduled Audits**: Automated daemon mode with email notifications and configurable intervals
- **System Service Integration**: Easy setup as system service with auto-restart capabilities

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

### 1. Initialize Configuration

```bash
# Interactive setup - guides you through profile selection and daemon configuration
./eai-security-check init
```

The interactive setup wizard will:
1. **Profile Selection**: Choose from 5 security profiles with detailed explanations
2. **Directory Setup**: Create OS-appropriate configuration directory
3. **Daemon Configuration**: Optionally set up automated scheduling with SMTP email
4. **Next Steps**: Clear guidance on running your first security audit

**Configuration Directory Locations:**
- **macOS**: `~/Library/Application Support/eai-security-check/`
- **Linux**: `~/.config/eai-security-check/`
- **Windows**: `%APPDATA%/eai-security-check/`

### 2. Run Security Audit

```bash
# Quick security check (uses centralized config)
./eai-security-check check

# Use specific profile
./eai-security-check check eai

# Save detailed report to Documents folder
./eai-security-check check --output ~/Documents/security-report.txt --password "mypassword"

# Generate tamper-evident report for email sharing
./eai-security-check check --hash --format email --output ~/Documents/security-audit-$(date +%Y%m%d).txt --password "mypassword"
```

### 3. Automated Monitoring (Optional)

```bash
# Start daemon for scheduled security audits
./eai-security-check daemon

# Check daemon status
./eai-security-check daemon --status

# Force immediate security check and email
./eai-security-check daemon --check-now
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

### Init Command

```bash
./eai-security-check init
```

Interactive setup wizard that guides you through configuration. **No options needed!**

**What it does:**
1. **Profile Selection**: Interactive menu to choose your default security profile with detailed explanations
2. **Directory Setup**: Creates OS-appropriate configuration directory and all profile files
3. **Daemon Setup**: Optional automated scheduling configuration with SMTP email settings
4. **Next Steps**: Clear guidance on running your first security audit

**Security Profiles Available:**
- `default` - Recommended security settings (7-min auto-lock timeout)
- `strict` - Maximum security, minimal convenience (3-min auto-lock timeout)
- `relaxed` - Balanced security with convenience (15-min auto-lock timeout)  
- `developer` - Developer-friendly with remote access enabled
- `eai` - EAI focused security (10+ char passwords, 180-day expiration)

**Examples:**
```bash
./eai-security-check init                      # Interactive setup wizard
```

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
./eai-security-check verify [options] <file>
```

Verify the integrity of a tamper-evident security report generated with `--hash`.

**Options:**
- `--verbose` - Show detailed verification information

**Examples:**
```bash
./eai-security-check verify security-report.txt     # Verify report integrity
./eai-security-check verify --verbose report.txt    # Show detailed verification info
./eai-security-check verify report.json             # Works with all formats (JSON, markdown, etc.)
```

**Supported Formats:** All output formats support verification (plain, markdown, json, email)
**Exit Codes:** 0 = verification passed, 1 = verification failed or file error

### Daemon Command

```bash
./eai-security-check daemon [options]
```

Run security checks on a schedule and automatically send email reports. This command starts a long-running daemon that performs scheduled security audits and sends email notifications.

**Setup:**
Before using daemon mode, initialize your configuration:
```bash
./eai-security-check init  # Interactive setup - choose daemon when prompted
```

**Options:**
- `-c, --config <path>` - Path to scheduling configuration file (default: uses centralized config)
- `--security-config <path>` - Path to security configuration file (overrides profile in schedule config)
- `-s, --state <path>` - Path to daemon state file (default: uses centralized state) 
- `--status` - Show current daemon status and exit
- `--test-email` - Send a test email and exit
- `--check-now` - Force an immediate security check and email (regardless of schedule)
- `--stop` - Stop the running daemon
- `--restart` - Restart the daemon
- `--uninstall` - Remove daemon files and configurations
- `--remove-executable` - Also remove the executable when uninstalling (requires --force)
- `--force` - Force operations that normally require confirmation

**Examples:**
```bash
# Initialize daemon configuration (interactive setup)
./eai-security-check init

# Start daemon with centralized configuration
./eai-security-check daemon

# Check daemon status
./eai-security-check daemon --status

# Force immediate check
./eai-security-check daemon --check-now

# Use custom configuration files
./eai-security-check daemon -c /path/to/my-schedule.json
./eai-security-check daemon --security-config /path/to/custom-security.json

# Daemon control operations
./eai-security-check daemon --stop                    # Stop running daemon
./eai-security-check daemon --restart                 # Restart daemon service
./eai-security-check daemon --uninstall               # Remove daemon files
./eai-security-check daemon --uninstall --force       # Remove daemon files and config
./eai-security-check daemon --uninstall --remove-executable --force  # Full uninstall
```

**Daemon Features:**
- Runs security checks on a configurable schedule (default: weekly)
- Sends email reports to configured recipients using SMTP
- Tracks when last report was sent to avoid duplicates
- Automatically restarts checks after system reboot (when configured as service)
- Graceful shutdown on SIGINT/SIGTERM signals
- Supports all existing security profiles and output formats
- Uses centralized configuration directory for easy management

**Setting up as System Service:**

For automatic startup on system reboot, use the provided setup script:

```bash
# Linux (systemd)
sudo ./daemon-examples/setup-daemon.sh install

# macOS (launchd)
./daemon-examples/setup-daemon.sh install

# Check service status
./daemon-examples/setup-daemon.sh status

# Uninstall service
sudo ./daemon-examples/setup-daemon.sh uninstall  # Linux
./daemon-examples/setup-daemon.sh uninstall       # macOS
```

**Configuration Files:**

The daemon uses configuration files stored in the centralized config directory:

1. **Security Configuration** (`security-config.json`): Defines security requirements
2. **Scheduling Configuration** (`scheduling-config.json`): Email and scheduling settings

Interactive setup (`init`) will create a scheduling configuration like:

```json
{
  "enabled": true,
  "intervalDays": 7,
  "userId": "user@company.com",
  "email": {
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "your-email@gmail.com",
        "pass": "your-app-specific-password"
      }
    },
    "from": "EAI Security Check <your-email@gmail.com>",
    "to": ["admin@company.com", "security@company.com"],
    "subject": "Weekly Security Audit Report"
  },
  "reportFormat": "email",
  "securityProfile": "default"
}
```

## 🖥️ Platform-Specific Examples

### macOS Example

```bash
# Initialize and run complete macOS security audit  
./eai-security-check init  # Choose eai profile in interactive setup
./eai-security-check check --password "myMacPassword" --output ~/Documents/macos-security.txt

# Run strict security check after setup
./eai-security-check check strict --format email --clipboard
```

### Linux (Fedora) Example

```bash
# Initialize and run Fedora security audit (primary supported distribution)
./eai-security-check init  # Choose default profile in interactive setup  
./eai-security-check check --password "mySudoPassword" --output ~/Documents/fedora-security.txt

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

### 🔐 Enhanced Cryptographic Security

The tool provides **enhanced tamper detection** with cryptographically secure signatures:

#### Security Levels
- **Basic Security**: SHA-256 hashing (development/testing)
- **Enhanced Security**: HMAC-SHA256 with build-time secrets (production recommended)

#### Key Features
- **Build-time Secret Injection**: Cryptographic secrets embedded during build process
- **HMAC Authentication**: Uses Hash-based Message Authentication Code for tamper detection  
- **Key Derivation**: PBKDF2 with 10,000 iterations for additional security
- **Salt Generation**: Unique cryptographically secure salt per report
- **Tamper Detection**: HMAC-SHA256 cryptographic signatures with build-time secrets

#### Usage
```bash
# Check current security status
eai-security-check security-status

# Create tamper-evident report (basic security)
eai-security-check check default --hash

# Build with enhanced security
EAI_BUILD_SECRET="$(openssl rand -hex 32)" npm run build:secure

# Verify report integrity
eai-security-check verify report.txt
```

**📖 Detailed Security Documentation**: See [SECURITY.md](SECURITY.md) for complete security analysis, threat model, and implementation details.

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
