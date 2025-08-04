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

import { select } from '@inquirer/prompts';

const mockSelect = select as jest.MockedFunction<typeof select>;

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
        .mockResolvedValueOnce('1') // Choose security check
        .mockResolvedValueOnce('8'); // Then exit

      (SecurityOperations.runInteractiveSecurityChecks as jest.Mock).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(SecurityOperations.runInteractiveSecurityChecks).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle daemon management option', async () => {
      mockSelect
        .mockResolvedValueOnce('2') // Choose daemon management
        .mockResolvedValueOnce('8'); // Then exit

      (DaemonOperations.runInteractiveDaemonManagement as jest.Mock).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(DaemonOperations.runInteractiveDaemonManagement).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle configuration management option', async () => {
      mockSelect
        .mockResolvedValueOnce('3') // Choose configuration management
        .mockResolvedValueOnce('8'); // Then exit

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
        .mockResolvedValueOnce('5') // Choose verification
        .mockResolvedValueOnce('8'); // Then exit

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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error in interactive mode:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should exit when user selects exit option', async () => {
      mockSelect.mockResolvedValueOnce('8'); // Exit option

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(consoleSpy).toHaveBeenCalledWith('👋 Goodbye!');

      consoleSpy.mockRestore();
    });

    it('should handle invalid selection gracefully', async () => {
      mockSelect
        .mockResolvedValueOnce('invalid') // Invalid option
        .mockResolvedValueOnce('8'); // Then exit

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await InteractiveHandlers.runInteractiveMode();

      expect(consoleSpy).toHaveBeenCalledWith('❌ Invalid choice. Please try again.\n');

      consoleSpy.mockRestore();
    });

    it('should continue looping until exit is selected', async () => {
      mockSelect
        .mockResolvedValueOnce('1') // Security check
        .mockResolvedValueOnce('2') // Daemon management
        .mockResolvedValueOnce('8'); // Exit

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
