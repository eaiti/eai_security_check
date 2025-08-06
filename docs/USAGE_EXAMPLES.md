# Usage Examples

This guide provides practical examples for using the EAI Security Check unified application in both desktop (GUI) and command-line (CLI) modes.

## 🖥️ Desktop Application (GUI Mode)

### Quick Security Check

**Using the Desktop Application:**
1. Launch EAI Security Check from your applications menu
2. Click "Run Security Audit" on the dashboard
3. View real-time results with color-coded status indicators:
   - ✅ **Green**: Security check passed
   - ⚠️ **Yellow**: Warning - review recommendation
   - ❌ **Red**: Failed - immediate attention required

### Profile-Based Checks

**Visual Profile Selection:**
1. Navigate to "Settings" → "Security Profiles"
2. Choose from built-in profiles:
   - **default**: Recommended settings for general users
   - **strict**: Maximum security for high-risk environments  
   - **relaxed**: Balanced approach prioritizing convenience
   - **developer**: Development-friendly settings
   - **eai**: EAI organization-specific requirements
3. Click "Run Audit" to check against selected profile

### Report Management

**Export and Share Results:**
1. After running an audit, access the "Reports" section
2. Select any historical report
3. Use the format converter to export in multiple formats:
   - **JSON**: Structured data for automation
   - **HTML**: Web-friendly with styling
   - **Markdown**: Documentation-ready format
   - **CSV**: Spreadsheet-compatible data
   - **Plain Text**: Simple, readable format
4. Use "Copy to Clipboard" for quick sharing
5. Click "Download" to save locally

## 🖲️ Command Line Interface (CLI Mode)

### Basic CLI Commands

```bash
# Show version and help
npx electron . --version
npx electron . --help

# Quick security check with human-readable output
npx electron . check --profile developer --format human

# Automated check with JSON output
npx electron . check --profile strict --format json --non-interactive
```

### Save Reports to Files

**CLI Method (Automated):**
```bash
# Save detailed report to JSON file
npx electron . check --profile strict --format json --output ~/security-report.json

# Save human-readable report 
npx electron . check --profile developer --format human --output ~/security-report.txt

# Non-interactive for automation
npx electron . check --profile eai --non-interactive --format json --output ~/automated-security-check.json
```

**GUI Method (Interactive):**
1. Run security check in desktop application
2. Navigate to "Reports" section  
3. Select report and click "Download"
4. Choose format (JSON, HTML, Markdown, CSV, Plain Text)

## 🔧 Custom Configuration Examples

### Creating Custom Security Profiles

**Using the Visual Profile Editor:**
1. Open the application and navigate to "Settings" → "Security Profiles"
2. Click "Create New Profile" or "Duplicate Existing"
3. Modify security requirements using the visual controls:
   - **Auto-lock timeout**: Slider control with minute increments
   - **Password requirements**: Character length and complexity options
   - **Firewall settings**: Enable/disable with explanation tooltips
   - **System integrity**: Toggle critical security features
4. Save with a descriptive name
5. Test the profile by running an audit

### Enterprise Configuration

**Setting up organization-wide profiles:**
1. Create a custom profile with enterprise requirements
2. Export the profile using "Export Configuration"
3. Share the configuration file with team members
4. Import on other systems using "Import Configuration"
5. Set as default profile for consistent auditing

### Development Environment Setup

**Developer-friendly configuration:**
1. Start with the "developer" profile template
2. Adjust settings for development workflow:
   - **Relaxed auto-lock**: 15-20 minutes for active development
   - **Flexible firewall**: Allow development servers and tools
   - **Modified sharing**: Enable necessary development services
3. Save as "custom-dev" profile
4. Use for all development workstations

## 🤖 Automated Monitoring Examples

### GUI-Based Scheduled Audits

**Using the Daemon Setup Wizard:**
1. Navigate to "Settings" → "Automated Monitoring"
2. Click "Setup Automated Audits"
3. Configure schedule options:
   - **Daily**: High-security environments
   - **Weekly**: Standard corporate environments  
   - **Custom**: Specific days/times using visual scheduler
4. Set up email notifications:
   - **SMTP Configuration**: Visual form with validation
   - **Recipient Lists**: Add multiple notification addresses
   - **Report Format**: Choose email-optimized formatting
5. Test configuration with "Send Test Email"
6. Activate automated monitoring

### CLI-Based Automation

**Simple Automation Scripts:**
```bash
#!/bin/bash
# Daily security check script
DATE=$(date +%Y-%m-%d)
REPORT_FILE="security-check-$DATE.json"

# Run non-interactive security check
npx electron . check --profile strict --non-interactive --format json --output "$REPORT_FILE"

# Check exit code
if [ $? -eq 0 ]; then
    echo "✅ Security check passed - $DATE"
else
    echo "❌ Security check failed - $DATE"
    # Send alert or take remediation action
fi
```

**Advanced Automation with Error Handling:**
```bash
#!/bin/bash
# Enterprise security monitoring script

set -e

LOG_DIR="/var/log/security-checks"
REPORT_DIR="/opt/security-reports"
DATE=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$LOG_DIR" "$REPORT_DIR"

# Run security check with comprehensive logging
{
    echo "Starting security check at $(date)"
    
    if npx electron . check --profile eai --non-interactive --format json --output "$REPORT_DIR/security-$DATE.json"; then
        echo "✅ Security check completed successfully"
        
        # Validate the report
        if npx electron . validate "$REPORT_DIR/security-$DATE.json"; then
            echo "✅ Report validation successful"
        else
            echo "⚠️ Report validation failed"
        fi
        
    else
        echo "❌ Security check failed"
        exit 1
    fi
    
} >> "$LOG_DIR/security-check.log" 2>&1
```

**CI/CD Integration:**
```bash
#!/bin/bash
# CI/CD security gate script
echo "🔒 Running security compliance check..."

# Non-interactive security check for CI/CD
if npx electron . check --profile developer --non-interactive --format json > security-ci-report.json; then
    echo "✅ Security compliance check passed"
    
    # Extract key metrics for CI/CD dashboard
    PASSED=$(cat security-ci-report.json | jq '.summary.passed')
    FAILED=$(cat security-ci-report.json | jq '.summary.failed')
    TOTAL=$(cat security-ci-report.json | jq '.summary.totalChecks')
    
    echo "📊 Results: $PASSED/$TOTAL checks passed, $FAILED failed"
    
    # Fail build if critical security checks fail
    if [ "$FAILED" -gt 0 ]; then
        echo "❌ Build failed due to security compliance issues"
        exit 1
    fi
    
else
    echo "❌ Security compliance check failed"
    exit 1
fi
```

### Email Notification Examples

**Configuring different notification scenarios:**

**Simple Daily Monitoring:**
- Schedule: Every day at 8:00 AM
- Recipients: IT team email alias
- Format: Email-optimized summary
- Trigger: Send on failures only

**Comprehensive Weekly Reports:**
- Schedule: Every Monday at 9:00 AM
- Recipients: Security team + management
- Format: Detailed HTML report
- Trigger: Send all results (pass/fail/warning)

**High-Security Real-Time Alerts:**
- Schedule: Every 4 hours
- Recipients: Security operations center
- Format: JSON for automated processing
- Trigger: Critical failures only
### Custom Configuration Files

**CLI Method:**
```bash
# Create custom configuration file
cat > my-config.json << 'EOF'
{
  "diskEncryption": { "enabled": true },
  "password": { 
    "required": true,
    "minLength": 12,
    "requireUppercase": true,
    "requireNumber": true,
    "maxAgeDays": 90
  },
  "autoLock": { "maxTimeoutMinutes": 5 },
  "firewall": { "enabled": true, "stealthMode": true },
  "remoteLogin": { "enabled": false }
}
EOF

# Use custom configuration
npx electron . check --config my-config.json --format human

# Save custom report
npx electron . check --config my-config.json --output custom-audit.json
```

**GUI Method:**
1. Open application, navigate to "Settings" → "Security Profiles"
2. Create or modify profiles using visual editor
3. Export configuration files for sharing or CLI use
```

### Configuration Validation

**CLI Method:**
```bash
# Test configuration file for errors
npx electron . check --config invalid-config.json

# Validate existing reports
npx electron . validate security-report.json

# Example error output:
# ❌ Configuration Error: password.minLength must be between 1-128
# ❌ Configuration Error: Unknown field 'invalidOption'
# ❌ Configuration failed validation
```

**GUI Method:**
1. Use the visual configuration editor with real-time validation
2. Import configuration files to check for errors
3. Built-in validation prevents invalid configurations

## 🖥️ Platform-Specific Examples

### macOS Examples

**CLI Usage:**
```bash
# Complete macOS security audit
npx electron . check --profile default --format human

# Check macOS-specific features with strict profile
npx electron . check --profile strict --format json --output macos-security-report.json

# Developer workstation setup (non-interactive)
npx electron . check --profile developer --non-interactive

# Example output focusing on macOS features:
# ✅ FileVault: Enabled for primary disk
# ✅ Gatekeeper: Enabled with developer mode
# ✅ SIP: System Integrity Protection enabled
# ✅ XProtect: Malware detection active
```

**GUI Usage:**
1. Launch application on macOS
2. macOS-specific checks automatically detected
3. View results with platform-specific explanations
4. Access macOS security recommendations and remediation steps

### Linux Examples

**CLI Usage:**
```bash
# Fedora/RHEL security audit (primary support)
npx electron . check --profile default --non-interactive --format json

# Ubuntu/Debian audit (limited testing)
npx electron . check --profile relaxed --format human  # May have fewer false positives

# Server-focused configuration
cat > linux-server-config.json << 'EOF'
{
  "diskEncryption": { "enabled": true },
  "firewall": { "enabled": true },
  "packageVerification": { "enabled": true },
  "systemIntegrityProtection": { "enabled": true },
  "remoteLogin": { "enabled": true },
  "automaticUpdates": { 
    "enabled": true,
    "automaticSecurityInstall": true
  },
  "sharingServices": {
    "fileSharing": false,
    "screenSharing": false
  }
}
EOF

npx electron . check --config linux-server-config.json --non-interactive
```

### Windows Examples

**CLI Usage:**
```bash
# Windows security audit
npx electron . check --profile default --format human

# Corporate Windows setup
npx electron . check --profile strict --format json --output windows-audit.json --non-interactive

# Example focusing on Windows features:
# ✅ BitLocker: Drive encryption enabled
# ✅ Windows Defender: Real-time protection active
# ✅ Windows Firewall: Enabled for all profiles
# ✅ SmartScreen: App and browser protection enabled
```

## 🔄 Automated and Scheduled Usage

### Basic Daemon Usage

```bash
# Start daemon with default configuration
eai-security-check daemon

# Check daemon status
eai-security-check daemon --status

# Force immediate check
eai-security-check daemon --check-now

# Test email configuration
eai-security-check daemon --test-email
```

### Custom Daemon Configuration

```bash
# Create custom scheduling configuration
cat > custom-schedule.json << 'EOF'
{
  "enabled": true,
  "intervalDays": 3,
  "userId": "security-team@company.com",
  "email": {
    "smtp": {
      "host": "smtp.company.com",
      "port": 587,
      "auth": {
        "user": "security-monitor@company.com",
        "pass": "app-password"
      }
    },
    "from": "Security Monitor <security-monitor@company.com>",
    "to": ["it-team@company.com", "compliance@company.com"],
    "subject": "Security Audit - {{hostname}} - {{status}}"
  },
  "reportFormat": "email",
  "securityProfile": "strict"
}
EOF

# Use custom daemon configuration
eai-security-check daemon -c custom-schedule.json
```

### Daemon with SCP Transfer

```bash
# Configuration with automatic file transfer
cat > backup-schedule.json << 'EOF'
{
  "enabled": true,
  "intervalDays": 7,
  "userId": "backup-service@company.com",
  "email": {
    "smtp": { /* email config */ },
    "to": ["admin@company.com"]
  },
  "scp": {
    "enabled": true,
    "host": "backup.company.com",
    "username": "security-backup",
    "privateKeyPath": "~/.ssh/backup_key",
    "destinationPath": "/backups/security-reports/"
  },
  "reportFormat": "json",
  "securityProfile": "default"
}
EOF

# Run daemon with backup functionality
eai-security-check daemon -c backup-schedule.json
```

## 🏢 Enterprise Usage Scenarios

### Multi-Environment Monitoring

```bash
# Development environment
eai-security-check check developer --format json -o dev-report.json

# Staging environment  
eai-security-check check default --format json -o staging-report.json

# Production environment
eai-security-check check strict --format json -o prod-report.json

# Compare environments
diff <(jq '.summary' dev-report.json) <(jq '.summary' prod-report.json)
```

### Compliance Reporting

```bash
# Generate compliance report with signatures
eai-security-check check strict --hash --format markdown -o compliance-$(date +%Y%m%d).md

# Create quarterly security assessment
for profile in default strict developer; do
  eai-security-check check $profile --format json -o quarterly-$profile-$(date +%Y%m%d).json
done

# Verify all reports in directory
for report in *.txt; do
  echo "Verifying $report"
  eai-security-check verify "$report"
done
```

### CI/CD Integration

```bash
#!/bin/bash
# Security check in CI/CD pipeline

# Run security audit
eai-security-check check default --format json -o security-check.json

# Parse results
PASSED=$(jq -r '.summary.overallPassed' security-check.json)
FAILED_COUNT=$(jq -r '.summary.failedCount' security-check.json)

if [ "$PASSED" = "true" ]; then
  echo "✅ Security check passed"
  exit 0
else
  echo "❌ Security check failed ($FAILED_COUNT failures)"
  jq -r '.results[] | select(.passed == false) | .setting + ": " + .message' security-check.json
  exit 1
fi
```

## 🔍 Debugging and Troubleshooting Examples

### Verbose Output

```bash
# Enable detailed logging
eai-security-check check --verbose

# Debug specific configuration
eai-security-check check -c debug-config.json --verbose
```

### Password Testing

```bash
# Test with different password methods
eai-security-check check --password "mypassword"  # Direct (less secure)
eai-security-check check                          # Interactive prompt (secure)

# Platform-specific prompts:
# macOS: "🔐 Enter your macOS password:"
# Linux: "🔐 Enter your sudo password:"
```

### Configuration Testing

```bash
# Test minimal configuration
echo '{"diskEncryption": {"enabled": true}}' > minimal.json
eai-security-check check -c minimal.json

# Test all features configuration
cat > comprehensive.json << 'EOF'
{
  "diskEncryption": { "enabled": true },
  "passwordProtection": { "enabled": true, "requirePasswordImmediately": true },
  "password": {
    "required": true,
    "minLength": 8,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumber": true,
    "requireSpecialChar": true,
    "maxAgeDays": 365
  },
  "autoLock": { "maxTimeoutMinutes": 10 },
  "firewall": { "enabled": true, "stealthMode": false },
  "packageVerification": { "enabled": true, "strictMode": false },
  "systemIntegrityProtection": { "enabled": true },
  "remoteLogin": { "enabled": false },
  "remoteManagement": { "enabled": false },
  "automaticUpdates": {
    "enabled": true,
    "downloadOnly": false,
    "automaticInstall": true,
    "automaticSecurityInstall": true
  },
  "sharingServices": {
    "fileSharing": false,
    "screenSharing": false,
    "remoteLogin": false,
    "mediaSharing": false,
    "internetSharing": false
  }
}
EOF

eai-security-check check -c comprehensive.json
```

## 📊 Output Format Examples

### Console Format (Default)

```
🔒 EAI Security Check Results 🔒

Platform: macOS 14.0 (Apple Silicon)
Configuration: default profile
Timestamp: 2024-01-15 14:30:25

✅ Disk Encryption: FileVault enabled
✅ Password Protection: Screen saver requires password immediately  
⚠️  Auto-lock Timeout: 10 minutes (7 minutes recommended)
✅ Firewall: Application Firewall enabled
✅ Package Verification: Gatekeeper enabled
✅ System Integrity Protection: SIP enabled
❌ Remote Login: SSH enabled (should be disabled)
✅ Automatic Updates: Download and install enabled
✅ Sharing Services: File sharing disabled

📊 Summary: 7/9 checks passed, 1 failed, 1 warning
🚨 OVERALL: FAILED (due to remote login enabled)

💡 Recommendations:
   • Disable SSH in System Preferences > Sharing
   • Consider reducing auto-lock timeout to 7 minutes
```

### JSON Format

```json
{
  "platform": "macOS",
  "version": "14.0",
  "profile": "default", 
  "timestamp": "2024-01-15T14:30:25.000Z",
  "summary": {
    "totalChecks": 9,
    "passedCount": 7,
    "failedCount": 1,
    "warningCount": 1,
    "overallPassed": false
  },
  "results": [
    {
      "setting": "Disk Encryption",
      "expected": "FileVault enabled",
      "actual": "FileVault enabled",
      "passed": true,
      "risk": "low",
      "message": "FileVault disk encryption is properly enabled"
    },
    {
      "setting": "Remote Login",
      "expected": "SSH disabled",
      "actual": "SSH enabled",
      "passed": false,
      "risk": "high",
      "message": "SSH remote login is enabled - potential security risk"
    }
  ],
  "recommendations": [
    "Disable SSH in System Preferences > Sharing",
    "Consider reducing auto-lock timeout to 7 minutes"
  ]
}
```

### Markdown Format

```markdown
# Security Audit Report

**Platform:** macOS 14.0 (Apple Silicon)  
**Profile:** default  
**Generated:** January 15, 2024 at 2:30:25 PM  

## Summary

📊 **7/9 checks passed** (1 failed, 1 warning)  
🚨 **Overall Status:** FAILED

## Results

| Setting | Status | Expected | Actual | Risk |
|---------|--------|----------|--------|------|
| Disk Encryption | ✅ PASS | FileVault enabled | FileVault enabled | Low |
| Password Protection | ✅ PASS | Required immediately | Required immediately | Low |
| Auto-lock Timeout | ⚠️ WARN | ≤ 7 minutes | 10 minutes | Medium |
| Remote Login | ❌ FAIL | SSH disabled | SSH enabled | High |

## Recommendations

- Disable SSH in System Preferences > Sharing
- Consider reducing auto-lock timeout to 7 minutes

---
*Report generated by EAI Security Check v1.0.0*
```

## 🔗 Integration Examples

### Shell Script Integration

```bash
#!/bin/bash
# Weekly security check script

LOG_FILE="/var/log/security-check.log"
REPORT_DIR="/home/admin/security-reports"

echo "$(date): Starting security check" >> $LOG_FILE

# Create timestamped report
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/security-report-$TIMESTAMP.json"

# Run check and capture exit code
eai-security-check check strict --format json -o "$REPORT_FILE"
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "$(date): Security check PASSED" >> $LOG_FILE
else
  echo "$(date): Security check FAILED" >> $LOG_FILE
  # Send alert email, trigger notification, etc.
fi

# Cleanup old reports (keep last 30 days)
find $REPORT_DIR -name "security-report-*.json" -mtime +30 -delete
```

### Python Integration

```python
#!/usr/bin/env python3
import subprocess
import json
import sys
from datetime import datetime

def run_security_check(profile="default"):
    """Run security check and return results"""
    try:
        result = subprocess.run([
            'eai-security-check', 'check', profile, 
            '--format', 'json'
        ], capture_output=True, text=True, check=False)
        
        if result.stdout:
            return json.loads(result.stdout), result.returncode
        else:
            return None, result.returncode
            
    except Exception as e:
        print(f"Error running security check: {e}")
        return None, 1

def main():
    # Run security check
    data, exit_code = run_security_check("strict")
    
    if data:
        print(f"Security Check Results - {datetime.now()}")
        print(f"Platform: {data['platform']}")
        print(f"Overall Status: {'PASSED' if data['summary']['overallPassed'] else 'FAILED'}")
        print(f"Results: {data['summary']['passedCount']}/{data['summary']['totalChecks']} passed")
        
        # Process failed checks
        failed_checks = [r for r in data['results'] if not r['passed']]
        if failed_checks:
            print("\nFailed Checks:")
            for check in failed_checks:
                print(f"  - {check['setting']}: {check['message']}")
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
```

## 🔗 Next Steps

- **[Configuration Guide](CONFIGURATION.md)** - Customize security requirements
- **[Daemon Setup](DAEMON_SETUP.md)** - Set up automated monitoring  
- **[Installation Guide](INSTALLATION.md)** - Install on different platforms
- **[Security Documentation](../SECURITY.md)** - Understand security implications