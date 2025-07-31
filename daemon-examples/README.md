# EAI Security Check Daemon Setup Examples

This directory contains example configuration files for setting up the EAI Security Check daemon as a system service on different platforms.

> **Note**: For comprehensive daemon setup instructions, see the [Daemon Setup Guide](../docs/DAEMON_SETUP.md).

## Quick Setup

The easiest way to set up the daemon is using interactive management mode:

```bash
# Launch interactive management and choose daemon automation option
eai-security-check interactive
```

## Platform-Specific Service Setup

### Linux (systemd)

1. **Copy the service file:**
   ```bash
   cp eai-security-check.service ~/.config/systemd/user/
   ```

2. **Enable and start the service:**
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable eai-security-check.service
   systemctl --user start eai-security-check.service
   ```

3. **Check service status:**
   ```bash
   systemctl --user status eai-security-check.service
   ```

4. **Enable lingering (to start on boot even when not logged in):**
   ```bash
   sudo loginctl enable-linger $USER
   ```

### macOS (launchd)

1. **Copy the plist file:**
   ```bash
   cp com.eai.security-check.plist ~/Library/LaunchAgents/
   ```

2. **Load and start the service:**
   ```bash
   launchctl load ~/Library/LaunchAgents/com.eai.security-check.plist
   launchctl start com.eai.security-check
   ```

3. **Check service status:**
   ```bash
   launchctl list | grep com.eai.security-check
   ```

### Windows (Task Scheduler)

1. **Run PowerShell as Administrator**

2. **Update the executable path in `windows-task-scheduler.ps1`**

3. **Execute the PowerShell script:**
   ```powershell
   .\windows-task-scheduler.ps1
   ```

4. **Verify the task was created:**
   ```powershell
   Get-ScheduledTask -TaskName "EAI Security Check Daemon"
   ```

## Important Notes

- **Update paths**: Modify the executable paths in the configuration files to match your installation
- **User permissions**: These examples run the daemon as the current user, not as root/administrator
- **Prerequisites**: Ensure that `eai-security-check interactive` has been run and daemon configuration exists
- **Logging**: Check system logs for daemon output and error messages

## Current Daemon Capabilities

| Feature | Linux | macOS | Windows |
|---------|-------|-------|---------|
| Scheduled execution | ✅ | ✅ | ✅ |
| Manual restart | ✅ | ✅ | ✅ |
| Auto-start on boot | ⚠️ Manual setup | ⚠️ Manual setup | ⚠️ Manual setup |
| Service management | systemd | launchd | Task Scheduler |

## Troubleshooting

1. **Daemon not starting**: Check that configuration files exist and are valid
2. **Email issues**: Verify SMTP settings in scheduling-config.json
3. **Permission errors**: Ensure the daemon has access to required directories
4. **Service logs**: Check system service logs for detailed error information

For more information, see the comprehensive [Daemon Setup Guide](../docs/DAEMON_SETUP.md) which covers:

- Complete scheduling configuration options
- Email setup for Gmail, Outlook, and corporate SMTP
- SCP file transfer configuration
- Troubleshooting common issues
- Advanced daemon control commands