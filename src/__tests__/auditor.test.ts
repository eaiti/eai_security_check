import { SecurityAuditor } from '../auditor';
import { SecurityConfig } from '../types';
import { MockMacOSSecurityChecker } from '../test-utils/mocks';

describe('SecurityAuditor', () => {
  let auditor: SecurityAuditor;

  beforeEach(() => {
    auditor = new SecurityAuditor();
    // Replace the real checker with a mock
    (auditor as any).checker = new MockMacOSSecurityChecker();
  });

  describe('auditSecurity', () => {
    it('should return a security report with correct structure', async () => {
      const config: SecurityConfig = {
        filevault: { enabled: true },
        passwordProtection: { 
          enabled: true, 
          requirePasswordImmediately: true 
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: true, stealthMode: true },
        gatekeeper: { enabled: true },
        systemIntegrityProtection: { enabled: true },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: { enabled: true, securityUpdatesOnly: true },
        sharingServices: { 
          fileSharing: false, 
          screenSharing: false, 
          remoteLogin: false 
        }
      };

      const report = await auditor.auditSecurity(config);

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overallPassed');
      expect(report).toHaveProperty('results');
      expect(Array.isArray(report.results)).toBe(true);
      expect(report.results.length).toBeGreaterThanOrEqual(10);

      // Check that each result has the correct structure
      report.results.forEach(result => {
        expect(result).toHaveProperty('setting');
        expect(result).toHaveProperty('expected');
        expect(result).toHaveProperty('actual');
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('message');
        expect(typeof result.passed).toBe('boolean');
      });
    });

    it('should check for FileVault setting', async () => {
      const config: SecurityConfig = {
        filevault: { enabled: true },
        passwordProtection: { 
          enabled: true, 
          requirePasswordImmediately: true 
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: true },
        gatekeeper: { enabled: true },
        systemIntegrityProtection: { enabled: true },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: { enabled: true },
        sharingServices: { 
          fileSharing: false, 
          screenSharing: false, 
          remoteLogin: false 
        }
      };

      const report = await auditor.auditSecurity(config);
      const fileVaultResult = report.results.find(r => r.setting === 'FileVault');
      
      expect(fileVaultResult).toBeDefined();
      expect(fileVaultResult?.expected).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate a formatted report string', async () => {
      const config: SecurityConfig = {
        filevault: { enabled: true },
        passwordProtection: { 
          enabled: true, 
          requirePasswordImmediately: true 
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: true },
        gatekeeper: { enabled: true },
        systemIntegrityProtection: { enabled: true },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: { enabled: true },
        sharingServices: { 
          fileSharing: false, 
          screenSharing: false, 
          remoteLogin: false 
        }
      };

      const reportString = await auditor.generateReport(config);

      expect(typeof reportString).toBe('string');
      expect(reportString).toContain('🔒 macOS Security Audit Report');
      expect(reportString).toContain('📅 Generated:');
      expect(reportString).toContain('💻 System:');
      expect(reportString).toContain('Overall Status:');
      expect(reportString).toContain('Security Check Results:');
    });
  });
});
