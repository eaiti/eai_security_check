# Daemon Setup Guide

This guide covers setting up automated security audits using the EAI Security Check daemon functionality with **automatic system service integration**.

## 🎯 Overview

The daemon feature enables:
- **Automated System Service Setup**: One-click installation as system service (LaunchAgent/systemd/Task Scheduler)
- **Independent Background Execution**: Runs as separate Node.js process, no CLI required
- **Scheduled Security Audits**: Automated checks at configurable intervals
- **Email Notifications**: Automatic report delivery to specified recipients  
- **SCP File Transfer**: Optional upload of reports to remote servers
- **Cross-Platform Service Management**: Unified interface for service installation/removal
- **Real-time Status Monitoring**: Live daemon and system service status
- **Integrated Log Management**: View and clear daemon logs from desktop interface

## 🚀 Quick Setup (Desktop Application)

### 1. **Access Daemon Manager**
1. Open EAI Security Check desktop application
2. Navigate to **🔄 Daemon Manager** in the main menu
3. The daemon manager provides complete daemon and system service control

### 2. **Configure Daemon Settings**
1. **Set Check Interval**: Choose daily (1), weekly (7), or custom interval (1-365 days)
2. **Select Security Profile**: Choose from default, strict, relaxed, developer, or EAI
3. **Configure Email Notifications** (optional):
   - Enter recipient email address
   - Configure SMTP settings (Gmail, Outlook, custom server)
   - Set email format and subject preferences
4. **Set User ID**: Identifier included in reports for tracking
5. Click **💾 Save Configuration**

### 3. **Setup System Service (Recommended)**
1. In Daemon Manager, locate **System Service Integration** section
2. Click **🛠️ Setup System Service** 
   - **macOS**: Creates LaunchAgent in `~/Library/LaunchAgents/`
   - **Linux**: Creates systemd service in `~/.config/systemd/user/`
   - **Windows**: Creates Task Scheduler entry for current user
3. System service will automatically start daemon on system boot
4. Verify installation with **✅ Installed** status indicator

### 4. **Start and Monitor Daemon**
1. Click **▶️ Start Daemon** to begin automated monitoring
2. Monitor **Current Status** section for:
   - Daemon running status (🟢 Running / 🔴 Stopped)  
   - Next scheduled run time
   - Last audit completion
3. Use **🔄 Refresh Status** to update information
4. Use **📋 Load Recent Logs** to view daemon activity

## 📋 System Service Details

## 📋 System Service Details

### Automatic Service Installation

The desktop application automatically handles system service setup:

| Platform | Service Type | Installation Location | Auto-start |
|----------|-------------|----------------------|------------|
| **macOS** | LaunchAgent | `~/Library/LaunchAgents/com.eai.security-check.plist` | ✅ User login |
| **Linux** | systemd user service | `~/.config/systemd/user/eai-security-check.service` | ✅ User session |
| **Windows** | Task Scheduler | User tasks (non-admin) | ✅ User logon |

### Service Management Commands

**Desktop Application** (Recommended):
- Use **🛠️ Setup System Service** / **🗑️ Remove System Service** buttons
- Real-time status monitoring with **System Service** indicator
- No terminal/command-line access required

**Manual Management** (Advanced users):

```bash
# macOS - LaunchAgent
launchctl load ~/Library/LaunchAgents/com.eai.security-check.plist    # Enable
launchctl unload ~/Library/LaunchAgents/com.eai.security-check.plist  # Disable  

# Linux - systemd user service
systemctl --user enable eai-security-check.service   # Enable auto-start
systemctl --user start eai-security-check.service    # Start now
systemctl --user status eai-security-check.service   # Check status
systemctl --user disable eai-security-check.service  # Disable

# Windows - Task Scheduler (via PowerShell)
Get-ScheduledTask -TaskName "EAI Security Check"      # Check status
Start-ScheduledTask -TaskName "EAI Security Check"    # Start now
Disable-ScheduledTask -TaskName "EAI Security Check"  # Disable
```

## 📋 Daemon Configuration

### User Configuration Directory

The daemon uses the standard user configuration directory structure:

```
# User configuration directory:
~/.eai-security-check/

# Directory structure:
~/.eai-security-check/
├── config/                      # Configuration files
│   ├── scheduling-config.json   # Daemon configuration
│   └── security-config.json     # Security profile settings
├── logs/                        # Daemon logs
│   ├── eai-security-check.log   # Output logs
│   └── eai-security-check.error.log # Error logs  
└── reports/                     # Generated reports
    └── security-report-*.{txt,md,json}
```

### Scheduling Configuration File

Location: `<executable-dir>/config/scheduling-config.json`

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
cp <executable-dir>/config/daemon-templates/eai-security-check.service ~/.config/systemd/user/

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

**Using the Desktop Application:**
1. Navigate to **Settings** → **Daemon Configuration** → **System Service**
2. Follow the macOS LaunchAgent setup instructions
3. The app will guide you through creating and loading the LaunchAgent

**Manual setup (for development builds):**
# The plist file uses centralized logging alongside the executable
cp ~/path/to/com.eai.security-check.daemon.plist ~/Library/LaunchAgents/

# Load and start service  
launchctl load ~/Library/LaunchAgents/com.eai.security-check.daemon.plist
launchctl start com.eai.security-check.daemon

# Check status
launchctl list | grep com.eai.security-check
```

**Plist File Example (with centralized logging):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.eai.security-check.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/eai-security-check</string>
        <string>daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <!-- Centralized logging alongside executable -->
    <key>StandardOutPath</key>
    <string>/path/to/executable/logs/eai-security-check.log</string>
    <key>StandardErrorPath</key>
    <string>/path/to/executable/logs/eai-security-check.error.log</string>
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
tail -f <executable-dir>/logs/eai-security-check.log
```

**Windows:**
```powershell
# Task Scheduler logs
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" | Where-Object {$_.TaskName -eq "EAI Security Check Daemon"}

# Application logs
Get-Content "$env:APPDATA\eai-security-check\daemon.log" -Wait
```

## 🚨 Troubleshooting

### Desktop Application Issues

**System Service Setup Fails:**
1. **Permission Issues**: Service installation requires write access to user service directories
   - **macOS**: `~/Library/LaunchAgents/` must be writable
   - **Linux**: `~/.config/systemd/user/` must exist and be writable  
   - **Windows**: Current user must have Task Scheduler access
2. **Missing Dependencies**: 
   - **Linux**: systemd user services require `systemctl --user` support
   - **Windows**: Task Scheduler service must be running
3. **Use Desktop Application Logs**: Check **📋 Load Recent Logs** for detailed error messages

**Daemon Status Shows "Not Available":**
1. **Configuration Missing**: Use **💾 Save Configuration** to create daemon config
2. **Node.js Path Issues**: Daemon requires Node.js in system PATH
3. **Permission Problems**: Check that `~/.eai-security-check/` is writable
4. **Desktop Application Restart**: Close and reopen application after configuration changes

**Email Configuration Not Saving:**
1. **SMTP Validation**: Use **Email Integration** collapsible section to verify all SMTP settings
2. **Authentication Issues**: Enable 2FA and use app-specific passwords for Gmail/Outlook
3. **SSL/TLS Settings**: Try both secure (port 465) and STARTTLS (port 587) options
4. **Firewall**: Ensure outbound SMTP ports (587, 465, 25) are not blocked

### Command Line Troubleshooting

**Classic Issues:**

**Daemon not starting:**
```bash
# Check configuration via desktop app first, then:
# Verify daemon process
ps aux | grep "eai-security-check"

# Check configuration files
ls -la ~/.eai-security-check/config/

# Test daemon manually
node dist/cli/index.js daemon --status
```

**Email not sending:**
```bash
# Test SMTP connection
telnet smtp.gmail.com 587

# Check authentication with desktop app **Email Integration** test feature

# Verify app password (Gmail)
# Make sure 2FA is enabled and app password is correct
```

**System service issues:**
```bash
# macOS LaunchAgent
launchctl list | grep eai-security-check
launchctl print gui/$(id -u)/com.eai.security-check

# Linux systemd
systemctl --user status eai-security-check.service
journalctl --user -u eai-security-check.service -f

# Windows Task Scheduler
Get-ScheduledTask -TaskName "*EAI*" | Select TaskName,State
```

### Getting Help

1. **Desktop Application Logs**: Use **📋 Load Recent Logs** for recent daemon activity
2. **Configuration Export**: Save your daemon configuration for support requests
3. **System Service Status**: Note the **System Service** status (installed/not installed, running/stopped)
4. **Platform Information**: Include OS version and platform details
5. **Error Messages**: Copy exact error messages from daemon logs

For additional support, include:
- Daemon configuration (with sensitive information removed)
- Recent log entries from **📋 Load Recent Logs**  
- System service installation status
- Platform and application version information

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