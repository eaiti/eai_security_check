import { InteractiveHandlers } from './interactive-handlers';
import { SecurityOperations } from '../core/security-operations';
import { DaemonOperations } from '../core/daemon-operations';
import { ConfigurationOperations } from '../core/configuration-operations';
import { VerificationOperations } from '../core/verification-operations';
import { ConfigManager } from '../config/config-manager';

// Mock all dependencies
jest.mock('@inquirer/prompts');
jest.mock('../core/security-operations');
jest.mock('../core/daemon-operations');
jest.mock('../core/configuration-operations');
jest.mock('../core/installation-operations');
jest.mock('../core/verification-operations');
jest.mock('../config/config-manager');

import { select, confirm } from '@inquirer/prompts';

const mockSelect = select as jest.MockedFunction<typeof select>;
const mockConfirm = confirm as jest.MockedFunction<typeof confirm>;

describe('InteractiveHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ConfigManager static methods
    (ConfigManager.ensureCentralizedDirectories as jest.Mock).mockReturnValue({
      configDir: '/home/user/.config/eai-security-check',
      reportsDir: '/home/user/.config/eai-security-check/reports'
    });

    (ConfigManager.getCurrentVersion as jest.Mock).mockReturnValue('1.1.0');

    (ConfigManager.getSystemStatus as jest.Mock).mockResolvedValue({
      globalInstall: { exists: false },
      config: {
        schedulingConfigExists: false,
        securityConfigExists: true
      }
    });

    // Default confirm behavior for sub-menu navigation
    mockConfirm.mockResolvedValue(false); // Don't continue by default
  });

  describe('runInteractiveMode', () => {
    it('should display welcome message and system status', async () => {
      // Mock user selection to exit
      mockSelect.mockResolvedValueOnce('8'); // Exit option

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(consoleSpy).toHaveBeenCalledWith(
        '🎛️  Welcome to EAI Security Check Interactive Management!\n'
      );
      expect(consoleSpy).toHaveBeenCalledWith('📊 Current System Status:');
      expect(consoleSpy).toHaveBeenCalledWith('📦 Version: 1.1.0');

      consoleSpy.mockRestore();
    });

    it('should handle security check option', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Choose security check menu
        .mockResolvedValueOnce('1') // Choose interactive security check
        .mockResolvedValueOnce('back') // Back from security menu
        .mockResolvedValueOnce('7'); // Then exit

      (SecurityOperations.runInteractiveSecurityCheck as jest.Mock).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(SecurityOperations.runInteractiveSecurityCheck).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle configuration menu option', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Choose configuration menu
        .mockResolvedValueOnce('7'); // Then exit

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      // Just verify the console output shows expected text for configuration
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration'));

      consoleSpy.mockRestore();
    });

    it('should handle configuration management option', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Choose configuration menu
        .mockResolvedValueOnce('1') // Choose setup/modify configurations
        .mockResolvedValueOnce('back') // Back from configuration menu
        .mockResolvedValueOnce('7'); // Then exit

      (ConfigurationOperations.setupOrModifyConfigurations as jest.Mock).mockResolvedValue(
        undefined
      );

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(ConfigurationOperations.setupOrModifyConfigurations).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle verification option', async () => {
      mockSelect
        .mockResolvedValueOnce('6') // Choose verification menu
        .mockResolvedValueOnce('1') // Choose verify local reports
        .mockResolvedValueOnce('back') // Back from verification menu
        .mockResolvedValueOnce('7'); // Then exit

      (VerificationOperations.verifyLocalReports as jest.Mock).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(VerificationOperations.verifyLocalReports).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      mockSelect.mockRejectedValueOnce(new Error('Selection failed'));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error: Error: Selection failed');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should exit when user selects exit option', async () => {
      mockSelect.mockResolvedValueOnce('7'); // Exit option

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(consoleSpy).toHaveBeenCalledWith('👋 Thank you for using EAI Security Check!');

      consoleSpy.mockRestore();
    });

    it('should handle invalid selection gracefully', async () => {
      mockSelect
        .mockResolvedValueOnce('invalid') // Invalid option
        .mockResolvedValueOnce('7'); // Then exit

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(consoleSpy).toHaveBeenCalledWith('❌ Invalid choice. Please try again.');

      consoleSpy.mockRestore();
    });

    it('should continue looping until exit is selected', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Security check menu
        .mockResolvedValueOnce('1') // Interactive security check
        .mockResolvedValueOnce('back') // Back from security menu
        .mockResolvedValueOnce('3') // Daemon menu
        .mockResolvedValueOnce('1') // Setup daemon automation
        .mockResolvedValueOnce('back') // Back from daemon menu
        .mockResolvedValueOnce('7'); // Exit

      (SecurityOperations.runInteractiveSecurityCheck as jest.Mock).mockResolvedValue(undefined);
      (DaemonOperations.setupDaemonAutomation as jest.Mock).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(SecurityOperations.runInteractiveSecurityCheck).toHaveBeenCalled();
      expect(DaemonOperations.setupDaemonAutomation).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should display system status with global install enabled', async () => {
      (ConfigManager.getSystemStatus as jest.Mock).mockResolvedValue({
        globalInstall: { exists: true },
        config: {
          schedulingConfigExists: true,
          securityConfigExists: true
        }
      });

      mockSelect.mockResolvedValueOnce('8'); // Exit

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(consoleSpy).toHaveBeenCalledWith('🌍 Global Install: ✅ Installed');
      expect(consoleSpy).toHaveBeenCalledWith('🤖 Daemon Config: ✅ Configured');

      consoleSpy.mockRestore();
    });

    it('should handle missing security config', async () => {
      (ConfigManager.getSystemStatus as jest.Mock).mockResolvedValue({
        globalInstall: { exists: false },
        config: {
          schedulingConfigExists: false,
          securityConfigExists: false
        }
      });

      mockSelect.mockResolvedValueOnce('8'); // Exit

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(consoleSpy).toHaveBeenCalledWith('🔒 Security Config: ❌ Missing');

      consoleSpy.mockRestore();
    });
  });
});
