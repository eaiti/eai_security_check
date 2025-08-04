# Build and Release Workflow Failsafe Documentation

## Overview

The build and release workflow has been enhanced with failsafe mechanisms to ensure that releases can be completed even when code signing fails. This documentation explains the failsafe behaviors and how they work.

## Failsafe Mechanisms

### 1. Windows Executable Signing

**Problem**: Windows code signing requires specific certificates and tools that may not always be available.

**Solution**: The Windows signing script now includes comprehensive failsafe behavior:

- **Graceful Failure**: If signing tools or certificates are not available, the script logs warnings but continues
- **Checksum Creation**: Even when signing fails, a SHA256 checksum file is created for integrity verification
- **Success Exit**: The script exits with code 0 (success) to allow the build workflow to continue
- **Clear Messaging**: Users are informed about the signing status and security implications

**Example Output**:
```
[Windows Signing] WARNING: Signing failed - Neither signtool.exe nor osslsigncode found.
[Windows Signing] WARNING: Build will continue without code signing
[Windows Signing] INFO: Checksum file created for integrity verification
```

### 2. Linux GPG Signing

**Problem**: GPG signing requires private keys that may not be configured in all environments.

**Solution**: Similar failsafe behavior to Windows signing:

- **Graceful Failure**: Missing GPG keys result in warnings, not build failures
- **Checksum Creation**: SHA256 checksums are always created for integrity verification
- **Success Exit**: Build continues even when GPG signing is not possible

### 3. macOS Code Signing

**Problem**: Apple code signing requires specific certificates and may fail due to various reasons.

**Solution**: The workflow handles both signed and unsigned macOS executables:

- **Separate Job**: macOS signing runs in a separate job to isolate failures
- **Fallback Download**: Release job downloads unsigned executables if signed ones are not available
- **Continue-on-Error**: The workflow uses `continue-on-error: true` for signing steps

### 4. Workflow-Level Resilience

**Changes Made**:

1. **Windows Build Job**:
   ```yaml
   - name: Sign Windows executable
     run: npm run sign:windows
     continue-on-error: true  # ← Added this
   ```

2. **Artifact Upload Fallback**:
   ```yaml
   - name: Upload unsigned Windows executable (fallback)
     if: ${{ !hashFiles('bin/index.exe.sha256') }}
     uses: actions/upload-artifact@v4
     with:
       name: windows-executables-unsigned
       path: bin/index.exe
   ```

3. **Release Job Dependencies**:
   ```yaml
   if: always() && startsWith(github.ref, 'refs/tags/v') && 
       (needs.build-linux-macos.result == 'success' && 
        needs.build-windows.result == 'success')
   ```

4. **Dynamic Release Notes**:
   - Signing status is automatically detected and reported in release notes
   - Users can see which executables are signed vs. unsigned

## Benefits

1. **Robust Releases**: Releases can complete even if some signing steps fail
2. **Clear Communication**: Users are informed about signing status
3. **Security Transparency**: Unsigned executables are clearly marked
4. **Integrity Verification**: SHA256 checksums are always provided
5. **Development Flexibility**: Developers can build locally without certificates

## Testing

The failsafe mechanisms are tested with:

- **Unit Tests**: Individual signing script behavior
- **Integration Tests**: End-to-end build and signing process (see `scripts/test-build-integration.js`)
- **Workflow Tests**: GitHub Actions workflow validation

## Security Considerations

- Unsigned executables may trigger security warnings on some systems
- Users should verify checksums when downloading unsigned executables
- Signed executables are preferred when certificates are available
- The system gracefully degrades to provide functionality without compromising security

## Usage

To test the failsafe behavior locally:

```bash
# Test Windows build and signing without certificates
npm run pkg:windows
node scripts/sign-windows.js

# Should create index.exe and index.exe.sha256 even without signing tools
```

The workflow will automatically handle failsafe scenarios during releases without any manual intervention.