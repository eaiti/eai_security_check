#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SecurityAuditor } from '../services/auditor';
import { SecurityConfig } from '../types';
import { OutputUtils, OutputFormat } from '../utils/output-utils';
import { CryptoUtils } from '../utils/crypto-utils';
import { PlatformDetector, Platform } from '../utils/platform-detector';
import { SchedulingService } from '../services/scheduling-service';
import { getConfigByProfile, isValidProfile, VALID_PROFILES } from '../config/config-profiles';
import { ConfigManager } from '../config/config-manager';

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
    } catch {
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

/**
 * Prompt user if they want to attempt automatic service setup
 */
async function promptForAutoServiceSetup(platform: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    let canAutoSetup = false;
    let setupDescription = '';

    switch (platform) {
      case 'Linux':
        canAutoSetup = true;
        setupDescription = 'copy the systemd service file to the correct location';
        break;
      case 'macOS':
        canAutoSetup = true;
        setupDescription = 'copy the LaunchAgent plist file to the correct location';
        break;
      case 'Windows':
        canAutoSetup = false;
        setupDescription = 'setup requires Administrator privileges (manual setup recommended)';
        break;
      default:
        return false;
    }

    if (!canAutoSetup) {
      console.log(`💡 Note: Automatic setup not available for ${platform} - ${setupDescription}`);
      return false;
    }

    console.log(`🤖 Auto-Setup Available: I can ${setupDescription} for you.\n`);

    const answer = await new Promise<string>(resolve => {
      rl.question('Would you like me to attempt automatic service setup? (y/N): ', resolve);
    });

    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * Attempt automatic service setup where possible
 */
async function attemptAutoServiceSetup(serviceSetup: any): Promise<void> {
  const configDir = ConfigManager.getConfigDirectory();
  const templatesDir = path.join(configDir, 'daemon-templates');

  try {
    switch (serviceSetup.platform) {
      case 'Linux':
        await attemptLinuxServiceSetup(templatesDir);
        break;
      case 'macOS':
        await attemptMacOSServiceSetup(templatesDir);
        break;
      default:
        console.log('⚠️  Automatic setup not supported for this platform');
    }
  } catch (error) {
    console.error(`❌ Automatic setup failed: ${error}`);
    console.log('💡 Please follow the manual setup instructions above');
  }
}

/**
 * Attempt Linux systemd service setup
 */
async function attemptLinuxServiceSetup(templatesDir: string): Promise<void> {
  const execAsync = promisify(exec);

  const serviceFile = path.join(templatesDir, 'eai-security-check.service');
  const userSystemdDir = path.join(os.homedir(), '.config', 'systemd', 'user');
  const destServiceFile = path.join(userSystemdDir, 'eai-security-check.service');

  try {
    // Create systemd user directory if it doesn't exist
    if (!fs.existsSync(userSystemdDir)) {
      fs.mkdirSync(userSystemdDir, { recursive: true });
      console.log('✅ Created systemd user directory');
    }

    // Copy service file
    if (fs.existsSync(serviceFile)) {
      fs.copyFileSync(serviceFile, destServiceFile);
      console.log('✅ Copied service file to systemd directory');

      // Reload systemd
      await execAsync('systemctl --user daemon-reload');
      console.log('✅ Systemd daemon reloaded');

      // Enable service
      await execAsync('systemctl --user enable eai-security-check.service');
      console.log('✅ Service enabled for auto-start');

      console.log('\n🎉 Linux systemd service setup completed successfully!');
      console.log('💡 To start now: systemctl --user start eai-security-check.service');
      console.log('💡 To enable login-less start: sudo loginctl enable-linger $USER');
    } else {
      throw new Error('Service template file not found');
    }
  } catch (error) {
    throw new Error(`Linux service setup failed: ${error}`);
  }
}

/**
 * Attempt macOS LaunchAgent setup
 */
async function attemptMacOSServiceSetup(templatesDir: string): Promise<void> {
  const plistFile = path.join(templatesDir, 'com.eai.security-check.plist');
  const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  const destPlistFile = path.join(launchAgentsDir, 'com.eai.security-check.plist');

  try {
    // Create LaunchAgents directory if it doesn't exist
    if (!fs.existsSync(launchAgentsDir)) {
      fs.mkdirSync(launchAgentsDir, { recursive: true });
      console.log('✅ Created LaunchAgents directory');
    }

    // Copy plist file
    if (fs.existsSync(plistFile)) {
      fs.copyFileSync(plistFile, destPlistFile);
      console.log('✅ Copied plist file to LaunchAgents directory');

      console.log('\n🎉 macOS LaunchAgent setup completed successfully!');
      console.log(
        '💡 To load now: launchctl load ~/Library/LaunchAgents/com.eai.security-check.plist'
      );
      console.log('💡 Service will auto-start on next login');
    } else {
      throw new Error('plist template file not found');
    }
  } catch (error) {
    throw new Error(`macOS service setup failed: ${error}`);
  }
}

const program = new Command();

program
  .name('eai-security-check')
  .description(
    "🔒 Cross-Platform Security Audit Tool - Check your system's security settings against configurable requirements"
  )
  .version('1.0.0')
  .addHelpText(
    'before',
    `
🔒 EAI Security Check - Cross-Platform Security Audit Tool

This tool audits your macOS, Linux, or Windows system against security best practices and generates
detailed reports with actionable recommendations.

SECURITY CHECKS PERFORMED:
  🔒 Disk Encryption (FileVault/LUKS/BitLocker)    🔥 Firewall (App Firewall/ufw/Windows Defender)
  🔑 Password Protection                         🛡️  Package Verification (Gatekeeper/GPG/SmartScreen)
  ⏰ Auto-lock Timeout                           🔐 System Integrity (SIP/SELinux/Windows Defender)
  🌐 Remote Login/SSH                     📱 Remote Management/VNC
  🔄 Automatic Updates                    📡 Sharing Services (File/Screen/Network)

PLATFORMS SUPPORTED:
  🍎 macOS: Complete support for all security features
  🐧 Linux: Full support (Fedora primary, Ubuntu/Debian limited testing)

RISK LEVELS:
  🚨 HIGH: Critical security vulnerabilities
  ⚠️  MEDIUM: Important security improvements
  📋 LOW: Additional security enhancements
`
  );

program
  .command('check')
  .description('🔍 Run security audit using configuration file')
  .argument('[profile]', 'Security profile: default, strict, relaxed, developer, or eai')
  .option('-c, --config <path>', 'Path to JSON configuration file (overrides profile argument)')
  .option('-o, --output <path>', 'Path to output report file (optional)')
  .option('-q, --quiet', 'Only show summary, suppress detailed output')
  .option(
    '--password <password>',
    'Administrator password for sudo commands (if not provided, will prompt when needed)'
  )
  .option('--clipboard', 'Copy report summary to clipboard')
  .option('--format <type>', 'Output format: console, plain, markdown, json, email', 'console')
  .option('--hash', 'Generate cryptographic hash for tamper detection')
  .option('--summary', 'Generate a summary line for quick sharing')
  .addHelpText(
    'after',
    `
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
`
  )
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
        // Default behavior - look for config in centralized location first, then local
        const centralConfigPath = ConfigManager.getSecurityConfigPath();
        const localConfigPath = path.resolve('./security-config.json');

        if (fs.existsSync(centralConfigPath)) {
          const configContent = fs.readFileSync(centralConfigPath, 'utf-8');
          config = JSON.parse(configContent);
          configSource = `config file: ${centralConfigPath}`;
        } else if (fs.existsSync(localConfigPath)) {
          const configContent = fs.readFileSync(localConfigPath, 'utf-8');
          config = JSON.parse(configContent);
          configSource = `config file: ${localConfigPath}`;
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
          const { promptForPassword } = await import('../utils/password-utils');
          const promptText =
            platformInfo.platform === Platform.MACOS
              ? '🔐 Enter your macOS password: '
              : '🔐 Enter your sudo password: ';
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
      const report = options.quiet
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
          console.log(`🔐 Report hash: ${hashShort} (HMAC-SHA256)`);
          console.log(`🔍 Verify with: eai-security-check verify "${outputFilename}"`);
        } else {
          // Output to console with hash header
          console.log(`\n🔒 TAMPER-EVIDENT SECURITY REPORT`);
          console.log(
            `🔐 Hash: ${hashShort} | Generated: ${new Date(hashedReport.timestamp).toLocaleString()}`
          );
          console.log(`🛡️  Security: HMAC-SHA256`);
          console.log(`${'='.repeat(80)}\n`);
          console.log(signedContent);
        }

        if (options.clipboard) {
          const clipboardContent = outputFilename
            ? `Security audit completed. Hash: ${hashShort} (HMAC-SHA256). Verify: eai-security-check verify "${outputFilename}"`
            : `Security audit completed. Hash: ${hashShort} (HMAC-SHA256). Generated: ${new Date(hashedReport.timestamp).toLocaleString()}`;
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
            const clipboardContent = options.quiet
              ? OutputUtils.createSummaryLine(report)
              : OutputUtils.stripAnsiCodes(finalReport);

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
  .description('🏠 Initialize EAI Security Check configuration directory and files interactively')
  .addHelpText(
    'after',
    `
Examples:
  $ eai-security-check init                           # Interactive setup with all options

Interactive Setup:
  The init command will guide you through:
  1. Choosing a default security profile with explanations
  2. Setting up configuration directory and files
  3. Optionally configuring automated daemon scheduling with email and SCP
  4. Optionally installing executable globally for system-wide access
  5. Providing next steps for using the tool

Global Installation:
  During interactive setup, you can choose to install globally:
  - macOS/Linux: Create symbolic links in /usr/local/bin for system-wide access  
  - Windows: Add executable to PATH or create shortcuts
  - Requires appropriate permissions (sudo on macOS/Linux, admin on Windows)

Configuration Directory:
  The init command creates an OS-appropriate configuration directory:
  - macOS: ~/Library/Application Support/eai-security-check/
  - Linux: ~/.config/eai-security-check/
  - Windows: %APPDATA%/eai-security-check/

This directory will contain:
  - security-config.json: Default security check requirements (using chosen profile)
  - default-config.json, strict-config.json, relaxed-config.json, developer-config.json, eai-config.json: All available profiles
  - scheduling-config.json: Daemon scheduling, email, and SCP settings (if daemon setup is chosen)
  - daemon-state.json: Daemon runtime state (created automatically when daemon runs)

Security Profiles Available:
  default     - Recommended security settings (7-min auto-lock timeout)
  strict      - Maximum security, minimal convenience (3-min auto-lock timeout)
  relaxed     - Balanced security with convenience (15-min auto-lock timeout)  
  developer   - Developer-friendly with remote access enabled
  eai         - EAI focused security (10+ char passwords, 180-day expiration)

After running init, you can use any profile with:
  $ eai-security-check check [profile]              # Use specific profile
  $ eai-security-check check                        # Use your chosen default profile
`
  )
  .action(async () => {
    try {
      console.log('🏠 Welcome to EAI Security Check Interactive Setup!\n');
      console.log(
        'This wizard will guide you through configuring security profiles and optional automated scheduling.\n'
      );

      // Show current configuration status
      const initialStatus = ConfigManager.getConfigStatus();
      console.log(`📁 Configuration directory: ${initialStatus.configDirectory}`);

      let forceOverwrite = false;

      if (initialStatus.securityConfigExists || initialStatus.schedulingConfigExists) {
        console.log('\n⚠️  Existing Configuration Detected:');
        if (initialStatus.securityConfigExists) {
          console.log(`  ✅ Security config exists: ${initialStatus.securityConfigPath}`);
        }
        if (initialStatus.schedulingConfigExists) {
          console.log(`  ✅ Daemon config exists: ${initialStatus.schedulingConfigPath}`);
        }

        forceOverwrite = await ConfigManager.promptForForceOverwrite();

        if (!forceOverwrite) {
          console.log('\n🔄 Running in update mode - will preserve existing configurations');
        } else {
          console.log('\n🔄 Force mode enabled - will overwrite existing configurations');
        }
        console.log('');
      }

      // Interactive profile selection
      const selectedProfile = await ConfigManager.promptForSecurityProfile();
      console.log(`\n✅ Selected profile: ${selectedProfile}\n`);

      // Ensure config directory exists
      ConfigManager.ensureConfigDirectory();
      console.log('✅ Configuration directory ready\n');

      // Create all security configurations
      console.log(`📋 Creating security configurations (default profile: ${selectedProfile})...`);
      ConfigManager.createAllSecurityConfigs(forceOverwrite, selectedProfile);
      console.log('');

      // Interactive daemon setup
      const wantsDaemon = await ConfigManager.promptForDaemonSetup();

      if (wantsDaemon) {
        const currentStatus = ConfigManager.getConfigStatus();
        if (currentStatus.schedulingConfigExists && !forceOverwrite) {
          console.log(
            `\n⚠️  Daemon configuration already exists: ${currentStatus.schedulingConfigPath}`
          );
          console.log('Configuration preserved since force overwrite was not selected.');
          console.log('');
        } else {
          try {
            console.log('\n🔧 Setting up daemon configuration...\n');

            if (currentStatus.schedulingConfigExists && forceOverwrite) {
              console.log('🗑️  Removing existing daemon configuration...');
              fs.unlinkSync(currentStatus.schedulingConfigPath);
            }

            await ConfigManager.createSchedulingConfigInteractive(selectedProfile);

            // Enhanced daemon setup - copy service templates and provide instructions
            console.log('\n🛠️  Setting up system service templates...\n');
            const serviceSetup = ConfigManager.copyDaemonServiceTemplates();

            if (serviceSetup.templatesCopied.length > 0) {
              console.log('✅ Service template files copied to your config directory:');
              for (const file of serviceSetup.templatesCopied) {
                const fullPath = path.join(
                  ConfigManager.getConfigDirectory(),
                  'daemon-templates',
                  file
                );
                console.log(`   📄 ${fullPath}`);
              }
              console.log('');
            }

            // Show platform-specific setup instructions
            console.log('🔧 Platform-Specific Setup Instructions:\n');
            for (const instruction of serviceSetup.instructions) {
              if (
                instruction.startsWith('🐧') ||
                instruction.startsWith('🍎') ||
                instruction.startsWith('🪟')
              ) {
                console.log(instruction);
              } else {
                console.log(`   ${instruction}`);
              }
            }
            console.log('');

            // Offer automatic setup help where possible
            const shouldAttemptAutoSetup = await promptForAutoServiceSetup(serviceSetup.platform);
            if (shouldAttemptAutoSetup) {
              await attemptAutoServiceSetup(serviceSetup);
            }

            // Offer to start daemon
            const shouldStartDaemon = await ConfigManager.promptToStartDaemon();
            if (shouldStartDaemon) {
              console.log('\n🔄 Starting daemon...');
              try {
                const { SchedulingService } = await import('../services/scheduling-service');
                const configPath = ConfigManager.getSchedulingConfigPath();
                const statePath = ConfigManager.getDaemonStatePath();
                const schedulingService = new SchedulingService(configPath, statePath);

                // Start daemon in background (non-blocking)
                setTimeout(async () => {
                  try {
                    await schedulingService.startDaemon();
                  } catch (error) {
                    console.error(`⚠️  Daemon start error: ${error}`);
                  }
                }, 100);

                console.log('✅ Daemon startup initiated - it will run in the background');
                console.log('💡 Use "eai-security-check daemon --status" to check daemon status');
              } catch (error) {
                console.error(`❌ Failed to start daemon: ${error}`);
                console.log('💡 You can start it manually later with "eai-security-check daemon"');
              }
            } else {
              console.log(
                '\n⏭️  Daemon configured but not started - use "eai-security-check daemon" to start it later'
              );
            }

            console.log('');
          } catch (error) {
            console.error(`❌ Error creating daemon configuration: ${error}`);
            process.exit(1);
          }
        }
      } else {
        console.log(
          '\n⏭️  Skipping daemon setup - you can configure it later with "eai-security-check init"'
        );
        console.log('');
      }

      // Show comprehensive summary
      console.log('🎉 Setup Complete!\n');
      console.log('📊 Configuration Summary:');
      const finalStatus = ConfigManager.getConfigStatus();
      console.log(`  📁 Config Directory: ${finalStatus.configDirectory}`);
      console.log(
        `  🔒 Security Config (default): ${finalStatus.securityConfigExists ? '✅' : '❌'} ${finalStatus.securityConfigPath}`
      );

      // Show profile-specific configs
      const profiles = ['strict', 'relaxed', 'developer', 'eai'];
      for (const profile of profiles) {
        const profilePath = path.join(finalStatus.configDirectory, `${profile}-config.json`);
        const exists = fs.existsSync(profilePath);
        console.log(`  🔒 Security Config (${profile}): ${exists ? '✅' : '❌'} ${profilePath}`);
      }

      console.log(
        `  🤖 Daemon Config: ${finalStatus.schedulingConfigExists ? '✅' : '❌'} ${finalStatus.schedulingConfigPath}`
      );

      console.log('\n🚀 Next Steps:');
      console.log(`  1. Run your first security audit: eai-security-check check`);
      console.log(`  2. Your default profile is: eai-security-check check ${selectedProfile}`);
      console.log(`  3. Try other profiles: eai-security-check check strict`);
      console.log(`  4. Get help anytime: eai-security-check --help`);

      if (finalStatus.schedulingConfigExists) {
        console.log(`  5. Start automated monitoring: eai-security-check daemon`);
        console.log(`  6. Check daemon status: eai-security-check daemon --status`);
        console.log(`  7. Test email setup: eai-security-check daemon --test-email`);
      } else {
        console.log(`  5. Setup automated monitoring later: eai-security-check init`);
      }

      console.log('\n📚 Additional Resources:');
      console.log('  • Verify reports: eai-security-check verify <file>');
      console.log('  • View all options: eai-security-check check --help');
      console.log('  • Reconfigure anytime: Run this init command again');

      // Global installation option - always ask during interactive setup
      const wantsGlobalInstall = await ConfigManager.promptForGlobalInstall();

      if (wantsGlobalInstall) {
        console.log('\n🌍 Setting up global installation...\n');
        try {
          await ConfigManager.setupGlobalInstallation();
          console.log('✅ Global installation completed successfully!');
          console.log('💡 You can now run "eai-security-check" from any directory');
        } catch (error) {
          console.error(`⚠️  Global installation failed: ${error}`);
          console.log('💡 You can still use the tool from this directory');
        }
        console.log('');
      }

      console.log(
        '\n🔒 Ready to secure your system! Run "eai-security-check check" to get started.'
      );
    } catch (error) {
      console.error('❌ Error during setup:', error);
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('🔍 Verify the integrity of tamper-evident security reports')
  .argument('<path>', 'Path to the signed report file or directory containing reports to verify')
  .option('--verbose', 'Show detailed verification information')
  .addHelpText(
    'after',
    `
Examples:
  $ eai-security-check verify security-report.txt     # Verify single report integrity
  $ eai-security-check verify --verbose report.txt    # Show detailed verification info
  $ eai-security-check verify ./reports/              # Verify all reports in directory
  $ eai-security-check verify report.json             # Works with all formats (JSON, markdown, etc.)

This command verifies that reports have not been tampered with by checking
their cryptographic signatures. Reports generated with --hash option include
verification signatures.

When verifying a directory, all files are checked and a summary is provided.
Only files with valid security report signatures are processed.

Supported formats: All output formats support verification (plain, markdown, json, email)
Exit codes: 0 = all verifications passed, 1 = any verification failed or file error
`
  )
  .action(async (inputPath, options) => {
    try {
      const resolvedPath = path.resolve(inputPath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Path not found: ${resolvedPath}`);
        process.exit(1);
      }

      const stats = fs.statSync(resolvedPath);

      if (stats.isDirectory()) {
        // Handle directory verification
        const files = fs.readdirSync(resolvedPath);
        const reportFiles = files.filter(file => {
          const filePath = path.join(resolvedPath, file);
          return fs.statSync(filePath).isFile();
        });

        if (reportFiles.length === 0) {
          console.error(`❌ No files found in directory: ${resolvedPath}`);
          process.exit(1);
        }

        console.log(`🔍 Verifying ${reportFiles.length} files in directory: ${resolvedPath}\n`);

        let passedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        const results: Array<{
          file: string;
          status: 'passed' | 'failed' | 'skipped';
          message?: string;
        }> = [];

        for (const file of reportFiles) {
          const filePath = path.join(resolvedPath, file);

          try {
            // Check if file contains a security report signature
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            if (!CryptoUtils.extractSignature(fileContent)) {
              skippedCount++;
              results.push({ file, status: 'skipped', message: 'No security signature found' });
              continue;
            }

            const { content, verification } = CryptoUtils.loadAndVerifyReport(filePath);
            const signature = CryptoUtils.extractSignature(content);

            if (verification.isValid) {
              passedCount++;
              results.push({ file, status: 'passed' });

              if (options.verbose) {
                console.log(`✅ ${file}: PASSED`);
                console.log(
                  `   🔐 Hash: ${CryptoUtils.createShortHash(verification.originalHash)}`
                );
                if (signature) {
                  console.log(`   📅 Generated: ${new Date(signature.timestamp).toLocaleString()}`);
                }
                console.log();
              }
            } else {
              failedCount++;
              results.push({ file, status: 'failed', message: verification.message });

              console.error(`❌ ${file}: FAILED`);
              console.error(`   ⚠️  ${verification.message}`);
              console.log();
            }
          } catch (error) {
            failedCount++;
            results.push({ file, status: 'failed', message: `Error: ${error}` });
            console.error(`❌ ${file}: ERROR - ${error}`);
          }
        }

        // Summary
        console.log(`📊 Verification Summary:`);
        console.log(`   ✅ Passed: ${passedCount}`);
        console.log(`   ❌ Failed: ${failedCount}`);
        console.log(`   ⏭️  Skipped: ${skippedCount} (no security signature)`);
        console.log(`   📄 Total: ${reportFiles.length}`);

        if (!options.verbose && passedCount > 0) {
          console.log(
            `\n✅ Files passed: ${results
              .filter(r => r.status === 'passed')
              .map(r => r.file)
              .join(', ')}`
          );
        }

        if (failedCount > 0) {
          console.log(
            `\n❌ Files failed: ${results
              .filter(r => r.status === 'failed')
              .map(r => r.file)
              .join(', ')}`
          );
        }

        process.exit(failedCount > 0 ? 1 : 0);
      } else {
        // Handle single file verification (existing behavior)
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
      }
    } catch (error) {
      console.error('❌ Error verifying report:', error);
      process.exit(1);
    }
  });

program
  .command('daemon')
  .description('🔄 Run security checks on a schedule and send email reports')
  .option(
    '-c, --config <path>',
    'Path to scheduling configuration file (default: uses centralized config)'
  )
  .option(
    '--security-config <path>',
    'Path to security configuration file (overrides profile in schedule config)'
  )
  .option('-s, --state <path>', 'Path to daemon state file (default: uses centralized state)')
  .option('--status', 'Show current daemon status and exit')
  .option('--test-email', 'Send a test email and exit')
  .option('--check-now', 'Force an immediate security check and email (regardless of schedule)')
  .option('--stop', 'Stop the running daemon')
  .option('--restart', 'Restart the daemon (stop current instance and start a new one)')
  .option('--uninstall', 'Remove daemon files and configurations')
  .option('--remove-executable', 'Also remove the executable when uninstalling (requires --force)')
  .option('--force', 'Force operations that normally require confirmation')
  .addHelpText(
    'after',
    `
Examples:
  $ eai-security-check daemon                              # Start daemon with centralized config
  $ eai-security-check daemon -c my-schedule.json         # Use custom scheduling config
  $ eai-security-check daemon --security-config strict.json # Use specific security config
  $ eai-security-check daemon -c schedule.json --security-config eai.json # Use both configs
  $ eai-security-check daemon --status                    # Check daemon status
  $ eai-security-check daemon --test-email                # Send test email
  $ eai-security-check daemon --check-now                 # Force immediate check

Setup:
  Before using daemon mode, initialize your configuration:
  $ eai-security-check init                            # Interactive setup (choose daemon when prompted)

Daemon Control:
  $ eai-security-check daemon --stop                      # Stop running daemon
  $ eai-security-check daemon --restart                   # Restart daemon service
  $ eai-security-check daemon --uninstall                 # Remove daemon files
  $ eai-security-check daemon --uninstall --force         # Remove daemon files and config
  $ eai-security-check daemon --uninstall --remove-executable --force  # Full uninstall

Daemon Features:
  - Runs security checks on a configurable schedule (default: weekly)
  - Sends email reports to configured recipients
  - Optionally transfers reports to remote server via SCP
  - Tracks when last report was sent to avoid duplicates
  - Automatically restarts checks after system reboot (when configured as service)
  - Graceful shutdown on SIGINT/SIGTERM

Configuration:
  The daemon uses two types of configuration files:
  1. Schedule Configuration (scheduling-config.json):
     - Email SMTP settings and recipients
     - Optional SCP file transfer settings (host, authentication, destination)
     - Check interval (in days)
     - Security profile or custom config path
     - Report format preferences
  2. Security Configuration (optional, overrides profile):
     - Specific security requirements and settings
     - Use --security-config to specify a custom security config file
     - If not specified, uses profile from schedule config

SCP File Transfer:
  - Automatically transfers reports to remote server after email delivery
  - Supports SSH key-based authentication (recommended) or password authentication
  - Configurable destination directory and SSH port
  - Reports are saved with timestamp and status (PASSED/FAILED) in filename
  - Password authentication requires 'sshpass' utility to be installed

Service Setup:
  Cross-platform daemon capabilities:
  ✅ Scheduled execution: All platforms (cron-based scheduling)
  ✅ Manual restart: All platforms via --restart option
  ⚠️  Auto-start on boot: Requires manual OS-specific setup

  Platform-specific auto-start setup (optional):
  - Windows: Use Task Scheduler to run on startup/login
  - macOS: Create LaunchAgent plist in ~/Library/LaunchAgents/
  - Linux: Create systemd user service in ~/.config/systemd/user/

  📁 See daemon-examples/ directory for sample configuration files.
  Current implementation runs as user process, not system service.
  Use "eai-security-check daemon --status" to check daemon capabilities on your platform.
`
  )
  .action(async options => {
    try {
      // Set default paths to centralized config locations
      const configPath = options.config || ConfigManager.getSchedulingConfigPath();
      const statePath = options.state || ConfigManager.getDaemonStatePath();

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
        const result = await SchedulingService.restartDaemon(
          configPath,
          statePath,
          options.securityConfig
        );
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
          configPath: configPath,
          stateFilePath: statePath,
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

      // Check if scheduling config exists
      if (!fs.existsSync(configPath)) {
        console.error(`❌ Scheduling configuration not found: ${configPath}`);
        console.log('💡 Initialize daemon configuration first:');
        console.log('   eai-security-check init (choose yes for daemon setup)');
        process.exit(1);
      }

      // Create scheduling service
      const schedulingService = new SchedulingService(
        configPath,
        statePath,
        options.securityConfig
      );

      // Handle status option
      if (options.status) {
        const status = schedulingService.getDaemonStatus();
        const platformInfo = SchedulingService.getDaemonPlatformInfo();

        console.log('📊 Daemon Status:');
        console.log(`  Running: ${status.running}`);
        console.log(`  Last Report: ${status.state.lastReportSent || 'Never'}`);
        console.log(`  Total Reports: ${status.state.totalReportsGenerated}`);
        console.log(`  Started: ${status.state.daemonStarted}`);
        console.log(`  Version: ${status.state.currentVersion}`);
        console.log(`  Check Interval: ${status.config.intervalDays} days`);
        console.log(`  Email Recipients: ${status.config.email.to.join(', ')}`);
        console.log(`  Security Profile: ${status.config.securityProfile}`);
        console.log(`  Config Path: ${configPath}`);
        console.log(`  State Path: ${statePath}`);

        console.log('\n🔧 Platform Capabilities:');
        console.log(`  Platform: ${platformInfo.platform}`);
        console.log(`  Scheduled Execution: ${platformInfo.supportsScheduling ? '✅' : '❌'}`);
        console.log(`  Manual Restart: ${platformInfo.supportsRestart ? '✅' : '❌'}`);
        console.log(
          `  Auto-start on Boot: ${platformInfo.supportsAutoStart ? '✅' : '⚠️  Manual setup required'}`
        );

        if (platformInfo.limitations.length > 0) {
          console.log('\n⚠️  Current Limitations:');
          platformInfo.limitations.forEach(limitation => {
            console.log(`  • ${limitation}`);
          });
        }

        if (platformInfo.setupInstructions.length > 0) {
          console.log('\n💡 Setup Information:');
          platformInfo.setupInstructions.forEach(instruction => {
            console.log(`  • ${instruction}`);
          });
        }

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
  .action(command => {
    if (command) {
      const cmd = program.commands.find(c => c.name() === command);
      if (cmd) {
        cmd.help();
      } else {
        console.error(`❌ Unknown command: ${command}`);
        console.log('Available commands: check, init, verify, daemon, help');
      }
    } else {
      console.log(`
🔒 EAI Security Check - Cross-Platform Security Audit Tool v1.0.0

OVERVIEW:
This tool performs comprehensive security audits of macOS and Linux systems against
configurable requirements and generates detailed reports with actionable
recommendations.

QUICK START:
  1. Initialize configuration:        eai-security-check init
  2. Run security audit:              eai-security-check check
  3. Review results and fix issues:   Follow report recommendations
  4. Setup daemon (optional):         eai-security-check init --daemon

COMMON WORKFLOWS:
  📋 Basic setup and audit:
    $ eai-security-check init
    $ eai-security-check check

  🔍 Custom security profile:
    $ eai-security-check init -p strict
    $ eai-security-check check

  🤖 Automated monitoring:
    $ eai-security-check init --daemon
    $ eai-security-check daemon

  📊 Generate report file:
    $ eai-security-check check -o security-audit-report.txt

  ⚡ Quick summary:
    $ eai-security-check check --quiet

SECURITY AREAS CHECKED:
  🔒 Disk Encryption (FileVault/LUKS/BitLocker)   🔥 Network Firewall (macOS/Linux/Windows)
  🔑 Login Security                                🛡️  Package Verification (Gatekeeper/GPG/SmartScreen)
  ⏰ Session Timeouts                              🔐 System Protection (SIP/SELinux/Defender)
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
