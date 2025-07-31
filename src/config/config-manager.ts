import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SecurityConfig, SchedulingConfig, ScpConfig } from '../types';
import { getConfigByProfile } from './config-profiles';
import { Platform, PlatformDetector } from '../utils/platform-detector';

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
  static createAllSecurityConfigs(
    force: boolean = false,
    defaultProfile: string = 'default'
  ): void {
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
  static async createSchedulingConfigInteractive(
    defaultProfile: string = 'default'
  ): Promise<void> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise(resolve => {
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

      const fromEmail = (await question('From email address: ')) || smtpUser;
      const toEmails = await question('To email addresses (comma-separated): ');
      if (!toEmails.trim()) {
        throw new Error('At least one recipient email is required');
      }

      // Get scheduling settings
      console.log('\n⏰ Scheduling Configuration:');
      const intervalInput = await question('Check interval in days (default: 7): ');
      const intervalDays = parseInt(intervalInput) || 7;

      // Get security profile
      const profileInput = await question(
        `Security profile (default, strict, relaxed, developer, eai) [${defaultProfile}]: `
      );
      const securityProfile = profileInput.trim() || defaultProfile;

      // SCP Configuration (optional)
      console.log('\n📤 SCP File Transfer Configuration (Optional):');
      console.log('SCP can automatically transfer reports to a remote server via SSH.');
      const wantsScp = await question('Would you like to configure SCP file transfer? (y/N): ');

      let scpConfig: ScpConfig | undefined;

      if (wantsScp.toLowerCase() === 'y') {
        console.log('\n🔧 Setting up SCP configuration...');

        const scpHost = await question('Remote server hostname/IP: ');
        if (!scpHost.trim()) {
          throw new Error('SCP host is required');
        }

        const scpUsername = await question('SSH username: ');
        if (!scpUsername.trim()) {
          throw new Error('SSH username is required');
        }

        const scpDestDir = await question('Destination directory on remote server: ');
        if (!scpDestDir.trim()) {
          throw new Error('Destination directory is required');
        }

        const scpPortInput = await question('SSH port (default: 22): ');
        const scpPort = parseInt(scpPortInput) || 22;

        console.log('\nAuthentication method:');
        console.log('1. SSH key (recommended)');
        console.log('2. Password');
        const authChoice = await question('Choose authentication method (1/2): ');

        if (authChoice === '1') {
          const keyPath = await question('Path to SSH private key file: ');
          if (!keyPath.trim()) {
            throw new Error('SSH private key path is required');
          }

          scpConfig = {
            enabled: true,
            host: scpHost.trim(),
            username: scpUsername.trim(),
            destinationDirectory: scpDestDir.trim(),
            port: scpPort,
            authMethod: 'key',
            privateKeyPath: keyPath.trim()
          };
        } else if (authChoice === '2') {
          const scpPassword = await question('SSH password: ');
          if (!scpPassword.trim()) {
            throw new Error('SSH password is required');
          }

          console.log(
            '⚠️  Note: Password authentication requires "sshpass" to be installed on the system.'
          );

          scpConfig = {
            enabled: true,
            host: scpHost.trim(),
            username: scpUsername.trim(),
            destinationDirectory: scpDestDir.trim(),
            port: scpPort,
            authMethod: 'password',
            password: scpPassword.trim()
          };
        } else {
          console.log('❌ Invalid choice. Skipping SCP configuration.');
        }
      }

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
          to: toEmails
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0),
          subject: 'Security Audit Report'
        },
        ...(scpConfig && { scp: scpConfig }),
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
      console.log(
        `🤖 Configured for ${intervalDays}-day intervals using '${securityProfile}' profile`
      );
      console.log(`📧 Will send reports to: ${config.email.to.join(', ')}`);

      if (scpConfig) {
        console.log(
          `📤 Will also transfer reports via SCP to: ${scpConfig.username}@${scpConfig.host}:${scpConfig.destinationDirectory}/`
        );
      }
    } finally {
      rl.close();
    }
  }

  /**
   * Ask user to select a security profile with explanations
   */
  static async promptForSecurityProfile(): Promise<string> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log('\n🔒 Security Profile Selection');
      console.log('Choose a default security profile for your system:\n');

      console.log('📋 Available Profiles:');
      console.log('  1. default   - Recommended security settings (7-min auto-lock timeout)');
      console.log('                 Good balance of security and usability for most users');
      console.log('  2. strict    - Maximum security, minimal convenience (3-min auto-lock)');
      console.log('                 Highest security requirements, may impact workflow');
      console.log('  3. relaxed   - Balanced security with convenience (15-min auto-lock)');
      console.log('                 More lenient settings for easier daily use');
      console.log('  4. developer - Developer-friendly with remote access enabled');
      console.log('                 Allows SSH and remote management for development work');
      console.log('  5. eai       - EAI focused security (10+ char passwords, 180-day expiration)');
      console.log('                 Specialized profile for EAI organizational requirements\n');

      const answer = await new Promise<string>(resolve => {
        rl.question('Select profile (1-5) or enter profile name [default]: ', resolve);
      });

      // Handle numeric choices
      const choice = answer.trim();
      switch (choice) {
        case '1':
        case '':
          return 'default';
        case '2':
          return 'strict';
        case '3':
          return 'relaxed';
        case '4':
          return 'developer';
        case '5':
          return 'eai';
        default:
          // Handle direct profile names
          const validProfiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];
          if (validProfiles.includes(choice.toLowerCase())) {
            return choice.toLowerCase();
          }
          // Invalid choice, default to 'default'
          console.log(`⚠️  Invalid choice "${choice}", using default profile`);
          return 'default';
      }
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
      console.log('\n🤖 Automated Scheduling Setup');
      console.log(
        'The daemon can automatically run security checks on a schedule and email results.'
      );
      console.log(
        'This is optional - you can always run checks manually with "eai-security-check check".\n'
      );

      const answer = await new Promise<string>(resolve => {
        rl.question('Would you like to set up automated scheduling (daemon)? (y/N): ', resolve);
      });

      return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    } finally {
      rl.close();
    }
  }

  /**
   * Ask user if they want to force overwrite existing configurations
   */
  static async promptForForceOverwrite(): Promise<boolean> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const answer = await new Promise<string>(resolve => {
        rl.question('\n🔄 Would you like to overwrite existing configurations? (y/N): ', resolve);
      });

      return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    } finally {
      rl.close();
    }
  }

  /**
   * Ask user if they want to start the daemon now
   */
  static async promptToStartDaemon(): Promise<boolean> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log('\n🚀 Daemon Ready to Start');
      console.log('The daemon is now configured and ready to run automated security checks.');
      const answer = await new Promise<string>(resolve => {
        rl.question('Would you like to start the daemon now? (y/N): ', resolve);
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

  /**
   * Prompt user if they want global installation
   */
  static async promptForGlobalInstall(): Promise<boolean> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const platform = os.platform();
    let installationDescription = '';

    switch (platform) {
      case 'win32':
        installationDescription =
          'Add to PATH or create desktop shortcuts (requires admin privileges)';
        break;
      case 'darwin':
      case 'linux':
        installationDescription = 'Create symbolic link in /usr/local/bin (requires sudo)';
        break;
      default:
        installationDescription = 'Enable system-wide access';
    }

    return new Promise(resolve => {
      console.log('🌍 Global Installation Setup');
      console.log(
        `   Platform: ${platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux'}`
      );
      console.log(`   Action: ${installationDescription}`);
      console.log('');

      rl.question(
        'Would you like to install globally for system-wide access? (y/N): ',
        (answer: string) => {
          rl.close();
          resolve(answer.toLowerCase().startsWith('y'));
        }
      );
    });
  }

  /**
   * Setup global installation across platforms
   */
  static async setupGlobalInstallation(): Promise<void> {
    const platform = os.platform();
    const executablePath = process.execPath;
    const executableFile = path.basename(executablePath);

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    switch (platform) {
      case 'win32':
        await this.setupWindowsGlobalInstall(executablePath, executableFile, execAsync);
        break;
      case 'darwin':
      case 'linux':
        await this.setupUnixGlobalInstall(executablePath, executableFile, execAsync);
        break;
      default:
        throw new Error(`Global installation not supported on platform: ${platform}`);
    }
  }

  /**
   * Setup global installation on Windows
   */
  private static async setupWindowsGlobalInstall(
    executablePath: string,
    executableFile: string,
    execAsync: any
  ): Promise<void> {
    // Strategy 1: Try to add to PATH via environment variables
    try {
      const binDir = path.dirname(executablePath);

      // Check if already in PATH
      const currentPath = process.env.PATH || '';
      if (currentPath.includes(binDir)) {
        console.log('✅ Executable directory already in PATH');
        return;
      }

      // Try to add to user PATH (doesn't require admin)
      const { stdout } = await execAsync(`powershell -Command "$env:PATH"`);
      console.log('💡 Adding to user PATH environment variable...');

      await execAsync(
        `powershell -Command "[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'User') + ';${binDir}', 'User')"`
      );

      console.log(
        '✅ Added to user PATH - restart terminal or log out/in for changes to take effect'
      );
      console.log(`📁 Executable location: ${executablePath}`);
    } catch (pathError) {
      // Strategy 2: Create a batch file wrapper in a common location
      try {
        console.log('💡 Creating batch file wrapper...');

        const userProfile = process.env.USERPROFILE;
        if (!userProfile) {
          throw new Error('USERPROFILE environment variable not found');
        }
        const binDir = path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WindowsApps');

        if (fs.existsSync(binDir)) {
          const batchFile = path.join(binDir, 'eai-security-check.bat');
          const batchContent = `@echo off\n"${executablePath}" %*`;

          fs.writeFileSync(batchFile, batchContent);
          console.log('✅ Created batch file wrapper');
          console.log(`📁 Wrapper location: ${batchFile}`);
        } else {
          throw new Error('Windows Apps directory not found');
        }
      } catch (batchError) {
        throw new Error(
          `Failed to setup global installation: ${pathError}. Batch file creation also failed: ${batchError}`
        );
      }
    }
  }

  /**
   * Setup global installation on Unix-like systems (macOS/Linux)
   */
  private static async setupUnixGlobalInstall(
    executablePath: string,
    executableFile: string,
    execAsync: any
  ): Promise<void> {
    const targetDir = '/usr/local/bin';
    const targetPath = path.join(targetDir, 'eai-security-check');

    // Check if target directory exists and is writable
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Target directory ${targetDir} does not exist`);
    }

    // Check if symlink already exists
    if (fs.existsSync(targetPath)) {
      try {
        const stats = fs.lstatSync(targetPath);
        if (stats.isSymbolicLink()) {
          const linkTarget = fs.readlinkSync(targetPath);
          if (linkTarget === executablePath) {
            console.log('✅ Symbolic link already exists and points to current executable');
            return;
          } else {
            console.log('⚠️  Existing symbolic link points to different executable, removing...');
            await execAsync(`sudo rm "${targetPath}"`);
          }
        } else {
          throw new Error(`File ${targetPath} exists but is not a symbolic link`);
        }
      } catch (statError) {
        throw new Error(`Error checking existing installation: ${statError}`);
      }
    }

    // Create symbolic link
    try {
      console.log('💡 Creating symbolic link (requires sudo)...');
      await execAsync(`sudo ln -s "${executablePath}" "${targetPath}"`);

      // Verify the link was created
      if (fs.existsSync(targetPath)) {
        const linkTarget = fs.readlinkSync(targetPath);
        if (linkTarget === executablePath) {
          console.log('✅ Symbolic link created successfully');
          console.log(`🔗 ${targetPath} -> ${executablePath}`);
        } else {
          throw new Error('Symbolic link verification failed');
        }
      } else {
        throw new Error('Symbolic link was not created');
      }
    } catch (symlinkError) {
      // Fallback: try creating without sudo (if user has write access)
      try {
        console.log('💡 Attempting to create link without sudo...');
        fs.symlinkSync(executablePath, targetPath);
        console.log('✅ Symbolic link created successfully');
        console.log(`🔗 ${targetPath} -> ${executablePath}`);
      } catch (fallbackError) {
        throw new Error(
          `Failed to create symbolic link with sudo: ${symlinkError}. Fallback also failed: ${fallbackError}`
        );
      }
    }
  }
}
