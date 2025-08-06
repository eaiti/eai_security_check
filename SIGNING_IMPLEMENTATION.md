# Code Signing Implementation

This document describes the code signing implementation added to the EAI Security Check project to resolve security warnings when running executables from unknown developers.

## Overview

The implementation adds comprehensive code signing support for all three supported platforms:

- **macOS**: Apple Developer certificate signing with optional notarization
- **Linux**: GPG signature files with SHA256 checksums
- **Windows**: Authenticode signing with certificate verification

## Files Added

### Signing Scripts
- `scripts/sign-macos.js` - macOS code signing with codesign and notarization
- `scripts/sign-linux.js` - Linux GPG signing with detached signatures
- `scripts/sign-windows.js` - Windows Authenticode signing (signtool/osslsigncode)
- `scripts/verify-signatures.js` - Cross-platform signature verification utility

### Documentation
- `scripts/SIGNING_GUIDE.md` - Comprehensive setup and usage guide

### Configuration Changes
- `package.json` - Added Windows target and signing commands
- `.github/workflows/build-release.yml` - Multi-platform build and signing workflow
- `.gitignore` - Added certificate and signature file exclusions

## Key Features

### Multi-Platform Support
- **Windows Build Support**: Full Electron application with Windows-specific build configuration
- **Cross-Platform Signing**: Scripts work on appropriate platforms or provide graceful fallbacks
- **Automated CI/CD**: GitHub Actions workflow handles signing in appropriate runners

### Security Best Practices
- **Certificate Management**: Secure handling via GitHub secrets and environment variables
- **Error Handling**: Comprehensive error checking and graceful degradation
- **Verification**: Built-in signature verification for all platforms
- **Checksum Generation**: SHA256 checksums for integrity verification

### Developer Experience
- **Simple Commands**: `npm run sign:macos`, `npm run sign:linux`, `npm run sign:windows`
- **Automated Workflow**: Signing integrated into release process
- **Verification Tools**: Easy-to-use verification script for end users
- **Comprehensive Documentation**: Step-by-step setup guides

## Build Process Changes

### Before
```bash
# Build desktop application
npm run build    # TypeScript compilation + Angular build
npm run dist     # Create Electron distributables
```

### After  
```bash
npm run build    # TypeScript compilation + Angular build
npm run dist     # Create signed Electron distributables with certificates
npm run sign:all # Signs all executables (with appropriate certs)
```

### GitHub Actions Workflow

The updated workflow uses multiple runners:

1. **Ubuntu Runner**: Builds Linux and macOS executables, signs Linux with GPG
2. **Windows Runner**: Builds and signs Windows executable with Authenticode
3. **macOS Runner**: Signs macOS executable with Apple certificates (optional notarization)
4. **Release**: Combines all signed artifacts into release

## Environment Variables

### macOS Signing
```bash
APPLE_DEVELOPER_ID="Developer ID Application: Your Name (TEAMID)"
APPLE_CERTIFICATE_P12="base64-encoded-certificate"
APPLE_CERTIFICATE_PASSWORD="certificate-password"
# Optional for notarization
APPLE_NOTARIZATION_USERNAME="apple-id@example.com"
APPLE_NOTARIZATION_PASSWORD="app-specific-password"
APPLE_TEAM_ID="TEAM_ID"
```

### Linux Signing
```bash
GPG_SIGNING_KEY="your-email@example.com"
GPG_PRIVATE_KEY="base64-encoded-private-key"
GPG_PASSPHRASE="key-passphrase"
```

### Windows Signing
```bash
WINDOWS_CERT_FILE="base64-encoded-certificate.p12"
WINDOWS_CERT_PASSWORD="certificate-password"
# Alternative: certificate thumbprint for Windows store
WINDOWS_CERT_THUMBPRINT="certificate-thumbprint"
```

## User Experience Improvements

### Before Implementation
- Users received security warnings on all platforms
- No verification method for executable integrity
- Manual trust decisions required

### After Implementation
- **macOS**: Code signed executables run without warnings (with proper certificates)
- **Linux**: GPG signatures allow users to verify authenticity
- **Windows**: Authenticode signatures reduce security prompts
- **All Platforms**: SHA256 checksums enable integrity verification

## Release Assets

Each release now includes:
- `eai-security-check-macos-VERSION` (signed executable)
- `eai-security-check-linux-VERSION` (executable)
- `eai-security-check-linux-VERSION.sig` (GPG signature)
- `eai-security-check-linux-VERSION.sha256` (checksum)
- `eai-security-check-windows-VERSION.exe` (signed executable)
- `eai-security-check-windows-VERSION.exe.sha256` (checksum)

## Verification Process

Users can verify downloads using the provided verification script:

```bash
# Download verification script
curl -fsSL https://raw.githubusercontent.com/eaiti/eai_security_check/main/scripts/verify-signatures.js -o verify-signatures.js

# Verify signatures
node verify-signatures.js eai-security-check-macos-v1.0.0
node verify-signatures.js eai-security-check-linux-v1.0.0  
node verify-signatures.js eai-security-check-windows-v1.0.0.exe
```

## Implementation Considerations

### Certificate Management
- Certificates stored as GitHub secrets (base64 encoded)
- Temporary files cleaned up after use
- Passwords masked in workflow logs

### Cross-Platform Compatibility
- Scripts detect available tools and adapt accordingly
- Graceful fallbacks when signing tools unavailable
- Platform-specific error messages and guidance

### CI/CD Integration
- Conditional signing based on secret availability
- Artifact management across multiple runners
- Comprehensive error handling and logging

This implementation provides a robust, secure, and user-friendly solution for code signing across all supported platforms while maintaining the existing build process compatibility.