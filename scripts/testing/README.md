# EAI Security Check - Testing Scripts

This directory contains platform-specific testing scripts that validate the security checking methods used by the EAI Security Check tool. These scripts are designed for developers to quickly understand system compatibility and identify issues.

## Overview

The testing scripts perform comprehensive validation of all security checking methods on their respective platforms. They provide:

- **Platform Detection**: Verify OS version and compatibility
- **Individual Security Checks**: Test each security feature independently  
- **Interactive & Non-Interactive Modes**: Support both user-guided and automated testing
- **Clear Results**: Show pass/fail status with actionable recommendations
- **Integration Testing**: Validate the CLI tool works correctly on the platform
- **pkg Executable Testing**: Validate pre-built binaries work correctly
- **CI/CD Integration**: Designed to work in GitHub Actions and other CI environments

## Automated Testing (CI/CD)

All scripts support non-interactive mode for use in continuous integration:

```bash
# Set environment variables for non-interactive mode
export CI=true
export TESTING_MODE=non-interactive

# Run automated tests
./scripts/testing/test-automated.sh
```

The scripts automatically detect CI environments and skip user prompts. This is used in our GitHub Actions workflows for:
- **Linux Testing**: Ubuntu runners with full security check validation
- **macOS Testing**: macOS runners with comprehensive Apple security features
- **Windows Testing**: Windows runners with Microsoft security settings
- **pkg Testing**: Validates pre-built executables work correctly on each platform

## Available Scripts

### `test-platform.sh` (Main Entry Point)
Auto-detects the current platform and runs the appropriate test script.

**Usage:**
```bash
# Make executable and run
chmod +x scripts/testing/test-platform.sh
./scripts/testing/test-platform.sh
```

### `test-automated.sh` (CI/CD Testing)
Non-interactive test runner designed for automated environments. Automatically:
- Builds the project if needed
- Detects the platform
- Runs appropriate platform tests without user interaction
- Tests pkg executables if available
- Provides summary results

**Usage:**
```bash
# For CI/automated testing
./scripts/testing/test-automated.sh

# Or with explicit environment variables
CI=true TESTING_MODE=non-interactive ./scripts/testing/test-automated.sh
```

### `test-linux.sh` (Linux Testing)
Comprehensive testing for Linux systems including:
- LUKS disk encryption detection
- Screen lock and password protection (GNOME/KDE)
- Firewall status (ufw/firewalld/iptables)
- Package verification (DNF/APT GPG keys)
- System integrity (SELinux/AppArmor)
- SSH configuration
- Automatic updates
- Network sharing services

**Supported Distributions:**
- Fedora (primary support)
- Ubuntu/Debian (tested)
- RHEL/CentOS (basic support)

### `test-macos.sh` (macOS Testing)
Complete testing for macOS systems including:
- FileVault disk encryption
- Screen saver password protection
- Application Firewall and stealth mode
- Gatekeeper malware protection
- System Integrity Protection (SIP)
- Remote login and management services
- Automatic updates configuration
- Sharing services (file, screen, media)
- Privacy settings (Location Services, Siri)

**Supported Versions:**
- macOS 10.15+ (tested)
- All Apple Silicon and Intel Macs

### `test-windows.ps1` (Windows Testing)
Thorough testing for Windows systems including:
- BitLocker disk encryption
- Windows Defender Firewall
- Windows Defender Antivirus
- SmartScreen protection
- User Account Control (UAC)
- Windows Update settings
- Remote Desktop configuration
- File and printer sharing
- Password policy requirements
- Screen lock settings

**Supported Versions:**
- Windows 10 (version 1903+)
- Windows 11
- Windows Server 2019+

## How to Use

### Prerequisites
1. Build the CLI tool first:
   ```bash
   npm run build
   ```

2. Ensure you have appropriate permissions:
   - **Linux/macOS**: Script may prompt for sudo password
   - **Windows**: Run PowerShell as Administrator for best results

### Running Tests

#### Option 1: Auto-detect Platform
```bash
# From project root
./scripts/testing/test-platform.sh
```

#### Option 2: Run Platform-Specific Scripts
```bash
# Linux
./scripts/testing/test-linux.sh

# macOS  
./scripts/testing/test-macos.sh

# Windows (PowerShell)
PowerShell -ExecutionPolicy Bypass -File scripts/testing/test-windows.ps1
```

### Interactive Mode

The scripts include interactive prompts when security settings need to be modified:

1. **Test Failure**: When a security check fails, you'll see:
   - Clear description of the issue
   - Specific instructions to fix the problem
   - Option to pause testing while you make changes

2. **User Prompts**: 
   - Press Enter to continue after making changes
   - Type 'q' to quit testing early

3. **Re-testing**: After fixing an issue, the script continues with remaining tests

## Understanding Results

### Test Status Indicators
- ✅ **PASSED**: Security feature is properly configured
- ❌ **FAILED**: Security feature needs attention
- ⏭️ **SKIPPED**: Feature not available or testable on current system

### Sample Output
```
🔍 Testing: FileVault Disk Encryption
==================================================
✅ FileVault: PASSED
   Status: FileVault is On.

🔍 Testing: Application Firewall  
==================================================
❌ Application Firewall: FAILED
   Application Firewall is disabled
💡 To enable Application Firewall:
   System Preferences > Security & Privacy > Firewall > Turn On Firewall

⏸️  Enable Application Firewall and then continue testing
Press Enter to continue after making changes, or 'q' to quit...
```

### Final Summary
Each script provides a comprehensive summary:
- Total tests run
- Pass/fail/skip counts  
- Overall pass percentage
- Recommendations for next steps

## Integration with EAI Security Check

The test scripts validate that:
1. Platform detection works correctly
2. All security checking methods function properly
3. The CLI tool can run successfully on the platform
4. Results match expected behavior
5. pkg executables work correctly with basic commands

## GitHub Actions Integration

These testing scripts are integrated into our CI/CD pipeline with multi-platform GitHub Actions workflows:

### Workflow Files
- **`.github/workflows/test-linux.yml`**: Linux testing on Ubuntu
- **`.github/workflows/test-macos.yml`**: macOS testing on macOS runners  
- **`.github/workflows/test-windows.yml`**: Windows testing on Windows runners
- **`.github/workflows/multi-platform-tests.yml`**: Matrix strategy testing all platforms

### CI Testing Process
Each workflow performs:
1. **Standard Tests**: Formatting, linting, TypeScript build, Jest tests
2. **Platform Testing**: Runs the appropriate testing script in non-interactive mode
3. **pkg Build**: Creates platform-specific executable using pkg
4. **Executable Testing**: Validates the built executable with basic commands:
   - `--help` - Show help information
   - `--version` - Display version
   - `profiles` - List security profiles
   - `check --profile=relaxed --quiet` - Run basic security check
5. **Artifact Upload**: Stores executables for download and review

### CI Environment Variables
The workflows automatically set:
- `CI=true` - Indicates running in CI environment
- `TESTING_MODE=non-interactive` - Skips user prompts

### Benefits
- **Early Detection**: Catch platform compatibility issues in PRs
- **Executable Validation**: Ensure pkg builds work correctly
- **Multi-Platform Coverage**: Test on Linux, macOS, and Windows simultaneously
- **Automated Testing**: No manual intervention required
- **Artifact Generation**: Automatically build and test executables for all platforms

This ensures the main EAI Security Check tool will work reliably on the tested system.

## Troubleshooting

### Common Issues

**"CLI tool not found"**
- Run `npm run build` from project root
- Verify `dist/cli/index.js` exists

**"Permission denied"**
- Make scripts executable: `chmod +x scripts/testing/*.sh`
- Run with appropriate privileges (sudo may be required)

**"Command not found"**
- Some security features may not be available on your system
- Tests will skip unavailable features automatically

**Windows PowerShell Execution Policy**
- Run: `Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser`
- Or use: `PowerShell -ExecutionPolicy Bypass -File script.ps1`

### Getting Help

1. Check the main README.md for general usage
2. Use `node dist/cli/index.js --help` for CLI options
3. Run `node dist/cli/index.js check --help` for security check details
4. Use the interactive mode: `node dist/cli/index.js interactive`

## Development Notes

### Adding New Tests
To add a new security check test:

1. Add the test logic to the appropriate platform script
2. Follow the existing pattern:
   ```bash
   test_header "New Security Feature"
   # Test logic here
   if [ condition ]; then
       test_result "Feature Name" "PASS" "Description"
   else
       test_result "Feature Name" "FAIL" "Error description"
       # Provide fix instructions
       pause_for_user "Fix the issue and continue"
   fi
   ```

3. Update the test counter and summary logic

### Platform-Specific Notes

**Linux**: Scripts detect the desktop environment (GNOME/KDE) and package manager (DNF/APT) to use appropriate commands.

**macOS**: Uses system commands like `defaults`, `systemsetup`, and `spctl` to check security settings.

**Windows**: Uses PowerShell cmdlets and registry checks. Some tests require administrator privileges.

## Contributing

When contributing to these test scripts:
1. Maintain the existing output format and color scheme
2. Include interactive prompts for fixable issues
3. Provide clear, actionable remediation steps
4. Test on multiple versions of the target platform
5. Update this README with any new requirements or features