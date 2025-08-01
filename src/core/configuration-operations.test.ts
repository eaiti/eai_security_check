import { ConfigurationOperations } from './configuration-operations';
import { ConfigManager } from '../config/config-manager';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock ConfigManager to avoid creating actual files
jest.mock('../config/config-manager');
const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;

describe('Configuration Operations', () => {
  const tmpDir = os.tmpdir();
  const testConfigDir = path.join(tmpDir, 'test-eai-security-check');
  const testSecurityConfig = path.join(testConfigDir, 'security-config.json');
  const testSchedulingConfig = path.join(testConfigDir, 'scheduling-config.json');

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getConfigStatus to return test paths
    mockConfigManager.getConfigStatus.mockReturnValue({
      configDirectory: testConfigDir,
      reportsDirectory: path.join(testConfigDir, 'reports'),
      securityConfigExists: false,
      securityConfigPath: testSecurityConfig,
      schedulingConfigExists: false,
      schedulingConfigPath: testSchedulingConfig
    });
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('getConfigurationStatus', () => {
    it('should return configuration status with no existing configs', () => {
      const status = ConfigurationOperations.getConfigurationStatus();

      expect(status.configDirectory).toBe(testConfigDir);
      expect(status.securityConfigExists).toBe(false);
      expect(status.schedulingConfigExists).toBe(false);
      expect(status.availableProfiles.default).toBe(false);
      expect(status.availableProfiles.strict).toBe(false);
      expect(status.availableProfiles.relaxed).toBe(false);
      expect(status.availableProfiles.developer).toBe(false);
      expect(status.availableProfiles.eai).toBe(false);
    });

    it('should return configuration status with existing configs', () => {
      // Create test directory and configs
      fs.mkdirSync(testConfigDir, { recursive: true });
      fs.writeFileSync(testSecurityConfig, '{}');
      fs.writeFileSync(path.join(testConfigDir, 'strict-config.json'), '{}');

      // Update mock to reflect existing files
      mockConfigManager.getConfigStatus.mockReturnValue({
        configDirectory: testConfigDir,
        reportsDirectory: path.join(testConfigDir, 'reports'),
        securityConfigExists: true,
        securityConfigPath: testSecurityConfig,
        schedulingConfigExists: false,
        schedulingConfigPath: testSchedulingConfig
      });

      const status = ConfigurationOperations.getConfigurationStatus();

      expect(status.securityConfigExists).toBe(true);
      expect(status.availableProfiles.default).toBe(true);
      expect(status.availableProfiles.strict).toBe(true);
      expect(status.availableProfiles.relaxed).toBe(false);
    });
  });
});
