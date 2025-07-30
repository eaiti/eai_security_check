# GitHub Copilot Instructions

This file provides context and guidelines for GitHub Copilot when working with the EAI Security Check project.

## Project Overview

This is a cross-platform Node.js + TypeScript CLI tool for auditing security settings on macOS and Linux systems against configurable security profiles. The tool checks various security configurations and provides detailed reports with educational explanations and actionable recommendations.

## Architecture

### Core Components
- `src/types.ts`: TypeScript interfaces and types for security checks and configurations
- `src/auditor.ts`: Main auditing engine (SecurityAuditor class) that orchestrates checks and generates reports
- `src/security-checker.ts`: macOS security checking logic (MacOSSecurityChecker class) that executes system commands
- `src/linux-security-checker.ts`: Linux security checking logic (LinuxSecurityChecker class) with cross-platform support
- `src/platform-detector.ts`: Platform detection service (PlatformDetector class) for cross-platform compatibility
- `src/scheduling-service.ts`: Daemon service (SchedulingService class) for automated scheduled security audits
- `src/index.ts`: CLI interface using Commander.js with multiple commands and options
- `src/output-utils.ts`: Output formatting utilities (OutputUtils class) supporting multiple formats
- `src/crypto-utils.ts`: Cryptographic utilities (CryptoUtils class) for tamper-evident reports

### Configuration System
- JSON-based security profiles (default, strict, relaxed, developer, eai)
- Cross-platform configuration names (diskEncryption, packageVerification, systemIntegrityProtection)
- Legacy macOS-specific names supported for backward compatibility
- Profile-specific timeout and requirement variations
- Scheduling configuration for daemon mode with email notifications and user identification

### Security Checks Implemented

**macOS:**
- FileVault disk encryption
- Password protection and screen saver settings
- Auto-lock timeout configuration
- Application Firewall and stealth mode
- Gatekeeper malware protection
- System Integrity Protection (SIP)
- Remote access services (SSH, remote management)
- Automatic security updates
- File and screen sharing services

**Linux:**
- LUKS disk encryption
- Password protection and session lock settings
- Auto-lock timeout configuration (GNOME/KDE)
- Firewall (ufw/firewalld/iptables) 
- Package verification (DNF/APT GPG)
- System integrity (SELinux/AppArmor)
- Remote access services (SSH, VNC)
- Automatic security updates
- Network sharing services (Samba/NFS)

## Development Guidelines

### Code Style
- Use TypeScript with strict type checking
- Follow async/await patterns for system command execution
- Implement comprehensive error handling for system calls
- Use descriptive variable names and include JSDoc comments for public methods

### Testing Strategy
- Jest test suite with TypeScript support
- Mock system commands using test utilities in `src/test-utils/mocks.ts`
- Test both success and failure scenarios for security checks
- Maintain high test coverage for critical security logic

### Cross-Platform System Integration
- Use `child_process.exec` for executing system commands
- Handle different macOS versions and Linux distributions
- Parse system command output reliably (plist, text formats, JSON)
- Gracefully handle missing or unavailable system features
- Automatic platform detection and appropriate checker selection

### CLI Design Principles
- Modern CLI experience with clear help text and examples
- Support multiple output formats (console, plain, markdown, json, email)
- Tamper-evident reports with cryptographic verification
- Cross-platform password prompts and secure input handling
- Provide both detailed and summary reporting modes
- Include educational content to help users understand security implications
- Daemon mode for automated scheduled security audits with email notifications

## Common Patterns

### Adding New Security Checks
1. Define the check interface in `src/types.ts`
2. Implement check logic in appropriate checker (`src/security-checker.ts` for macOS, `src/linux-security-checker.ts` for Linux)
3. Add platform-agnostic configuration options to security profiles
4. Include educational explanations and remediation advice
5. Add test cases with mocked system responses for both platforms if applicable

### Configuration Management
- Use JSON schema validation for configuration files
- Support environment-specific overrides
- Provide clear error messages for invalid configurations
- Include example configurations for different use cases

### Error Handling
- Catch and handle system command failures gracefully
- Provide actionable error messages to users
- Log detailed error information for debugging
- Continue execution when individual checks fail

## Dependencies

### Production
- `commander`: CLI framework for command parsing and help generation
- `node-cron`: Task scheduling for daemon mode
- `nodemailer`: Email sending for automated reports
- Node.js built-in modules: `child_process`, `fs`, `path`, `crypto`

### Development
- `typescript`: Type checking and compilation
- `jest`: Testing framework with TypeScript support
- `@types/*`: Type definitions for Node.js and testing

## Security Considerations

- Never execute user-provided commands directly
- Validate all input parameters and configuration values
- Handle sensitive information (passwords, keys) appropriately
- Provide clear warnings about security implications of changes
- Test on various macOS versions and Linux distributions to ensure compatibility

## File Structure Conventions

- Keep source code in `src/` directory
- Place test files adjacent to source files with `.test.ts` extension
- Store configuration examples in `examples/` directory
- Use descriptive filenames that reflect their purpose
- Maintain consistent TypeScript module exports

## Performance Considerations

- Minimize system command execution through caching when appropriate
- Run security checks in parallel where possible
- Provide progress indicators for long-running operations
- Optimize report generation for large numbers of checks

## Documentation Standards

- Maintain up-to-date README with installation and usage instructions
- Document all CLI commands and options with examples
- Include troubleshooting section for common issues
- Keep CHANGELOG updated with user-facing changes
- Provide clear explanations of security check purposes and implications
