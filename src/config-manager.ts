import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SecurityConfig, SchedulingConfig } from './types';
import { getConfigByProfile } from './config-profiles';
import { Platform, PlatformDetector } from './platform-detector';

/**
 * ConfigManager handles configuration directory setup and management
 */
export class ConfigManager {
  private static readonly APP_NAME = 'eai-security-check';

  /**
   * Get the OS-appropriate configuration directory
   */
  static getConfigDirectory(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'darwin': // macOS
        return path.join(homeDir, 'Library', 'Application Support', this.APP_NAME);
      case 'linux':
        // Use XDG_CONFIG_HOME if set, otherwise ~/.config
        const xdgConfigHome = process.env.XDG_CONFIG_HOME;
        if (xdgConfigHome) {
          return path.join(xdgConfigHome, this.APP_NAME);
        }
        return path.join(homeDir, '.config', this.APP_NAME);
      case 'win32': // Windows
        const appData = process.env.APPDATA;
        if (appData) {
          return path.join(appData, this.APP_NAME);
        }
        return path.join(homeDir, 'AppData', 'Roaming', this.APP_NAME);
      default:
        // Fallback to a hidden directory in home
        return path.join(homeDir, `.${this.APP_NAME}`);
    }
  }

  /**
   * Create the configuration directory if it doesn't exist
   */
  static ensureConfigDirectory(): string {
    const configDir = this.getConfigDirectory();
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    return configDir;
  }

  /**
   * Get the path to the default security configuration file
   */
  static getSecurityConfigPath(): string {
    return path.join(this.getConfigDirectory(), 'security-config.json');
  }

  /**
   * Get the path to the scheduling configuration file
   */
  static getSchedulingConfigPath(): string {
    return path.join(this.getConfigDirectory(), 'scheduling-config.json');
  }

  /**
   * Get the path to the daemon state file
   */
  static getDaemonStatePath(): string {
    return path.join(this.getConfigDirectory(), 'daemon-state.json');
  }

  /**
   * Create a default security configuration file
   */
  static createSecurityConfig(profile: string = 'default'): void {
    const configDir = this.ensureConfigDirectory();
    const configPath = this.getSecurityConfigPath();

    if (fs.existsSync(configPath)) {
      throw new Error(`Security configuration already exists: ${configPath}`);
    }

    const config = getConfigByProfile(profile);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Create all security profile configuration files
   */
  static createAllSecurityConfigs(force: boolean = false, defaultProfile: string = 'default'): void {
    const configDir = this.ensureConfigDirectory();
    const profiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];
    const createdProfiles: string[] = [];
    const skippedProfiles: string[] = [];

    // Create main security config (using specified default profile)
    const mainConfigPath = this.getSecurityConfigPath();
    if (!fs.existsSync(mainConfigPath) || force) {
      const defaultConfig = getConfigByProfile(defaultProfile);
      fs.writeFileSync(mainConfigPath, JSON.stringify(defaultConfig, null, 2));
      createdProfiles.push(`default (${defaultProfile} profile)`);
    } else {
      skippedProfiles.push(`default (${defaultProfile} profile)`);
    }

    // Create profile-specific config files
    for (const profile of profiles) {
      if (profile === 'default') continue; // Already handled above

      const profileConfigPath = path.join(configDir, `${profile}-config.json`);
      if (!fs.existsSync(profileConfigPath) || force) {
        const config = getConfigByProfile(profile);
        fs.writeFileSync(profileConfigPath, JSON.stringify(config, null, 2));
        createdProfiles.push(profile);
      } else {
        skippedProfiles.push(profile);
      }
    }

    if (createdProfiles.length > 0) {
      console.log(`✅ Created security configs: ${createdProfiles.join(', ')}`);
    }
    if (skippedProfiles.length > 0) {
      console.log(`⚠️  Skipped existing configs: ${skippedProfiles.join(', ')}`);
    }
  }

  /**
   * Create a scheduling configuration file with interactive prompts
   */
  static async createSchedulingConfigInteractive(defaultProfile: string = 'default'): Promise<void> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
    };

    try {
      console.log('🔧 Setting up daemon configuration...\n');
      
      // Get user identification
      const userId = await question('Enter user/system identifier (e.g., user@company.com): ');
      if (!userId.trim()) {
        throw new Error('User identifier is required');
      }
      
      // Get email settings
      console.log('\n📧 Email Configuration:');
      const smtpHost = await question('SMTP host (e.g., smtp.gmail.com): ');
      if (!smtpHost.trim()) {
        throw new Error('SMTP host is required');
      }
      
      const smtpPortInput = await question('SMTP port (587 for TLS, 465 for SSL): ');
      const smtpPort = parseInt(smtpPortInput) || 587;
      const smtpSecure = smtpPort === 465;
      
      const smtpUser = await question('SMTP username/email: ');
      if (!smtpUser.trim()) {
        throw new Error('SMTP username is required');
      }
      
      const smtpPass = await question('SMTP password (use app-specific password for Gmail): ');
      if (!smtpPass.trim()) {
        throw new Error('SMTP password is required');
      }
      
      const fromEmail = await question('From email address: ') || smtpUser;
      const toEmails = await question('To email addresses (comma-separated): ');
      if (!toEmails.trim()) {
        throw new Error('At least one recipient email is required');
      }
      
      // Get scheduling settings
      console.log('\n⏰ Scheduling Configuration:');
      const intervalInput = await question('Check interval in days (default: 7): ');
      const intervalDays = parseInt(intervalInput) || 7;
      
      // Get security profile
      const profileInput = await question(`Security profile (default, strict, relaxed, developer, eai) [${defaultProfile}]: `);
      const securityProfile = profileInput.trim() || defaultProfile;
      
      const config: SchedulingConfig = {
        enabled: true,
        intervalDays,
        userId: userId.trim(),
        email: {
          smtp: {
            host: smtpHost.trim(),
            port: smtpPort,
            secure: smtpSecure,
            auth: {
              user: smtpUser.trim(),
              pass: smtpPass.trim()
            }
          },
          from: `EAI Security Check <${fromEmail.trim()}>`,
          to: toEmails.split(',').map(email => email.trim()).filter(email => email.length > 0),
          subject: 'Security Audit Report'
        },
        reportFormat: 'email',
        securityProfile: securityProfile
      };

      const configDir = this.ensureConfigDirectory();
      const configPath = this.getSchedulingConfigPath();
      
      if (fs.existsSync(configPath)) {
        const overwrite = await question(`\nScheduling config already exists. Overwrite? (y/N): `);
        if (overwrite.toLowerCase() !== 'y') {
          console.log('❌ Configuration creation cancelled.');
          return;
        }
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Scheduling configuration created: ${configPath}`);
      console.log(`🤖 Configured for ${intervalDays}-day intervals using '${securityProfile}' profile`);
      console.log(`📧 Will send reports to: ${config.email.to.join(', ')}`);
      
    } finally {
      rl.close();
    }
  }

  /**
   * Ask user if they want to setup daemon configuration
   */
  static async promptForDaemonSetup(): Promise<boolean> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const answer = await new Promise<string>((resolve) => {
        rl.question('\n🤖 Would you like to set up automated scheduling (daemon)? (y/N): ', resolve);
      });

      return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    } finally {
      rl.close();
    }
  }

  /**
   * Check if security configuration exists
   */
  static hasSecurityConfig(): boolean {
    return fs.existsSync(this.getSecurityConfigPath());
  }

  /**
   * Check if scheduling configuration exists
   */
  static hasSchedulingConfig(): boolean {
    return fs.existsSync(this.getSchedulingConfigPath());
  }

  /**
   * Load security configuration
   */
  static loadSecurityConfig(): SecurityConfig | null {
    const configPath = this.getSecurityConfigPath();
    
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load security configuration: ${error}`);
    }
  }

  /**
   * Load scheduling configuration
   */
  static loadSchedulingConfig(): SchedulingConfig | null {
    const configPath = this.getSchedulingConfigPath();
    
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load scheduling configuration: ${error}`);
    }
  }

  /**
   * Get configuration status summary
   */
  static getConfigStatus(): {
    configDirectory: string;
    securityConfigExists: boolean;
    schedulingConfigExists: boolean;
    securityConfigPath: string;
    schedulingConfigPath: string;
  } {
    return {
      configDirectory: this.getConfigDirectory(),
      securityConfigExists: this.hasSecurityConfig(),
      schedulingConfigExists: this.hasSchedulingConfig(),
      securityConfigPath: this.getSecurityConfigPath(),
      schedulingConfigPath: this.getSchedulingConfigPath()
    };
  }
}