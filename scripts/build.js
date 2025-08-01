#!/usr/bin/env node

const { spawn } = require('child_process');
const crypto = require('crypto');
const os = require('os');

// Generate a build secret if not already set
const buildSecret = process.env.EAI_BUILD_SECRET || crypto.randomBytes(32).toString('hex');

// Set the environment variable
process.env.EAI_BUILD_SECRET = buildSecret;

// Determine the correct TypeScript compiler command
const isWindows = os.platform() === 'win32';
const tscCmd = isWindows ? 'npx.cmd' : 'npx';
const tscArgs = ['tsc'];

console.log('Building TypeScript with EAI_BUILD_SECRET...');

// Spawn the TypeScript compiler with the environment variable set
const child = spawn(tscCmd, tscArgs, {
  stdio: 'inherit',
  env: process.env,
  shell: isWindows
});

child.on('close', code => {
  process.exit(code);
});

child.on('error', err => {
  console.error('Failed to start TypeScript compiler:', err);
  process.exit(1);
});
