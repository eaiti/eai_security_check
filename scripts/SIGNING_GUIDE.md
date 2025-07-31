# Code Signing Guide

This document explains how to set up and use code signing for the EAI Security Check application across different platforms.

## Overview

Code signing helps users trust and run the application without security warnings. Each platform has different requirements and processes:

- **macOS**: Uses Apple Developer certificates with codesign and optional notarization
- **Linux**: Uses GPG signatures with detached signature files
- **Windows**: Uses Authenticode certificates with signtool or osslsigncode

## macOS Code Signing

### Requirements

1. **Apple Developer Account**: Required for official distribution
2. **Developer ID Certificate**: Install in keychain
3. **Xcode Command Line Tools**: For codesign utility

### Environment Variables

```bash
# Required
APPLE_DEVELOPER_ID="Developer ID Application: Your Name (TEAMID)"

# Optional (for notarization)
APPLE_NOTARIZATION_USERNAME="your-apple-id@example.com"
APPLE_NOTARIZATION_PASSWORD="app-specific-password"
APPLE_TEAM_ID="YOUR_TEAM_ID"
```

### Certificate Setup

1. Create certificates in Apple Developer portal
2. Download and install in keychain:
   ```bash
   security import certificate.p12 -k ~/Library/Keychains/login.keychain
   ```
3. Verify installation:
   ```bash
   security find-identity -v -p codesigning
   ```

### Usage

```bash
npm run sign:macos
```

## Linux GPG Signing

### Requirements

1. **GPG**: GNU Privacy Guard utility
2. **GPG Key**: For signing (can be self-generated)

### GPG Key Setup

1. Generate a new key:
   ```bash
   gpg --full-generate-key
   ```
2. Export public key for verification:
   ```bash
   gpg --armor --export your-email@example.com > signing-key.pub
   ```

### Environment Variables

```bash
# Required
GPG_SIGNING_KEY="your-email@example.com"  # or key ID

# Optional (if key has passphrase)
GPG_PASSPHRASE="your-key-passphrase"
```

### Usage

```bash
npm run sign:linux
```

This creates:
- `index-linux.sig`: Detached GPG signature
- `index-linux.sha256`: SHA256 checksum

### Verification

Users can verify the signature:
```bash
gpg --import signing-key.pub
gpg --verify index-linux.sig index-linux
```

## Windows Code Signing

### Requirements

**Option 1: Windows with signtool.exe**
- Windows SDK or Visual Studio
- Code signing certificate (.p12/.pfx file or installed in certificate store)

**Option 2: Cross-platform with osslsigncode**
- osslsigncode utility (available on Linux/macOS)
- Code signing certificate (.p12/.pfx file)

### Certificate Options

1. **Self-signed certificate** (for testing):
   ```bash
   # Generate self-signed certificate
   openssl req -new -x509 -newkey rsa:2048 -keyout private.key -out certificate.crt -days 365
   openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt
   ```

2. **Commercial certificate**: Purchase from a Certificate Authority (CA) like DigiCert, Sectigo, etc.

### Environment Variables

```bash
# Certificate file approach
WINDOWS_CERT_FILE="/path/to/certificate.p12"
WINDOWS_CERT_PASSWORD="certificate-password"

# OR certificate store approach (Windows only)
WINDOWS_CERT_THUMBPRINT="certificate-thumbprint"

# Optional custom signtool path
SIGNTOOL_PATH="/custom/path/to/signtool.exe"
```

### Install osslsigncode (for cross-platform signing)

```bash
# Ubuntu/Debian
sudo apt-get install osslsigncode

# macOS
brew install osslsigncode

# CentOS/RHEL
sudo yum install osslsigncode
```

### Usage

```bash
npm run sign:windows
```

## GitHub Actions Integration

The signing process is integrated into the GitHub Actions workflow with the following approach:

### Secrets Configuration

Add these secrets to your GitHub repository settings:

```bash
# macOS
APPLE_DEVELOPER_ID
APPLE_NOTARIZATION_USERNAME
APPLE_NOTARIZATION_PASSWORD
APPLE_TEAM_ID
APPLE_CERTIFICATE_P12  # Base64 encoded certificate
APPLE_CERTIFICATE_PASSWORD

# Linux
GPG_SIGNING_KEY
GPG_PASSPHRASE
GPG_PRIVATE_KEY  # Base64 encoded private key

# Windows
WINDOWS_CERT_FILE  # Base64 encoded certificate
WINDOWS_CERT_PASSWORD
```

### Multi-platform Build Strategy

The updated workflow uses:
- **Ubuntu runners**: For Linux executables and cross-compile macOS signing
- **Windows runners**: For Windows executables and signing
- **macOS runners**: For native macOS signing and notarization (if needed)

## Verification Scripts

Create verification scripts for users:

### verify-signatures.sh (Linux/macOS)
```bash
#!/bin/bash
# Verify all signatures

echo "Verifying macOS signature..."
codesign --verify --verbose eai-security-check-macos-*

echo "Verifying Linux signature..."
gpg --verify eai-security-check-linux-*.sig eai-security-check-linux-*

echo "Verifying Windows signature..."
osslsigncode verify eai-security-check-windows-*.exe

echo "Verifying checksums..."
sha256sum -c *.sha256
```

## Security Best Practices

1. **Certificate Storage**: Never commit certificates or private keys to version control
2. **Environment Variables**: Use GitHub secrets for sensitive information
3. **Key Rotation**: Regularly rotate signing keys and certificates
4. **Verification**: Always verify signatures after signing
5. **Backup**: Securely backup signing certificates and keys

## Troubleshooting

### macOS Issues
- **"Developer ID not found"**: Ensure certificate is installed in keychain
- **Notarization fails**: Check Apple ID and app-specific password
- **"Resource busy"**: Close any running instances of the application

### Linux Issues
- **"Secret key not available"**: Ensure GPG key is imported correctly
- **"Bad passphrase"**: Check GPG_PASSPHRASE environment variable

### Windows Issues
- **"signtool not found"**: Install Windows SDK or use osslsigncode
- **"Certificate not found"**: Check certificate file path and password
- **"Timestamp server unreachable"**: Try different timestamp servers

## Testing Signed Executables

After signing, test the executables:

```bash
# Test macOS executable
./eai-security-check-macos-v1.0.0 --version

# Test Linux executable  
./eai-security-check-linux-v1.0.0 --version

# Test Windows executable
./eai-security-check-windows-v1.0.0.exe --version
```

The executables should run without security warnings on their respective platforms.