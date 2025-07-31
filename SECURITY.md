# Enhanced Tamper Detection Security

This document explains the enhanced tamper detection security features implemented to address the concerns raised in Issue #25.

## Security Problem

The original implementation used simple SHA-256 hashing for tamper detection, which had several vulnerabilities:

1. **Open Source Visibility**: Since the code is open source, attackers could see exactly how hashes are calculated
2. **No Secret Key**: The hashing only used publicly visible data (content + metadata + timestamp)
3. **Predictable Algorithm**: An attacker could easily replicate the hashing process and forge valid signatures
4. **PKG Vulnerability**: Even after packaging with PKG, the JavaScript code could potentially be extracted

## Security Solution

The enhanced implementation uses **HMAC-SHA256 with build-time secrets** to provide cryptographically secure tamper detection:

### Key Features

1. **HMAC Authentication**: Uses Hash-based Message Authentication Code (HMAC) with SHA-256
2. **Build-time Secret Injection**: Secret keys are injected during the build process via environment variables
3. **Key Derivation**: Uses PBKDF2 with 10,000 iterations to derive keys from the build secret
4. **Salt Generation**: Each report gets a unique cryptographically secure salt for additional entropy

### Security Implementation

The tamper detection system uses HMAC-SHA256 with build-time secret injection:

- **Algorithm**: HMAC-SHA256 with PBKDF2 key derivation
- **Usage**: Production builds with EAI_BUILD_SECRET environment variable
- **Security**: Cryptographically secure - requires secret key for verification
- **Protection**: Prevents tampering even with source code visibility

## Implementation Details

### Build-time Secret Injection

The system requires environment variables to inject secrets during the build process:

```bash
# Generate and use a secure random secret
EAI_BUILD_SECRET="$(openssl rand -hex 32)" npm run build

# Or set your own secret
EAI_BUILD_SECRET="your-secure-secret-key-here" npm run build
```

### Key Derivation Process

1. **Input**: Build secret + unique salt per report
2. **Algorithm**: PBKDF2 with SHA-256, 10,000 iterations
3. **Output**: 32-byte derived key for HMAC
4. **Benefits**: Makes brute-force attacks computationally expensive

### HMAC Calculation

```
HMAC-SHA256(derived_key, content + metadata + timestamp + salt)
```

### Report Structure

Enhanced reports include additional fields:
```json
{
  "hash": "hmac_signature",
  "algorithm": "hmac-sha256",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "salt": "32-character-hex-salt",
  "metadata": {
    "platform": "linux",
    "hostname": "example",
    "version": "1.0.0"
  }
}
```

## Usage Instructions

### For Developers

1. **Build with Enhanced Security** (Default):
   ```bash
   EAI_BUILD_SECRET="$(openssl rand -hex 32)" npm run build
   npm start check --hash
   ```

### For CI/CD Pipelines

1. **Set Secret in Environment**:
   ```bash
   export EAI_BUILD_SECRET="your-secure-build-secret"
   ```

2. **Build with Enhanced Security**:
   ```bash
   npm run build
   npm run pkg:build
   ```

3. **Keep Secret Secure**:
   - Store in secure CI/CD secret management
   - Don't commit to version control
   - Use different secrets for different environments

### For Package Distribution

1. **Use Secure Build Scripts**:
   ```bash
   # All pkg: scripts use secure build by default
   npm run pkg:build    # Enhanced security (auto-generates secret if not set)
   npm run pkg:macos    # macOS binary with enhanced security
   npm run pkg:linux    # Linux binary with enhanced security
   ```

## Verification Process

### Enhanced Security Verification

1. **Extract signature** from report
2. **Check algorithm** (hmac-sha256)
3. **Derive key** using PBKDF2 with stored salt
4. **Calculate HMAC** of content + metadata + timestamp + salt
5. **Compare** calculated HMAC with stored signature

## Security Analysis

### Threat Model

**Attack Scenario**: Attacker wants to modify a security report while maintaining valid signature

**Previous Vulnerability**:
1. Attacker modifies report content
2. Attacker views source code to understand hash calculation
3. Attacker recalculates SHA-256(content + metadata + timestamp)
4. Attacker replaces signature with new hash
5. ✅ Verification passes (attack succeeds)

**Enhanced Protection**:
1. Attacker modifies report content
2. Attacker views source code but doesn't have build secret
3. Attacker cannot calculate HMAC without secret key
4. ❌ Verification fails (attack prevented)

### Remaining Considerations

1. **PKG Extraction**: While PKG binaries can potentially be reverse-engineered, the build secret embedded in the binary significantly raises the bar for attackers compared to having no secret at all.

2. **Secret Management**: The security level is only as strong as the secret management practices. Secrets should be:
   - Generated cryptographically securely
   - Stored securely (not in source code)
   - Rotated periodically in production
   - Different per environment/deployment

3. **Key Length**: The system supports variable-length secrets, but recommends minimum 32 characters (256 bits) for cryptographic security.

## Migration Guide

### For Existing Users

1. **Check current security level**:
   ```bash
   eai-security-check security-status
   ```

2. **Upgrade to enhanced security**:
   ```bash
   # Generate secure secret
   export EAI_BUILD_SECRET="$(openssl rand -hex 32)"
   
   # Rebuild with enhanced security
   npm run build:secure
   
   # Verify enhancement
   eai-security-check security-status
   ```

3. **Test verification**:
   ```bash
   # Create test report
   eai-security-check check default --hash -o test-report.txt
   
   # Verify report
   eai-security-check verify test-report.txt
   ```

### For Package Maintainers

1. **Update build scripts** to use `build:secure`
2. **Set build secrets** in CI/CD environment
3. **Update documentation** with security instructions
4. **Test HMAC report verification**

## Testing

Run the comprehensive crypto test suite:

```bash
npm test -- src/__tests__/crypto-utils.test.ts
```

Key test scenarios:
- ✅ HMAC-SHA256 security with build secrets
- ✅ Tampering detection
- ✅ Secret key rotation scenarios

## Conclusion

The tamper detection system provides cryptographically secure protection against report tampering. The use of HMAC with build-time secrets makes it computationally infeasible for attackers to forge valid signatures, even with full source code access.

**Recommendation**: All production deployments should use enhanced security with cryptographically secure build secrets.