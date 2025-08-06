# Automated Monitoring Setup Examples

This directory contains configuration files and setup scripts for configuring automated security auditing across different platforms.

## 🚀 Quick Start (Recommended)

**The easiest way to set up automated monitoring is through the desktop application:**

1. **Launch EAI Security Check** desktop application
2. **Navigate to Settings** → "Automated Monitoring"  
3. **Click "Setup Automated Audits"** 
4. **Follow the setup wizard**:
   - Configure audit schedule (daily, weekly, custom)
   - Set up email notifications with SMTP settings
   - Choose security profile and report format
   - Test configuration with sample email
5. **Activate monitoring** - system service setup is handled automatically

This will:
1. ✅ Configure email settings and schedule
2. ✅ Create centralized config alongside executable  
3. ✅ Set up automatic system service (optional)
4. ✅ Test your configuration and start daemon
5. ✅ Use centralized logging (no permission issues)

## 🗂 Configuration and File Structure

The daemon uses the standard user directory structure for configuration and files:

```
# User configuration directory: ~/.eai-security-check/
~/.eai-security-check/
├── config/                      # Configuration files
│   ├── scheduling-config.json   # Daemon settings & email config  
│   └── security-config.json     # Security profile settings
├── logs/                        # Daemon logs  
│   ├── eai-security-check.log   # Daemon output logs
│   └── eai-security-check.error.log # Error logs
└── reports/                     # Generated security reports
    └── security-report-*.{txt,md,json}
```

**Benefits:**
✅ **User-based**: Configuration stored in user's home directory  
✅ **Cross-platform consistent**: Same structure on macOS, Linux, Windows  
✅ **No permission issues**: User has full access to their config directory  
✅ **Service-friendly**: LaunchAgent/systemd can reliably find user configs  

## 📋 Manual Setup Instructions

### macOS (LaunchAgent)

#### Setup Steps
1. **Configure daemon settings:**
   - Use the desktop application to configure daemon email settings and schedule
   - Settings are saved to `~/.eai-security-check/config/scheduling-config.json`

2. **Set up LaunchAgent:**
   ```bash
   cp daemon-examples/com.eai.security-check.daemon.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.eai.security-check.daemon.plist
   ```

#### Common Issues on macOS
- **"No such file or directory"**: Make sure the daemon service files are properly installed and configured
- **"Permission denied"**: Check that the executable is in your PATH and has execute permissions
- **"Service won't start"**: Check logs in `~/.eai-security-check/logs/eai-security-check.error.log`

### Linux (systemd)

#### System Service (runs as root)
```bash
sudo cp daemon-examples/eai-security-check.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable eai-security-check.service
sudo systemctl start eai-security-check.service
```

#### User Service (runs as current user) - Recommended
```bash
mkdir -p ~/.config/systemd/user
cp daemon-examples/eai-security-check-daemon.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable eai-security-check-daemon.service
systemctl --user start eai-security-check-daemon.service
```

### Windows (Task Scheduler)

1. **Set up daemon configuration:**
   - Use the desktop application to configure daemon email settings and schedule
   - Settings are saved to `%USERPROFILE%\.eai-security-check\config\scheduling-config.json`

2. **Run the PowerShell setup script as Administrator:**
   ```powershell
   .\daemon-examples\windows-task-scheduler.ps1
   ```

Or manually create a scheduled task that runs:
```
eai-security-check.exe daemon
```

## 🔧 Configuration Files

### Required Configuration
Before setting up as a service, you need:

1. **Scheduling Configuration** (`<executable-dir>/config/scheduling-config.json`):
   - Email SMTP settings
   - Recipients and schedule
   - Security profile to use

2. **Security Configuration** (optional):
   - Custom security requirements
   - Override default profiles

### Example Scheduling Configuration
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
        "pass": "your-app-password"
      }
    },
    "from": "Security Reports <your-email@gmail.com>",
    "to": ["admin@company.com"],
    "subject": "Weekly Security Audit Report"
  },
  "reportFormat": "email",
  "securityProfile": "default"
}
```

## 📊 Service Management

### Check Service Status
```bash
# macOS
launchctl list com.eai.security-check.daemon
launchctl print user/$(id -u)/com.eai.security-check.daemon

# Linux (systemd)
systemctl --user status eai-security-check-daemon

# Windows
schtasks /query /tn "EAI Security Check Daemon"
```

### View Logs
```bash
# macOS
tail -f ~/Library/Logs/eai-security-check.log
tail -f ~/Library/Logs/eai-security-check.error.log

# Linux (systemd)
journalctl --user -u eai-security-check-daemon -f

# Windows
# Check Windows Event Log or Task Scheduler history
```

### Stop/Start Service
```bash
# macOS
launchctl stop com.eai.security-check.daemon
launchctl start com.eai.security-check.daemon

# Linux (systemd)
systemctl --user stop eai-security-check-daemon
systemctl --user start eai-security-check-daemon

# Windows
schtasks /end /tn "EAI Security Check Daemon"
schtasks /run /tn "EAI Security Check Daemon"
```

## 🛠️ Troubleshooting

### Common Issues

1. **"Command not found" errors**
   - Ensure `eai-security-check` is installed globally and in PATH
   - For compiled executable, ensure correct path in service files

2. **Email not sending**
   - Test email configuration: `eai-security-check daemon --test-email`
   - Check SMTP settings and authentication

3. **Service won't start**
   - Check service logs for specific error messages
   - Verify configuration files exist and are valid JSON
   - Ensure executable has proper permissions

4. **Daemon stops unexpectedly**
   - Check system logs for crash information
   - Verify the daemon has proper permissions for log files
   - Check disk space and memory usage

### Debug Mode
Run the daemon manually to see detailed output:
```bash
eai-security-check daemon --check-now
```

## 📁 File Locations

### Configuration Files
**Location**: `<executable-dir>/config/`
  - `scheduling-config.json`
  - `daemon-state.json`
  - `security-config.json` (optional)

### Log Files
**Location**: `~/.eai-security-check/logs/`
  - `eai-security-check.log`
  - `eai-security-check.error.log`

### Service Files
- **macOS**: `~/Library/LaunchAgents/com.eai.security-check.daemon.plist`
- **Linux**: `~/.config/systemd/user/eai-security-check-daemon.service`
- **Windows**: Task Scheduler

## 💡 Best Practices

1. **Configure Using Desktop App**: Use the desktop application to configure daemon settings properly
2. **Test First**: Test your configuration before setting up automated services
3. **Check Logs**: Monitor logs after setup to ensure everything works correctly
4. **Use User Services**: Run as user service rather than system service when possible
5. **Regular Updates**: Keep the tool updated and restart services after updates

For more detailed information, see the [Daemon Setup Guide](../docs/DAEMON_SETUP.md).