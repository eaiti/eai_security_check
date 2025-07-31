# Daemon Setup Guide

This guide covers setting up automated security audits using the EAI Security Check daemon functionality.

## 🎯 Overview

The daemon feature enables:
- **Scheduled Security Audits**: Automated checks at configurable intervals
- **Email Notifications**: Automatic report delivery to specified recipients  
- **SCP File Transfer**: Optional upload of reports to remote servers
- **Service Integration**: Run as system service with auto-restart capabilities
- **Flexible Scheduling**: Daily, weekly, or custom interval options

## 🚀 Quick Setup

### 1. Initialize Daemon Configuration

```bash
# Interactive setup (includes daemon configuration)
eai-security-check init

# When prompted, choose:
# - "Yes" for daemon setup
# - Configure email settings
# - Set check interval (daily/weekly)
# - Choose security profile
```

### 2. Start the Daemon

```bash
# Start daemon with centralized configuration
eai-security-check daemon

# Check daemon status
eai-security-check daemon --status

# Test email configuration
eai-security-check daemon --test-email
```

### 3. Optional: Set Up as System Service

Follow the platform-specific instructions created by `eai-security-check init`:

```bash
# View service setup instructions
cat ~/.config/eai-security-check/daemon-templates/setup-instructions.txt

# Or follow the platform-specific guides below
```

## 📋 Daemon Configuration

### Scheduling Configuration File

Location: `~/.config/eai-security-check/scheduling-config.json` (Linux)

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
    "subject": "Weekly Security Audit Report",
    "replyTo": "security@company.com"
  },
  "reportFormat": "email",
  "securityProfile": "default",
  "scp": {
    "enabled": false,
    "host": "backup.company.com",
    "port": 22,
    "username": "backup-user",
    "privateKeyPath": "~/.ssh/id_rsa",
    "destinationPath": "/backups/security-reports/",
    "authentication": "key"
  }
}
```

## ⚙️ Configuration Options

### Basic Settings

```json
{
  "enabled": true,
  "intervalDays": 1,
  "userId": "admin@company.com"
}
```

**Options:**
- `enabled`: Enable/disable daemon functionality
- `intervalDays`: Check interval (1=daily, 7=weekly, 30=monthly)
- `userId`: User identifier for tracking and reporting

### Email Configuration

#### Gmail Setup (Most Common)

```json
{
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
    "from": "EAI Security Monitor <your-email@gmail.com>",
    "to": ["security-team@company.com"],
    "subject": "Security Audit Report - {{date}}"
  }
}
```

**Gmail App Password Setup:**
1. Enable 2-factor authentication
2. Go to Google Account settings > Security > App passwords
3. Generate app password for "Mail"
4. Use the generated password (not your regular password)

#### Microsoft 365/Outlook Setup

```json
{
  "email": {
    "smtp": {
      "host": "smtp-mail.outlook.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "your-email@outlook.com",
        "pass": "your-password"
      }
    },
    "from": "Security Monitor <your-email@outlook.com>",
    "to": ["team@company.com"]
  }
}
```

#### Corporate SMTP Server

```json
{
  "email": {
    "smtp": {
      "host": "mail.company.com",
      "port": 25,
      "secure": false,
      "auth": {
        "user": "monitoring@company.com",
        "pass": "service-account-password"
      }
    },
    "from": "Security Monitoring <monitoring@company.com>",
    "to": ["it-security@company.com", "sysadmin@company.com"],
    "subject": "{{hostname}} Security Report - {{status}}",
    "replyTo": "it-security@company.com"
  }
}
```

### SCP File Transfer (Optional)

Automatically upload reports to a remote server:

```json
{
  "scp": {
    "enabled": true,
    "host": "backup.company.com",
    "port": 22,
    "username": "backup-service",
    "privateKeyPath": "~/.ssh/backup_key",
    "destinationPath": "/var/backups/security-reports/",
    "authentication": "key"
  }
}
```

**Authentication Options:**
- `"key"`: SSH key-based (recommended)
- `"password"`: Password-based (requires `sshpass` utility)

**SSH Key Setup:**
```bash
# Generate SSH key for backup service
ssh-keygen -t rsa -b 4096 -f ~/.ssh/backup_key -C "security-check-daemon"

# Copy public key to remote server
ssh-copy-id -i ~/.ssh/backup_key.pub backup-service@backup.company.com

# Test connection
ssh -i ~/.ssh/backup_key backup-service@backup.company.com
```

### Report Format Options

```json
{
  "reportFormat": "email"
}
```

**Available Formats:**
- `"email"`: Email-optimized format with headers
- `"markdown"`: Markdown format for documentation
- `"plain"`: Plain text without formatting
- `"json"`: Structured JSON format

### Security Profile Selection

```json
{
  "securityProfile": "strict"
}
```

**Or use custom configuration:**
```json
{
  "securityConfigPath": "/path/to/custom-config.json"
}
```

## 🖥️ System Service Setup

### Linux (systemd)

The `init` command creates service templates. Manual setup:

```bash
# Copy service file
cp ~/.config/eai-security-check/daemon-templates/eai-security-check.service ~/.config/systemd/user/

# Edit service file to update paths
nano ~/.config/systemd/user/eai-security-check.service

# Enable and start service
systemctl --user daemon-reload
systemctl --user enable eai-security-check.service
systemctl --user start eai-security-check.service

# Check status
systemctl --user status eai-security-check.service

# Enable lingering (start on boot without login)
sudo loginctl enable-linger $USER
```

**Service File Example:**
```ini
[Unit]
Description=EAI Security Check Daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/eai-security-check daemon
Restart=always
RestartSec=60
User=%i
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

### macOS (launchd)

```bash
# Copy plist file
cp ~/.config/eai-security-check/daemon-templates/com.eai.security-check.plist ~/Library/LaunchAgents/

# Edit plist to update paths
nano ~/Library/LaunchAgents/com.eai.security-check.plist

# Load and start service
launchctl load ~/Library/LaunchAgents/com.eai.security-check.plist
launchctl start com.eai.security-check

# Check status
launchctl list | grep com.eai.security-check
```

**Plist File Example:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.eai.security-check</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/eai-security-check</string>
        <string>daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/eai-security-check.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/eai-security-check.error.log</string>
</dict>
</plist>
```

### Windows (Task Scheduler)

```powershell
# Run as Administrator
# The init command provides a PowerShell script

# Create scheduled task
$action = New-ScheduledTaskAction -Execute "C:\path\to\eai-security-check.exe" -Argument "daemon"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType ServiceAccount

Register-ScheduledTask -TaskName "EAI Security Check Daemon" -Action $action -Trigger $trigger -Settings $settings -Principal $principal

# Start task
Start-ScheduledTask -TaskName "EAI Security Check Daemon"

# Check status
Get-ScheduledTask -TaskName "EAI Security Check Daemon"
```

## 🔧 Daemon Control Commands

### Basic Operations

```bash
# Start daemon
eai-security-check daemon

# Check status
eai-security-check daemon --status

# Stop daemon  
eai-security-check daemon --stop

# Restart daemon
eai-security-check daemon --restart
```

### Configuration Management

```bash
# Use custom scheduling config
eai-security-check daemon -c /path/to/custom-schedule.json

# Override security config
eai-security-check daemon --security-config /path/to/security.json

# Use custom state file
eai-security-check daemon -s /path/to/daemon-state.json
```

### Testing and Debugging

```bash
# Test email configuration
eai-security-check daemon --test-email

# Force immediate check (ignore schedule)
eai-security-check daemon --check-now

# Verbose logging
eai-security-check daemon --verbose
```

### Maintenance Operations

```bash
# Uninstall daemon files and config
eai-security-check daemon --uninstall

# Force uninstall (skip confirmations)
eai-security-check daemon --uninstall --force

# Remove executable during uninstall
eai-security-check daemon --uninstall --remove-executable --force
```

## 📊 Example Email Reports

### Successful Audit Email

```
Subject: Weekly Security Audit Report - PASSED

Security Audit Report
Generated: 2024-01-15 09:00:00
Platform: macOS 14.0
Profile: default
User: admin@company.com

SUMMARY: ✅ PASSED (8/9 checks passed, 1 warning)

RESULTS:
✅ Disk Encryption: FileVault enabled
✅ Password Protection: Required immediately  
✅ Auto-lock Timeout: 7 minutes
✅ Firewall: Application Firewall enabled
⚠️  Package Verification: Gatekeeper enabled (strict mode recommended)
✅ System Integrity Protection: SIP enabled
✅ Remote Login: SSH disabled
✅ Automatic Updates: Download and install enabled
✅ Sharing Services: All services disabled

RECOMMENDATIONS:
- Consider enabling Gatekeeper strict mode for enhanced security

This report was generated automatically by EAI Security Check.
Next audit scheduled: 2024-01-22 09:00:00
```

### Failed Audit Email

```
Subject: Weekly Security Audit Report - FAILED

⚠️  SECURITY ALERT ⚠️

Security Audit Report  
Generated: 2024-01-15 09:00:00
Platform: Linux (Ubuntu 22.04)
Profile: strict
User: sysadmin@company.com

SUMMARY: ❌ FAILED (6/9 checks passed, 3 failed)

CRITICAL ISSUES:
❌ Disk Encryption: LUKS not enabled (CRITICAL)
❌ System Integrity Protection: AppArmor not active (CRITICAL)  
❌ Firewall: ufw disabled (HIGH RISK)

PASSED CHECKS:
✅ Password Protection: Session lock enabled
✅ Auto-lock Timeout: 3 minutes
✅ Package Verification: APT GPG verification enabled

IMMEDIATE ACTION REQUIRED:
1. Enable LUKS disk encryption
2. Activate AppArmor security module
3. Enable and configure ufw firewall

This system does not meet security requirements.
Please address these issues immediately.
```

## 🔍 Monitoring and Logs

### Daemon State Tracking

The daemon maintains state in `daemon-state.json`:

```json
{
  "lastRun": "2024-01-15T09:00:00.000Z",
  "lastEmailSent": "2024-01-15T09:00:15.000Z",
  "lastStatus": "PASSED",
  "nextScheduledRun": "2024-01-22T09:00:00.000Z",
  "runCount": 12,
  "consecutiveFailures": 0
}
```

### Log Locations

**macOS:**
```bash
# launchd logs
tail -f ~/Library/Logs/com.eai.security-check.log

# System logs
log show --predicate 'process == "eai-security-check"' --last 1h
```

**Linux:**
```bash
# systemd logs
journalctl --user -u eai-security-check.service -f

# Application logs
tail -f ~/.config/eai-security-check/daemon.log
```

**Windows:**
```powershell
# Task Scheduler logs
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" | Where-Object {$_.TaskName -eq "EAI Security Check Daemon"}

# Application logs
Get-Content "$env:APPDATA\eai-security-check\daemon.log" -Wait
```

## 🚨 Troubleshooting

### Common Issues

**Daemon not starting:**
```bash
# Check configuration
eai-security-check daemon --status

# Validate email settings
eai-security-check daemon --test-email

# Check permissions
ls -la ~/.config/eai-security-check/
```

**Email not sending:**
```bash
# Test SMTP connection
telnet smtp.gmail.com 587

# Check authentication
eai-security-check daemon --test-email

# Verify app password (Gmail)
# Make sure 2FA is enabled and app password is correct
```

**SCP transfer failing:**
```bash
# Test SSH connection
ssh -i ~/.ssh/backup_key backup-user@backup.company.com

# Check destination permissions
ssh backup-user@backup.company.com "ls -la /backup/path/"

# Install sshpass for password auth (Linux)
sudo apt install sshpass  # Ubuntu/Debian
sudo dnf install sshpass  # Fedora
```

**Service not auto-starting:**
```bash
# Linux: Check lingering
loginctl show-user $USER | grep Linger

# macOS: Check launchd
launchctl list | grep com.eai.security-check

# Windows: Check scheduled task
Get-ScheduledTask -TaskName "EAI Security Check Daemon"
```

### Performance Tuning

**Reduce resource usage:**
```json
{
  "intervalDays": 7,
  "reportFormat": "plain",
  "scp": { "enabled": false }
}
```

**Faster execution:**
```json
{
  "securityProfile": "relaxed"
}
```

## 🔗 Next Steps

- **[Configuration Guide](CONFIGURATION.md)** - Customize security requirements
- **[Usage Examples](USAGE_EXAMPLES.md)** - See practical daemon use cases
- **[Security Documentation](../SECURITY.md)** - Understand security implications