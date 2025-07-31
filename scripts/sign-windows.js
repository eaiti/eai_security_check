#!/usr/bin/env node

/**
 * Windows Code Signing Script
 * 
 * This script signs the Windows executable using signtool.exe or osslsigncode.
 * Requires:
 * - Windows SDK (for signtool.exe) OR osslsigncode for cross-platform signing
 * - Code signing certificate
 * 
 * Environment variables:
 * - WINDOWS_CERT_FILE: Path to certificate file (.p12/.pfx)
 * - WINDOWS_CERT_PASSWORD: Password for certificate file
 * - WINDOWS_CERT_THUMBPRINT: Certificate thumbprint (alternative to file)
 * - SIGNTOOL_PATH: Custom path to signtool.exe (optional)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EXECUTABLE_NAME = 'index.exe';
const BIN_DIR = path.join(__dirname, '..', 'bin');
const EXECUTABLE_PATH = path.join(BIN_DIR, EXECUTABLE_NAME);

function log(message) {
  console.log(`[Windows Signing] ${message}`);
}

function error(message) {
  console.error(`[Windows Signing] ERROR: ${message}`);
}

function checkRequirements() {
  log('Checking requirements...');
  
  // Check if executable exists
  if (!fs.existsSync(EXECUTABLE_PATH)) {
    throw new Error(`Executable not found: ${EXECUTABLE_PATH}`);
  }
  
  // Check for signing tools
  let signtoolPath = null;
  let useOsslSigncode = false;
  
  // Try to find signtool.exe
  if (os.platform() === 'win32') {
    const possiblePaths = [
      process.env.SIGNTOOL_PATH,
      'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
      'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x86\\signtool.exe',
      'C:\\Program Files\\Microsoft SDKs\\Windows\\v7.1\\Bin\\signtool.exe'
    ].filter(Boolean);
    
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        signtoolPath = testPath;
        break;
      }
    }
    
    if (!signtoolPath) {
      try {
        execSync('where signtool.exe', { stdio: 'ignore' });
        signtoolPath = 'signtool.exe';
      } catch (e) {
        // signtool not in PATH
      }
    }
  }
  
  // If signtool not found, try osslsigncode for cross-platform signing
  if (!signtoolPath) {
    try {
      execSync('which osslsigncode || where osslsigncode', { stdio: 'ignore' });
      useOsslSigncode = true;
      log('Using osslsigncode for cross-platform signing');
    } catch (e) {
      throw new Error('Neither signtool.exe nor osslsigncode found. Please install Windows SDK or osslsigncode.');
    }
  } else {
    log(`Using signtool: ${signtoolPath}`);
  }
  
  // Check certificate configuration
  const certFile = process.env.WINDOWS_CERT_FILE;
  const certPassword = process.env.WINDOWS_CERT_PASSWORD;
  const certThumbprint = process.env.WINDOWS_CERT_THUMBPRINT;
  
  if (!certFile && !certThumbprint) {
    throw new Error('Either WINDOWS_CERT_FILE or WINDOWS_CERT_THUMBPRINT must be set');
  }
  
  if (certFile && !fs.existsSync(certFile)) {
    throw new Error(`Certificate file not found: ${certFile}`);
  }
  
  log('Requirements check passed');
  
  return { signtoolPath, useOsslSigncode };
}

function signWithSigntool(signtoolPath) {
  log('Signing with signtool.exe...');
  
  const certFile = process.env.WINDOWS_CERT_FILE;
  const certPassword = process.env.WINDOWS_CERT_PASSWORD;
  const certThumbprint = process.env.WINDOWS_CERT_THUMBPRINT;
  
  let signCommand;
  
  if (certFile) {
    // Sign with certificate file
    signCommand = [
      `"${signtoolPath}"`,
      'sign',
      '/fd', 'SHA256',
      '/t', 'http://timestamp.digicert.com',
      '/f', `"${certFile}"`
    ];
    
    if (certPassword) {
      signCommand.push('/p', `"${certPassword}"`);
    }
    
    signCommand.push(`"${EXECUTABLE_PATH}"`);
  } else if (certThumbprint) {
    // Sign with certificate from store
    signCommand = [
      `"${signtoolPath}"`,
      'sign',
      '/fd', 'SHA256',
      '/t', 'http://timestamp.digicert.com',
      '/sha1', certThumbprint,
      `"${EXECUTABLE_PATH}"`
    ];
  }
  
  const command = signCommand.join(' ');
  log(`Running: ${command.replace(/\/p "[^"]*"/, '/p "***"')}`); // Hide password in logs
  
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    log('Signing successful');
    if (output) {
      log(`Output: ${output}`);
    }
  } catch (e) {
    throw new Error(`Signing failed: ${e.message}`);
  }
}

function signWithOsslSigncode() {
  log('Signing with osslsigncode...');
  
  const certFile = process.env.WINDOWS_CERT_FILE;
  const certPassword = process.env.WINDOWS_CERT_PASSWORD;
  
  if (!certFile) {
    throw new Error('WINDOWS_CERT_FILE is required when using osslsigncode');
  }
  
  const signCommand = [
    'osslsigncode',
    'sign',
    '-certs', `"${certFile}"`,
    '-t', 'http://timestamp.digicert.com',
    '-h', 'sha256',
    '-in', `"${EXECUTABLE_PATH}"`,
    '-out', `"${EXECUTABLE_PATH}.signed"`
  ];
  
  if (certPassword) {
    signCommand.splice(4, 0, '-pass', `"${certPassword}"`);
  }
  
  const command = signCommand.join(' ');
  log(`Running: ${command.replace(/-pass "[^"]*"/, '-pass "***"')}`); // Hide password in logs
  
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    log('Signing successful');
    if (output) {
      log(`Output: ${output}`);
    }
    
    // Replace original with signed version
    fs.renameSync(`${EXECUTABLE_PATH}.signed`, EXECUTABLE_PATH);
    
  } catch (e) {
    // Clean up temporary file if it exists
    if (fs.existsSync(`${EXECUTABLE_PATH}.signed`)) {
      fs.unlinkSync(`${EXECUTABLE_PATH}.signed`);
    }
    throw new Error(`Signing failed: ${e.message}`);
  }
}

function verifySignature(useOsslSigncode, signtoolPath) {
  log('Verifying signature...');
  
  try {
    let verifyCommand;
    
    if (useOsslSigncode) {
      verifyCommand = `osslsigncode verify "${EXECUTABLE_PATH}"`;
    } else {
      verifyCommand = `"${signtoolPath || 'signtool.exe'}" verify /pa "${EXECUTABLE_PATH}"`;
    }
    
    const output = execSync(verifyCommand, { encoding: 'utf8', stdio: 'pipe' });
    log('Signature verification successful');
    if (output) {
      log(`Verification output: ${output}`);
    }
  } catch (e) {
    throw new Error(`Signature verification failed: ${e.message}`);
  }
}

function createChecksumFile() {
  log('Creating checksum file...');
  
  const checksumPath = path.join(BIN_DIR, EXECUTABLE_NAME + '.sha256');
  
  try {
    let output;
    if (os.platform() === 'win32') {
      // Use PowerShell on Windows
      output = execSync(`powershell -Command "Get-FileHash '${EXECUTABLE_PATH}' -Algorithm SHA256 | Select-Object -ExpandProperty Hash"`, { encoding: 'utf8' });
      output = output.trim().toLowerCase();
    } else {
      // Use sha256sum on Unix-like systems
      output = execSync(`sha256sum "${EXECUTABLE_PATH}"`, { encoding: 'utf8', cwd: BIN_DIR });
      output = output.split(' ')[0];
    }
    
    const checksumContent = `${output}  ${EXECUTABLE_NAME}`;
    fs.writeFileSync(checksumPath, checksumContent);
    log(`Checksum file created: ${checksumPath}`);
    log(`SHA256: ${output}`);
  } catch (e) {
    throw new Error(`Failed to create checksum file: ${e.message}`);
  }
}

function main() {
  try {
    log('Starting Windows signing process...');
    
    const { signtoolPath, useOsslSigncode } = checkRequirements();
    
    if (useOsslSigncode) {
      signWithOsslSigncode();
    } else {
      signWithSigntool(signtoolPath);
    }
    
    verifySignature(useOsslSigncode, signtoolPath);
    createChecksumFile();
    
    log('Windows signing process completed successfully!');
    log(`Signed executable: ${EXECUTABLE_PATH}`);
    log(`Checksum: ${EXECUTABLE_PATH}.sha256`);
    
  } catch (e) {
    console.warn(`[Windows Signing] WARNING: Signing failed - ${e.message}`);
    console.warn('[Windows Signing] WARNING: Build will continue without code signing');
    console.warn('[Windows Signing] WARNING: Users may see security warnings when running the executable');
    console.warn('[Windows Signing] INFO: To enable code signing, configure Windows certificates and signing tools');
    
    // Still try to create checksum file for integrity verification
    try {
      createChecksumFile();
      console.warn('[Windows Signing] INFO: Checksum file created for integrity verification');
    } catch (checksumError) {
      console.warn(`[Windows Signing] WARNING: Could not create checksum file: ${checksumError.message}`);
    }
    
    // Exit with success code to allow build to continue
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, checkRequirements, signWithSigntool, signWithOsslSigncode, verifySignature, createChecksumFile };