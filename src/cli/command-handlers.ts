import * as fs from 'fs';
import * as path from 'path';
import { SecurityOperations } from '../core/security-operations';
import { InstallationOperations } from '../core/installation-operations';
import { VerificationOperations } from '../core/verification-operations';
import { SchedulingService } from '../services/scheduling-service';
import { ConfigManager } from '../config/config-manager';
import { VALID_PROFILES } from '../config/config-profiles';
import { OutputFormat } from '../utils/output-utils';

/**
 * CLI command handlers that use shared core operations
 */
export class CommandHandlers {
  /**
   * Handle the 'check' command
   */
  static async handleCheckCommand(
    profile: string | undefined,
    options: {
      config?: string;
      output?: string;
      quiet?: boolean;
      password?: string;
      clipboard?: boolean;
      format?: string;
      hash?: boolean;
      summary?: boolean;
    }
  ): Promise<void> {
    try {
      const result = await SecurityOperations.runSecurityCheck({
        profile,
        configPath: options.config,
        outputPath: options.output,
        quiet: options.quiet,
        password: options.password,
        clipboard: options.clipboard,
        format: options.format,
        hash: options.hash,
        summary: options.summary
      });

      // Handle output
      if (options.hash && result.hashInfo) {
        if (result.outputPath) {
          // Save to file
          fs.writeFileSync(result.outputPath, result.report);
          console.log(`📄 Tamper-evident report saved to: ${result.outputPath}`);
          console.log(`🔐 Report hash: ${result.hashInfo.shortHash} (HMAC-SHA256)`);
          console.log(`🔍 Verify with: eai-security-check verify "${result.outputPath}"`);
        } else {
          // Output to console with hash header
          console.log(`\n🔒 TAMPER-EVIDENT SECURITY REPORT`);
          console.log(
            `🔐 Hash: ${result.hashInfo.shortHash} | Generated: ${new Date(result.hashInfo.timestamp).toLocaleString()}`
          );
          console.log(`🛡️  Security: HMAC-SHA256`);
          console.log(`${'='.repeat(80)}\n`);
          console.log(result.report);
        }
      } else {
        // Handle regular output
        if (result.outputPath) {
          fs.writeFileSync(result.outputPath, result.report);
          console.log(`📄 Report saved to: ${result.outputPath}`);
        } else {
          console.log(result.report);
        }
      }

      // Exit with appropriate code
      process.exit(result.overallPassed ? 0 : 1);
    } catch (error) {
      console.error('❌ Error running security check:', error);
      process.exit(1);
    }
  }

  /**
   * Handle the 'verify' command
   */
  static async handleVerifyCommand(
    inputPath: string,
    options: { verbose?: boolean }
  ): Promise<void> {
    try {
      const resolvedPath = path.resolve(inputPath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Path not found: ${resolvedPath}`);
        process.exit(1);
      }

      const stats = fs.statSync(resolvedPath);

      if (stats.isDirectory()) {
        // Handle directory verification
        const summary = VerificationOperations.verifyDirectory(resolvedPath, options.verbose);

        console.log(`🔍 Verifying ${summary.totalFiles} files in directory: ${resolvedPath}\n`);

        // Display results
        for (const result of summary.results) {
          if (result.result) {
            VerificationOperations.displayVerificationResult(
              result.result,
              path.join(resolvedPath, result.file),
              options.verbose
            );
          } else {
            const icon = result.status === 'skipped' ? '⏭️' : '❌';
            console.log(`${icon} ${result.file}: ${result.status.toUpperCase()}`);
            if (result.message) {
              console.log(`   ${result.message}`);
            }
          }
          console.log();
        }

        // Display summary
        VerificationOperations.displayDirectoryVerificationSummary(summary, options.verbose);

        process.exit(summary.failedCount > 0 ? 1 : 0);
      } else {
        // Handle single file verification
        const result = VerificationOperations.verifyFile(resolvedPath, options.verbose);

        if (result.isValid) {
          console.log('✅ Report verification PASSED');
          if (result.originalHash) {
            const { CryptoUtils } = await import('../utils/crypto-utils');
            console.log(`🔐 Hash: ${CryptoUtils.createShortHash(result.originalHash)}`);
          }

          if (result.timestamp) {
            console.log(`📅 Generated: ${new Date(result.timestamp).toLocaleString()}`);
          }

          if (result.metadata) {
            console.log(`💻 Platform: ${result.metadata.platform}`);
            console.log(`🖥️  Hostname: ${result.metadata.hostname}`);
          }
        } else {
          console.error('❌ Report verification FAILED');
          console.error(`⚠️  ${result.message}`);

          if (result.originalHash && result.calculatedHash) {
            const { CryptoUtils } = await import('../utils/crypto-utils');
            console.error(`🔐 Expected: ${CryptoUtils.createShortHash(result.originalHash)}`);
            console.error(`🔐 Actual: ${CryptoUtils.createShortHash(result.calculatedHash)}`);
          }
        }

        if (options.verbose && result.originalHash) {
          const { CryptoUtils } = await import('../utils/crypto-utils');
          const content = fs.readFileSync(resolvedPath, 'utf-8');
          const signature = CryptoUtils.extractSignature(content);
          // Only call createVerificationSummary if we have compatible types
          if (signature) {
            console.log(`🔍 Detailed verification information available`);
            console.log(`   Platform: ${result.metadata?.platform || 'Unknown'}`);
            console.log(`   Hostname: ${result.metadata?.hostname || 'Unknown'}`);
          }
        }

        process.exit(result.isValid ? 0 : 1);
      }
    } catch (error) {
      console.error('❌ Error verifying report:', error);
      process.exit(1);
    }
  }

  /**
   * Handle the 'daemon' command
   */
  static async handleDaemonCommand(options: {
    config?: string;
    securityConfig?: string;
    state?: string;
    status?: boolean;
    testEmail?: boolean;
    checkNow?: boolean;
    stop?: boolean;
    restart?: boolean;
    uninstall?: boolean;
    removeExecutable?: boolean;
    force?: boolean;
  }): Promise<void> {
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
        console.log('💡 Set up daemon configuration first:');
        console.log('   eai-security-check interactive (choose daemon automation)');
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
        if (status.config.email?.to?.length) {
          console.log(`  📧 Email Recipients: ${status.config.email.to.join(', ')}`);
        } else {
          console.log('  📧 Email Recipients: ❌ Not configured');
        }
        if (status.config.scp?.enabled) {
          console.log(
            `  📤 SCP Transfer: ✅ ${status.config.scp.username}@${status.config.scp.host}`
          );
        } else {
          console.log('  📤 SCP Transfer: ❌ Not configured');
        }
        console.log(`  Security Profile: ${status.config.securityProfile}`);

        console.log('\n📁 File Locations:');
        console.log(`  Config Path: ${configPath}`);
        console.log(`  State Path: ${statePath}`);
        if (options.securityConfig) {
          console.log(`  Security Config: ${options.securityConfig}`);
        }

        // Show platform information
        console.log('\n🔧 Platform Information:');
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
  }

  /**
   * Handle the 'install' command
   */
  static async handleInstallCommand(): Promise<void> {
    try {
      console.log('🚀 Installing EAI Security Check globally...\n');

      const result = await InstallationOperations.installGlobally();

      if (result.success) {
        console.log('✅', result.message);
        if (result.symlinkPath) {
          console.log(`🔗 Symlink created: ${result.symlinkPath}`);
        }
        console.log(`📂 Executable installed: ${result.executablePath}`);
        console.log('\n💡 You can now run "eai-security-check" from anywhere!');
      } else {
        console.error('❌', result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Installation failed:', error);
      process.exit(1);
    }
  }

  /**
   * Handle the 'uninstall' command
   */
  static async handleUninstallCommand(options: { cleanup?: boolean }): Promise<void> {
    try {
      console.log('🗑️ Uninstalling EAI Security Check...\n');

      const result = await InstallationOperations.uninstallGlobally(options.cleanup);

      if (result.success) {
        console.log('✅', result.message);
        if (!options.cleanup) {
          console.log('\n💡 Configuration files and data were preserved.');
          console.log('💡 Run with --cleanup flag to remove all data.');
        }
      } else {
        console.error('❌', result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Uninstall failed:', error);
      process.exit(1);
    }
  }

  /**
   * Handle the 'update' command
   */
  static async handleUpdateCommand(): Promise<void> {
    try {
      console.log('🔄 Checking for updates...\n');

      const result = await InstallationOperations.updateGlobalInstallation();

      if (result.success) {
        console.log('✅', result.message);
        if (result.oldVersion && result.newVersion) {
          console.log(`📦 Updated from version ${result.oldVersion} to ${result.newVersion}`);
        }
        console.log('\n🔄 Please restart any running daemon services.');
        console.log(
          '💡 Run "eai-security-check daemon --restart" if you have daemon mode enabled.'
        );
      } else {
        console.error('❌', result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Update failed:', error);
      process.exit(1);
    }
  }

  /**
   * Validate command options and arguments
   */
  static validateCheckCommand(
    profile: string | undefined,
    options: {
      config?: string;
      format?: string;
    }
  ): void {
    // Validate profile if provided
    if (
      profile &&
      !VALID_PROFILES.includes(profile as 'default' | 'strict' | 'relaxed' | 'developer' | 'eai')
    ) {
      console.error(`❌ Invalid profile: ${profile}`);
      console.log(`💡 Valid profiles: ${VALID_PROFILES.join(', ')}`);
      console.log('💡 Use "eai-security-check check --help" for examples');
      process.exit(1);
    }

    // Validate config file if provided
    if (options.config && !fs.existsSync(path.resolve(options.config))) {
      console.error(`❌ Configuration file not found: ${options.config}`);
      console.log('💡 Use "eai-security-check interactive" to setup configurations interactively.');
      process.exit(1);
    }

    // Validate format if provided
    if (options.format) {
      const validFormats = Object.values(OutputFormat);
      if (!validFormats.includes(options.format as OutputFormat)) {
        console.error(`❌ Invalid format: ${options.format}`);
        console.log(`💡 Valid formats: ${validFormats.join(', ')}`);
        process.exit(1);
      }
    }
  }

  /**
   * Display help information for a specific command
   */
  static displayCommandHelp(command?: string): void {
    if (command) {
      // This would be handled by Commander.js normally
      console.log(`Help for command: ${command}`);
    } else {
      console.log(`
🔒 EAI Security Check - Cross-Platform Security Audit Tool v1.1.0

OVERVIEW:
This tool performs comprehensive security audits of macOS and Linux systems against
configurable requirements and generates detailed reports with actionable
recommendations.

QUICK START:
  1. Setup configuration:             eai-security-check interactive
  2. Run security audit:              eai-security-check check
  3. Review results and fix issues:   Follow report recommendations
  4. Setup daemon (optional):        eai-security-check interactive (choose daemon automation)

COMMON WORKFLOWS:
  📋 Basic setup and audit:
    $ eai-security-check interactive
    $ eai-security-check check

  🔍 Custom security profile:
    $ eai-security-check interactive
    $ eai-security-check check

  🤖 Automated monitoring:
    $ eai-security-check interactive
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
  }
}
