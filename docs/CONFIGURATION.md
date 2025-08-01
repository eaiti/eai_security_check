# Configuration Guide

This guide covers all security configuration options and how to customize them for your specific requirements.

## 📋 Configuration Overview

The EAI Security Check tool uses JSON-based configuration files to define security requirements. These configurations are:

- **Cross-platform**: Same configuration works on macOS, Linux, and Windows
- **Profile-based**: Pre-defined profiles for common use cases
- **Customizable**: Create your own configurations for specific needs
- **Validated**: Automatic validation with helpful error messages

## 🏠 Configuration Directory

EAI Security Check uses a **centralized file structure** alongside the executable for better organization and portability:

### Centralized Structure (Recommended)

```bash
# Executable location (example):
/path/to/eai-security-check

# Centralized configuration:
/path/to/
├── eai-security-check           # Main executable
├── config/                      # Configuration files
│   ├── security-config.json     # Security requirements
│   └── scheduling-config.json   # Daemon configuration
├── reports/                     # Generated reports
│   └── security-report-*.{txt,md,json}
└── logs/                        # Application logs
    ├── eai-security-check.log
    └── eai-security-check.error.log
```

### Previous Installation Locations

**Note**: Previous versions used OS-specific configuration directories. Current versions use the centralized structure for better portability and organization.

**Benefits of Centralized Structure:**
✅ **Portable**: Move executable directory, everything moves with it  
✅ **Self-contained**: All files in one location  
✅ **Permission-safe**: No system directory issues  
✅ **Global-compatible**: Works with global installation via symlinks

## 📊 Built-in Security Profiles

### Profile Comparison

| Profile | Auto-lock | Password Length | Remote Access | Use Case |
|---------|-----------|----------------|---------------|----------|
| **default** | 7 min | 8+ chars | Disabled | General users |
| **strict** | 3 min | 12+ chars | Disabled | High-security environments |
| **relaxed** | 15 min | 6+ chars | Allowed | Convenience-focused |
| **developer** | 10 min | 8+ chars | Enabled | Development workstations |
| **eai** | 7 min | 10+ chars | Disabled | EAI organization requirements |

### Using Built-in Profiles

```bash
# Use a specific profile
eai-security-check check default    # Recommended settings
eai-security-check check strict     # Maximum security
eai-security-check check relaxed    # Balanced approach
eai-security-check check developer  # Developer-friendly
eai-security-check check eai        # EAI-specific requirements
```

## 🔧 Security Configuration Options

### Complete Configuration Schema

Here's a comprehensive example showing all available options:

```json
{
  "diskEncryption": {
    "enabled": true
  },
  "passwordProtection": {
    "enabled": true,
    "requirePasswordImmediately": true
  },
  "password": {
    "required": true,
    "minLength": 8,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumber": true,
    "requireSpecialChar": true,
    "maxAgeDays": 180
  },
  "autoLock": {
    "maxTimeoutMinutes": 7
  },
  "firewall": {
    "enabled": true,
    "stealthMode": false
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
    "downloadOnly": false,
    "automaticInstall": true,
    "automaticSecurityInstall": true,
    "securityUpdatesOnly": false
  },
  "sharingServices": {
    "fileSharing": false,
    "screenSharing": false,
    "remoteLogin": false
  },
  "osVersion": {
    "targetVersion": "latest"
  },
  "wifiSecurity": {
    "bannedNetworks": [
      "EAIguest",
      "xfinitywifi",
      "Guest",
      "Public WiFi",
      "Free WiFi"
    ]
  },
  "installedApps": {
    "bannedApplications": [
      "BitTorrent",
      "uTorrent",
      "TeamViewer",
      "AnyDesk"
    ]
  },
  "platform": {
    "target": "auto"
  }
}
```

## 🔐 Detailed Configuration Options

### Disk Encryption

Controls full-disk encryption requirements:

```json
{
  "diskEncryption": {
    "enabled": true
  }
}
```

**Platform Implementation:**
- **macOS**: FileVault 2 encryption
- **Linux**: LUKS encryption detection  
- **Windows**: BitLocker encryption

### Password Protection

Screen lock and authentication requirements:

```json
{
  "passwordProtection": {
    "enabled": true,
    "requirePasswordImmediately": true
  }
}
```

**Options:**
- `enabled`: Require password for screen unlock
- `requirePasswordImmediately`: No grace period after screen lock

### Password Requirements

User account password strength requirements:

```json
{
  "password": {
    "required": true,
    "minLength": 12,
    "requireUppercase": true,
    "requireLowercase": true, 
    "requireNumber": true,
    "requireSpecialChar": true,
    "maxAgeDays": 90
  }
}
```

**Options:**
- `required`: Whether password is required for the account
- `minLength`: Minimum password length (integer value)
- `requireUppercase`: Must contain uppercase letters (A-Z)
- `requireLowercase`: Must contain lowercase letters (a-z)
- `requireNumber`: Must contain numbers (0-9)
- `requireSpecialChar`: Must contain special characters (!@#$%^&*)
- `maxAgeDays`: Maximum password age in days (0 = no expiration)

### Auto-lock Timeout

Screen lock timeout configuration:

```json
{
  "autoLock": {
    "maxTimeoutMinutes": 5
  }
}
```

**Platform Implementation:**
- **macOS**: Screen saver timeout settings
- **Linux**: GNOME/KDE screensaver settings
- **Windows**: Screen saver timeout settings

### Firewall Configuration

Network firewall requirements:

```json
{
  "firewall": {
    "enabled": true,
    "stealthMode": true
  }
}
```

**Options:**
- `enabled`: Firewall must be active
- `stealthMode`: Enable stealth mode (hide from network scans)

**Platform Implementation:**
- **macOS**: Application Firewall
- **Linux**: ufw, firewalld, or iptables
- **Windows**: Windows Defender Firewall

### Package Verification

Code signing and package integrity:

```json
{
  "packageVerification": {
    "enabled": true
  }
}
```

**Options:**
- `enabled`: Require package verification

**Platform Implementation:**
- **macOS**: Gatekeeper
- **Linux**: GPG signature verification (DNF/APT)
- **Windows**: Windows Defender SmartScreen

### System Integrity Protection

System-level protection mechanisms:

```json
{
  "systemIntegrityProtection": {
    "enabled": true
  }
}
```

**Platform Implementation:**
- **macOS**: System Integrity Protection (SIP)
- **Linux**: SELinux or AppArmor
- **Windows**: Windows Defender + Tamper Protection

### Remote Access Control

Remote login and management services:

```json
{
  "remoteLogin": {
    "enabled": false
  },
  "remoteManagement": {
    "enabled": false  
  }
}
```

**Services Monitored:**
- **Remote Login**: SSH, Remote Desktop, VNC
- **Remote Management**: Apple Remote Desktop, VNC servers, RDP

### Automatic Updates

System update configuration:

```json
{
  "automaticUpdates": {
    "enabled": true,
    "downloadOnly": false,
    "automaticInstall": true,
    "automaticSecurityInstall": true,
    "securityUpdatesOnly": false
  }
}
```

**Options:**
- `enabled`: Automatic updates must be enabled
- `downloadOnly`: Only download, don't install automatically  
- `automaticInstall`: Install all updates automatically
- `automaticSecurityInstall`: Install security updates automatically
- `securityUpdatesOnly`: Only check for security updates

### Sharing Services

Network sharing service restrictions:

```json
{
  "sharingServices": {
    "fileSharing": false,
    "screenSharing": false,
    "remoteLogin": false
  }
}
```

**Services Monitored:**
- **File Sharing**: SMB/AFP file sharing, Samba, NFS
- **Screen Sharing**: VNC, Apple Screen Sharing
- **Remote Login**: SSH, remote access services

## 🎯 Creating Custom Configurations

### Example: High-Security Environment

```json
{
  "diskEncryption": {
    "enabled": true
  },
  "password": {
    "required": true,
    "minLength": 16,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumber": true,
    "requireSpecialChar": true,
    "maxAgeDays": 60
  },
  "autoLock": {
    "maxTimeoutMinutes": 2
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
    "automaticSecurityInstall": true
  },
  "sharingServices": {
    "fileSharing": false,
    "screenSharing": false,
    "remoteLogin": false
  }
}
```

### Example: Developer Workstation

```json
{
  "diskEncryption": {
    "enabled": true
  },
  "password": {
    "required": true,
    "minLength": 8,
    "requireNumber": true,
    "maxAgeDays": 365
  },
  "autoLock": {
    "maxTimeoutMinutes": 15
  },
  "firewall": {
    "enabled": true,
    "stealthMode": false
  },
  "packageVerification": {
    "enabled": true
  },
  "systemIntegrityProtection": {
    "enabled": true
  },
  "remoteLogin": {
    "enabled": true
  },
  "remoteManagement": {
    "enabled": false
  },
  "automaticUpdates": {
    "enabled": true,
    "downloadOnly": true,
    "automaticSecurityInstall": true
  },
  "sharingServices": {
    "fileSharing": true,
    "screenSharing": true,
    "remoteLogin": true
  }
}
```

## 🔄 Using Custom Configurations

### Save and Use Custom Configuration

```bash
# Create your custom configuration file
cat > my-security-config.json << 'EOF'
{
  "diskEncryption": { "enabled": true },
  "password": { 
    "required": true,
    "minLength": 10,
    "requireUppercase": true,
    "requireNumber": true
  },
  "autoLock": { "maxTimeoutMinutes": 5 },
  "firewall": { "enabled": true }
}
EOF

# Use your custom configuration
eai-security-check check -c my-security-config.json

# Save results with custom configuration
eai-security-check check -c my-security-config.json -o security-report.txt
```

### Configuration Validation

The tool automatically validates configurations:

```bash
# Test configuration file
eai-security-check check -c invalid-config.json

# Example error output:
# ❌ Configuration Error: Invalid password.minLength: must be between 1-128
# ❌ Configuration Error: Unknown field 'invalidOption' in configuration
```

## 🌍 Cross-Platform Configuration Differences

### Platform-Specific Behaviors

Some features behave differently across platforms:

**Disk Encryption:**
- **macOS**: FileVault status detection
- **Linux**: LUKS encryption detection (may vary by distribution)
- **Windows**: BitLocker status detection

**Password Requirements:**
- **macOS**: Local account password policies
- **Linux**: PAM configuration analysis
- **Windows**: Local security policy analysis

**Firewall:**
- **macOS**: Application Firewall settings
- **Linux**: Multiple firewall systems (ufw preferred)
- **Windows**: Windows Defender Firewall

### Generic vs Legacy Names

The tool supports both modern cross-platform names and legacy platform-specific names:

```json
{
  // Modern cross-platform names (recommended)
  "diskEncryption": { "enabled": true },
  "packageVerification": { "enabled": true },
  "systemIntegrityProtection": { "enabled": true }

  // Legacy macOS-specific names (still supported)
  // "fileVault": { "enabled": true },
  // "gatekeeper": { "enabled": true },
  // "sip": { "enabled": true }
}
```

## 📝 Configuration Best Practices

### Security Recommendations

1. **Start with built-in profiles** - Use `default` or `strict` as a baseline
2. **Customize gradually** - Make incremental changes and test
3. **Document changes** - Add comments explaining custom requirements
4. **Test thoroughly** - Verify configurations work on your target platforms
5. **Version control** - Track configuration changes over time

### Common Patterns

**Baseline Security:**
```json
{
  "diskEncryption": { "enabled": true },
  "passwordProtection": { "enabled": true },
  "firewall": { "enabled": true },
  "automaticUpdates": { "enabled": true }
}
```

**Development-Friendly:**
```json
{
  "autoLock": { "maxTimeoutMinutes": 15 },
  "remoteLogin": { "enabled": true },
  "sharingServices": {
    "fileSharing": true,
    "screenSharing": true
  }
}
```

**Enterprise Environment:**
```json
{
  "password": {
    "required": true,
    "minLength": 12,
    "maxAgeDays": 90,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumber": true,
    "requireSpecialChar": true
  },
  "autoLock": { 
    "maxTimeoutMinutes": 5 
  },
  "packageVerification": { 
    "enabled": true 
  }
}
```

## 🔗 Next Steps

- **[Usage Examples](USAGE_EXAMPLES.md)** - See practical examples of using configurations
- **[Daemon Setup](DAEMON_SETUP.md)** - Automate security checks with scheduling
- **[Installation Guide](INSTALLATION.md)** - Set up the tool on your system