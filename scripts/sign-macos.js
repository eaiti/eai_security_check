#!/usr/bin/env node

/**
 * macOS Code Signing Script
 * 
 * This script signs the macOS executable using Apple's codesign tool.
 * Requires:
 * - Apple Developer Certificate installed in keychain
 * - Xcode command line tools
 * 
 * Environment variables:
 * - APPLE_DEVELOPER_ID: Developer ID for signing (e.g., "Developer ID Application: Your Name (TEAMID)")
 * - APPLE_NOTARIZATION_USERNAME: Apple ID for notarization
 * - APPLE_NOTARIZATION_PASSWORD: App-specific password for notarization
 * - APPLE_TEAM_ID: Team ID for notarization
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXECUTABLE_NAME = 'index-macos';
const BIN_DIR = path.join(__dirname, '..', 'bin');
const EXECUTABLE_PATH = path.join(BIN_DIR, EXECUTABLE_NAME);

function log(message) {
  console.log(`[macOS Signing] ${message}`);
}

function error(message) {
  console.error(`[macOS Signing] ERROR: ${message}`);
}

function checkRequirements() {
  log('Checking requirements...');
  
  // Check if executable exists
  if (!fs.existsSync(EXECUTABLE_PATH)) {
    throw new Error(`Executable not found: ${EXECUTABLE_PATH}`);
  }
  
  // Check if codesign is available
  try {
    execSync('which codesign', { stdio: 'ignore' });
  } catch (e) {
    throw new Error('codesign tool not found. Please install Xcode command line tools.');
  }
  
  // Check environment variables
  const requiredEnvVars = ['APPLE_DEVELOPER_ID'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} not set`);
    }
  }
  
  log('Requirements check passed');
}

function signExecutable() {
  log('Signing executable...');
  
  const developerId = process.env.APPLE_DEVELOPER_ID;
  
  // Sign the executable
  const signCommand = [
    'codesign',
    '--sign', `"${developerId}"`,
    '--timestamp',
    '--options', 'runtime',
    '--verbose',
    `"${EXECUTABLE_PATH}"`
  ].join(' ');
  
  log(`Running: ${signCommand}`);
  
  try {
    const output = execSync(signCommand, { encoding: 'utf8', stdio: 'pipe' });
    log('Signing successful');
    if (output) {
      log(`Output: ${output}`);
    }
  } catch (e) {
    throw new Error(`Signing failed: ${e.message}`);
  }
}

function verifySignature() {
  log('Verifying signature...');
  
  try {
    const verifyCommand = `codesign --verify --verbose "${EXECUTABLE_PATH}"`;
    const output = execSync(verifyCommand, { encoding: 'utf8', stdio: 'pipe' });
    log('Signature verification successful');
    if (output) {
      log(`Verification output: ${output}`);
    }
  } catch (e) {
    throw new Error(`Signature verification failed: ${e.message}`);
  }
}

function notarizeExecutable() {
  const username = process.env.APPLE_NOTARIZATION_USERNAME;
  const password = process.env.APPLE_NOTARIZATION_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  
  if (!username || !password || !teamId) {
    log('Notarization credentials not provided, skipping notarization');
    log('For distribution, you may want to notarize the executable');
    return;
  }
  
  log('Starting notarization process...');
  
  // Create a temporary zip file
  const zipPath = path.join(BIN_DIR, 'eai-security-check-macos.zip');
  
  try {
    // Zip the executable
    execSync(`cd "${BIN_DIR}" && zip -r "${zipPath}" "${EXECUTABLE_NAME}"`, { stdio: 'pipe' });
    
    // Submit for notarization
    const notarizeCommand = [
      'xcrun', 'notarytool', 'submit',
      `"${zipPath}"`,
      '--apple-id', username,
      '--password', password,
      '--team-id', teamId,
      '--wait'
    ].join(' ');
    
    log('Submitting for notarization (this may take several minutes)...');
    const output = execSync(notarizeCommand, { encoding: 'utf8', timeout: 600000 }); // 10 minute timeout
    log(`Notarization result: ${output}`);
    
    // Clean up zip file
    fs.unlinkSync(zipPath);
    
    log('Notarization completed successfully');
  } catch (e) {
    // Clean up zip file if it exists
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    throw new Error(`Notarization failed: ${e.message}`);
  }
}

function main() {
  try {
    log('Starting macOS signing process...');
    
    checkRequirements();
    signExecutable();
    verifySignature();
    
    // Only attempt notarization if credentials are provided
    if (process.env.APPLE_NOTARIZATION_USERNAME) {
      notarizeExecutable();
    }
    
    log('macOS signing process completed successfully!');
    log(`Signed executable: ${EXECUTABLE_PATH}`);
    
  } catch (e) {
    error(e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, checkRequirements, signExecutable, verifySignature, notarizeExecutable };