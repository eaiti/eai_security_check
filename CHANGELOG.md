# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-22

### Added

#### 🔒 Security Auditing
- **FileVault Check**: Verifies disk encryption is enabled to protect data if device is lost/stolen
- **Password Protection**: Ensures login password and immediate screen saver password requirements are configured
- **Auto-lock Timeout**: Validates screen automatically locks within specified time limit to prevent unauthorized access
- **Firewall**: Checks application firewall and stealth mode status to block malicious network traffic
- **Gatekeeper**: Verifies downloaded applications are checked for malware before execution
- **System Integrity Protection (SIP)**: Ensures system files are protected from modification
- **Remote Access**: Checks SSH/remote login and management services configuration
- **Automatic Updates**: Validates security updates are enabled to protect against known vulnerabilities
- **Sharing Services**: Audits file sharing, screen sharing, and remote access services

#### 📋 Configuration System
- JSON-based configuration files with flexible security requirements
- Multiple security profiles:
  - **Default**: Recommended security settings (7-min auto-lock)
  - **Strict**: Maximum security, minimal convenience (3-min auto-lock)
  - **Relaxed**: Balanced security with convenience (15-min auto-lock)
  - **Developer**: Developer-friendly with necessary remote access enabled

#### 📊 Reporting & Education
- Detailed reports with actionable security advice and risk levels
- Risk prioritization system (High/Medium/Low priority)
- Educational explanations for each security check
- Quiet mode for summary-only output
- File output for report archiving

#### 🎯 CLI Interface
- Comprehensive help system with examples and workflows
- `init` command with profile selection
- `check` command with multiple output options
- `help` command with detailed usage information
- Modern CLI design with emojis and clear formatting

#### 🧪 Development & Testing
- TypeScript implementation with strict type checking
- Comprehensive Jest test suite with mocking
- ESLint configuration for code quality
- Build system with development and production modes
- VS Code integration with tasks and debugging support

### Technical Details
- **Language**: TypeScript + Node.js
- **CLI Framework**: Commander.js
- **Testing**: Jest with TypeScript support
- **Build**: TypeScript compiler
- **Compatibility**: macOS 14+ (tested on macOS 15.5)
- **Node.js**: 18+ required
