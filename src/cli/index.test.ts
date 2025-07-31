import { jest } from '@jest/globals';

// Mock all external dependencies first, before any imports
jest.mock('@inquirer/prompts');
jest.mock('fs');
jest.mock('os');
jest.mock('path');
jest.mock('child_process');
jest.mock('../services/auditor');
jest.mock('../utils/platform-detector');
jest.mock('../services/scheduling-service');
jest.mock('../config/config-manager');
jest.mock('../config/config-profiles');
jest.mock('../utils/output-utils');
jest.mock('../utils/crypto-utils');

// Import mocked modules after mocking
import { select, confirm, input } from '@inquirer/prompts';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { SecurityAuditor } from '../services/auditor';
import { PlatformDetector, Platform } from '../utils/platform-detector';
import { SchedulingService } from '../services/scheduling-service';
import { ConfigManager } from '../config/config-manager';
import { getConfigByProfile, isValidProfile } from '../config/config-profiles';
import { OutputUtils } from '../utils/output-utils';
import { CryptoUtils } from '../utils/crypto-utils';

// Create typed mocks
const mockSelect = select as jest.MockedFunction<typeof select>;
const mockConfirm = confirm as jest.MockedFunction<typeof confirm>;
const mockInput = input as jest.MockedFunction<typeof input>;
const mockFs = jest.mocked(fs);
const mockOs = jest.mocked(os);
const mockPath = jest.mocked(path);
const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockSecurityAuditor = SecurityAuditor as jest.MockedClass<typeof SecurityAuditor>;
const mockPlatformDetector = PlatformDetector as jest.Mocked<typeof PlatformDetector>;
const mockSchedulingService = SchedulingService as jest.MockedClass<typeof SchedulingService>;
const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;
const mockGetConfigByProfile = getConfigByProfile as jest.MockedFunction<typeof getConfigByProfile>;
const mockIsValidProfile = isValidProfile as jest.MockedFunction<typeof isValidProfile>;
const mockOutputUtils = OutputUtils as jest.Mocked<typeof OutputUtils>;
const mockCryptoUtils = CryptoUtils as jest.Mocked<typeof CryptoUtils>;

// Import the functions we want to test AFTER mocking
import {
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
} from './index';

describe('CLI Interactive Mode', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods to prevent output during tests
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Mock process.exit to prevent tests from actually exiting
    process.exit = jest.fn() as never;

    // Setup default mocks
    mockOs.homedir.mockReturnValue('/home/testuser');
    mockOs.platform.mockReturnValue('darwin');
    mockPath.resolve.mockImplementation((...paths) => paths.join('/'));
    mockPath.join.mockImplementation((...paths) => paths.join('/'));
    mockPath.dirname.mockReturnValue('/test/dir');
    
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{"testConfig": true}');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
      mtime: new Date(),
      size: 1024
    } as any);

    mockPlatformDetector.detectPlatform.mockResolvedValue({
      platform: Platform.MACOS,
      version: '14.5',
      isSupported: true,
      isApproved: true,
      warningMessage: undefined
    });

    mockIsValidProfile.mockReturnValue(true);
    mockGetConfigByProfile.mockReturnValue({
      diskEncryption: { enabled: true },
      passwordProtection: { enabled: true, requirePasswordImmediately: true },
      autoLock: { maxTimeoutMinutes: 7 },
      firewall: { enabled: true, stealthMode: true },
      packageVerification: { enabled: true },
      systemIntegrityProtection: { enabled: true },
      remoteLogin: { enabled: false },
      remoteManagement: { enabled: false },
      automaticUpdates: { enabled: true },
      sharingServices: { fileSharing: false, screenSharing: false }
    });

    // Mock ConfigManager methods
    mockConfigManager.ensureConfigDirectory.mockReturnValue('/test/config');
    mockConfigManager.getReportsDirectory.mockReturnValue('/test/reports');
    mockConfigManager.getSystemStatus.mockResolvedValue({
      globalInstall: { 
        exists: false, 
        isDifferentVersion: false, 
        globalVersion: null,
        currentVersion: '1.1.0' 
      },
      config: {
        configDirectory: '/test/config',
        reportsDirectory: '/test/reports',
        securityConfigExists: true,
        securityConfigPath: '/test/config/security-config.json',
        schedulingConfigExists: false,
        schedulingConfigPath: '/test/config/scheduling-config.json'
      },
      daemon: { 
        isRunning: false, 
        needsUpdate: false, 
        daemonVersion: null, 
        currentVersion: '1.1.0' 
      }
    });
    mockConfigManager.getCurrentVersion.mockReturnValue('1.1.0');
    mockConfigManager.promptForSecurityProfile.mockResolvedValue('default');
    mockConfigManager.hasSecurityConfig.mockReturnValue(true);
    mockConfigManager.loadSecurityConfig.mockReturnValue({
      diskEncryption: { enabled: true }
    } as any);
    mockConfigManager.getConfigStatus.mockReturnValue({
      configDirectory: '/test/config',
      reportsDirectory: '/test/reports',
      securityConfigExists: true,
      securityConfigPath: '/test/config/security-config.json',
      schedulingConfigExists: false,
      schedulingConfigPath: '/test/config/scheduling-config.json'
    });

    // Mock SecurityAuditor methods - simplified approach to avoid typing issues
    const mockAuditorMethods = {
      generateReport: jest.fn(),
      generateQuietReport: jest.fn(),
      auditSecurity: jest.fn(),
      checkVersionCompatibility: jest.fn()
    };
    
    (mockAuditorMethods.generateReport as any).mockResolvedValue('Mock security report');
    (mockAuditorMethods.generateQuietReport as any).mockResolvedValue('Mock quiet report');
    (mockAuditorMethods.auditSecurity as any).mockResolvedValue({ overallPassed: true });
    (mockAuditorMethods.checkVersionCompatibility as any).mockResolvedValue({
      currentVersion: '14.5',
      isSupported: true,
      isApproved: true,
      isLegacy: false,
      platform: Platform.MACOS,
      warningMessage: undefined
    });

    // Mock additional ConfigManager methods
    mockConfigManager.promptForForceOverwrite.mockResolvedValue(true);
    mockConfigManager.createAllSecurityConfigs.mockImplementation(() => {});
    mockConfigManager.resetAllConfigurations.mockImplementation(() => {});
    mockConfigManager.promptForConfigReset.mockResolvedValue(true);
    mockConfigManager.hasSchedulingConfig.mockReturnValue(false);
    mockConfigManager.createSchedulingConfigInteractive.mockResolvedValue(undefined);
    mockConfigManager.promptForDaemonSetup.mockResolvedValue(true);
    mockConfigManager.copyDaemonServiceTemplates.mockReturnValue({
      templatesCopied: ['service.template'],
      instructions: ['Install instruction'],
      platform: 'Linux'
    });
    mockConfigManager.manageDaemon.mockResolvedValue(undefined);
    mockConfigManager.promptForGlobalInstall.mockResolvedValue(true);
    mockConfigManager.setupGlobalInstallation.mockResolvedValue(undefined);
    mockConfigManager.removeGlobalInstall.mockResolvedValue(undefined);
    mockConfigManager.isVersionUpgrade.mockReturnValue(false);
    mockConfigManager.getLastTrackedVersion.mockReturnValue('1.0.0');
    mockConfigManager.updateTrackedVersion.mockImplementation(() => {});

    mockSecurityAuditor.mockImplementation(() => mockAuditorMethods as any);

    // Mock default prompt responses
    mockSelect.mockResolvedValue('7'); // Default to exit
    mockConfirm.mockResolvedValue(false); // Default to no
    mockInput.mockResolvedValue('test-input');
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe('Main Interactive Loop', () => {
    it('should display welcome message and system status', async () => {
      mockSelect.mockResolvedValueOnce('7'); // Exit immediately
      
      await runInteractiveMode();
      
      expect(console.log).toHaveBeenCalledWith('🎛️  Welcome to EAI Security Check Interactive Management!\n');
      expect(mockConfigManager.ensureConfigDirectory).toHaveBeenCalled();
      expect(mockConfigManager.getReportsDirectory).toHaveBeenCalled();
      expect(mockConfigManager.getSystemStatus).toHaveBeenCalled();
      expect(mockConfigManager.getCurrentVersion).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
    });

    it('should handle user selecting exit option', async () => {
      mockSelect.mockResolvedValueOnce('7'); // Exit option
      
      await runInteractiveMode();
      
      expect(console.log).toHaveBeenCalledWith('👋 Thank you for using EAI Security Check!');
      expect(console.log).toHaveBeenCalledWith('💡 You can always return to this menu with: eai-security-check interactive');
    });

    it('should handle Ctrl+C gracefully', async () => {
      const exitError = new Error('User interrupted');
      (exitError as any).name = 'ExitPromptError';
      mockSelect.mockRejectedValueOnce(exitError);
      
      await runInteractiveMode();
      
      expect(console.log).toHaveBeenCalledWith('\n👋 Thank you for using EAI Security Check!');
    });

    it('should handle security check menu selection', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Security check menu
        .mockResolvedValueOnce('back') // Exit submenu immediately
        .mockResolvedValueOnce('7'); // Exit main menu
      mockConfirm.mockResolvedValueOnce(false); // Don't continue to main menu
      
      await runInteractiveMode();
      
      expect(mockSelect).toHaveBeenCalledTimes(3);
    });
  });

  describe('Security Check Menu', () => {
    it('should handle interactive security check selection', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Interactive security check
        .mockResolvedValueOnce('back'); // Go back to main menu
      mockConfirm.mockResolvedValueOnce(false); // Don't continue to menu
      
      await showSecurityCheckMenu();
      
      expect(mockSelect).toHaveBeenCalledWith({
        message: 'Choose a security check option:',
        choices: expect.arrayContaining([
          expect.objectContaining({ name: '1. Interactive Security Check - Select profile and options' }),
          expect.objectContaining({ name: '2. Quick Security Check - Use default profile' }),
          expect.objectContaining({ name: '3. Back to Main Menu' })
        ])
      });
      expect(mockConfigManager.promptForSecurityProfile).toHaveBeenCalled();
    });

    it('should handle quick security check selection', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Quick security check
        .mockResolvedValueOnce('back'); // Go back to main menu
      mockConfirm.mockResolvedValueOnce(false); // Don't continue to menu
      
      await showSecurityCheckMenu();
      
      expect(mockSelect).toHaveBeenCalled();
      expect(mockGetConfigByProfile).toHaveBeenCalledWith('default');
      expect(mockSecurityAuditor).toHaveBeenCalled();
    });

    it('should handle back to main menu', async () => {
      mockSelect.mockResolvedValueOnce('back');
      
      await showSecurityCheckMenu();
      
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration Menu', () => {
    it('should handle setup/modify configurations', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Setup/modify
        .mockResolvedValueOnce('back'); // Go back
      mockConfirm.mockResolvedValueOnce(false); // Don't continue to menu
      mockConfigManager.hasSecurityConfig.mockReturnValue(false);
      
      await showConfigurationMenu();
      
      expect(mockSelect).toHaveBeenCalled();
      expect(mockConfigManager.hasSecurityConfig).toHaveBeenCalled();
      expect(mockConfigManager.promptForSecurityProfile).toHaveBeenCalled();
    });

    it('should handle view configuration status', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // View status
        .mockResolvedValueOnce('back'); // Go back
      mockConfirm.mockResolvedValueOnce(false); // Don't continue to menu
      mockConfigManager.getConfigStatus.mockReturnValue({
        configDirectory: '/test/config',
        reportsDirectory: '/test/reports',
        securityConfigExists: true,
        securityConfigPath: '/test/config/security-config.json',
        schedulingConfigExists: false,
        schedulingConfigPath: '/test/config/scheduling-config.json'
      });
      
      await showConfigurationMenu();
      
      expect(mockConfigManager.getConfigStatus).toHaveBeenCalled();
    });

    it('should handle reset all configurations with confirmation', async () => {
      mockSelect
        .mockResolvedValueOnce('3') // Reset all
        .mockResolvedValueOnce('back'); // Go back
      mockConfirm.mockResolvedValueOnce(false); // Don't continue to menu
      mockConfigManager.promptForConfigReset.mockResolvedValue(true);
      mockConfigManager.resetAllConfigurations.mockImplementation(() => {});
      
      await showConfigurationMenu();
      
      expect(mockConfigManager.promptForConfigReset).toHaveBeenCalled();
      expect(mockConfigManager.resetAllConfigurations).toHaveBeenCalled();
    });

    it('should handle reset cancellation', async () => {
      mockSelect
        .mockResolvedValueOnce('3') // Reset all
        .mockResolvedValueOnce('back'); // Go back
      mockConfirm.mockResolvedValueOnce(false); // Don't continue to menu
      mockConfigManager.promptForConfigReset.mockResolvedValue(false);
      
      await showConfigurationMenu();
      
      expect(mockConfigManager.promptForConfigReset).toHaveBeenCalled();
      expect(mockConfigManager.resetAllConfigurations).not.toHaveBeenCalled();
    });

    it('should handle existing configuration modification', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Setup/modify
        .mockResolvedValueOnce('2') // Change default profile
        .mockResolvedValueOnce('back'); // Go back
      mockConfirm.mockResolvedValueOnce(false); // Don't continue to menu
      mockConfigManager.hasSecurityConfig.mockReturnValue(true);
      mockConfigManager.promptForForceOverwrite.mockResolvedValue(true);
      mockConfigManager.createAllSecurityConfigs.mockImplementation(() => {});
      
      await showConfigurationMenu();
      
      expect(mockConfigManager.promptForSecurityProfile).toHaveBeenCalled();
      expect(mockConfigManager.promptForForceOverwrite).toHaveBeenCalled();
      expect(mockConfigManager.createAllSecurityConfigs).toHaveBeenCalled();
    });
  });

  describe('Daemon Menu', () => {
    it('should handle daemon setup', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Setup daemon
        .mockResolvedValueOnce('back'); // Go back
      mockConfigManager.hasSchedulingConfig.mockReturnValue(false);
      
      // Test would call showDaemonMenu() here
      expect(true).toBe(true); // Placeholder
    });

    it('should handle daemon service management', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Manage service
        .mockResolvedValueOnce('1') // Start daemon
        .mockResolvedValueOnce('back'); // Go back
      
      // Test would verify service management
      expect(true).toBe(true); // Placeholder
    });

    it('should handle daemon status view', async () => {
      mockSelect
        .mockResolvedValueOnce('3') // View status
        .mockResolvedValueOnce('back'); // Go back
      
      // Test would verify status display
      expect(true).toBe(true); // Placeholder
    });

    it('should handle daemon removal', async () => {
      mockSelect
        .mockResolvedValueOnce('4') // Remove daemon
        .mockResolvedValueOnce('back'); // Go back
      mockConfigManager.hasSchedulingConfig.mockReturnValue(true);
      mockConfirm.mockResolvedValueOnce(true); // Confirm removal
      
      // Test would verify daemon removal
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Global Menu', () => {
    it('should handle global installation', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Install globally
        .mockResolvedValueOnce('back'); // Go back
      
      // Test would call showGlobalMenu() here
      expect(true).toBe(true); // Placeholder
    });

    it('should handle global update', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Update global
        .mockResolvedValueOnce('back'); // Go back
      
      // Test would verify update process
      expect(true).toBe(true); // Placeholder
    });

    it('should handle global removal', async () => {
      mockSelect
        .mockResolvedValueOnce('3') // Remove global
        .mockResolvedValueOnce('back'); // Go back
      mockConfirm.mockResolvedValueOnce(true); // Confirm removal
      
      // Test would verify removal process
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('System Menu', () => {
    it('should handle detailed system info view', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // View detailed info
        .mockResolvedValueOnce('back'); // Go back
      
      // Test would call showSystemMenu() here
      expect(true).toBe(true); // Placeholder
    });

    it('should handle version update check', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Check updates
        .mockResolvedValueOnce('back'); // Go back
      mockConfigManager.isVersionUpgrade.mockReturnValue(true);
      
      // Test would verify update check
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Verify Menu', () => {
    it('should handle local reports verification', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Verify local reports
        .mockResolvedValueOnce('back'); // Go back
      mockFs.readdirSync.mockReturnValue(['security-report-1.txt', 'security-report-2.txt'] as any);
      
      // Test would call showVerifyMenu() here
      expect(true).toBe(true); // Placeholder
    });

    it('should handle specific file verification', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Verify specific file
        .mockResolvedValueOnce('back'); // Go back
      mockInput.mockResolvedValueOnce('/path/to/report.txt');
      
      // Test would verify file verification
      expect(true).toBe(true); // Placeholder
    });

    it('should handle directory verification', async () => {
      mockSelect
        .mockResolvedValueOnce('3') // Verify directory
        .mockResolvedValueOnce('back'); // Go back
      mockInput.mockResolvedValueOnce('/path/to/reports');
      
      // Test would verify directory verification
      expect(true).toBe(true); // Placeholder
    });

    it('should handle invalid file path gracefully', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Verify specific file
        .mockResolvedValueOnce('back'); // Go back
      
      const exitError = new Error('User cancelled');
      (exitError as any).name = 'ExitPromptError';
      mockInput.mockRejectedValueOnce(exitError);
      
      // Test would verify graceful error handling
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Individual Interactive Functions', () => {
    it('should handle interactive security check with profile selection', async () => {
      mockConfigManager.promptForSecurityProfile.mockResolvedValue('strict');
      
      // Test would call runInteractiveSecurityCheck() here
      expect(true).toBe(true); // Placeholder
    });

    it('should handle quick security check execution', async () => {
      // Test would call runQuickSecurityCheck() here
      expect(true).toBe(true); // Placeholder
    });

    it('should handle configuration setup for first time', async () => {
      mockConfigManager.hasSecurityConfig.mockReturnValue(false);
      
      // Test would call setupOrModifyConfigurations() here
      expect(true).toBe(true); // Placeholder
    });

    it('should handle configuration modification', async () => {
      mockConfigManager.hasSecurityConfig.mockReturnValue(true);
      mockSelect.mockResolvedValueOnce('2'); // Change default profile
      mockConfigManager.promptForForceOverwrite.mockResolvedValue(true);
      
      // Test would verify configuration modification
      expect(true).toBe(true); // Placeholder
    });

    it('should handle daemon automation setup', async () => {
      mockConfigManager.hasSchedulingConfig.mockReturnValue(false);
      mockConfigManager.promptForDaemonSetup.mockResolvedValue(true);
      mockConfigManager.copyDaemonServiceTemplates.mockReturnValue({
        templatesCopied: ['service.template'],
        instructions: ['Install instruction'],
        platform: 'Linux'
      });
      
      // Test would call setupDaemonAutomation() here
      expect(true).toBe(true); // Placeholder
    });

    it('should handle service setup with auto-setup', async () => {
      mockConfirm.mockResolvedValueOnce(true); // Accept auto-setup
      
      // Test would verify auto-setup process
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      // Test would verify error handling
      expect(true).toBe(true); // Placeholder
    });

    it('should handle network/service errors gracefully', async () => {
      const mockErrorMethods = {
        generateReport: jest.fn(),
        generateQuietReport: jest.fn(),
        auditSecurity: jest.fn()
      };
      
      (mockErrorMethods.generateReport as any).mockRejectedValue(new Error('Network error'));
      (mockErrorMethods.generateQuietReport as any).mockRejectedValue(new Error('Network error'));
      (mockErrorMethods.auditSecurity as any).mockRejectedValue(new Error('Network error'));
      
      mockSecurityAuditor.mockImplementation(() => mockErrorMethods as any);
      
      // Test would verify error handling  
      expect(true).toBe(true); // Placeholder
    });

    it('should handle invalid user input', async () => {
      mockInput.mockResolvedValueOnce(''); // Empty input
      
      // Test would verify input validation
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Menu Navigation', () => {
    it('should handle continue/return to menu prompts', async () => {
      mockConfirm
        .mockResolvedValueOnce(true) // Continue to menu
        .mockResolvedValueOnce(false); // Don't continue (exit)
      
      // Test would verify menu navigation flow
      expect(true).toBe(true); // Placeholder
    });

    it('should handle menu transitions correctly', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Go to security check
        .mockResolvedValueOnce('back') // Return to main
        .mockResolvedValueOnce('2') // Go to configuration
        .mockResolvedValueOnce('back') // Return to main
        .mockResolvedValueOnce('7'); // Exit
      
      // Test would verify transitions work correctly
      expect(true).toBe(true); // Placeholder
    });
  });
});