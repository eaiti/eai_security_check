import { select, confirm } from '@inquirer/prompts';
import { SecurityOperations } from '../core/security-operations';
import { DaemonOperations } from '../core/daemon-operations';
import { ConfigurationOperations } from '../core/configuration-operations';
import { InstallationOperations } from '../core/installation-operations';
import { VerificationOperations } from '../core/verification-operations';
import { ConfigManager } from '../config/config-manager';

/**
 * Interactive mode handlers that use shared core operations
 */
export class InteractiveHandlers {
  /**
   * Run the full interactive management mode
   */
  static async runInteractiveMode(): Promise<void> {
    console.log('🎛️  Welcome to EAI Security Check Interactive Management!\n');

    // Ensure centralized configuration and reports directories exist on first run
    const directories = ConfigManager.ensureCentralizedDirectories();

    // Get current system status once
    const systemStatus = await ConfigManager.getSystemStatus();

    while (true) {
      // Display current status with centralized directories
      console.log('📊 Current System Status:');
      console.log(`📦 Version: ${ConfigManager.getCurrentVersion()}`);
      console.log(
        `🌍 Global Install: ${systemStatus.globalInstall.exists ? '✅ Installed' : '❌ Not installed'}`
      );
      console.log(
        `🤖 Daemon Config: ${systemStatus.config.schedulingConfigExists ? '✅ Configured' : '❌ Not configured'}`
      );
      console.log(
        `🔒 Security Config: ${systemStatus.config.securityConfigExists ? '✅ Found' : '❌ Missing'}`
      );
      console.log(`📁 Config Directory: ${directories.configDir}`);
      console.log(`📄 Reports Directory: ${directories.reportsDir}`);
      console.log('');

      try {
        const choice = await select({
          message: '🎯 What would you like to do?',
          choices: [
            {
              name: '1. Security Check - Run security audits',
              value: '1',
              description: 'Run security checks with different profiles and options'
            },
            {
              name: '2. Configuration - Manage security configurations',
              value: '2',
              description: 'Setup, view, and modify security profiles and settings'
            },
            {
              name: '3. Daemon - Automated security monitoring',
              value: '3',
              description: 'Setup and manage automated security checks and reports'
            },
            {
              name: '4. Global - System-wide installation',
              value: '4',
              description: 'Install, update, or remove global system access'
            },
            {
              name: '5. System - System information and diagnostics',
              value: '5',
              description: 'View system status, check for updates, and diagnostics'
            },
            {
              name: '6. Verify - Report integrity verification',
              value: '6',
              description: 'Verify the integrity of security reports and files'
            },
            {
              name: '7. Exit - Exit interactive mode',
              value: '7',
              description: 'Exit interactive mode'
            }
          ],
          pageSize: 10
        });

        console.log('');

        switch (choice) {
          case '1':
            await this.showSecurityCheckMenu();
            break;
          case '2':
            await this.showConfigurationMenu();
            break;
          case '3':
            await this.showDaemonMenu();
            break;
          case '4':
            await this.showGlobalMenu();
            break;
          case '5':
            await this.showSystemMenu();
            break;
          case '6':
            await this.showVerifyMenu();
            break;
          case '7':
            console.log('👋 Thank you for using EAI Security Check!');
            console.log(
              '💡 You can always return to this menu with: eai-security-check interactive'
            );
            console.log('');
            return;
          default:
            console.log('❌ Invalid choice. Please try again.');
            console.log('');
        }
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'ExitPromptError'
        ) {
          // User pressed Ctrl+C
          console.log('\n👋 Thank you for using EAI Security Check!');
          return;
        }
        console.error(`❌ Error: ${error}`);
        console.log('');
      }

      // Ask if user wants to continue
      try {
        const continueChoice = await confirm({
          message: 'Would you like to return to the main menu?',
          default: true
        });

        if (!continueChoice) {
          console.log('👋 Thank you for using EAI Security Check!');
          return;
        }
        console.log('');
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'ExitPromptError'
        ) {
          console.log('\n👋 Thank you for using EAI Security Check!');
          return;
        }
        // If any other error, just exit gracefully
        console.log('\n👋 Thank you for using EAI Security Check!');
        return;
      }
    }
  }

  /**
   * Security Check submenu
   */
  static async showSecurityCheckMenu(): Promise<void> {
    while (true) {
      console.log('🔍 Security Check Menu\n');

      const choice = await select({
        message: 'Choose a security check option:',
        choices: [
          {
            name: '1. Interactive Security Check - Select profile and options',
            value: '1',
            description: 'Run a security audit with interactive profile selection'
          },
          {
            name: '2. Quick Security Check - Use default profile',
            value: '2',
            description: 'Run a quick security audit with default settings'
          },
          {
            name: '3. Back to Main Menu',
            value: 'back',
            description: 'Return to the main menu'
          }
        ]
      });

      console.log('');

      switch (choice) {
        case '1':
          await SecurityOperations.runInteractiveSecurityCheck();
          break;
        case '2':
          await SecurityOperations.runQuickSecurityCheck();
          break;
        case 'back':
          return;
      }

      const continueChoice = await confirm({
        message: 'Would you like to return to the Security Check menu?',
        default: true
      });

      if (!continueChoice) {
        return;
      }
      console.log('');
    }
  }

  /**
   * Configuration submenu
   */
  static async showConfigurationMenu(): Promise<void> {
    while (true) {
      console.log('🔧 Configuration Menu\n');

      const choice = await select({
        message: 'Choose a configuration option:',
        choices: [
          {
            name: '1. Setup/Modify Security Configurations',
            value: '1',
            description: 'Create or modify security profiles and settings'
          },
          {
            name: '2. View Configuration Status',
            value: '2',
            description: 'View current configuration status and available profiles'
          },
          {
            name: '3. Reset All Configurations',
            value: '3',
            description: 'Reset all configurations to default'
          },
          {
            name: '4. Back to Main Menu',
            value: 'back',
            description: 'Return to the main menu'
          }
        ]
      });

      console.log('');

      switch (choice) {
        case '1':
          await ConfigurationOperations.setupOrModifyConfigurations();
          break;
        case '2':
          await ConfigurationOperations.viewConfigurationStatus();
          break;
        case '3':
          await ConfigurationOperations.resetAllConfigurations();
          break;
        case 'back':
          return;
      }

      const continueChoice = await confirm({
        message: 'Would you like to return to the Configuration menu?',
        default: true
      });

      if (!continueChoice) {
        return;
      }
      console.log('');
    }
  }

  /**
   * Daemon submenu
   */
  static async showDaemonMenu(): Promise<void> {
    while (true) {
      console.log('🤖 Daemon Menu\n');

      const choice = await select({
        message: 'Choose a daemon option:',
        choices: [
          {
            name: '1. Setup Daemon Automation',
            value: '1',
            description: 'Setup automated security checks and email reports'
          },
          {
            name: '2. Start/Stop/Restart Daemon',
            value: '2',
            description: 'Manage daemon service status'
          },
          {
            name: '3. View Daemon Status',
            value: '3',
            description: 'Check current daemon status and configuration'
          },
          {
            name: '4. Remove Daemon Configuration',
            value: '4',
            description: 'Remove daemon automation and configuration'
          },
          {
            name: '5. Back to Main Menu',
            value: 'back',
            description: 'Return to the main menu'
          }
        ]
      });

      console.log('');

      switch (choice) {
        case '1':
          await DaemonOperations.setupDaemonAutomation();
          break;
        case '2':
          await this.manageDaemonService();
          break;
        case '3':
          await this.viewDaemonStatus();
          break;
        case '4':
          await DaemonOperations.manageDaemonService({ action: 'remove' });
          break;
        case 'back':
          return;
      }

      const continueChoice = await confirm({
        message: 'Would you like to return to the Daemon menu?',
        default: true
      });

      if (!continueChoice) {
        return;
      }
      console.log('');
    }
  }

  /**
   * Global submenu
   */
  static async showGlobalMenu(): Promise<void> {
    while (true) {
      console.log('🌍 Global Installation Menu\n');

      const choice = await select({
        message: 'Choose a global installation option:',
        choices: [
          {
            name: '1. Install Globally (system-wide access)',
            value: '1',
            description: 'Install for system-wide access via command line'
          },
          {
            name: '2. Update Global Installation',
            value: '2',
            description: 'Update existing global installation to current version'
          },
          {
            name: '3. Remove Global Installation',
            value: '3',
            description: 'Remove system-wide access'
          },
          {
            name: '4. Back to Main Menu',
            value: 'back',
            description: 'Return to the main menu'
          }
        ]
      });

      console.log('');

      switch (choice) {
        case '1':
          await this.installGlobally();
          break;
        case '2':
          await this.updateGlobalInstallation();
          break;
        case '3':
          await this.removeGlobalInstallation();
          break;
        case 'back':
          return;
      }

      const continueChoice = await confirm({
        message: 'Would you like to return to the Global Installation menu?',
        default: true
      });

      if (!continueChoice) {
        return;
      }
      console.log('');
    }
  }

  /**
   * System submenu
   */
  static async showSystemMenu(): Promise<void> {
    while (true) {
      console.log('📊 System Menu\n');

      const choice = await select({
        message: 'Choose a system option:',
        choices: [
          {
            name: '1. View Detailed System Information',
            value: '1',
            description: 'Show comprehensive system and application information'
          },
          {
            name: '2. Check for Version Updates',
            value: '2',
            description: 'Check version status and update tracking'
          },
          {
            name: '3. Back to Main Menu',
            value: 'back',
            description: 'Return to the main menu'
          }
        ]
      });

      console.log('');

      switch (choice) {
        case '1':
          await InstallationOperations.displayDetailedSystemInfo();
          break;
        case '2':
          await InstallationOperations.handleVersionUpdates();
          break;
        case 'back':
          return;
      }

      const continueChoice = await confirm({
        message: 'Would you like to return to the System menu?',
        default: true
      });

      if (!continueChoice) {
        return;
      }
      console.log('');
    }
  }

  /**
   * Verify submenu
   */
  static async showVerifyMenu(): Promise<void> {
    while (true) {
      console.log('🔍 Verify Menu\n');

      const choice = await select({
        message: 'Choose a verification option:',
        choices: [
          {
            name: '1. Verify Local Reports',
            value: '1',
            description: 'Verify the integrity of locally saved security reports'
          },
          {
            name: '2. Verify Specific File',
            value: '2',
            description: 'Verify the integrity of a specific report file'
          },
          {
            name: '3. Verify Directory',
            value: '3',
            description: 'Verify all reports in a specific directory'
          },
          {
            name: '4. Back to Main Menu',
            value: 'back',
            description: 'Return to the main menu'
          }
        ]
      });

      console.log('');

      switch (choice) {
        case '1':
          await VerificationOperations.verifyLocalReports();
          break;
        case '2':
          await VerificationOperations.verifySpecificFile();
          break;
        case '3':
          await VerificationOperations.verifyDirectoryInteractive();
          break;
        case 'back':
          return;
      }

      const continueChoice = await confirm({
        message: 'Would you like to return to the Verify menu?',
        default: true
      });

      if (!continueChoice) {
        return;
      }
      console.log('');
    }
  }

  /**
   * Manage daemon service (start/stop/restart)
   */
  private static async manageDaemonService(): Promise<void> {
    console.log('🤖 Daemon Service Management\n');

    if (!ConfigManager.hasSchedulingConfig()) {
      console.log('❌ No daemon configuration found. Please set up daemon automation first.');
      return;
    }

    const choice = await select({
      message: 'What would you like to do with the daemon?',
      choices: [
        {
          name: 'Start daemon (run once)',
          value: '1',
          description: 'Start the daemon for this session only'
        },
        {
          name: 'Stop daemon',
          value: '2',
          description: 'Stop the currently running daemon'
        },
        {
          name: 'Restart daemon',
          value: '3',
          description: 'Stop and restart the daemon'
        },
        {
          name: 'View daemon logs',
          value: '4',
          description: 'Show recent daemon activity and logs'
        },
        {
          name: 'Go back',
          value: '5',
          description: 'Return to daemon menu'
        }
      ]
    });

    switch (choice) {
      case '1':
        console.log('');
        console.log('🚀 Starting daemon in current session...');
        console.log('💡 This will run until you stop it or close the terminal.');
        console.log('💡 For automatic startup, use the Setup Daemon Automation option.');
        console.log('');
        await DaemonOperations.manageDaemonService({ action: 'start' });
        break;
      case '2':
        await DaemonOperations.manageDaemonService({ action: 'stop' });
        break;
      case '3':
        await DaemonOperations.manageDaemonService({ action: 'restart' });
        break;
      case '4':
        await this.showDaemonLogs();
        break;
      case '5':
        return;
      default:
        console.log('❌ Invalid choice.');
    }
  }

  /**
   * View daemon status
   */
  private static async viewDaemonStatus(): Promise<void> {
    console.log('🤖 Daemon Status Report\n');

    await DaemonOperations.manageDaemonService({ action: 'status' });
  }

  /**
   * Show daemon logs (placeholder - this would need to be implemented in DaemonOperations)
   */
  private static async showDaemonLogs(): Promise<void> {
    console.log('📄 Daemon Logs\n');
    console.log('💡 Daemon log viewing functionality would be implemented here.');
    console.log('For now, check platform-specific log locations:');
    console.log('  macOS: ~/Library/Logs/eai-security-check.log');
    console.log('  Linux: journalctl --user -u eai-security-check-daemon');
  }

  /**
   * Install globally
   */
  private static async installGlobally(): Promise<void> {
    console.log('🌍 Global Installation\n');

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
    }
  }

  /**
   * Update global installation
   */
  private static async updateGlobalInstallation(): Promise<void> {
    console.log('🔄 Update Global Installation\n');

    const result = await InstallationOperations.updateGlobalInstallation();

    if (result.success) {
      console.log('✅', result.message);
      if (result.oldVersion && result.newVersion) {
        console.log(`📦 Updated from version ${result.oldVersion} to ${result.newVersion}`);
      }
      console.log('\n🔄 Please restart any running daemon services.');
    } else {
      console.error('❌', result.message);
    }
  }

  /**
   * Remove global installation
   */
  private static async removeGlobalInstallation(): Promise<void> {
    await InstallationOperations.removeGlobalInstallation();
  }
}
