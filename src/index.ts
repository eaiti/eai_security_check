#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityAuditor } from './auditor';
import { SecurityConfig } from './types';
import { OutputUtils, OutputFormat } from './output-utils';
import { CryptoUtils } from './crypto-utils';
import { PlatformDetector, Platform } from './platform-detector';
import { SchedulingService } from './scheduling-service';
import { getConfigByProfile, isValidProfile, VALID_PROFILES } from './config-profiles';

/**
 * Determines if password is needed based on configuration
 */
function requiresPassword(config: SecurityConfig): boolean {
  // Check if password validation is required
  if (config.password?.required) {
    return true;
  }

  // Also check if any sudo operations are needed (backward compatibility)
  return !!(config.remoteLogin || config.remoteManagement);
}

/**
 * Gets configuration by profile name, either from file or generated dynamically
 */
function getConfigForProfile(profile: string): SecurityConfig | null {
  if (!isValidProfile(profile)) {
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
  if (!isValidProfile(profile)) {
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
  .description('🔒 Cross-Platform Security Audit Tool - Check your system\'s security settings against configurable requirements')
  .version('1.0.0')
  .addHelpText('before', `
🔒 EAI Security Check - Cross-Platform Security Audit Tool

This tool audits your macOS or Linux system against security best practices and generates
detailed reports with actionable recommendations.

SECURITY CHECKS PERFORMED:
  🔒 Disk Encryption (FileVault/LUKS)    🔥 Firewall (App Firewall/ufw/firewalld)
  🔑 Password Protection                  🛡️  Package Verification (Gatekeeper/GPG)
  ⏰ Auto-lock Timeout                    🔐 System Integrity Protection (SIP/SELinux)
  🌐 Remote Login/SSH                     📱 Remote Management/VNC
  🔄 Automatic Updates                    📡 Sharing Services (File/Screen/Network)

PLATFORMS SUPPORTED:
  🍎 macOS: Complete support for all security features
  🐧 Linux: Full support (Fedora primary, Ubuntu/Debian limited testing)

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
  .option('--password <password>', 'Administrator password for sudo commands (if not provided, will prompt when needed)')
  .option('--clipboard', 'Copy report summary to clipboard')
  .option('--format <type>', 'Output format: console, plain, markdown, json, email', 'console')
  .option('--hash', 'Generate cryptographic hash for tamper detection')
  .option('--summary', 'Generate a summary line for quick sharing')
  .addHelpText('after', `
Examples:
  $ eai-security-check check                        # Use default config
  $ eai-security-check check default               # Use default profile
  $ eai-security-check check strict                # Use strict profile
  $ eai-security-check check relaxed               # Use relaxed profile
  $ eai-security-check check developer             # Use developer profile
  $ eai-security-check check eai                   # Use EAI profile (10+ char passwords)
  $ eai-security-check check -c my-config.json     # Use custom config file
  $ eai-security-check check -o ~/Documents/report.txt  # Save report to Documents folder
  $ eai-security-check check -q                    # Quiet mode (summary only)
  $ eai-security-check check --password mypass     # Provide admin password directly
  $ eai-security-check check --clipboard           # Copy summary to clipboard
  $ eai-security-check check --format markdown     # Markdown format output
  $ eai-security-check check --hash -o report.txt  # Generate tamper-evident report file
  $ eai-security-check check --hash --format json  # Generate tamper-evident JSON to console
  $ eai-security-check check --summary             # Just show summary line

Password Input:
  --password    - Provide admin/sudo password directly (avoid interactive prompt)
  Interactive   - Platform-aware prompts: "Enter your macOS password:" or "Enter your sudo password:"
  Platform      - macOS users enter their user password, Linux users enter sudo password

Output Formats (all support --hash for tamper detection):
  console     - Colorized console output (default)
  plain       - Plain text without colors
  markdown    - Markdown format for documentation
  json        - Structured JSON format
  email       - Email-friendly format with headers

Tamper Detection:
  --hash        - Generate cryptographic signature for report integrity
  Available in all formats (console, file, markdown, json, email)
  Verify with:  eai-security-check verify <filename>

Security Profiles:
  default     - Recommended security settings (7-min auto-lock)
  strict      - Maximum security (3-min auto-lock)
  relaxed     - Balanced security (15-min auto-lock)
  developer   - Developer-friendly (remote access enabled)
  eai         - EAI focused security (10+ char passwords, 180-day expiration)
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
          console.log(`💡 Valid profiles: ${VALID_PROFILES.join(', ')}`);
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

      // Check platform compatibility first
      const platformInfo = await PlatformDetector.detectPlatform();
      if (!platformInfo.isSupported) {
        console.error(platformInfo.warningMessage);
        process.exit(1);
      }

      // Prompt for password if needed for sudo operations (platform-aware)
      let password: string | undefined;


      if (options.password) {
        // Use provided password
        if (!options.quiet) {
          console.log('🔐 Using provided password for administrator privileges.');
        }
        password = options.password;
      } else {
        // Prompt for password interactively
        if (!options.quiet) {
          console.log('🔐 Some security checks require administrator privileges.');
        }
        try {
          // Platform-aware password prompt
          const { promptForPassword } = await import('./password-utils');
          const promptText = platformInfo.platform === Platform.MACOS ?
            '🔐 Enter your macOS password: ' :
            '🔐 Enter your sudo password: ';
          password = await promptForPassword(promptText);
          if (!options.quiet) {
            console.log('✅ Password collected.\n');
          }
        } catch (error) {
          console.error(`❌ ${error}`);
          process.exit(1);
        }
      }


      // Create auditor with password if needed
      const auditor = new SecurityAuditor(password);
      const versionInfo = await auditor.checkVersionCompatibility();

      // Show version warning immediately if there are issues
      if (versionInfo.warningMessage && !options.quiet) {
        console.log(versionInfo.warningMessage);
        console.log(''); // Add blank line for readability
      }

      if (!options.quiet) {
        console.log(`🔧 Using ${configSource}`);
      }

      // Run audit
      let report = options.quiet
        ? await auditor.generateQuietReport(config)
        : await auditor.generateReport(config);

      // Handle summary-only option
      if (options.summary) {
        const summaryLine = OutputUtils.createSummaryLine(report);
        console.log(summaryLine);

        if (options.clipboard) {
          const clipboardAvailable = await OutputUtils.isClipboardAvailable();
          if (clipboardAvailable) {
            const success = await OutputUtils.copyToClipboard(summaryLine);
            if (success) {
              console.log('📋 Summary copied to clipboard');
            } else {
              console.error('❌ Failed to copy to clipboard');
            }
          } else {
            console.error('❌ Clipboard not available');
            console.log(OutputUtils.getClipboardInstallSuggestion());
          }
        }

        const auditResult = await auditor.auditSecurity(config);
        process.exit(auditResult.overallPassed ? 0 : 1);
      }

      // Validate output format
      const validFormats = Object.values(OutputFormat);
      if (options.format && !validFormats.includes(options.format)) {
        console.error(`❌ Invalid format: ${options.format}`);
        console.log(`💡 Valid formats: ${validFormats.join(', ')}`);
        process.exit(1);
      }

      // Format report if needed
      let finalReport = report;
      let outputFilename = options.output;

      if (options.format && options.format !== OutputFormat.CONSOLE) {
        const auditResult = await auditor.auditSecurity(config);
        const formattedOutput = OutputUtils.formatReport(report, options.format as OutputFormat, {
          platform: platformInfo.platform,
          timestamp: new Date().toISOString(),
          overallPassed: auditResult.overallPassed
        });

        finalReport = formattedOutput.content;

        // Use default filename if not specified
        if (!outputFilename && formattedOutput.filename) {
          outputFilename = formattedOutput.filename;
        }
      }

      // Handle hashing if requested
      if (options.hash) {
        const { signedContent, hashedReport } = CryptoUtils.createTamperEvidentReport(finalReport, {
          platform: platformInfo.platform,
          distribution: platformInfo.distribution,
          configSource
        });

        const hashShort = CryptoUtils.createShortHash(hashedReport.hash);

        if (outputFilename) {
          // Save to file
          const outputPath = path.resolve(outputFilename);
          fs.writeFileSync(outputPath, signedContent);
          console.log(`📄 Tamper-evident report saved to: ${outputPath}`);
          console.log(`🔐 Report hash: ${hashShort}`);
          console.log(`🔍 Verify with: eai-security-check verify "${outputFilename}"`);
        } else {
          // Output to console with hash header
          console.log(`\n🔒 TAMPER-EVIDENT SECURITY REPORT`);
          console.log(`🔐 Hash: ${hashShort} | Generated: ${new Date(hashedReport.timestamp).toLocaleString()}`);
          console.log(`${'='.repeat(80)}\n`);
          console.log(signedContent);
        }

        if (options.clipboard) {
          const clipboardContent = outputFilename ?
            `Security audit completed. Hash: ${hashShort}. Verify: eai-security-check verify "${outputFilename}"` :
            `Security audit completed. Hash: ${hashShort}. Generated: ${new Date(hashedReport.timestamp).toLocaleString()}`;
          const clipboardAvailable = await OutputUtils.isClipboardAvailable();
          if (clipboardAvailable) {
            const success = await OutputUtils.copyToClipboard(clipboardContent);
            if (success) {
              console.log('📋 Verification info copied to clipboard');
            }
          }
        }
      } else {
        // Handle regular output
        if (outputFilename) {
          const outputPath = path.resolve(outputFilename);
          fs.writeFileSync(outputPath, finalReport);
          console.log(`📄 Report saved to: ${outputPath}`);
        } else {
          console.log(finalReport);
        }

        // Handle clipboard for regular reports
        if (options.clipboard) {
          const clipboardAvailable = await OutputUtils.isClipboardAvailable();
          if (clipboardAvailable) {
            const clipboardContent = options.quiet ?
              OutputUtils.createSummaryLine(report) :
              OutputUtils.stripAnsiCodes(finalReport);

            const success = await OutputUtils.copyToClipboard(clipboardContent);
            if (success) {
              console.log('📋 Report copied to clipboard');
            } else {
              console.error('❌ Failed to copy to clipboard');
            }
          } else {
            console.error('❌ Clipboard not available');
            console.log(OutputUtils.getClipboardInstallSuggestion());
          }
        }
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
  .command('verify')
  .description('🔍 Verify the integrity of a tamper-evident security report')
  .argument('<file>', 'Path to the signed report file to verify')
  .option('--verbose', 'Show detailed verification information')
  .addHelpText('after', `
Examples:
  $ eai-security-check verify security-report.txt     # Verify report integrity
  $ eai-security-check verify --verbose report.txt    # Show detailed verification info
  $ eai-security-check verify report.json             # Works with all formats (JSON, markdown, etc.)

This command verifies that a report has not been tampered with by checking
its cryptographic signature. Reports generated with --hash option include
verification signatures.

Supported formats: All output formats support verification (plain, markdown, json, email)
Exit codes: 0 = verification passed, 1 = verification failed or file error
`)
  .action(async (filepath, options) => {
    try {
      const resolvedPath = path.resolve(filepath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ File not found: ${resolvedPath}`);
        process.exit(1);
      }

      const { content, verification } = CryptoUtils.loadAndVerifyReport(resolvedPath);
      const signature = CryptoUtils.extractSignature(content);

      if (verification.isValid) {
        console.log('✅ Report verification PASSED');
        console.log(`🔐 Hash: ${CryptoUtils.createShortHash(verification.originalHash)}`);

        if (signature) {
          console.log(`📅 Generated: ${new Date(signature.timestamp).toLocaleString()}`);
          console.log(`💻 Platform: ${signature.metadata.platform}`);
          console.log(`🖥️  Hostname: ${signature.metadata.hostname}`);
        }
      } else {
        console.error('❌ Report verification FAILED');
        console.error(`⚠️  ${verification.message}`);

        if (verification.originalHash && verification.calculatedHash) {
          console.error(`🔐 Expected: ${CryptoUtils.createShortHash(verification.originalHash)}`);
          console.error(`🔐 Actual: ${CryptoUtils.createShortHash(verification.calculatedHash)}`);
        }
      }

      if (options.verbose) {
        console.log(CryptoUtils.createVerificationSummary(verification, signature));
      }

      process.exit(verification.isValid ? 0 : 1);
    } catch (error) {
      console.error('❌ Error verifying report:', error);
      process.exit(1);
    }
  });

program
  .command('daemon')
  .description('🔄 Run security checks on a schedule and send email reports')
  .option('-c, --config <path>', 'Path to scheduling configuration file', './scheduling-config.json')
  .option('--security-config <path>', 'Path to security configuration file (overrides profile in schedule config)')
  .option('-s, --state <path>', 'Path to daemon state file', './daemon-state.json')
  .option('--init', 'Create a sample scheduling configuration file')
  .option('--status', 'Show current daemon status and exit')
  .option('--test-email', 'Send a test email and exit')
  .option('--check-now', 'Force an immediate security check and email (regardless of schedule)')
  .option('--stop', 'Stop the running daemon')
  .option('--restart', 'Restart the daemon (stop current instance and start a new one)')
  .option('--uninstall', 'Remove daemon files and configurations')
  .option('--remove-executable', 'Also remove the executable when uninstalling (requires --force)')
  .option('--force', 'Force operations that normally require confirmation')
  .addHelpText('after', `
Examples:
  $ eai-security-check daemon                              # Start daemon with default config
  $ eai-security-check daemon -c my-schedule.json         # Use custom scheduling config
  $ eai-security-check daemon --security-config strict.json # Use specific security config
  $ eai-security-check daemon -c schedule.json --security-config eai.json # Use both configs
  $ eai-security-check daemon --init                      # Create sample scheduling config
  $ eai-security-check daemon --status                    # Check daemon status
  $ eai-security-check daemon --test-email                # Send test email
  $ eai-security-check daemon --check-now                 # Force immediate check

Daemon Control:
  $ eai-security-check daemon --stop                      # Stop running daemon
  $ eai-security-check daemon --restart                   # Restart daemon service
  $ eai-security-check daemon --uninstall                 # Remove daemon files
  $ eai-security-check daemon --uninstall --force         # Remove daemon files and config
  $ eai-security-check daemon --uninstall --remove-executable --force  # Full uninstall

Daemon Features:
  - Runs security checks on a configurable schedule (default: weekly)
  - Sends email reports to configured recipients
  - Tracks when last report was sent to avoid duplicates
  - Automatically restarts checks after system reboot (when configured as service)
  - Graceful shutdown on SIGINT/SIGTERM

Configuration:
  The daemon uses two types of configuration files:
  1. Schedule Configuration (scheduling-config.json):
     - Email SMTP settings and recipients
     - Check interval (in days)
     - Security profile or custom config path
     - Report format preferences
  2. Security Configuration (optional, overrides profile):
     - Specific security requirements and settings
     - Use --security-config to specify a custom security config file
     - If not specified, uses profile from schedule config

Service Setup:
  To run as a system service that restarts automatically:
  - Linux: Create systemd service unit file
  - macOS: Create launchd plist file
  - See documentation for platform-specific setup instructions
`)
  .action(async (options) => {
    try {
      // Handle init option
      if (options.init) {
        const configPath = path.resolve(options.config);
        
        if (fs.existsSync(configPath)) {
          console.error(`❌ Scheduling configuration already exists: ${configPath}`);
          process.exit(1);
        }

        const sampleConfig = {
          enabled: true,
          intervalDays: 7,
          userId: 'user@company.com',
          email: {
            smtp: {
              host: 'smtp.gmail.com',
              port: 587,
              secure: false,
              auth: {
                user: 'your-email@gmail.com',
                pass: 'your-app-specific-password'
              }
            },
            from: 'EAI Security Check <your-email@gmail.com>',
            to: ['admin@company.com'],
            subject: 'Weekly Security Audit Report'
          },
          reportFormat: 'email',
          securityProfile: 'default'
        };

        fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2));
        console.log(`✅ Sample scheduling configuration created: ${configPath}`);
        console.log('💡 Edit this file to configure your email settings and preferences.');
        console.log('📧 Make sure to update the SMTP credentials and recipient email addresses.');
        console.log('👤 Update the userId field to identify reports from this user/system.');
        return;
      }

      // Handle stop option
      if (options.stop) {
        console.log('🛑 Stopping daemon...');
        const result = await SchedulingService.stopDaemon();
        if (result.success) {
          console.log(`✅ ${result.message}`);
        } else {
          console.error(`❌ ${result.message}`);
          process.exit(1);
        }
        return;
      }

      // Handle restart option
      if (options.restart) {
        const result = await SchedulingService.restartDaemon(options.config, options.state, options.securityConfig);
        if (result.success) {
          console.log(`✅ ${result.message}`);
        } else {
          console.error(`❌ ${result.message}`);
          process.exit(1);
        }
        return;
      }

      // Handle uninstall option
      if (options.uninstall) {
        if (!options.force) {
          console.log('⚠️  This will remove daemon state and lock files.');
          console.log('💡 Use --force to also remove configuration files.');
          console.log('💡 Use --remove-executable --force to also remove the executable.');
          console.log('');
        }

        const result = await SchedulingService.uninstallDaemon({
          configPath: options.config,
          stateFilePath: options.state,
          removeExecutable: options.removeExecutable,
          force: options.force
        });

        if (result.success) {
          console.log('✅ Daemon uninstalled successfully');
          console.log('');
          console.log('📁 Removed files:');
          result.removedFiles.forEach(file => console.log(`  - ${file}`));
          console.log('');
          console.log(result.message);
        } else {
          console.error(`❌ ${result.message}`);
          if (result.removedFiles.length > 0) {
            console.log('📁 Partially removed files:');
            result.removedFiles.forEach(file => console.log(`  - ${file}`));
          }
          process.exit(1);
        }
        return;
      }

      // Create scheduling service
      const schedulingService = new SchedulingService(options.config, options.state, options.securityConfig);

      // Handle status option
      if (options.status) {
        const status = schedulingService.getDaemonStatus();
        console.log('📊 Daemon Status:');
        console.log(`  Running: ${status.running}`);
        console.log(`  Last Report: ${status.state.lastReportSent || 'Never'}`);
        console.log(`  Total Reports: ${status.state.totalReportsGenerated}`);
        console.log(`  Started: ${status.state.daemonStarted}`);
        console.log(`  Version: ${status.state.currentVersion}`);
        console.log(`  Check Interval: ${status.config.intervalDays} days`);
        console.log(`  Email Recipients: ${status.config.email.to.join(', ')}`);
        console.log(`  Security Profile: ${status.config.securityProfile}`);
        return;
      }

      // Handle test email option
      if (options.testEmail) {
        console.log('📧 Sending test email...');
        await schedulingService.runScheduledCheck();
        console.log('✅ Test email sent successfully');
        return;
      }

      // Handle check now option
      if (options.checkNow) {
        console.log('🔍 Running immediate security check...');
        await schedulingService.runScheduledCheck();
        console.log('✅ Security check completed and email sent');
        return;
      }

      // Start daemon
      await schedulingService.startDaemon();

    } catch (error) {
      console.error('❌ Error running daemon:', error);
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
        console.log('Available commands: check, init, daemon, verify, help');
      }
    } else {
      console.log(`
🔒 EAI Security Check - Cross-Platform Security Audit Tool v1.0.0

OVERVIEW:
This tool performs comprehensive security audits of macOS and Linux systems against
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
  🔒 Disk Encryption (FileVault/LUKS)   🔥 Network Firewall (App/ufw/firewalld)
  🔑 Login Security                      🛡️  Package Verification (Gatekeeper/GPG)
  ⏰ Session Timeouts                    🔐 System Protection (SIP/SELinux)
  🌐 Remote Access Controls              📱 Management Services
  🔄 Update Policies                     📡 Network Sharing

SUPPORTED PLATFORMS:
  🍎 macOS: Complete support for all security features
  🐧 Linux: Full support (Fedora primary, Ubuntu/Debian limited testing)

EXIT CODES:
  0 = All security checks passed
  1 = One or more checks failed or error occurred

For detailed command help: eai-security-check help <command>
`);
    }
  });

program.parse(process.argv);
