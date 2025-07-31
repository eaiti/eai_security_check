# Usage Examples

This guide provides practical examples for using the EAI Security Check tool in various scenarios and environments.

## 🎯 Basic Usage Examples

### Quick Security Check

```bash
# Run security audit with default profile
eai-security-check check

# Output shows real-time security status
# ✅ Disk Encryption: FileVault enabled  
# ❌ Firewall: Application Firewall disabled
# 📊 Summary: 6/9 checks passed, 2 failed, 1 warning
```

### Profile-Based Checks

```bash
# Use built-in security profiles
eai-security-check check default    # Recommended settings
eai-security-check check strict     # Maximum security  
eai-security-check check relaxed    # Balanced approach
eai-security-check check developer  # Development-friendly
eai-security-check check eai        # EAI-specific requirements

# Compare profiles
eai-security-check check strict --summary
eai-security-check check relaxed --summary
```

### Output Formats

```bash
# Console output (default) - colorized with emojis
eai-security-check check

# Plain text - no colors or formatting
eai-security-check check --format plain

# Markdown - documentation-ready
eai-security-check check --format markdown

# JSON - structured data for automation
eai-security-check check --format json

# Email format - optimized for email sharing
eai-security-check check --format email
```

## 📄 Report Generation

### Save Reports to Files

```bash
# Save detailed report to file
eai-security-check check -o ~/security-report.txt

# Generate markdown report for documentation
eai-security-check check --format markdown -o ~/security-report.md

# Create JSON report for automation
eai-security-check check --format json -o ~/security-report.json

# Email-formatted report
eai-security-check check --format email -o ~/security-email.txt
```

### Tamper-Evident Reports

```bash
# Generate cryptographically signed report
eai-security-check check --hash -o ~/secure-report.txt

# Sign JSON report for API integration
eai-security-check check --format json --hash -o ~/api-report.json

# Verify previously generated report
eai-security-check verify ~/secure-report.txt

# Example verification output:
# ✅ Report verification PASSED
# 🔐 Hash: AD545088  
# 📅 Generated: 1/15/2024, 2:30:15 PM
# 💻 Platform: macOS
```

### Summary and Sharing

```bash
# Generate one-line summary for quick sharing
eai-security-check check --summary

# Output: Security Audit: 6/9 passed, 2 failed, 1 warning (1/15/2024, 2:30 PM)

# Copy summary to clipboard for sharing
eai-security-check check --summary --clipboard

# Copy full report to clipboard
eai-security-check check --clipboard
```

## 🔧 Custom Configuration Examples

### Using Custom Configuration Files

```bash
# Create custom configuration
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
eai-security-check check -c my-config.json

# Save custom report
eai-security-check check -c my-config.json -o custom-audit.txt
```

### Configuration Validation

```bash
# Test configuration file for errors
eai-security-check check -c invalid-config.json

# Example error output:
# ❌ Configuration Error: password.minLength must be between 1-128
# ❌ Configuration Error: Unknown field 'invalidOption'
# ❌ Configuration failed validation
```

## 🖥️ Platform-Specific Examples

### macOS Examples

```bash
# Complete macOS security audit
eai-security-check check default

# Check macOS-specific features
eai-security-check check strict --format markdown -o macos-security-report.md

# Developer workstation setup
eai-security-check check developer

# Example output focusing on macOS features:
# ✅ FileVault: Enabled for primary disk
# ✅ Gatekeeper: Enabled with developer mode
# ✅ SIP: System Integrity Protection enabled
# ✅ XProtect: Malware detection active
```

### Linux Examples

```bash
# Fedora/RHEL security audit (primary support)
eai-security-check check default

# Ubuntu/Debian audit (limited testing)
eai-security-check check relaxed  # May have fewer false positives

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

eai-security-check check -c linux-server-config.json
```

### Windows Examples

```bash
# Windows security audit
eai-security-check.exe check default

# Corporate Windows setup
eai-security-check.exe check strict --format json -o windows-audit.json

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