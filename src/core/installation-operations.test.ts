import { InstallationOperations } from './installation-operations';
import { ConfigManager } from '../config/config-manager';

// Mock ConfigManager
jest.mock('../config/config-manager');
const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;

describe('Installation Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('installGlobally', () => {
    it('should install globally successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Installation successful',
        executablePath: '/usr/local/bin/eai-security-check'
      };
      mockConfigManager.installGlobally.mockResolvedValue(mockResult);

      const result = await InstallationOperations.installGlobally();

      expect(result).toEqual(mockResult);
      expect(mockConfigManager.installGlobally).toHaveBeenCalledTimes(1);
    });

    it('should handle installation failure', async () => {
      const mockError = new Error('Permission denied');
      mockConfigManager.installGlobally.mockRejectedValue(mockError);

      const result = await InstallationOperations.installGlobally();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Installation failed: Permission denied');
    });
  });

  describe('getSystemStatus', () => {
    it('should return system status', async () => {
      const mockStatus = {
        globalInstall: {
          exists: true,
          globalVersion: '1.1.0',
          currentVersion: '1.1.0',
          isDifferentVersion: false
        },
        config: {
          configDirectory: '/test/.config/eai-security-check',
          reportsDirectory: '/test/.config/eai-security-check/reports',
          securityConfigExists: true,
          securityConfigPath: '/test/.config/eai-security-check/security-config.json',
          schedulingConfigExists: false,
          schedulingConfigPath: '/test/.config/eai-security-check/scheduling-config.json'
        },
        daemon: {
          isRunning: false,
          daemonVersion: null,
          currentVersion: '1.1.0',
          needsUpdate: false
        }
      };
      mockConfigManager.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await InstallationOperations.getSystemStatus();

      expect(result).toEqual(mockStatus);
      expect(mockConfigManager.getSystemStatus).toHaveBeenCalledTimes(1);
    });
  });
});
