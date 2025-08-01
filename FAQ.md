# Frequently Asked Questions (FAQ)

## General Usage

### How do I run a custom security configuration?

You can run a custom security configuration in several ways:

1. **Create a custom profile**: Use the interactive mode to create a custom configuration:
   ```bash
   eai-security-check interactive
   # Select "2. Configuration Management" → "Create Configuration"
   ```

2. **Use an existing profile**: Run with a specific built-in profile:
   ```bash
   eai-security-check check --profile strict
   eai-security-check check --profile relaxed
   eai-security-check check --profile developer
   eai-security-check check --profile eai
   ```

3. **Specify a custom config file**: Point to your own configuration file:
   ```bash
   eai-security-check check --config /path/to/your/custom-config.json
   ```

4. **Modify default configuration**: Edit the default configuration file located at:
   - **macOS/Linux**: `~/.config/eai-security-check/security-config.json`
   - **Windows**: `%APPDATA%\eai-security-check\security-config.json`

### How can I manually setup the daemon configuration?

To manually set up daemon configuration for automated security audits:

1. **Quick setup via CLI**:
   ```bash
   eai-security-check daemon-setup
   ```

2. **Interactive setup**:
   ```bash
   eai-security-check interactive
   # Select "3. Daemon Management" → "Setup Daemon Autoconf"
   ```

3. **Manual configuration file creation**:
   Create a file at `~/.config/eai-security-check/scheduling-config.json` with:
   ```json
   {
     "enabled": true,
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

Configuration files are stored in platform-specific locations:

- **macOS/Linux**: `~/.config/eai-security-check/`
  - `security-config.json` - Security check configuration
  - `scheduling-config.json` - Daemon scheduling configuration
- **Windows**: `%APPDATA%\eai-security-check\`
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
   # macOS/Linux
   rm -rf ~/.config/eai-security-check/
   
   # Windows
   rmdir /S "%APPDATA%\eai-security-check"
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