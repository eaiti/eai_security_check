import { confirm, input } from '@inquirer/prompts';
import { ConfigManager } from '../config/config-manager';

export interface InstallationResult {
  success: boolean;
  message: string;
  executablePath?: string;
  symlinkPath?: string;
  oldVersion?: string;
  newVersion?: string;
}

export interface SystemStatus {
  globalInstall: {
    exists: boolean;
    globalVersion?: string | null;
    isDifferentVersion?: boolean;
  };
  config: {
    configDirectory: string;
    reportsDirectory: string;
    securityConfigExists: boolean;
    securityConfigPath: string;
    schedulingConfigExists: boolean;
    schedulingConfigPath: string;
  };
  daemon: {
    isRunning: boolean;
    daemonVersion?: string | null;
    needsUpdate?: boolean;
  };
}

/**
 * Core installation operations shared between CLI and interactive modes
 */
export class InstallationOperations {
  /**
   * Install the application globally
   */
  static async installGlobally(): Promise<InstallationResult> {
    console.log('🌍 Installing globally...\n');

    try {
      const result = await ConfigManager.installGlobally();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Update the global installation
   */
  static async updateGlobalInstallation(): Promise<InstallationResult> {
    console.log('🔄 Updating global installation...\n');

    try {
      const result = await ConfigManager.updateApplication();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Update failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Uninstall the application globally
   */
  static async uninstallGlobally(cleanupData: boolean = false): Promise<InstallationResult> {
    console.log('🗑️  Uninstalling globally...\n');

    try {
      if (cleanupData) {
        const confirmInput = await input({
          message:
            '⚠️ This will remove ALL configuration files, reports, and logs. Type "yes" to confirm:'
        });

        if (confirmInput.toLowerCase() !== 'yes') {
          return {
            success: false,
            message: 'Uninstall cancelled by user'
          };
        }
      }

      const result = await ConfigManager.uninstallGlobally(cleanupData);
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Uninstall failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check if a global installation exists and get its status
   */
  static async checkGlobalInstallationStatus(): Promise<{
    exists: boolean;
    version?: string;
    isUpToDate?: boolean;
    path?: string;
  }> {
    try {
      const systemStatus = await ConfigManager.getSystemStatus();

      return {
        exists: systemStatus.globalInstall.exists,
        version: systemStatus.globalInstall.globalVersion || undefined,
        isUpToDate: !systemStatus.globalInstall.isDifferentVersion,
        path: systemStatus.globalInstall.exists ? '/usr/local/bin/eai-security-check' : undefined
      };
    } catch (error) {
      console.error('Error checking global installation status:', error);
      return {
        exists: false
      };
    }
  }

  /**
   * Get comprehensive system status
   */
  static async getSystemStatus(): Promise<SystemStatus> {
    try {
      return await ConfigManager.getSystemStatus();
    } catch (error) {
      console.error('Error getting system status:', error);
      throw error;
    }
  }

  /**
   * Setup global installation with user interaction
   */
  static async setupGlobalInstallation(): Promise<void> {
    const globalStatus = await this.checkGlobalInstallationStatus();

    if (globalStatus.exists) {
      if (globalStatus.isUpToDate) {
        console.log('✅ Global installation is already up to date');
        return;
      } else {
        console.log('🔄 Global installation exists but needs updating...');
        const result = await this.updateGlobalInstallation();

        if (result.success) {
          console.log('✅', result.message);
          if (result.oldVersion && result.newVersion) {
            console.log(`📦 Updated from version ${result.oldVersion} to ${result.newVersion}`);
          }
        } else {
          console.error('❌', result.message);
          throw new Error(result.message);
        }
      }
    } else {
      console.log('📦 No global installation found. Installing...');
      const result = await this.installGlobally();

      if (result.success) {
        console.log('✅', result.message);
        if (result.symlinkPath) {
          console.log(`🔗 Symlink created: ${result.symlinkPath}`);
        }
        console.log(`📂 Executable installed: ${result.executablePath}`);
      } else {
        console.error('❌', result.message);
        throw new Error(result.message);
      }
    }
  }

  /**
   * Remove global installation with user interaction
   */
  static async removeGlobalInstallation(): Promise<void> {
    console.log('🗑️  Remove Global Installation\n');

    console.log('⚠️  This will remove system-wide access to eai-security-check.');

    const cleanupData = await confirm({
      message: 'Do you also want to remove all configuration files and data?',
      default: false
    });

    const confirmRemoval = await confirm({
      message: cleanupData
        ? 'Are you sure you want to uninstall and remove ALL data?'
        : 'Are you sure you want to uninstall (keeping configuration data)?',
      default: false
    });

    if (confirmRemoval) {
      const result = await this.uninstallGlobally(cleanupData);

      if (result.success) {
        console.log('✅', result.message);
        if (!cleanupData) {
          console.log('\n💡 Configuration files and data were preserved.');
        }
      } else {
        console.error('❌', result.message);
        throw new Error(result.message);
      }
    } else {
      console.log('❌ Removal cancelled.');
    }
  }

  /**
   * Check for version updates and handle version tracking
   */
  static checkForUpdates(): {
    currentVersion: string;
    lastTrackedVersion?: string;
    isUpgrade: boolean;
    needsUpdate: boolean;
  } {
    const currentVersion = ConfigManager.getCurrentVersion();
    const isUpgrade = ConfigManager.isVersionUpgrade();
    const lastVersion = ConfigManager.getLastTrackedVersion();

    return {
      currentVersion,
      lastTrackedVersion: lastVersion || undefined,
      isUpgrade,
      needsUpdate: isUpgrade
    };
  }

  /**
   * Update version tracking
   */
  static updateVersionTracking(): void {
    ConfigManager.updateTrackedVersion();
  }

  /**
   * Get detailed system information for diagnostics
   */
  static async getDetailedSystemInfo(): Promise<{
    platform: string;
    architecture: string;
    nodeVersion: string;
    applicationVersion: string;
    executablePath: string;
    workingDirectory: string;
    globalInstallation: {
      exists: boolean;
      version?: string;
      upToDate?: boolean;
    };
    daemon: {
      configured: boolean;
      running: boolean;
      version?: string;
      upToDate?: boolean;
    };
    configuration: {
      directory: string;
      reportsDirectory: string;
      securityConfigExists: boolean;
      schedulingConfigExists: boolean;
      availableProfiles: string[];
    };
  }> {
    const os = await import('os');
    const { PlatformDetector } = await import('../utils/platform-detector');

    const systemStatus = await this.getSystemStatus();
    const platform = await PlatformDetector.detectPlatform();
    const version = ConfigManager.getCurrentVersion();

    // Get available profiles
    const availableProfiles: string[] = [];
    const profiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];
    const fs = await import('fs');
    const path = await import('path');

    for (const profile of profiles) {
      const profilePath =
        profile === 'default'
          ? systemStatus.config.securityConfigPath
          : path.join(systemStatus.config.configDirectory, `${profile}-config.json`);
      if (fs.existsSync(profilePath)) {
        availableProfiles.push(profile);
      }
    }

    return {
      platform: `${platform.platform} (${platform.version})`,
      architecture: os.arch(),
      nodeVersion: process.version,
      applicationVersion: version,
      executablePath: process.execPath,
      workingDirectory: process.cwd(),
      globalInstallation: {
        exists: systemStatus.globalInstall.exists,
        version: systemStatus.globalInstall.globalVersion || undefined,
        upToDate: !systemStatus.globalInstall.isDifferentVersion
      },
      daemon: {
        configured: systemStatus.config.schedulingConfigExists,
        running: systemStatus.daemon.isRunning,
        version: systemStatus.daemon.daemonVersion || undefined,
        upToDate: !systemStatus.daemon.needsUpdate
      },
      configuration: {
        directory: systemStatus.config.configDirectory,
        reportsDirectory: systemStatus.config.reportsDirectory,
        securityConfigExists: systemStatus.config.securityConfigExists,
        schedulingConfigExists: systemStatus.config.schedulingConfigExists,
        availableProfiles
      }
    };
  }

  /**
   * Display detailed system information
   */
  static async displayDetailedSystemInfo(): Promise<void> {
    console.log('📊 Detailed System Information\n');

    const systemInfo = await this.getDetailedSystemInfo();

    console.log('🖥️  System Information:');
    console.log(`   Platform: ${systemInfo.platform}`);
    console.log(`   Architecture: ${systemInfo.architecture}`);
    console.log(`   Node.js: ${systemInfo.nodeVersion}`);
    console.log('');

    console.log('📦 Application Information:');
    console.log(`   Version: ${systemInfo.applicationVersion}`);
    console.log(`   Executable: ${systemInfo.executablePath}`);
    console.log(`   Working Directory: ${systemInfo.workingDirectory}`);
    console.log('');

    console.log('🌍 Global Installation:');
    console.log(`   Installed: ${systemInfo.globalInstallation.exists ? 'Yes' : 'No'}`);
    if (systemInfo.globalInstallation.exists) {
      console.log(`   Version: ${systemInfo.globalInstallation.version || 'Unknown'}`);
      console.log(`   Up to date: ${systemInfo.globalInstallation.upToDate ? 'Yes' : 'No'}`);
    }
    console.log('');

    console.log('🤖 Daemon Status:');
    console.log(`   Configured: ${systemInfo.daemon.configured ? 'Yes' : 'No'}`);
    console.log(`   Running: ${systemInfo.daemon.running ? 'Yes' : 'No'}`);
    if (systemInfo.daemon.version) {
      console.log(`   Version: ${systemInfo.daemon.version}`);
      console.log(`   Up to date: ${systemInfo.daemon.upToDate ? 'Yes' : 'No'}`);
    }
    console.log('');

    console.log('🔧 Configuration:');
    console.log(`   Directory: ${systemInfo.configuration.directory}`);
    console.log(`   Reports Directory: ${systemInfo.configuration.reportsDirectory}`);
    console.log(
      `   Security Config: ${systemInfo.configuration.securityConfigExists ? 'Found' : 'Missing'}`
    );
    console.log(
      `   Scheduling Config: ${systemInfo.configuration.schedulingConfigExists ? 'Found' : 'Missing'}`
    );

    // Show available profiles
    console.log('   Available Profiles:');
    const allProfiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];
    for (const profile of allProfiles) {
      const exists = systemInfo.configuration.availableProfiles.includes(profile);
      console.log(`     ${profile}: ${exists ? '✅' : '❌'}`);
    }
    console.log('');
  }

  /**
   * Handle version update notification and tracking
   */
  static async handleVersionUpdates(): Promise<void> {
    console.log('🔍 Checking for Updates\n');

    const updateInfo = this.checkForUpdates();

    console.log(`📦 Current Version: ${updateInfo.currentVersion}`);
    console.log(`📊 Last Tracked Version: ${updateInfo.lastTrackedVersion || 'None'}`);
    console.log(`🔄 Version Upgrade: ${updateInfo.isUpgrade ? 'Yes' : 'No'}`);
    console.log('');

    if (updateInfo.isUpgrade) {
      console.log('🎉 You have upgraded to a newer version!');
      console.log('💡 Consider updating global installation and daemon if needed.');

      // Update tracked version
      this.updateVersionTracking();
      console.log('✅ Version tracking updated.');
    } else {
      console.log('✅ You are running the latest tracked version.');
      console.log('💡 For the latest releases, check: https://github.com/eaiti/eai_security_check');
    }

    console.log('');
  }
}
