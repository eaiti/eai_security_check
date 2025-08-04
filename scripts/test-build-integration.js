#!/usr/bin/env node

/**
 * Integration test for build and signing scripts
 * Tests the fixed Windows executable naming and failsafe behavior
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BIN_DIR = path.join(__dirname, '..', 'bin');

function log(message) {
  console.log(`[Build Integration Test] ${message}`);
}

function error(message) {
  console.error(`[Build Integration Test] ERROR: ${message}`);
}

function cleanup() {
  log('Cleaning up test artifacts...');
  if (fs.existsSync(BIN_DIR)) {
    fs.rmSync(BIN_DIR, { recursive: true, force: true });
  }
}

function testWindowsBuild() {
  log('Testing Windows build...');
  
  try {
    execSync('npm run pkg:windows', { stdio: 'inherit' });
    
    const expectedPath = path.join(BIN_DIR, 'index.exe');
    if (!fs.existsSync(expectedPath)) {
      throw new Error(`Windows executable not found at expected path: ${expectedPath}`);
    }
    
    const stats = fs.statSync(expectedPath);
    if (stats.size === 0) {
      throw new Error('Windows executable is empty');
    }
    
    log(`✅ Windows executable created successfully: ${expectedPath} (${stats.size} bytes)`);
    return true;
  } catch (e) {
    error(`Windows build failed: ${e.message}`);
    return false;
  }
}

function testWindowsSigning() {
  log('Testing Windows signing failsafe behavior...');
  
  try {
    // This should fail gracefully and still create checksum
    execSync('node scripts/sign-windows.js', { stdio: 'inherit' });
    
    const checksumPath = path.join(BIN_DIR, 'index.exe.sha256');
    if (!fs.existsSync(checksumPath)) {
      throw new Error('Checksum file was not created during failsafe signing');
    }
    
    const checksumContent = fs.readFileSync(checksumPath, 'utf8');
    if (!checksumContent.includes('index.exe')) {
      throw new Error('Checksum file has incorrect format');
    }
    
    log(`✅ Windows signing failsafe worked correctly: created ${checksumPath}`);
    log(`✅ Checksum content: ${checksumContent.trim()}`);
    return true;
  } catch (e) {
    error(`Windows signing test failed: ${e.message}`);
    return false;
  }
}

function main() {
  log('Starting build integration test...');
  
  // Cleanup first
  cleanup();
  
  let passed = 0;
  let total = 0;
  
  // Test Windows build
  total++;
  if (testWindowsBuild()) {
    passed++;
  }
  
  // Test Windows signing failsafe
  total++;
  if (testWindowsSigning()) {
    passed++;
  }
  
  // Cleanup after tests
  cleanup();
  
  log(`Test results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    log('✅ All integration tests passed!');
    process.exit(0);
  } else {
    error(`❌ ${total - passed} test(s) failed`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  testWindowsBuild,
  testWindowsSigning,
  cleanup
};