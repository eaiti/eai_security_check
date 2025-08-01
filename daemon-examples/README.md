# Daemon Service Setup Examples

This directory contains configuration files and setup scripts for running EAI Security Check as a system service across different platforms.

## 🚀 Quick Start (Recommended)

**The easiest way to set up the daemon is through the interactive mode:**

```bash
eai-security-check interactive
# Navigate to: Daemon → Setup Daemon Automation
# Follow the guided setup process with centralized file structure
```

This will:
1. ✅ Configure email settings and schedule
2. ✅ Create centralized config alongside executable  
3. ✅ Set up automatic system service (optional)
4. ✅ Test your configuration and start daemon
5. ✅ Use centralized logging (no permission issues)

## � Centralized File Structure

The daemon uses a centralized file structure that keeps all files organized alongside the executable:

```
# Example: Executable at /path/to/eai-security-check
/path/to/
├── eai-security-check           # Main executable
├── config/                      # All configuration files
│   ├── scheduling-config.json   # Daemon settings & email config
│   └── security-config.json     # Security profile settings
├── logs/                        # All daemon logs (no permission issues!)
│   ├── eai-security-check.log   # Daemon output logs
│   └── eai-security-check.error.log # Error logs
└── reports/                     # Generated security reports
    └── security-report-*.{txt,md,json}
```

**Benefits:**
✅ **Self-contained**: Move executable directory, everything moves with it  
✅ **No permission issues**: No need for `/var/log/` or system directories  
✅ **Global install compatible**: Works with symlinks (`/usr/local/bin/eai-security-check`)  
✅ **Cross-platform consistent**: Same structure on macOS, Linux, Windows  
✅ **Service-friendly**: LaunchAgent/systemd can reliably find logs and config  

## �📋 Manual Setup Instructions

### macOS (LaunchAgent)

#### Using Interactive Mode (Recommended)
```bash
# Run the guided setup
eai-security-check interactive
# Choose "3. Daemon - Automated security monitoring"
# Choose "1. Setup Daemon Automation"
# Follow the prompts - it will automatically:
# 1. Check for compatible global installation
# 2. Install globally if needed
# 3. Set up LaunchAgent automatically
```

#### Manual Setup
1. **First, ensure global installation:**
   ```bash
   npm install -g eai-security-check  # Or use interactive mode
   ```

2. **Configure the daemon:**
   ```bash
   eai-security-check interactive  # Choose daemon setup
   ```

3. **Manual LaunchAgent setup (if needed):**
   ```bash
   # Only needed if interactive setup failed
   cp daemon-examples/com.eai.security-check.daemon.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.eai.security-check.daemon.plist
   ```

#### Common Issues on macOS
- **"No such file or directory"**: Make sure you have a compatible global installation. Use interactive mode which checks this automatically.
- **"Permission denied"**: Check that the executable is in your PATH and has execute permissions
- **"Service won't start"**: Check logs in `~/Library/Logs/eai-security-check.error.log`

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
   ```cmd
   eai-security-check interactive
   ```

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
**Location**: `<executable-dir>/logs/`
  - `eai-security-check.log`
  - `eai-security-check.error.log`

### Service Files
- **macOS**: `~/Library/LaunchAgents/com.eai.security-check.daemon.plist`
- **Linux**: `~/.config/systemd/user/eai-security-check-daemon.service`
- **Windows**: Task Scheduler

## 💡 Best Practices

1. **Start with Interactive Setup**: Use `eai-security-check interactive` to configure everything properly
2. **Test First**: Run `eai-security-check daemon` manually to verify your configuration
3. **Check Logs**: Monitor logs after setup to ensure everything works correctly
4. **Use User Services**: Run as user service rather than system service when possible
5. **Regular Updates**: Keep the tool updated and restart services after updates

For more detailed information, see the [Daemon Setup Guide](../docs/DAEMON_SETUP.md).