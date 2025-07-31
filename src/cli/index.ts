#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { select, confirm, input } from '@inquirer/prompts';
import { SecurityAuditor } from '../services/auditor';
import { SecurityConfig } from '../types';
import { OutputUtils, OutputFormat } from '../utils/output-utils';
import { CryptoUtils } from '../utils/crypto-utils';
import { PlatformDetector, Platform } from '../utils/platform-detector';
import { SchedulingService } from '../services/scheduling-service';
import { isValidProfile, VALID_PROFILES } from '../config/config-profiles';
import { ConfigManager } from '../config/config-manager';

/**
 * Gets configuration by profile name from centralized config files
 */
function getConfigForProfile(profile: string): SecurityConfig | null {
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
 * Prompt user if they want to attempt automatic service setup
 */
async function promptForAutoServiceSetup(platform: string): Promise<boolean> {
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

  return await confirm({
    message: 'Would you like me to attempt automatic service setup?',
    default: false
  });
}

/**
 * Attempt automatic service setup where possible
 */
async function attemptAutoServiceSetup(serviceSetup: {
  templatesCopied: string[];
  instructions: string[];
  platform: string;
}): Promise<void> {
  const { configDir } = ConfigManager.ensureCentralizedDirectories();
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

/**
 * Run the full interactive management mode
 */
async function runInteractiveMode(): Promise<void> {
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
          await showSecurityCheckMenu();
          break;
        case '2':
          await showConfigurationMenu();
          break;
        case '3':
          await showDaemonMenu();
          break;
        case '4':
          await showGlobalMenu();
          break;
        case '5':
          await showSystemMenu();
          break;
        case '6':
          await showVerifyMenu();
          break;
        case '7':
          console.log('👋 Thank you for using EAI Security Check!');
          console.log('💡 You can always return to this menu with: eai-security-check interactive');
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
async function showSecurityCheckMenu(): Promise<void> {
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
        await runInteractiveSecurityCheck();
        break;
      case '2':
        await runQuickSecurityCheck();
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
async function showConfigurationMenu(): Promise<void> {
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
        await setupOrModifyConfigurations();
        break;
      case '2':
        await viewConfigurationStatus();
        break;
      case '3':
        await resetAllConfigurations();
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
async function showDaemonMenu(): Promise<void> {
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
        await setupDaemonAutomation();
        break;
      case '2':
        await manageDaemonService();
        break;
      case '3':
        await viewDaemonStatus();
        break;
      case '4':
        await removeDaemonConfiguration();
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
async function showGlobalMenu(): Promise<void> {
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
        await installGlobally();
        break;
      case '2':
        await updateGlobalInstallation();
        break;
      case '3':
        await removeGlobalInstallation();
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
async function showSystemMenu(): Promise<void> {
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
        await viewDetailedSystemInfo();
        break;
      case '2':
        await checkForUpdates();
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
async function showVerifyMenu(): Promise<void> {
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
        await verifyLocalReports();
        break;
      case '2':
        await verifySpecificFile();
        break;
      case '3':
        await verifyDirectory();
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
 * Interactive security check with profile selection
 */
async function runInteractiveSecurityCheck(): Promise<void> {
  console.log('🔍 Security Check - Profile Selection\n');

  const profile = await ConfigManager.promptForSecurityProfile();
  console.log(`\n🚀 Running security check with '${profile}' profile...\n`);

  // Run the security check
  const config = getConfigForProfile(profile);
  if (!config) {
    throw new Error(`Could not load configuration for profile: ${profile}`);
  }

  const auditor = new SecurityAuditor();
  const report = await auditor.generateReport(config);

  // Display results
  console.log(report);
}

/**
 * Quick security check with default profile
 */
async function runQuickSecurityCheck(): Promise<void> {
  console.log('🚀 Running quick security check with default profile...\n');

  const config = getConfigForProfile('default');
  if (!config) {
    throw new Error('Could not load default configuration');
  }

  const auditor = new SecurityAuditor();
  const report = await auditor.generateReport(config);

  // Display results
  console.log(report);

  // Save report to file
  try {
    const { reportsDir } = ConfigManager.ensureCentralizedDirectories();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `security-check-${timestamp}.txt`;
    const filePath = path.join(reportsDir, filename);

    fs.writeFileSync(filePath, report, 'utf-8');
    console.log(`\n📄 Report saved to: ${filePath}`);
  } catch (error) {
    console.warn(
      `⚠️  Could not save report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Setup or modify security configurations
 */
async function setupOrModifyConfigurations(): Promise<void> {
  console.log('🔧 Security Configuration Management\n');

  if (!ConfigManager.hasSecurityConfig()) {
    console.log('📝 No security configuration found. Setting up for first time...\n');

    const profile = await ConfigManager.promptForSecurityProfile();
    ConfigManager.createAllSecurityConfigs(false, profile);

    console.log('✅ Security configurations created successfully!');
  } else {
    console.log('🔧 Security configuration exists. What would you like to do?\n');

    const choice = await select({
      message: 'Choose an option:',
      choices: [
        { name: 'View current configuration', value: '1' },
        { name: 'Change default profile', value: '2' },
        { name: 'Recreate all configurations', value: '3' },
        { name: 'Go back', value: '4' }
      ]
    });

    switch (choice) {
      case '1': {
        const config = ConfigManager.loadSecurityConfig();
        console.log('\n📋 Current Security Configuration:');
        console.log(JSON.stringify(config, null, 2));
        break;
      }
      case '2': {
        const profile = await ConfigManager.promptForSecurityProfile();
        const force = await ConfigManager.promptForForceOverwrite();
        ConfigManager.createAllSecurityConfigs(force, profile);
        console.log(`✅ Security configurations updated to '${profile}' profile!`);
        break;
      }
      case '3': {
        const profile = await ConfigManager.promptForSecurityProfile();
        ConfigManager.createAllSecurityConfigs(true, profile);
        console.log('✅ All security configurations recreated!');
        break;
      }
      case '4':
        return;
      default:
        console.log('❌ Invalid choice.');
    }
  }
}

/**
 * View configuration status
 */
async function viewConfigurationStatus(): Promise<void> {
  console.log('📊 Configuration Status Report\n');

  const status = ConfigManager.getConfigStatus();

  console.log(`📁 Configuration Directory: ${status.configDirectory}`);
  console.log(`🔒 Security Config: ${status.securityConfigExists ? '✅ Found' : '❌ Missing'}`);
  if (status.securityConfigExists) {
    console.log(`   Location: ${status.securityConfigPath}`);
  }

  console.log(`🤖 Daemon Config: ${status.schedulingConfigExists ? '✅ Found' : '❌ Missing'}`);
  if (status.schedulingConfigExists) {
    console.log(`   Location: ${status.schedulingConfigPath}`);
  }

  // Show available profiles
  console.log('\n📋 Available Security Profiles:');
  const profiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];
  for (const profile of profiles) {
    const profilePath =
      profile === 'default'
        ? status.securityConfigPath
        : path.join(status.configDirectory, `${profile}-config.json`);
    const exists = fs.existsSync(profilePath);
    console.log(`   ${profile}: ${exists ? '✅' : '❌'}`);
  }

  console.log('');
}

/**
 * Reset all configurations
 */
async function resetAllConfigurations(): Promise<void> {
  console.log('🔄 Reset All Configurations\n');

  if (await ConfigManager.promptForConfigReset()) {
    ConfigManager.resetAllConfigurations();
    console.log('✅ All configurations have been reset!');
    console.log('💡 You can now set up fresh configurations if needed.');
  } else {
    console.log('❌ Reset cancelled.');
  }
}

/**
 * Setup daemon automation
 */
async function setupDaemonAutomation(): Promise<void> {
  console.log('🤖 Daemon Automation Setup\n');

  if (ConfigManager.hasSchedulingConfig()) {
    console.log('⚠️  Daemon configuration already exists.');

    const reconfigure = await confirm({
      message: 'Do you want to reconfigure it?',
      default: false
    });

    if (!reconfigure) {
      console.log('❌ Daemon setup cancelled.');
      return;
    }
  }

  // Ensure security config exists first
  if (!ConfigManager.hasSecurityConfig()) {
    console.log('📝 Setting up security configuration first...\n');
    const profile = await ConfigManager.promptForSecurityProfile();
    ConfigManager.createAllSecurityConfigs(false, profile);
  }

  // Setup daemon configuration
  await ConfigManager.createSchedulingConfigInteractive('default');

  // Ask if user wants to setup system service
  const setupService = await ConfigManager.promptForDaemonSetup();
  if (setupService) {
    // Check for compatible global installation first
    console.log('\n🔍 Checking global installation compatibility...');
    const globalCheck = await checkGlobalInstallationCompatibility();
    console.log(`💡 ${globalCheck.message}`);

    if (!globalCheck.compatible) {
      console.log('');
      if (!globalCheck.exists) {
        console.log('⚠️  Daemon setup requires a global installation because:');
        console.log('   • System services (LaunchAgent/systemd) need a fixed executable path');
        console.log('   • The global installation provides a stable command: eai-security-check');
        console.log('   • This ensures the daemon works reliably across system restarts');
        console.log('');

        const installGlobal = await confirm({
          message: 'Would you like to install globally now?',
          default: true
        });

        if (installGlobal) {
          await ConfigManager.setupGlobalInstallation();
          console.log('✅ Global installation completed!');
          console.log('');
        } else {
          console.log('❌ Daemon service setup cancelled. Global installation is required.');
          console.log('💡 You can still run the daemon manually without service setup.');
          return;
        }
      } else {
        console.log('⚠️  Version mismatch detected:');
        console.log(`   • Current version: ${ConfigManager.getCurrentVersion()}`);
        console.log(`   • Global version: ${globalCheck.version}`);
        console.log('');

        const updateGlobal = await confirm({
          message: 'Would you like to update the global installation now?',
          default: true
        });

        if (updateGlobal) {
          await ConfigManager.setupGlobalInstallation();
          console.log('✅ Global installation updated!');
          console.log('');
        } else {
          console.log('❌ Daemon service setup cancelled. Version compatibility is required.');
          console.log('💡 You can still run the daemon manually without service setup.');
          return;
        }
      }
    } else {
      console.log('✅ Global installation is compatible!');
      console.log('');
    }

    const platform = os.platform();

    if (platform === 'darwin') {
      // macOS: Set up LaunchAgent directly
      console.log('🍎 macOS LaunchAgent Setup:');
      console.log('   Setting up automatic startup on login...');
      console.log('');

      try {
        await setupMacOSLaunchAgent();
        console.log('✅ LaunchAgent setup completed!');
        console.log('💡 The daemon will now start automatically when you log in.');
      } catch (error) {
        console.error(`❌ LaunchAgent setup failed: ${error}`);
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('   1. Check if you have permission to write to ~/Library/LaunchAgents/');
        console.log(
          '   2. Make sure the daemon configuration exists (set up via interactive mode)'
        );
        console.log('   3. Check the error message above for specific details');
        console.log('');
      }
    } else {
      // Other platforms: Show manual setup instructions
      const serviceSetup = ConfigManager.copyDaemonServiceTemplates();

      console.log('\n🎯 Service Setup Instructions:');
      serviceSetup.instructions.forEach(instruction => console.log(instruction));

      if (serviceSetup.templatesCopied.length > 0) {
        console.log(`\n📁 Template files copied: ${serviceSetup.templatesCopied.join(', ')}`);
      }

      // Ask if user wants to attempt automatic setup
      if (await promptForAutoServiceSetup(serviceSetup.platform)) {
        await attemptAutoServiceSetup(serviceSetup);
      }
    }
  }

  console.log('\n✅ Daemon automation setup complete!');
}

/**
 * Check if a compatible global installation exists
 */
async function checkGlobalInstallationCompatibility(): Promise<{
  exists: boolean;
  version?: string;
  compatible: boolean;
  message: string;
}> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const currentVersion = ConfigManager.getCurrentVersion();

  try {
    // Check if global eai-security-check exists and get its version
    const { stdout } = await execAsync('eai-security-check --version 2>/dev/null');
    const globalVersion = stdout.trim();

    if (globalVersion === currentVersion) {
      return {
        exists: true,
        version: globalVersion,
        compatible: true,
        message: `Global installation exists with matching version ${globalVersion}`
      };
    } else {
      return {
        exists: true,
        version: globalVersion,
        compatible: false,
        message: `Global installation exists but version mismatch (global: ${globalVersion}, current: ${currentVersion})`
      };
    }
  } catch {
    return {
      exists: false,
      compatible: false,
      message:
        'No global installation found. The daemon requires a global installation to work properly.'
    };
  }
}

/**
 * Get the correct log file paths - centralized alongside executable
 */
function getLogPaths() {
  // Get the directory where the actual executable is located (resolve symlinks)
  let executablePath = process.execPath;

  try {
    // Resolve symlinks to get the actual executable path
    const stats = fs.lstatSync(executablePath);
    if (stats && stats.isSymbolicLink()) {
      executablePath = fs.readlinkSync(executablePath);
      // If it's a relative symlink, resolve it relative to the symlink directory
      if (!path.isAbsolute(executablePath)) {
        executablePath = path.resolve(path.dirname(process.execPath), executablePath);
      }
    }
  } catch (_error) {
    // If we can't resolve the symlink, use the original path
    console.warn('Warning: Could not resolve symlink for executable path:', _error);
  }

  const executableDir = path.dirname(executablePath);
  const logsDir = path.join(executableDir, 'logs');

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  return {
    output: path.join(logsDir, 'eai-security-check.log'),
    error: path.join(logsDir, 'eai-security-check.error.log'),
    logsDir
  };
}

/**
 * Setup macOS LaunchAgent for daemon automation
 */
async function setupMacOSLaunchAgent(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // Use the global executable path since that's what the daemon service should use
  const globalExecutable = 'eai-security-check'; // This will resolve to the global installation

  // Create LaunchAgents directory
  const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  const plistPath = path.join(launchAgentsDir, 'com.eai.security-check.daemon.plist');

  if (!fs.existsSync(launchAgentsDir)) {
    fs.mkdirSync(launchAgentsDir, { recursive: true });
    console.log('✅ Created LaunchAgents directory');
  }

  // Stop existing service if running
  try {
    const { stdout } = await execAsync('launchctl list | grep com.eai.security-check.daemon');
    if (stdout.trim()) {
      console.log('🛑 Stopping existing daemon service...');
      await execAsync('launchctl stop com.eai.security-check.daemon').catch(() => {});
      await execAsync(`launchctl unload "${plistPath}"`).catch(() => {});
    }
  } catch {
    // No existing service, that's fine
  }

  // Create plist content
  const logPaths = getLogPaths();
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.eai.security-check.daemon</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/${globalExecutable}</string>
        <string>daemon</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/usr/local/bin</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>${logPaths.output}</string>
    
    <key>StandardErrorPath</key>
    <string>${logPaths.error}</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>`;

  // Write plist file
  fs.writeFileSync(plistPath, plistContent);
  console.log(`✅ Created plist file: ${plistPath}`);

  // Load the service
  console.log('🔄 Loading LaunchAgent...');
  await execAsync(`launchctl load "${plistPath}"`);
  console.log('✅ LaunchAgent loaded successfully!');

  // Start the service
  console.log('🚀 Starting daemon service...');
  try {
    await execAsync('launchctl start com.eai.security-check.daemon');
    console.log('✅ Daemon service started!');
  } catch {
    console.log('⚠️  Service loaded but may have failed to start');
    console.log('💡 Check status with: launchctl list com.eai.security-check.daemon');
  }

  console.log('');
  console.log('🎉 Setup complete! The daemon will:');
  console.log('   ✅ Start automatically when you log in');
  console.log('   ✅ Restart automatically if it crashes');
  console.log('   ✅ Run security checks according to your schedule');
}

/**
 * Manage daemon service (start/stop/restart)
 */
async function manageDaemonService(): Promise<void> {
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
      await ConfigManager.manageDaemon('start');
      break;
    case '2':
      await ConfigManager.manageDaemon('stop');
      break;
    case '3':
      await ConfigManager.manageDaemon('restart');
      break;
    case '4':
      await showDaemonLogs();
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
async function viewDaemonStatus(): Promise<void> {
  console.log('🤖 Daemon Status Report\n');

  const platform = os.platform();
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // Check configuration first
  const hasConfig = ConfigManager.hasSchedulingConfig();
  console.log('📋 Configuration Status:');
  console.log(`   Daemon Config: ${hasConfig ? '✅ Found' : '❌ Missing'}`);

  if (hasConfig) {
    const configPath = ConfigManager.getSchedulingConfigPath();
    console.log(`   Config Path: ${configPath}`);

    // Get basic daemon status from config manager
    await ConfigManager.manageDaemon('status');
  } else {
    console.log('   💡 Run "eai-security-check interactive" → Daemon → Setup to configure\n');
    return;
  }

  console.log('');

  // Check system service status
  console.log('🔧 System Service Status:');

  try {
    if (platform === 'darwin') {
      // macOS LaunchAgent status
      console.log('   Platform: macOS (LaunchAgent)');

      try {
        const { stdout } = await execAsync('launchctl list | grep com.eai.security-check');
        if (stdout.trim()) {
          console.log('   LaunchAgent: ✅ Loaded and running');

          // Get detailed status
          try {
            const { stdout: details } = await execAsync(
              'launchctl list com.eai.security-check.daemon'
            );
            const lines = details.trim().split('\n');
            for (const line of lines) {
              if (
                line.includes('PID') ||
                line.includes('LastExitStatus') ||
                line.includes('Label')
              ) {
                console.log(`   ${line.trim()}`);
              }
            }
          } catch {
            // Detailed status not available
          }
        } else {
          console.log('   LaunchAgent: ❌ Not loaded');
        }
      } catch {
        console.log('   LaunchAgent: ❌ Not loaded');
      }

      // Check for plist file
      const plistPath = path.join(
        os.homedir(),
        'Library',
        'LaunchAgents',
        'com.eai.security-check.daemon.plist'
      );
      console.log(`   Plist File: ${fs.existsSync(plistPath) ? '✅ Installed' : '❌ Missing'}`);
      if (fs.existsSync(plistPath)) {
        console.log(`   Plist Path: ${plistPath}`);
      }
    } else if (platform === 'linux') {
      // Linux systemd status
      console.log('   Platform: Linux (systemd)');

      try {
        const { stdout } = await execAsync(
          'systemctl --user is-active eai-security-check-daemon 2>/dev/null'
        );
        const isActive = stdout.trim() === 'active';
        console.log(`   Service: ${isActive ? '✅ Active' : '❌ Inactive'}`);
      } catch {
        console.log('   Service: ❌ Not found');
      }

      try {
        const { stdout } = await execAsync(
          'systemctl --user is-enabled eai-security-check-daemon 2>/dev/null'
        );
        const isEnabled = stdout.trim() === 'enabled';
        console.log(`   Auto-start: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`);
      } catch {
        console.log('   Auto-start: ❌ Not configured');
      }

      // Check for service file
      const servicePath = path.join(
        os.homedir(),
        '.config',
        'systemd',
        'user',
        'eai-security-check-daemon.service'
      );
      console.log(`   Service File: ${fs.existsSync(servicePath) ? '✅ Installed' : '❌ Missing'}`);
      if (fs.existsSync(servicePath)) {
        console.log(`   Service Path: ${servicePath}`);
      }
    } else {
      console.log(`   Platform: ${platform} (manual process management)`);
      console.log('   Auto-start: ⚠️  Manual setup required');
    }
  } catch (error) {
    console.log(`   ❌ Error checking service status: ${error}`);
  }

  console.log('');

  // Check for running daemon processes
  console.log('🔍 Process Status:');
  try {
    const { stdout } = await execAsync('ps aux | grep "eai-security-check.*daemon" | grep -v grep');
    if (stdout.trim()) {
      console.log('   Running Processes: ✅ Found');
      const processes = stdout.trim().split('\n');
      processes.forEach((process, index) => {
        const parts = process.trim().split(/\s+/);
        const pid = parts[1];
        const cpu = parts[2];
        const mem = parts[3];
        console.log(`   Process ${index + 1}: PID ${pid}, CPU ${cpu}%, Memory ${mem}%`);
      });
    } else {
      console.log('   Running Processes: ❌ None found');
    }
  } catch {
    console.log('   Running Processes: ❌ None found');
  }

  console.log('');

  // Log file information
  console.log('📄 Log Information:');
  const logPaths = getLogPaths();
  const logFiles = [
    { path: logPaths.output, type: 'Output' },
    { path: logPaths.error, type: 'Error' }
  ];

  for (const logFile of logFiles) {
    if (fs.existsSync(logFile.path)) {
      const stats = fs.statSync(logFile.path);
      console.log(`   ${logFile.type} Log: ✅ ${logFile.path}`);
      console.log(
        `   Size: ${(stats.size / 1024).toFixed(1)} KB, Modified: ${stats.mtime.toLocaleString()}`
      );
    } else {
      console.log(`   ${logFile.type} Log: ❌ ${logFile.path} (not found)`);
    }
  }

  console.log('');

  // Quick commands
  console.log('💡 Quick Commands:');
  if (platform === 'darwin') {
    const logPaths = getLogPaths();
    console.log('   View Logs: Use menu option "View daemon logs" or:');
    console.log(`   • tail -20 "${logPaths.output}"`);
    console.log(`   • tail -20 "${logPaths.error}"`);
    console.log('   ');
    console.log('   Service Control:');
    console.log('   • launchctl start com.eai.security-check.daemon');
    console.log('   • launchctl stop com.eai.security-check.daemon');
    console.log('   • launchctl list com.eai.security-check.daemon');
  } else if (platform === 'linux') {
    console.log('   View Logs:');
    console.log('   • journalctl --user -u eai-security-check-daemon -f  (follow live)');
    console.log('   • journalctl --user -u eai-security-check-daemon --since "1 hour ago"');
    console.log('   ');
    console.log('   Service Control:');
    console.log('   • systemctl --user start eai-security-check-daemon');
    console.log('   • systemctl --user stop eai-security-check-daemon');
    console.log('   • systemctl --user status eai-security-check-daemon');
  } else {
    console.log('   Use interactive menu for daemon management on this platform');
  }
}

/**
 * Show daemon logs
 */
async function showDaemonLogs(): Promise<void> {
  console.log('📄 Daemon Logs\n');

  const platform = os.platform();
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    if (platform === 'darwin') {
      console.log('📋 macOS LaunchAgent Logs:\n');

      // Check if LaunchAgent is loaded
      let launchAgentStatus = false;
      try {
        const { stdout: listOutput } = await execAsync(
          'launchctl list com.eai.security-check.daemon'
        );
        console.log('🔍 LaunchAgent Status:');
        console.log(listOutput);
        launchAgentStatus = true;
        console.log('');
      } catch {
        console.log('⚠️  LaunchAgent not loaded or not running');
        console.log('💡 To set up LaunchAgent, use interactive mode → Daemon → Start/Stop/Restart');
        console.log('');
      }

      // Show log files
      const logPaths = getLogPaths();
      const logFiles = [logPaths.output, logPaths.error];
      let foundAnyLogs = false;

      for (const logFile of logFiles) {
        const logType = logFile.includes('error') ? 'Error' : 'Output';
        console.log(`📄 ${logType} Log (${logFile}):`);

        try {
          if (fs.existsSync(logFile)) {
            const stats = fs.statSync(logFile);
            console.log(
              `   File size: ${(stats.size / 1024).toFixed(1)} KB, Modified: ${stats.mtime.toLocaleString()}`
            );

            const { stdout } = await execAsync(
              `tail -20 "${logFile}" 2>/dev/null || echo "Log file is empty"`
            );
            if (stdout.trim()) {
              console.log('   Recent entries:');
              console.log(
                stdout
                  .split('\n')
                  .map(line => `   ${line}`)
                  .join('\n')
              );
              foundAnyLogs = true;
            } else {
              console.log('   Log file is empty');
            }
          } else {
            console.log('   ❌ Log file not found');
            console.log('   💡 This is normal if the LaunchAgent has never been started');
          }
        } catch (error) {
          console.log(`   ❌ Error reading log: ${error}`);
        }
        console.log('');
      }

      if (!foundAnyLogs && !launchAgentStatus) {
        console.log('💡 No logs found. This could mean:');
        console.log('   • The daemon is running as a manual process (not via LaunchAgent)');
        console.log('   • The LaunchAgent has never been started');
        console.log('   • The daemon is configured to log elsewhere');
        console.log('');
        console.log('🔧 To check for manual daemon processes:');
        console.log('   ps aux | grep "eai-security-check.*daemon" | grep -v grep');
        console.log('');
      }
    } else if (platform === 'linux') {
      console.log('📋 Linux systemd Logs:\n');

      // Check service status first
      try {
        const { stdout: statusOutput } = await execAsync(
          'systemctl --user status eai-security-check-daemon --no-pager -l'
        );
        console.log('🔍 Service Status:');
        console.log(statusOutput);
        console.log('');
      } catch {
        console.log('⚠️  Service not found or not running');
        console.log('💡 Set up with: systemctl --user enable eai-security-check-daemon');
        console.log('');
      }

      // Show recent logs
      try {
        const { stdout: logsOutput } = await execAsync(
          'journalctl --user -u eai-security-check-daemon --since "24 hours ago" --no-pager'
        );
        if (logsOutput.trim()) {
          console.log('� Recent Logs (last 24 hours):');
          console.log(logsOutput);
        } else {
          console.log('📄 No recent logs found');
          console.log(
            '💡 Try: journalctl --user -u eai-security-check-daemon --since "1 week ago"'
          );
        }
      } catch (error) {
        console.log(`❌ Error reading logs: ${error}`);
        console.log('💡 Manual command: journalctl --user -u eai-security-check-daemon');
      }
    } else {
      console.log(`📋 Platform: ${platform}\n`);
      console.log('⚠️  Platform-specific log viewing not implemented for this OS');
      console.log('');

      // Try to find daemon process
      try {
        const { stdout } = await execAsync(
          'ps aux | grep "eai-security-check.*daemon" | grep -v grep'
        );
        if (stdout.trim()) {
          console.log('🔍 Running daemon processes:');
          console.log(stdout);
        } else {
          console.log('❌ No daemon processes found');
        }
      } catch {
        console.log('❌ No daemon processes found');
      }
    }

    console.log('💡 Additional Log Commands:');
    if (platform === 'darwin') {
      const logPaths = getLogPaths();
      console.log(`   Follow live logs: tail -f "${logPaths.output}"`);
      console.log(`   Error logs only: tail -f "${logPaths.error}"`);
      console.log(`   Last 50 lines: tail -50 "${logPaths.output}"`);
    } else if (platform === 'linux') {
      console.log('   Follow live logs: journalctl --user -u eai-security-check-daemon -f');
      console.log(
        '   Last hour: journalctl --user -u eai-security-check-daemon --since "1 hour ago"'
      );
      console.log('   Error logs only: journalctl --user -u eai-security-check-daemon -p err');
    } else {
      console.log('   Check running processes: ps aux | grep eai-security-check');
      console.log('   Check system logs for application output');
    }
  } catch (error) {
    console.error(`❌ Error accessing logs: ${error}`);
    console.log('💡 Try running the commands manually for more specific error information');
  }
}

/**
 * Remove daemon configuration
 */
async function removeDaemonConfiguration(): Promise<void> {
  console.log('🗑️  Remove Daemon Configuration\n');

  if (!ConfigManager.hasSchedulingConfig()) {
    console.log('ℹ️  No daemon configuration found.');
    return;
  }

  console.log('⚠️  This will remove all daemon configuration and stop the service.');
  const confirmRemoval = await confirm({
    message: 'Are you sure?',
    default: false
  });

  if (confirmRemoval) {
    await ConfigManager.manageDaemon('remove');
  } else {
    console.log('❌ Removal cancelled.');
  }
}

/**
 * Install globally
 */
async function installGlobally(): Promise<void> {
  console.log('🌍 Global Installation\n');

  const result = await ConfigManager.installGlobally();

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
async function updateGlobalInstallation(): Promise<void> {
  console.log('🔄 Update Global Installation\n');

  const result = await ConfigManager.updateApplication();

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
async function removeGlobalInstallation(): Promise<void> {
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
    const result = await ConfigManager.uninstallGlobally(cleanupData);

    if (result.success) {
      console.log('✅', result.message);
      if (!cleanupData) {
        console.log('\n💡 Configuration files and data were preserved.');
      }
    } else {
      console.error('❌', result.message);
    }
  } else {
    console.log('❌ Removal cancelled.');
  }
}

/**
 * View detailed system information
 */
async function viewDetailedSystemInfo(): Promise<void> {
  console.log('📊 Detailed System Information\n');

  const systemStatus = await ConfigManager.getSystemStatus();
  const platform = await PlatformDetector.detectPlatform();
  const version = ConfigManager.getCurrentVersion();

  console.log('🖥️  System Information:');
  console.log(`   Platform: ${platform.platform} (${platform.version})`);
  console.log(`   Architecture: ${os.arch()}`);
  console.log(`   Node.js: ${process.version}`);
  console.log('');

  console.log('📦 Application Information:');
  console.log(`   Version: ${version}`);
  console.log(`   Executable: ${process.execPath}`);
  console.log(`   Working Directory: ${process.cwd()}`);
  console.log('');

  console.log('🌍 Global Installation:');
  console.log(`   Installed: ${systemStatus.globalInstall.exists ? 'Yes' : 'No'}`);
  if (systemStatus.globalInstall.exists) {
    console.log(`   Version: ${systemStatus.globalInstall.globalVersion || 'Unknown'}`);
    console.log(`   Up to date: ${!systemStatus.globalInstall.isDifferentVersion ? 'Yes' : 'No'}`);
  }
  console.log('');

  console.log('🤖 Daemon Status:');
  console.log(`   Configured: ${systemStatus.config.schedulingConfigExists ? 'Yes' : 'No'}`);
  console.log(`   Running: ${systemStatus.daemon.isRunning ? 'Yes' : 'No'}`);
  if (systemStatus.daemon.daemonVersion) {
    console.log(`   Version: ${systemStatus.daemon.daemonVersion}`);
    console.log(`   Up to date: ${!systemStatus.daemon.needsUpdate ? 'Yes' : 'No'}`);
  }
  console.log('');

  console.log('🔧 Configuration:');
  console.log(`   Directory: ${systemStatus.config.configDirectory}`);
  console.log(`   Reports Directory: ${systemStatus.config.reportsDirectory}`);
  console.log(
    `   Security Config: ${systemStatus.config.securityConfigExists ? 'Found' : 'Missing'}`
  );
  console.log(
    `   Scheduling Config: ${systemStatus.config.schedulingConfigExists ? 'Found' : 'Missing'}`
  );

  // Show available profiles
  const profiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];
  console.log('   Available Profiles:');
  for (const profile of profiles) {
    const profilePath =
      profile === 'default'
        ? systemStatus.config.securityConfigPath
        : path.join(systemStatus.config.configDirectory, `${profile}-config.json`);
    const exists = fs.existsSync(profilePath);
    console.log(`     ${profile}: ${exists ? '✅' : '❌'}`);
  }
  console.log('');
}

/**
 * Check for updates
 */
async function checkForUpdates(): Promise<void> {
  console.log('🔍 Checking for Updates\n');

  const currentVersion = ConfigManager.getCurrentVersion();
  const isUpgrade = ConfigManager.isVersionUpgrade();
  const lastVersion = ConfigManager.getLastTrackedVersion();

  console.log(`📦 Current Version: ${currentVersion}`);
  console.log(`📊 Last Tracked Version: ${lastVersion || 'None'}`);
  console.log(`🔄 Version Upgrade: ${isUpgrade ? 'Yes' : 'No'}`);
  console.log('');

  if (isUpgrade) {
    console.log('🎉 You have upgraded to a newer version!');
    console.log('💡 Consider updating global installation and daemon if needed.');

    // Update tracked version
    ConfigManager.updateTrackedVersion();
    console.log('✅ Version tracking updated.');
  } else {
    console.log('✅ You are running the latest tracked version.');
    console.log('💡 For the latest releases, check: https://github.com/eaiti/eai_security_check');
  }

  console.log('');
}

/**
 * Verify locally saved security reports
 */
async function verifyLocalReports(): Promise<void> {
  console.log('🔍 Verify Local Reports\n');

  const { reportsDir } = ConfigManager.ensureCentralizedDirectories();

  if (!fs.existsSync(reportsDir)) {
    console.log('❌ Reports directory not found:');
    console.log(`   ${reportsDir}`);
    console.log(
      '💡 Reports will be created here when the daemon runs or when you save reports manually.'
    );
    console.log('');
    return;
  }

  console.log(`📂 Scanning reports directory: ${reportsDir}\n`);

  try {
    const files = fs
      .readdirSync(reportsDir)
      .filter(file => file.includes('security-report-') && file.endsWith('.txt'))
      .sort((a, b) => {
        // Sort by modification time, newest first
        const statA = fs.statSync(path.join(reportsDir, a));
        const statB = fs.statSync(path.join(reportsDir, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });

    if (files.length === 0) {
      console.log('ℹ️  No security reports found in the reports directory.');
      console.log(
        '💡 Reports are automatically saved when the daemon runs or when you manually save reports.'
      );
      console.log('');
      return;
    }

    console.log(`📋 Found ${files.length} report file${files.length === 1 ? '' : 's'}:\n`);

    let verifiedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      const stats = fs.statSync(filePath);

      console.log(`📄 ${file}`);
      console.log(`   📅 Created: ${stats.mtime.toLocaleString()}`);
      console.log(`   📏 Size: ${(stats.size / 1024).toFixed(1)} KB`);

      // Basic integrity checks
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if file has expected structure
        const hasHeader =
          content.includes('EAI Security Check Report') ||
          content.includes('Security Audit Report');
        const hasTimestamp = /\d{4}-\d{2}-\d{2}/.test(content);
        const hasResults = content.includes('PASSED') || content.includes('FAILED');

        if (hasHeader && hasTimestamp && hasResults) {
          console.log('   ✅ Basic integrity: PASSED');
          verifiedCount++;
        } else {
          console.log('   ❌ Basic integrity: FAILED (missing expected content)');
          failedCount++;
        }
      } catch (error) {
        console.log(`   ❌ Read error: ${error}`);
        failedCount++;
      }

      console.log('');
    }

    // Summary
    console.log('📊 Verification Summary:');
    console.log(`   ✅ Verified: ${verifiedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   📁 Total: ${files.length}`);

    if (failedCount === 0) {
      console.log('\n🎉 All reports passed basic integrity checks!');
    } else {
      console.log('\n⚠️  Some reports failed verification. Consider re-running security checks.');
    }
  } catch (error) {
    console.error('❌ Error accessing reports directory:', error);
  }

  console.log('');
}

/**
 * Verify a specific file
 */
async function verifySpecificFile(): Promise<void> {
  console.log('🔍 Verify Specific File\n');

  try {
    const filePath = await input({
      message: 'Enter the path to the file you want to verify:',
      validate: (value: string) => {
        if (!value.trim()) {
          return 'File path cannot be empty';
        }
        if (!fs.existsSync(value.trim())) {
          return 'File does not exist';
        }
        return true;
      }
    });

    const trimmedPath = filePath.trim();
    console.log(`\n📄 Verifying file: ${trimmedPath}`);

    try {
      const content = fs.readFileSync(trimmedPath, 'utf-8');

      // Check if it's a JSON file
      if (trimmedPath.endsWith('.json')) {
        JSON.parse(content); // Verify it's valid JSON
        console.log('✅ File is valid JSON');
      } else {
        console.log('✅ File is readable');
      }

      // Get file stats
      const stats = fs.statSync(trimmedPath);
      console.log(`📊 File size: ${stats.size} bytes`);
      console.log(`📅 Last modified: ${stats.mtime.toISOString()}`);
    } catch (error) {
      console.log(
        `❌ File verification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ExitPromptError') {
      return; // User cancelled
    }
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify all files in a directory
 */
async function verifyDirectory(): Promise<void> {
  console.log('🔍 Verify Directory\n');

  try {
    const dirPath = await input({
      message: 'Enter the path to the directory you want to verify:',
      validate: (value: string) => {
        if (!value.trim()) {
          return 'Directory path cannot be empty';
        }
        if (!fs.existsSync(value.trim())) {
          return 'Directory does not exist';
        }
        if (!fs.statSync(value.trim()).isDirectory()) {
          return 'Path is not a directory';
        }
        return true;
      }
    });

    const trimmedPath = dirPath.trim();
    console.log(`\n📁 Verifying directory: ${trimmedPath}`);

    const files = fs.readdirSync(trimmedPath);

    if (files.length === 0) {
      console.log('📂 Directory is empty');
      return;
    }

    console.log(`📊 Found ${files.length} file(s):`);
    let validFiles = 0;
    let invalidFiles = 0;
    let directories = 0;

    for (const file of files) {
      const filePath = path.join(trimmedPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        console.log(`  📁 ${file} - Directory`);
        directories++;
        continue;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check if it's a JSON file
        if (file.endsWith('.json')) {
          JSON.parse(content); // Verify it's valid JSON
          console.log(`  ✅ ${file} - Valid JSON (${stats.size} bytes)`);
        } else {
          console.log(`  ✅ ${file} - Readable (${stats.size} bytes)`);
        }
        validFiles++;
      } catch (error) {
        console.log(
          `  ❌ ${file} - Error: ${error instanceof Error ? error.message : String(error)}`
        );
        invalidFiles++;
      }
    }

    console.log(
      `\n📈 Summary: ${validFiles} valid files, ${invalidFiles} invalid files, ${directories} directories`
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ExitPromptError') {
      return; // User cancelled
    }
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const program = new Command();

program
  .name('eai-security-check')
  .description(
    "🔒 Cross-Platform Security Audit Tool - Check your system's security settings against configurable requirements"
  )
  .version('1.1.0')
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
          console.log(
            '💡 Use "eai-security-check interactive" to setup configurations interactively.'
          );
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
          const defaultConfig = getConfigForProfile('default');
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
  .command('interactive')
  .alias('manage')
  .description(
    '�️  Interactive management mode - manage configurations, global install, and daemon'
  )
  .addHelpText(
    'after',
    `
Examples:
  $ eai-security-check interactive                   # Full interactive management
  $ eai-security-check manage                        # Same as interactive (alias)

Interactive Management:
  The interactive command provides a menu-driven interface for:
  1. Running security checks with different profiles
  2. Managing security configurations and profiles
  3. Setting up and managing daemon automation
  4. Installing/updating/removing global system access
  5. Viewing comprehensive system status
  6. Managing all aspects of the security check system

Features Available:
  🔍 Security Checks      - Run checks with any profile, view results
  🔧 Configuration        - Setup, view, modify security profiles
  🤖 Daemon Management    - Setup, start/stop, configure automated checks
  🌍 Global Installation  - Install/remove system-wide access
  📊 System Status        - View comprehensive system information
  ⚙️  Reset & Cleanup     - Reset configurations, cleanup files

Supported Operations:
  - First-time setup wizard for new installations
  - Configuration management (create, modify, reset)
  - Daemon setup with email and SCP configuration
  - Global installation with platform-specific methods
  - System status monitoring and diagnostics
  - Version management and upgrade detection

Platform Support:
  🍎 macOS: Full support with LaunchAgent integration
  🐧 Linux: Complete support with systemd user services
  🪟 Windows: Basic support with Task Scheduler
`
  )
  .action(async () => {
    try {
      await runInteractiveMode();
    } catch (error) {
      console.error('❌ Error in interactive mode:', error);
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
                  console.log(
                    `   📅 Generated: ${new Date(signature.timestamp as string).toLocaleString()}`
                  );
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
            console.log(
              `📅 Generated: ${new Date(signature.timestamp as string).toLocaleString()}`
            );
            const metadata = signature.metadata as Record<string, unknown>;
            console.log(`💻 Platform: ${metadata.platform}`);
            console.log(`🖥️  Hostname: ${metadata.hostname}`);
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
          console.log(CryptoUtils.createVerificationSummary(verification, signature || undefined));
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
  $ eai-security-check daemon --status                    # Check daemon status
  $ eai-security-check daemon --test-email                # Send test email
  $ eai-security-check daemon --check-now                 # Force immediate check

🚀 QUICK START:
  1. Set up daemon configuration:
     $ eai-security-check interactive    # Choose "Daemon" menu, then "Setup Daemon Automation"
  
  2. Start daemon manually (for testing):
     $ eai-security-check daemon         # Runs until you stop it
  
  3. Set up automatic startup (optional):
     macOS:   Use interactive mode's "Start/Stop/Restart Daemon" option for LaunchAgent setup
     Linux:   $ sudo systemctl --user enable eai-security-check-daemon
     Windows: Use Task Scheduler (see daemon-examples/ directory)

📋 SETUP FLOW:
  ✅ 1. Configuration: Use 'eai-security-check interactive' to setup email/schedule
  ✅ 2. Test manually: Use 'eai-security-check daemon' to test the setup
  ✅ 3. Auto-startup: Use interactive mode to setup system service (optional)

Daemon Control:
  $ eai-security-check daemon --stop                      # Stop running daemon
  $ eai-security-check daemon --restart                   # Restart daemon service
  $ eai-security-check daemon --uninstall                 # Remove daemon files
  $ eai-security-check daemon --uninstall --force         # Remove daemon files and config

Configuration:
  The daemon requires two configuration steps:
  
  1. 📧 Email & Schedule Setup (Required):
     - SMTP server settings for sending reports
     - Email recipients and subject
     - Check interval (daily/weekly)
     - Security profile to use
     
  2. 🔧 System Service Setup (Optional but Recommended):
     - Makes daemon start automatically on login/boot
     - Automatically restarts if daemon crashes
     - Platform-specific (LaunchAgent/systemd/Task Scheduler)

💡 For the best experience, use the interactive setup:
   $ eai-security-check interactive
   Then choose "3. Daemon - Automated security monitoring"
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

        // Platform-specific file locations and commands
        const platform = PlatformDetector.getSimplePlatform();
        console.log('\n🔧 Platform-Specific Information:');
        console.log(`  Platform: ${platformInfo.platform}`);

        if (platform === Platform.MACOS) {
          const plistFile = path.join(
            os.homedir(),
            'Library',
            'LaunchAgents',
            'com.eai.security-check.plist'
          );
          console.log(`  Service Name: com.eai.security-check`);
          console.log(`  LaunchAgent plist: ${plistFile}`);
          console.log(`  Check if loaded: launchctl list | grep com.eai.security-check`);
          console.log(`  Load service: launchctl load "${plistFile}"`);
          console.log(`  Unload service: launchctl unload "${plistFile}"`);
          console.log(`  View logs: tail -f ~/Library/Logs/eai-security-check.log`);
        } else if (platform === Platform.LINUX) {
          const serviceFile = path.join(
            os.homedir(),
            '.config',
            'systemd',
            'user',
            'eai-security-check.service'
          );
          console.log(`  Service Name: eai-security-check`);
          console.log(`  Systemd service: ${serviceFile}`);
          console.log(`  Check if active: systemctl --user is-active eai-security-check`);
          console.log(`  Start service: systemctl --user start eai-security-check`);
          console.log(`  Stop service: systemctl --user stop eai-security-check`);
          console.log(`  Enable on boot: systemctl --user enable eai-security-check`);
          console.log(`  View logs: journalctl --user -u eai-security-check -f`);
        } else if (platform === Platform.WINDOWS) {
          console.log(`  Service Name: EAI Security Check`);
          console.log(`  Task Scheduler: Task Scheduler Library > EAI Security Check`);
          console.log(`  Check task: schtasks /Query /TN "EAI Security Check"`);
          console.log(`  Run task: schtasks /Run /TN "EAI Security Check"`);
          console.log(`  View logs: Event Viewer > Windows Logs > Application`);
        }

        console.log('\n🔧 Platform Capabilities:');
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
  .command('install')
  .description('🚀 Install EAI Security Check globally')
  .action(async () => {
    try {
      console.log('🚀 Installing EAI Security Check globally...\n');

      const result = await ConfigManager.installGlobally();

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
  });

program
  .command('uninstall')
  .description('🗑️ Uninstall EAI Security Check globally')
  .option('--cleanup', 'Remove all configuration files and data')
  .action(async options => {
    try {
      console.log('🗑️ Uninstalling EAI Security Check...\n');

      if (options.cleanup) {
        const confirmInput = await input({
          message:
            '⚠️ This will remove ALL configuration files, reports, and logs. Type "yes" to confirm:'
        });

        if (confirmInput.toLowerCase() !== 'yes') {
          console.log('❌ Uninstall cancelled.');
          return;
        }
      }

      const result = await ConfigManager.uninstallGlobally(options.cleanup);

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
  });

program
  .command('update')
  .description('🔄 Update EAI Security Check to the latest version')
  .action(async () => {
    try {
      console.log('🔄 Checking for updates...\n');

      const result = await ConfigManager.updateApplication();

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
        console.log(
          'Available commands: check, interactive, verify, daemon, install, uninstall, update, help'
        );
      }
    } else {
      console.log(`
🔒 EAI Security Check - Cross-Platform Security Audit Tool v1.0.0

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
  });

// Only parse command line arguments if this module is being run directly
if (require.main === module) {
  program.parse(process.argv);
}

// Export functions for testing
export {
  runInteractiveMode,
  showSecurityCheckMenu,
  showConfigurationMenu,
  showDaemonMenu,
  showGlobalMenu,
  showSystemMenu,
  showVerifyMenu,
  runInteractiveSecurityCheck,
  runQuickSecurityCheck,
  setupOrModifyConfigurations,
  viewConfigurationStatus,
  resetAllConfigurations,
  setupDaemonAutomation,
  manageDaemonService,
  viewDaemonStatus,
  removeDaemonConfiguration,
  installGlobally,
  updateGlobalInstallation,
  removeGlobalInstallation,
  viewDetailedSystemInfo,
  checkForUpdates,
  verifyLocalReports,
  verifySpecificFile,
  verifyDirectory,
  getConfigForProfile,
  promptForAutoServiceSetup,
  attemptAutoServiceSetup
};
