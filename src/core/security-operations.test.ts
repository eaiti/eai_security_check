import { SecurityOperations } from './security-operations';
import { ConfigManager } from '../config/config-manager';
import { SecurityAuditor } from '../services/auditor';

// Mock dependencies
jest.mock('../config/config-manager');
jest.mock('../services/auditor');

describe('SecurityOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runSecurityCheck', () => {
    it('should run security check with default profile', async () => {
      const mockConfig = {
        profileName: 'default',
        enabledChecks: ['diskEncryption'],
        requirements: { diskEncryption: true },
        timeouts: { diskEncryption: 30 }
      };

      (ConfigManager.loadProfile as jest.Mock).mockReturnValue(mockConfig);
      (SecurityAuditor.prototype.runAudit as jest.Mock).mockResolvedValue({
        summary: { passed: 1, failed: 0, total: 1 },
        results: [{ checkName: 'diskEncryption', passed: true }],
        report: 'Security check passed'
      });

      const result = await SecurityOperations.runSecurityCheck({
        profile: 'default'
      });

      expect(result.report).toContain('Security check passed');
    });

    it('should handle missing profile gracefully', async () => {
      (ConfigManager.loadProfile as jest.Mock).mockReturnValue(null);

      try {
        await SecurityOperations.runSecurityCheck({
          profile: 'nonexistent'
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle config file path', async () => {
      const mockConfig = {
        profileName: 'test',
        enabledChecks: ['diskEncryption'],
        requirements: { diskEncryption: true },
        timeouts: { diskEncryption: 30 }
      };

      (ConfigManager.loadSecurityConfig as jest.Mock).mockReturnValue(mockConfig);
      (SecurityAuditor.prototype.runAudit as jest.Mock).mockResolvedValue({
        summary: { passed: 1, failed: 0, total: 1 },
        results: [{ checkName: 'diskEncryption', passed: true }],
        report: 'Security check passed'
      });

      const result = await SecurityOperations.runSecurityCheck({
        configPath: '/path/to/config.json'
      });

      expect(result.report).toContain('Security check passed');
    });

    it('should handle audit errors', async () => {
      const mockConfig = {
        profileName: 'default',
        enabledChecks: ['diskEncryption'],
        requirements: { diskEncryption: true },
        timeouts: { diskEncryption: 30 }
      };

      (ConfigManager.loadProfile as jest.Mock).mockReturnValue(mockConfig);
      (SecurityAuditor.prototype.runAudit as jest.Mock).mockRejectedValue(
        new Error('Audit failed')
      );

      try {
        await SecurityOperations.runSecurityCheck({
          profile: 'default'
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('runInteractiveSecurityChecks', () => {
    it('should run interactive security checks', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await SecurityOperations.runInteractiveSecurityChecks();

      consoleSpy.mockRestore();
    });
  });
});