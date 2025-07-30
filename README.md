# EAI Security Check

A Node.js + TypeScript tool for auditing macOS security settings against ### Initialize Configuration

Create a sample security configuration file:

```bash```bash
# Using standalone executable - Basic usage
./eai-security-check check

# Using globally installed version
eai-security-check check

# Using predefined security profiles (works from any directory)
./eai-security-check check default             # Recommended security settings
./eai-security-check check strict              # Maximum security (3-min auto-lock)
./eai-security-check check relaxed             # Balanced security (15-min auto-lock)
./eai-security-check check developer           # Developer-friendly (remote access enabled)
./eai-security-check check eai                 # EAI focused security (essential checks only)

# Using custom config file
./eai-security-check check --config ./my-config.json

# Save report to file
./eai-security-check check strict --output ./security-report.txt

# Quiet mode (summary only)
./eai-security-check check eai --quiet

# Provide administrator password directly (for profiles requiring sudo access)
./eai-security-check check developer --password 'MySecure123!'
```

### Initialize Configuration

Create a sample security configuration file:

```bash
./eai-security-check init

# Using globally installed version
eai-security-check init

# Create with different security profiles
./eai-security-check init --profile strict      # Maximum security (3-min auto-lock)
./eai-security-check init --profile relaxed     # Balanced security (15-min auto-lock)
./eai-security-check init --profile developer   # Developer-friendly (remote access enabled)
./eai-security-check init --profile eai         # EAI focused security (essential checks only)

# Custom filename
./eai-security-check init --file my-config.json
```ion file.

## Features

- **🔒 FileVault Check**: Verifies disk encryption is enabled to protect data if device is lost/stolen
- **🔑 Password Protection**: Ensures login password and immediate screen saver password requirements are configured
- **⏰ Auto-lock Timeout**: Validates screen automatically locks within specified time limit to prevent unauthorized access
- **🔥 Firewall**: Checks application firewall and stealth mode status to block malicious network traffic
- **🛡️ Gatekeeper**: Verifies downloaded applications are checked for malware before execution
- **🔐 System Integrity Protection (SIP)**: Ensures system files are protected from modification
- **🌐 Remote Access**: Checks SSH/remote login and management services configuration
- **🔄 Automatic Updates**: Validates different levels of automatic update configuration from disabled to fully automatic, including security updates and download-only modes
- **📡 Sharing Services**: Audits file sharing, screen sharing, and remote access services
- **📱 OS Version Tracking**: Ensures macOS is up-to-date with latest security patches (configurable target version or "latest")
- **📋 JSON Configuration**: Easy-to-customize security requirements with flexible profiles
- **📊 Detailed Reports**: Clear pass/fail status with actionable security advice and risk levels
- **🎯 Risk Prioritization**: Groups security issues by High/Medium/Low priority for efficient remediation

## Installation

### For End Users (Standalone Executable - Recommended)

Download the standalone executable for your platform from the [GitHub Releases](https://github.com/your-repo/eai_security_check/releases) page. **No Node.js installation required!**

```bash
# macOS
curl -L -o eai-security-check https://github.com/your-repo/eai_security_check/releases/latest/download/eai-security-check-macos
chmod +x eai-security-check
./eai-security-check --help
```

### For End Users (NPM Global Installation)

Install globally to use the `eai-security-check` command from anywhere:

```bash
# Clone the repository
git clone <repository-url>
cd eai_security_check

# Install dependencies and build
npm install
npm run build

# Install globally (makes eai-security-check available system-wide)
npm install -g .
```

After global installation, you can use `eai-security-check` from any directory.

## Quick Start (Standalone Executable)

```bash
# 1. Download the executable for your platform
curl -L -o eai-security-check https://github.com/your-repo/eai_security_check/releases/latest/download/eai-security-check-macos
chmod +x eai-security-check

# 2. Run a quick security check with the EAI profile
./eai-security-check check eai

# 3. Get detailed report
./eai-security-check check eai --output security-report.txt

# 4. Try different security profiles
./eai-security-check check strict    # Maximum security
./eai-security-check check relaxed   # Balanced approach
```

### For Development

```bash
# Clone and setup for development
git clone <repository-url>
cd eai_security_check

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Get Help

The tool provides comprehensive help information:

```bash
# Using standalone executable
./eai-security-check --help
./eai-security-check help

# Using globally installed version
eai-security-check --help
eai-security-check help

# Command-specific help
./eai-security-check help check
./eai-security-check help init
```

### Initialize Configuration

Create a sample security configuration file:

```bash
# Create default configuration
eai-security-check init

# Create with different security profiles
eai-security-check init --profile strict      # Maximum security (3-min auto-lock)
eai-security-check init --profile relaxed     # Balanced security (15-min auto-lock)
eai-security-check init --profile developer   # Developer-friendly (remote access enabled)
eai-security-check init --profile eai         # EAI focused security (essential checks only)

# Custom filename
eai-security-check init --file my-config.json
```

This creates a `security-config.json` file with default security requirements:

```json
{
  "filevault": {
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
  "gatekeeper": {
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
    "securityUpdatesOnly": true
  },
  "sharingServices": {
    "fileSharing": false,
    "screenSharing": false,
    "remoteLogin": false
  }
}
```

### Run Security Audit

Check your system against the configuration:

```bash
# Using default config file or profile
eai-security-check check

# Using predefined security profiles (works from any directory)
eai-security-check check default             # Recommended security settings
eai-security-check check strict              # Maximum security (3-min auto-lock)
eai-security-check check relaxed             # Balanced security (15-min auto-lock)
eai-security-check check developer           # Developer-friendly (remote access enabled)
eai-security-check check eai                 # EAI focused security (essential checks only)

# Using custom config file
eai-security-check check --config ./my-config.json

# Save report to file
eai-security-check check strict --output ./security-report.txt

# Quiet mode (summary only)
eai-security-check check eai --quiet

# Provide administrator password directly (for profiles requiring sudo access)
eai-security-check check developer --password 'MySecure123!'
```

### Development Commands

For development and testing:

```bash
# Using npm scripts (for development)
npm run dev -- init
npm run dev -- check
npm run dev -- help

# Build and run production version
npm run check
```

## Configuration Options

**Note**: All configuration sections are optional. If a section is omitted from your configuration file, that security check will be skipped entirely.

### Password Handling

The tool may require administrator privileges for certain security checks (specifically for `remoteLogin` and `remoteManagement` checks). You can provide the password in two ways:

- **Interactive prompt** (default): The tool will prompt for your password when needed
- **CLI parameter**: Use `--password 'YourPassword123!'` to provide the password directly

**Password Requirements:**
- Minimum 8 characters
- Must contain uppercase letter, lowercase letter, number, and special character
- Password age validation (must be less than 180 days old)
- Up to 3 retry attempts for interactive prompts

**Security Profiles and Password Requirements:**
- `eai` profile: No password required (only checks essential settings)
- `default`, `strict`, `relaxed`: No password required (remote access disabled)
- `developer` profile: Password required (remote access enabled for development)

### 🔒 FileVault
- `enabled`: Boolean - Whether disk encryption should be enabled

### 🔑 Password Protection
- `enabled`: Boolean - Whether login password protection should be enabled
- `requirePasswordImmediately`: Boolean - Whether password should be required immediately after screen saver activates

### ⏰ Auto-lock
- `maxTimeoutMinutes`: Number - Maximum minutes before screen should automatically lock (recommended: 7 or less)

### 🔥 Firewall
- `enabled`: Boolean - Whether application firewall should be enabled
- `stealthMode`: Boolean (optional) - Whether stealth mode should be enabled (makes system less visible to network scans)

### 🛡️ Gatekeeper
- `enabled`: Boolean - Whether Gatekeeper should verify downloaded applications

### 🔐 System Integrity Protection
- `enabled`: Boolean - Whether SIP should be enabled to protect system files

### 🌐 Remote Login
- `enabled`: Boolean - Whether SSH/remote login should be enabled (typically false for security)

### 📱 Remote Management
- `enabled`: Boolean - Whether remote management/screen control should be enabled (typically false)

### 🔄 Automatic Updates
- `enabled`: Boolean - Whether automatic update checking should be enabled (required)
- `securityUpdatesOnly`: Boolean (optional) - Whether only security updates should auto-install (backward compatibility)
- `downloadOnly`: Boolean (optional) - When true, configures "download-only" mode (check + download, manual install)
- `automaticInstall`: Boolean (optional) - Whether all updates should be installed automatically
- `automaticSecurityInstall`: Boolean (optional) - Whether security updates should be installed automatically

**Update Modes Detected:**
- `disabled`: No automatic checking, downloading, or installing
- `check-only`: Automatic checking enabled, but manual download and install required
- `download-only`: Automatic checking and downloading, but manual install required
- `fully-automatic`: Automatic checking, downloading, and installing

**Examples:**
```json
// Download-only mode (recommended for most users)
"automaticUpdates": {
  "enabled": true,
  "downloadOnly": true,
  "automaticSecurityInstall": true
}

// Fully automatic mode (maximum security)
"automaticUpdates": {
  "enabled": true,
  "automaticInstall": true,
  "automaticSecurityInstall": true
}

// Legacy configuration (still supported)
"automaticUpdates": {
  "enabled": true,
  "securityUpdatesOnly": true
}
```

### 📡 Sharing Services
- `fileSharing`: Boolean - Whether file sharing should be enabled
- `screenSharing`: Boolean - Whether screen sharing should be enabled
- `remoteLogin`: Boolean - Whether remote login sharing should be enabled

### 📱 OS Version
- `targetVersion`: String - Minimum required macOS version (e.g., "14.0") or "latest" to check against Apple's current release

## Security Profiles

The project includes multiple example configurations:

- **`default`**: Recommended security settings (7-minute auto-lock, all security features enabled)
- **`strict`**: Maximum security, minimal convenience (3-minute auto-lock, all security features enabled)
- **`relaxed`**: Balanced security with more convenience (15-minute auto-lock, some relaxed settings)
- **`developer`**: Developer-friendly with necessary remote access enabled
- **`eai`**: EAI focused security (7-minute auto-lock, essential security checks only: FileVault, password protection, auto-lock)

### Using Profiles

Profiles can be used as arguments to the check command:

```bash
# With standalone executable
./eai-security-check check strict      # Use strict security profile
./eai-security-check check eai         # Use EAI focused profile

# With globally installed version
eai-security-check check strict      # Use strict security profile
eai-security-check check eai         # Use EAI focused profile
```

### Customizing Security Checks

The EAI profile demonstrates selective security checking - it only includes essential checks (FileVault, password protection, auto-lock) and skips others (firewall, Gatekeeper, SIP, remote services, etc.). You can create custom configurations by omitting sections you don't want to check.

## Example Output

```
🔒 macOS Security Audit Report
📅 Generated: 7/22/2025, 10:30:00 AM
💻 System: macOS 14.5
✅ Overall Status: FAILED

📋 Security Check Results:
============================================================

✅ PASS FileVault [High Risk]
   Expected: true
   Actual: true
   Status: FileVault is enabled - disk encryption is active
   📝 What it does: FileVault provides full-disk encryption, protecting your data if your Mac is lost or stolen.
   💡 Security advice: Should be ENABLED. Without FileVault, anyone with physical access can read your files by booting from external media.

❌ FAIL Firewall [High Risk]
   Expected: true
   Actual: false
   Status: Firewall is disabled - system is vulnerable to network attacks
   📝 What it does: Application firewall blocks unauthorized network connections and protects against network-based attacks.
   💡 Security advice: Should be ENABLED. Protects against malicious network traffic and unauthorized remote access attempts.

✅ PASS Auto-lock Timeout [Medium Risk]
   Expected: ≤ 7 minutes
   Actual: 5 minutes
   Status: Screen locks after 5 minutes (within acceptable limit)
   📝 What it does: Automatically locks your screen after a period of inactivity to prevent unauthorized access.
   💡 Security advice: Should be ≤7 minutes for security, ≤15 minutes for convenience. Shorter timeouts provide better security.

⚠️  Security Issues Found!
The checks marked as FAIL indicate potential security vulnerabilities.
Review the security advice above and adjust your system settings accordingly.

🚨 HIGH PRIORITY: Firewall, Automatic Updates
⚠️  MEDIUM PRIORITY: Auto-lock Timeout, File Sharing
```

## Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Requirements

### For Standalone Executable Users
- macOS (tested on macOS 14+)
- **No Node.js installation required!**

### For Development or Source Installation
- macOS (tested on macOS 14+)
- Node.js 18+
- TypeScript

## Security Checks Performed

1. **🔒 FileVault Status**: Uses `fdesetup status` to check disk encryption
2. **🔑 Password Requirements**: Checks system preferences for login and screen saver password settings
3. **⏰ Auto-lock Timeout**: Reads screen saver idle time from system defaults
4. **🔥 Firewall**: Checks application firewall status and stealth mode via `socketfilterfw`
5. **🛡️ Gatekeeper**: Verifies Gatekeeper status using `spctl --status`
6. **🔐 System Integrity Protection**: Checks SIP status via `csrutil status`
7. **🌐 Remote Login**: Examines SSH service status and remote login settings
8. **📱 Remote Management**: Checks for active remote management services
9. **🔄 Automatic Updates**: Reads comprehensive system update preferences to distinguish between disabled, check-only, download-only, and fully-automatic modes
10. **📡 Sharing Services**: Monitors file sharing, screen sharing, and remote access services

## Exit Codes

- `0`: All security checks passed
- `1`: One or more security checks failed or error occurred

## License

MIT
