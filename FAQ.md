# Frequently Asked Questions (FAQ)

## General Usage

### How do I run a custom security configuration?

You can create and use custom security configurations through the desktop application:

1. **Create a custom profile through the UI**:
   - Launch the EAI Security Check application
   - Navigate to "Settings" → "Security Profiles"
   - Click "Create New Profile" or duplicate an existing one
   - Modify settings using the visual controls
   - Save with a descriptive name

2. **Use built-in profiles**:
   - Select from predefined profiles in the settings:
     - **default**: Recommended general-purpose settings
     - **strict**: Maximum security for high-risk environments
     - **relaxed**: Balanced approach prioritizing convenience  
     - **developer**: Development-friendly settings
     - **eai**: EAI organization-specific requirements

3. **Import/Export configurations**:
   - Use "Import Configuration" to load shared profiles
   - Use "Export Configuration" to save and share custom profiles
   - Share configuration files across team members and systems

### How can I set up automated monitoring?

To set up automated security auditing with email notifications:

1. **Use the Setup Wizard**:
   - Open the application and go to "Settings" → "Automated Monitoring"  
   - Click "Setup Automated Audits"
   - Follow the step-by-step wizard to configure:
     - Schedule frequency (daily, weekly, or custom)
     - Email settings (SMTP configuration)
     - Notification recipients
     - Report format preferences

2. **Visual Scheduling**:
   - Use the built-in scheduler to set specific days and times
   - Choose from preset options or create custom schedules
   - Preview schedule before activation

3. **Email Integration**:
   - Configure SMTP settings with validation
   - Test email delivery with "Send Test Email" 
   - Set up multiple recipient lists for different scenarios
     "intervalDays": 7,
     "email": {
       "smtp": {
         "host": "smtp.gmail.com",
         "port": 587,
         "secure": false,
         "auth": {
           "user": "your-email@example.com",
           "pass": "your-app-password"
         }
       },
       "from": "security-audit@yourcompany.com",
       "to": ["admin@yourcompany.com"],
       "subject": "Security Audit Report"
     },
     "reportFormat": "email",
     "securityProfile": "default",
     "user": {
       "name": "Your Name",
       "email": "your-email@example.com"
     }
   }
   ```

4. **Test the configuration**:
   ```bash
   eai-security-check daemon --status
   eai-security-check daemon --test-email
   ```

## Configuration and Profiles

### What's the difference between security profiles?

- **default**: Balanced security settings suitable for most users
- **strict**: High-security settings with stricter requirements
- **relaxed**: More permissive settings for development environments
- **developer**: Optimized for development workflows with relaxed security
- **eai**: Enterprise-grade security profile for corporate environments

### Where are configuration files stored?

Configuration files are stored in a centralized structure alongside the executable:

**Location**: `<executable-dir>/config/`
  - `security-config.json` - Security check configuration
  - `scheduling-config.json` - Daemon scheduling configuration

### How do I reset configurations to defaults?

1. **Reset security configuration**:
   ```bash
   eai-security-check interactive
   # Select "2. Configuration Management" → "Reset to Defaults"
   ```

2. **Remove all configurations** (nuclear option):
   ```bash
   # Remove configuration directory alongside executable
   rm -rf <executable-dir>/config/
   ```

## Daemon and Automation

### How do I check if the daemon is running?

```bash
eai-security-check daemon --status
```

This will show you:
- Whether the daemon is currently running
- When it was last started
- Next scheduled audit time
- Configuration summary

### How do I stop the daemon?

```bash
eai-security-check daemon stop
```

Or use the interactive mode:
```bash
eai-security-check interactive
# Select "3. Daemon Management" → "Stop Daemon"
```

### Can I run audits immediately while daemon is scheduled?

Yes! You can run manual audits anytime:
```bash
eai-security-check check
```

This won't interfere with scheduled daemon audits.

### How do I change the audit frequency?

Edit your scheduling configuration file or use interactive mode:
```bash
eai-security-check interactive
# Select "3. Daemon Management" → "Configure Daemon"
```

Change the `intervalDays` value to your desired frequency.

## Email Configuration

### What email providers are supported?

The tool supports any SMTP-compatible email provider:
- Gmail (smtp.gmail.com:587)
- Outlook/Hotmail (smtp-mail.outlook.com:587)
- Yahoo Mail (smtp.mail.yahoo.com:587)
- Corporate SMTP servers
- Custom SMTP servers

### How do I set up Gmail for email reports?

1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use these settings in your configuration:
   ```json
   {
     "smtp": {
       "host": "smtp.gmail.com",
       "port": 587,
       "secure": false,
       "auth": {
         "user": "your-gmail@gmail.com",
         "pass": "your-16-char-app-password"
       }
     }
   }
   ```

### Can I send reports to multiple recipients?

Yes! Set multiple email addresses in the `to` array:
```json
{
  "email": {
    "to": [
      "admin@company.com",
      "security@company.com",
      "manager@company.com"
    ]
  }
}
```

## Troubleshooting

### The tool says "Permission denied" on macOS

Some security checks require administrative privileges. Run with sudo:
```bash
sudo eai-security-check check
```

Or grant Full Disk Access to your terminal application in:
System Preferences → Security & Privacy → Privacy → Full Disk Access

### Linux checks are failing with "Command not found"

Ensure required system utilities are installed:
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y systemd ufw

# CentOS/RHEL/Fedora
sudo dnf install -y systemd firewalld

# Arch Linux
sudo pacman -S systemd ufw
```

### Email reports are not being sent

1. **Test email configuration**:
   ```bash
   eai-security-check daemon --test-email
   ```

2. **Check common issues**:
   - Verify SMTP settings (host, port, credentials)
   - Ensure firewall allows outbound connections on SMTP port
   - Check that email provider allows SMTP access
   - For Gmail, ensure App Passwords are used (not regular password)

3. **Check daemon logs**:
   Look for error messages when the daemon attempts to send emails

### How do I report bugs or request features?

1. **Check existing issues**: Visit [GitHub Issues](https://github.com/eaiti/eai_security_check/issues)
2. **Create new issue**: Use the appropriate template for bugs or feature requests
3. **Include details**:
   - Operating system and version
   - Tool version (`eai-security-check --version`)
   - Full command that caused the issue
   - Complete error message
   - Configuration file (remove sensitive information)

## Advanced Usage

### Can I integrate this with CI/CD pipelines?

Yes! The tool provides JSON output and appropriate exit codes:

```bash
# Use in CI/CD with JSON output
eai-security-check check --output json --quiet

# Exit codes: 0 = all checks passed, 1 = some checks failed
echo $?  # Check exit code
```

### How do I customize check timeouts?

Edit your security configuration file and modify timeout values:
```json
{
  "checks": {
    "diskEncryption": {
      "enabled": true,
      "timeout": 30
    }
  }
}
```

### Can I disable specific security checks?

Yes, set `enabled: false` for any check in your configuration:
```json
{
  "checks": {
    "fileSharing": {
      "enabled": false
    }
  }
}
```

### How do I run only specific checks?

Currently, you can disable unwanted checks in your configuration. A future version may support running specific checks via command-line flags.