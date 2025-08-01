import * as fs from 'fs';
import * as path from 'path';
import { SecurityAuditor } from '../services/auditor';
import { SecurityConfig } from '../types';
import { OutputUtils, OutputFormat } from '../utils/output-utils';
import { CryptoUtils } from '../utils/crypto-utils';
import { PlatformDetector, Platform } from '../utils/platform-detector';
import { ConfigManager } from '../config/config-manager';
import { isValidProfile } from '../config/config-profiles';

export interface SecurityCheckOptions {
  profile?: string;
  configPath?: string;
  outputPath?: string;
  quiet?: boolean;
  password?: string;
  clipboard?: boolean;
  format?: string;
  hash?: boolean;
  summary?: boolean;
}

export interface SecurityCheckResult {
  report: string;
  overallPassed: boolean;
  outputPath?: string;
  hashInfo?: {
    hash: string;
    shortHash: string;
    timestamp: string;
  };
}

/**
 * Core security operations shared between CLI and interactive modes
 */
export class SecurityOperations {
  /**
   * Get configuration by profile name from centralized config files
   */
  static getConfigForProfile(profile: string): SecurityConfig | null {
    if (!isValidProfile(profile)) {
      return null;
    }

    // Get the centralized config directory
    const { configDir } = ConfigManager.ensureCentralizedDirectories();

    // Try to load the profile-specific config file
    let configPath: string;
    if (profile === 'default') {
      configPath = path.join(configDir, 'security-config.json');
    } else {
      configPath = path.join(configDir, `${profile}-config.json`);
    }

    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error(`Failed to load config from ${configPath}:`, error);
        return null;
      }
    } else {
      // If the profile config doesn't exist, try to create all configs first
      try {
        ConfigManager.createAllSecurityConfigs(false, 'default');

        // Try to load again after creation
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf-8');
          return JSON.parse(content);
        } else {
          console.error(`Configuration file not found after creation: ${configPath}`);
          return null;
        }
      } catch (creationError) {
        console.error(
          `Failed to create security configuration for profile '${profile}':`,
          creationError
        );
        return null;
      }
    }
  }

  /**
   * Run a security check with the given options
   */
  static async runSecurityCheck(options: SecurityCheckOptions): Promise<SecurityCheckResult> {
    // Determine configuration source
    let config: SecurityConfig;
    let configSource = '';

    if (options.configPath) {
      // Use explicit config file if provided
      const configPath = path.resolve(options.configPath);

      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      const configContent = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configContent);
      configSource = `config file: ${configPath}`;
    } else if (options.profile) {
      // Use profile argument
      const profileConfig = this.getConfigForProfile(options.profile);

      if (!profileConfig) {
        throw new Error(`Invalid profile: ${options.profile}`);
      }

      config = profileConfig;
      configSource = `${options.profile} profile`;
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
        const defaultConfig = this.getConfigForProfile('default');
        if (!defaultConfig) {
          throw new Error('Failed to load default configuration');
        }
        config = defaultConfig;
        configSource = 'default profile (generated)';
      }
    }

    // Check platform compatibility first
    const platformInfo = await PlatformDetector.detectPlatform();
    if (!platformInfo.isSupported) {
      throw new Error(platformInfo.warningMessage || 'Platform not supported');
    }

    // Handle password for sudo operations if needed
    let password: string | undefined;
    if (options.password) {
      password = options.password;
    } else if (!options.quiet) {
      // Prompt for password interactively if not in quiet mode
      try {
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
        throw new Error(`Password collection failed: ${error}`);
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

    // Get audit result for exit code and processing
    const auditResult = await auditor.auditSecurity(config);

    // Handle summary-only option
    if (options.summary) {
      const summaryLine = OutputUtils.createSummaryLine(report);
      return {
        report: summaryLine,
        overallPassed: auditResult.overallPassed
      };
    }

    // Validate output format
    const validFormats = Object.values(OutputFormat);
    if (options.format && !validFormats.includes(options.format as OutputFormat)) {
      throw new Error(
        `Invalid format: ${options.format}. Valid formats: ${validFormats.join(', ')}`
      );
    }

    // Format report if needed
    let finalReport = report;
    let outputFilename = options.outputPath;

    if (options.format && options.format !== OutputFormat.CONSOLE) {
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
    let hashInfo: SecurityCheckResult['hashInfo'];
    if (options.hash) {
      const { signedContent, hashedReport } = CryptoUtils.createTamperEvidentReport(finalReport, {
        platform: platformInfo.platform,
        distribution: platformInfo.distribution,
        configSource
      });

      const hashShort = CryptoUtils.createShortHash(hashedReport.hash);
      hashInfo = {
        hash: hashedReport.hash,
        shortHash: hashShort,
        timestamp: hashedReport.timestamp
      };

      finalReport = signedContent;
    }

    // Handle clipboard functionality
    if (options.clipboard) {
      const clipboardAvailable = await OutputUtils.isClipboardAvailable();
      if (clipboardAvailable) {
        let clipboardContent: string;

        if (options.summary) {
          clipboardContent = finalReport;
        } else if (hashInfo) {
          clipboardContent = outputFilename
            ? `Security audit completed. Hash: ${hashInfo.shortHash} (HMAC-SHA256). Verify: eai-security-check verify "${outputFilename}"`
            : `Security audit completed. Hash: ${hashInfo.shortHash} (HMAC-SHA256). Generated: ${new Date(hashInfo.timestamp).toLocaleString()}`;
        } else {
          clipboardContent = options.quiet
            ? OutputUtils.createSummaryLine(report)
            : OutputUtils.stripAnsiCodes(finalReport);
        }

        const success = await OutputUtils.copyToClipboard(clipboardContent);
        if (!success && !options.quiet) {
          console.error('❌ Failed to copy to clipboard');
        }
      } else if (!options.quiet) {
        console.error('❌ Clipboard not available');
        console.log(OutputUtils.getClipboardInstallSuggestion());
      }
    }

    return {
      report: finalReport,
      overallPassed: auditResult.overallPassed,
      outputPath: outputFilename,
      hashInfo
    };
  }

  /**
   * Run an interactive security check with profile selection
   */
  static async runInteractiveSecurityCheck(): Promise<void> {
    console.log('🔍 Security Check - Profile Selection\n');

    const profile = await ConfigManager.promptForSecurityProfile();
    console.log(`\n🚀 Running security check with '${profile}' profile...\n`);

    const result = await this.runSecurityCheck({ profile });
    console.log(result.report);
  }

  /**
   * Run a quick security check with default profile
   */
  static async runQuickSecurityCheck(): Promise<void> {
    console.log('🚀 Running quick security check with default profile...\n');

    const result = await this.runSecurityCheck({ profile: 'default' });
    console.log(result.report);

    // Save report to file
    try {
      const { reportsDir } = ConfigManager.ensureCentralizedDirectories();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `security-check-${timestamp}.txt`;
      const filePath = path.join(reportsDir, filename);

      fs.writeFileSync(filePath, result.report, 'utf-8');
      console.log(`\n📄 Report saved to: ${filePath}`);
    } catch (error) {
      console.warn(
        `⚠️  Could not save report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
