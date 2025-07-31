#!/usr/bin/env node

/**
 * Linux GPG Signing Script
 * 
 * This script creates a GPG signature for the Linux executable.
 * Requires:
 * - GPG key configured for signing
 * 
 * Environment variables:
 * - GPG_SIGNING_KEY: GPG key ID or email to use for signing
 * - GPG_PASSPHRASE: Passphrase for the GPG key (optional if key has no passphrase)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXECUTABLE_NAME = 'index-linux';
const BIN_DIR = path.join(__dirname, '..', 'bin');
const EXECUTABLE_PATH = path.join(BIN_DIR, EXECUTABLE_NAME);
const SIGNATURE_PATH = path.join(BIN_DIR, EXECUTABLE_NAME + '.sig');

function log(message) {
  console.log(`[Linux Signing] ${message}`);
}

function error(message) {
  console.error(`[Linux Signing] ERROR: ${message}`);
}

function checkRequirements() {
  log('Checking requirements...');
  
  // Check if executable exists
  if (!fs.existsSync(EXECUTABLE_PATH)) {
    throw new Error(`Executable not found: ${EXECUTABLE_PATH}`);
  }
  
  // Check if gpg is available
  try {
    execSync('which gpg', { stdio: 'ignore' });
  } catch (e) {
    throw new Error('gpg tool not found. Please install GnuPG.');
  }
  
  // Check environment variables
  const requiredEnvVars = ['GPG_SIGNING_KEY'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} not set`);
    }
  }
  
  log('Requirements check passed');
}

function checkGpgKey() {
  const signingKey = process.env.GPG_SIGNING_KEY;
  
  log(`Checking GPG key: ${signingKey}`);
  
  try {
    // List secret keys to verify the signing key exists
    const output = execSync(`gpg --list-secret-keys "${signingKey}"`, { encoding: 'utf8', stdio: 'pipe' });
    if (output.includes(signingKey)) {
      log('GPG signing key found');
    } else {
      throw new Error(`GPG signing key not found: ${signingKey}`);
    }
  } catch (e) {
    throw new Error(`Failed to verify GPG key: ${e.message}`);
  }
}

function signExecutable() {
  log('Creating GPG signature...');
  
  const signingKey = process.env.GPG_SIGNING_KEY;
  const passphrase = process.env.GPG_PASSPHRASE;
  
  // Remove existing signature file if it exists
  if (fs.existsSync(SIGNATURE_PATH)) {
    fs.unlinkSync(SIGNATURE_PATH);
  }
  
  const gpgArgs = [
    '--detach-sign',
    '--armor',
    '--local-user', signingKey,
    '--output', SIGNATURE_PATH
  ];
  
  if (passphrase) {
    gpgArgs.push('--batch', '--yes', '--passphrase-fd', '0');
  }
  
  gpgArgs.push(EXECUTABLE_PATH);
  
  log(`Creating detached signature: ${SIGNATURE_PATH}`);
  
  try {
    if (passphrase) {
      // Use spawn to pass passphrase via stdin
      const gpgProcess = spawn('gpg', gpgArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
      
      gpgProcess.stdin.write(passphrase);
      gpgProcess.stdin.end();
      
      let stdout = '';
      let stderr = '';
      
      gpgProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      gpgProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      return new Promise((resolve, reject) => {
        gpgProcess.on('close', (code) => {
          if (code === 0) {
            log('GPG signing successful');
            if (stdout) log(`Output: ${stdout}`);
            resolve();
          } else {
            reject(new Error(`GPG signing failed with code ${code}: ${stderr}`));
          }
        });
      });
    } else {
      // No passphrase, use execSync
      const output = execSync(`gpg ${gpgArgs.join(' ')}`, { encoding: 'utf8', stdio: 'pipe' });
      log('GPG signing successful');
      if (output) {
        log(`Output: ${output}`);
      }
    }
  } catch (e) {
    throw new Error(`GPG signing failed: ${e.message}`);
  }
}

function verifySignature() {
  log('Verifying GPG signature...');
  
  if (!fs.existsSync(SIGNATURE_PATH)) {
    throw new Error(`Signature file not found: ${SIGNATURE_PATH}`);
  }
  
  try {
    const verifyCommand = `gpg --verify "${SIGNATURE_PATH}" "${EXECUTABLE_PATH}"`;
    const output = execSync(verifyCommand, { encoding: 'utf8', stdio: 'pipe' });
    log('Signature verification successful');
    if (output) {
      log(`Verification output: ${output}`);
    }
  } catch (e) {
    // GPG verification output goes to stderr even on success
    if (e.stderr && e.stderr.includes('Good signature')) {
      log('Signature verification successful');
      log(`Verification output: ${e.stderr}`);
    } else {
      throw new Error(`Signature verification failed: ${e.message}`);
    }
  }
}

function createChecksumFile() {
  log('Creating checksum file...');
  
  const checksumPath = path.join(BIN_DIR, EXECUTABLE_NAME + '.sha256');
  
  try {
    const output = execSync(`sha256sum "${EXECUTABLE_PATH}"`, { encoding: 'utf8', cwd: BIN_DIR });
    // Extract just the hash and filename (remove the path)
    const hash = output.split(' ')[0];
    const checksumContent = `${hash}  ${EXECUTABLE_NAME}`;
    
    fs.writeFileSync(checksumPath, checksumContent);
    log(`Checksum file created: ${checksumPath}`);
    log(`SHA256: ${hash}`);
  } catch (e) {
    throw new Error(`Failed to create checksum file: ${e.message}`);
  }
}

async function main() {
  try {
    log('Starting Linux signing process...');
    
    checkRequirements();
    checkGpgKey();
    await signExecutable();
    verifySignature();
    createChecksumFile();
    
    log('Linux signing process completed successfully!');
    log(`Signed executable: ${EXECUTABLE_PATH}`);
    log(`GPG signature: ${SIGNATURE_PATH}`);
    log(`Checksum: ${EXECUTABLE_PATH}.sha256`);
    
  } catch (e) {
    console.warn(`[Linux Signing] WARNING: Signing failed - ${e.message}`);
    console.warn('[Linux Signing] WARNING: Build will continue without GPG signatures');
    console.warn('[Linux Signing] WARNING: Users will not be able to verify executable authenticity via GPG');
    console.warn('[Linux Signing] INFO: To enable GPG signing, configure GPG keys and environment variables');
    
    // Still try to create checksum file for integrity verification
    try {
      createChecksumFile();
      console.warn('[Linux Signing] INFO: Checksum file created for integrity verification');
    } catch (checksumError) {
      console.warn(`[Linux Signing] WARNING: Could not create checksum file: ${checksumError.message}`);
    }
    
    // Exit with success code to allow build to continue
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, checkRequirements, signExecutable, verifySignature, createChecksumFile };