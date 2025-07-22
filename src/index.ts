#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityAuditor } from './auditor';
import { SecurityConfig } from './types';

function getConfigByProfile(profile: string): SecurityConfig {
  const baseConfig = {
    filevault: { enabled: true },
    gatekeeper: { enabled: true },
    systemIntegrityProtection: { enabled: true }
  };

  switch (profile) {
    case 'strict':
      return {
        ...baseConfig,
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        autoLock: { maxTimeoutMinutes: 3 },
        firewall: { enabled: true, stealthMode: true },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: { enabled: true, securityUpdatesOnly: true },
        sharingServices: {
          fileSharing: false,
          screenSharing: false,
          remoteLogin: false
        }
      };

    case 'relaxed':
      return {
        ...baseConfig,
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: false
        },
        autoLock: { maxTimeoutMinutes: 15 },
        firewall: { enabled: true, stealthMode: false },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: { enabled: true },
        sharingServices: {
          fileSharing: false,
          screenSharing: false,
          remoteLogin: false
        }
      };

    case 'developer':
      return {
        ...baseConfig,
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        autoLock: { maxTimeoutMinutes: 10 },
        firewall: { enabled: true, stealthMode: false },
        remoteLogin: { enabled: true },
        remoteManagement: { enabled: false },
        automaticUpdates: { enabled: true, securityUpdatesOnly: true },
        sharingServices: {
          fileSharing: true,
          screenSharing: true,
          remoteLogin: true
        }
      };

    case 'eai':
      return {
        filevault: { enabled: true },
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        autoLock: { maxTimeoutMinutes: 7 }
      };

    default: // 'default' profile
      return {
        ...baseConfig,
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: true, stealthMode: true },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: { enabled: true, securityUpdatesOnly: true },
        sharingServices: {
          fileSharing: false,
          screenSharing: false,
          remoteLogin: false
        }
      };
  }
}

/**
 * Gets configuration by profile name, either from file or generated dynamically
 */
function getConfigForProfile(profile: string): SecurityConfig | null {
  const validProfiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];

  if (!validProfiles.includes(profile)) {
    return null;
  }

  // Try to get from file first (for non-pkg environments)
  const configPath = resolveProfileConfigPath(profile);
  if (configPath && fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      // If file read fails, fall back to generated config
    }
  }

  // Generate configuration dynamically based on profile
  return getConfigByProfile(profile);
}
function resolveProfileConfigPath(profile: string): string | null {
  const validProfiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];

  if (!validProfiles.includes(profile)) {
    return null;
  }

  // For 'default', use the main config file or generate on the fly
  if (profile === 'default') {
    const defaultConfigPath = path.resolve('./security-config.json');
    if (fs.existsSync(defaultConfigPath)) {
      return defaultConfigPath;
    }
    // If no default config exists, we'll generate it dynamically
    return null;
  }

  const configFileName = `${profile}-config.json`;

  // Check if we're running in a pkg environment
  const isPkg = typeof (process as any).pkg !== 'undefined';
  
  if (isPkg) {
    // In pkg environment, check the snapshot filesystem first
    const pkgPath = path.join(path.dirname(process.execPath), 'examples', configFileName);
    if (fs.existsSync(pkgPath)) {
      return pkgPath;
    }
    
    // Try the embedded path (pkg snapshot)
    const snapshotPath = path.join(__dirname, '..', 'examples', configFileName);
    if (fs.existsSync(snapshotPath)) {
      return snapshotPath;
    }
  }

  // For other profiles, try to find the examples directory
  // First, try relative to the current script location
  const scriptDir = path.dirname(__filename);
  const examplesDir = path.join(scriptDir, '..', 'examples');
  let configPath = path.join(examplesDir, configFileName);

  if (fs.existsSync(configPath)) {
    return configPath;
  }

  // If not found, try relative to the package root (for global installs)
  const packageRoot = path.join(scriptDir, '..');
  configPath = path.join(packageRoot, 'examples', configFileName);

  if (fs.existsSync(configPath)) {
    return configPath;
  }

  return null;
}

const program = new Command();

program
  .name('eai-security-check')
  .description('🔒 macOS Security Audit Tool - Check your Mac\'s security settings against configurable requirements')
  .version('1.0.0')
  .addHelpText('before', `
🔒 EAI Security Check - macOS Security Audit Tool

This tool audits your macOS system against security best practices and generates
detailed reports with actionable recommendations.

SECURITY CHECKS PERFORMED:
  🔒 FileVault (disk encryption)        🔥 Application Firewall
  🔑 Password Protection                 🛡️  Gatekeeper (app verification)
  ⏰ Auto-lock Timeout                   🔐 System Integrity Protection (SIP)
  🌐 Remote Login/SSH                    📱 Remote Management
  🔄 Automatic Updates                   📡 Sharing Services (File/Screen)

RISK LEVELS:
  🚨 HIGH: Critical security vulnerabilities
  ⚠️  MEDIUM: Important security improvements
  📋 LOW: Additional security enhancements
`);

program
  .command('check')
  .description('🔍 Run security audit using configuration file')
  .argument('[profile]', 'Security profile: default, strict, relaxed, developer, or eai')
  .option('-c, --config <path>', 'Path to JSON configuration file (overrides profile argument)')
  .option('-o, --output <path>', 'Path to output report file (optional)')
  .option('-q, --quiet', 'Only show summary, suppress detailed output')
  .addHelpText('after', `
Examples:
  $ eai-security-check check                    # Use default config
  $ eai-security-check check default           # Use default profile
  $ eai-security-check check strict            # Use strict profile
  $ eai-security-check check relaxed           # Use relaxed profile
  $ eai-security-check check developer         # Use developer profile
  $ eai-security-check check eai               # Use EAI profile (focused security)
  $ eai-security-check check -c my-config.json # Use custom config file
  $ eai-security-check check -o report.txt     # Save report to file
  $ eai-security-check check -q                # Quiet mode (summary only)

Security Profiles:
  default     - Recommended security settings (7-min auto-lock)
  strict      - Maximum security (3-min auto-lock)
  relaxed     - Balanced security (15-min auto-lock)
  developer   - Developer-friendly (remote access enabled)
  eai         - EAI focused security (7-min auto-lock, essential security only)
`)
  .action(async (profile, options) => {
    try {
      let config: SecurityConfig;
      let configSource = '';

      // Determine configuration source
      if (options.config) {
        // Use explicit config file if provided
        const configPath = path.resolve(options.config);

        if (!fs.existsSync(configPath)) {
          console.error(`❌ Configuration file not found: ${configPath}`);
          console.log('💡 Use "eai-security-check init" to create a sample configuration file.');
          process.exit(1);
        }

        const configContent = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(configContent);
        configSource = `config file: ${configPath}`;

      } else if (profile) {
        // Use profile argument
        const profileConfig = getConfigForProfile(profile);
        
        if (!profileConfig) {
          console.error(`❌ Invalid profile: ${profile}`);
          console.log('💡 Valid profiles: default, strict, relaxed, developer, eai');
          console.log('💡 Use "eai-security-check check --help" for examples');
          process.exit(1);
        }
        
        config = profileConfig;
        configSource = `${profile} profile`;

      } else {
        // Default behavior - look for security-config.json
        const defaultConfigPath = path.resolve('./security-config.json');

        if (fs.existsSync(defaultConfigPath)) {
          const configContent = fs.readFileSync(defaultConfigPath, 'utf-8');
          config = JSON.parse(configContent);
          configSource = `default config file: ${defaultConfigPath}`;
        } else {
          // Generate default config if no file exists
          config = getConfigByProfile('default');
          configSource = 'default profile (generated)';
        }
      }

      if (!options.quiet) {
        console.log(`🔧 Using ${configSource}`);
      }

      // Run audit
      const auditor = new SecurityAuditor();
      const report = options.quiet
        ? await auditor.generateQuietReport(config)
        : await auditor.generateReport(config);

      // Output report
      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, report);
        console.log(`📄 Report saved to: ${outputPath}`);
      } else {
        console.log(report);
      }

      // Exit with error code if audit failed
      const auditResult = await auditor.auditSecurity(config);
      process.exit(auditResult.overallPassed ? 0 : 1);

    } catch (error) {
      console.error('❌ Error running security check:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('📝 Create a sample security configuration file')
  .option('-f, --file <path>', 'Path for the configuration file', './security-config.json')
  .option('-p, --profile <type>', 'Security profile: strict, relaxed, or developer', 'default')
  .addHelpText('after', `
Examples:
  $ eai-security-check init                           # Create default config
  $ eai-security-check init -f my-config.json        # Custom filename
  $ eai-security-check init -p strict                # Strict security profile
  $ eai-security-check init -p relaxed               # Relaxed security profile
  $ eai-security-check init -p developer             # Developer-friendly profile

Security Profiles:
  default     - Recommended security settings (7-min auto-lock)
  strict      - Maximum security, minimal convenience (3-min auto-lock)
  relaxed     - Balanced security with convenience (15-min auto-lock)
  developer   - Developer-friendly with remote access enabled
`)
  .action((options) => {
    try {
      const configPath = path.resolve(options.file);

      if (fs.existsSync(configPath)) {
        console.error(`❌ Configuration file already exists: ${configPath}`);
        process.exit(1);
      }

      const sampleConfig: SecurityConfig = getConfigByProfile(options.profile || 'default');

      fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2));
      console.log(`✅ Sample configuration created: ${configPath}`);
      console.log(`📋 Profile: ${options.profile}`);
      console.log('💡 Edit this file to customize your security requirements.');

    } catch (error) {
      console.error('❌ Error creating configuration file:', error);
      process.exit(1);
    }
  });

program
  .command('help')
  .alias('h')
  .description('📚 Show detailed help information')
  .argument('[command]', 'Show help for specific command')
  .action((command) => {
    if (command) {
      const cmd = program.commands.find(c => c.name() === command);
      if (cmd) {
        cmd.help();
      } else {
        console.error(`❌ Unknown command: ${command}`);
        console.log('Available commands: check, init, help');
      }
    } else {
      console.log(`
🔒 EAI Security Check - macOS Security Audit Tool v1.0.0

OVERVIEW:
This tool performs comprehensive security audits of macOS systems against
configurable requirements and generates detailed reports with actionable
recommendations.

QUICK START:
  1. Initialize a configuration:    eai-security-check init
  2. Run security audit:            eai-security-check check
  3. Review results and fix issues: Follow report recommendations

COMMON WORKFLOWS:
  📋 Basic audit:
    $ eai-security-check init
    $ eai-security-check check

  🔍 Custom configuration:
    $ eai-security-check init -p strict -f strict.json
    $ eai-security-check check -c strict.json

  📊 Generate report file:
    $ eai-security-check check -o security-audit-report.txt

  ⚡ Quick summary:
    $ eai-security-check check --quiet

SECURITY AREAS CHECKED:
  🔒 Disk Encryption (FileVault)      🔥 Network Firewall
  🔑 Login Security                   🛡️  Code Signing (Gatekeeper)
  ⏰ Session Timeouts                 🔐 System Protection (SIP)
  🌐 Remote Access Controls           📱 Management Services
  🔄 Update Policies                  📡 Network Sharing

EXIT CODES:
  0 = All security checks passed
  1 = One or more checks failed or error occurred

For detailed command help: eai-security-check help <command>
`);
    }
  });

program.parse(process.argv);
