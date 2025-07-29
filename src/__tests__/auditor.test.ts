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

  describe('Optional Configuration Tests', () => {
    it('should handle partial configuration with only essential checks', async () => {
      // Test the EAI-style configuration with only essential checks
      const partialConfig: SecurityConfig = {
        filevault: { enabled: true },
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        autoLock: { maxTimeoutMinutes: 7 }
        // Note: Other sections are omitted and should be skipped
      };

      const report = await auditor.auditSecurity(partialConfig);

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overallPassed');
      expect(report).toHaveProperty('results');
      expect(Array.isArray(report.results)).toBe(true);
      
      // Should only have results for the configured sections (3-4 checks)
      expect(report.results.length).toBeLessThan(10);
      expect(report.results.length).toBeGreaterThanOrEqual(3);

      // Check that results only contain the configured checks
      const resultSettings = report.results.map(r => r.setting);
      expect(resultSettings).toContain('FileVault');
      expect(resultSettings).toContain('Password Protection');
      expect(resultSettings).toContain('Auto-lock Timeout');
      
      // Should NOT contain unconfigured checks
      expect(resultSettings).not.toContain('Firewall');
      expect(resultSettings).not.toContain('Gatekeeper');
      expect(resultSettings).not.toContain('System Integrity Protection');
    });
  });

  describe('OS Version Checks', () => {
    it('should check OS version with specific target version', async () => {
      const config: SecurityConfig = {
        osVersion: { targetVersion: '14.0' }
      };

      const report = await auditor.auditSecurity(config);
      const osVersionResult = report.results.find(r => r.setting === 'OS Version');

      expect(osVersionResult).toBeDefined();
      expect(osVersionResult?.expected).toBe('≥ 14.0');
      expect(osVersionResult?.actual).toBe('14.5');
      expect(osVersionResult?.passed).toBe(true);
    });

    it('should check OS version with "latest" target version', async () => {
      const config: SecurityConfig = {
        osVersion: { targetVersion: 'latest' }
      };

      const report = await auditor.auditSecurity(config);
      const osVersionResult = report.results.find(r => r.setting === 'OS Version');

      expect(osVersionResult).toBeDefined();
      expect(osVersionResult?.expected).toBe('latest macOS version');
      expect(osVersionResult?.actual).toBe('14.5');
      expect(osVersionResult?.passed).toBe(false); // Mock returns 14.5 which is less than latest 15.1
    });

    it('should fail OS version check when current version is below target', async () => {
      const config: SecurityConfig = {
        osVersion: { targetVersion: '15.0' }
      };

      const report = await auditor.auditSecurity(config);
      const osVersionResult = report.results.find(r => r.setting === 'OS Version');

      expect(osVersionResult).toBeDefined();
      expect(osVersionResult?.expected).toBe('≥ 15.0');
      expect(osVersionResult?.actual).toBe('14.5');
      expect(osVersionResult?.passed).toBe(false);
    });

    it('should skip OS version check when not configured', async () => {
      const config: SecurityConfig = {
        filevault: { enabled: true }
      };

      const report = await auditor.auditSecurity(config);
      const osVersionResult = report.results.find(r => r.setting === 'OS Version');

      expect(osVersionResult).toBeUndefined();
    });
  });

  describe('WiFi Network Security Checks', () => {
    it('should pass when not connected to banned network', async () => {
      const config: SecurityConfig = {
        wifiSecurity: {
          bannedNetworks: ['EAIguest', 'BadNetwork']
        }
      };

      const report = await auditor.auditSecurity(config);
      const wifiResult = report.results.find(r => r.setting === 'WiFi Network Security');

      expect(wifiResult).toBeDefined();
      expect(wifiResult?.expected).toBe('Not connected to banned networks: EAIguest, BadNetwork');
      expect(wifiResult?.actual).toBe('Connected to: TestNetwork');
      expect(wifiResult?.passed).toBe(true);
    });

    it('should fail when connected to banned network', async () => {
      // Modify mock to return a banned network
      (auditor as any).checker.checkCurrentWifiNetwork = jest.fn().mockResolvedValue({
        networkName: 'EAIguest',
        connected: true
      });

      const config: SecurityConfig = {
        wifiSecurity: {
          bannedNetworks: ['EAIguest', 'BadNetwork']
        }
      };

      const report = await auditor.auditSecurity(config);
      const wifiResult = report.results.find(r => r.setting === 'WiFi Network Security');

      expect(wifiResult).toBeDefined();
      expect(wifiResult?.expected).toBe('Not connected to banned networks: EAIguest, BadNetwork');
      expect(wifiResult?.actual).toBe('Connected to: EAIguest');
      expect(wifiResult?.passed).toBe(false);
      expect(wifiResult?.message).toContain('❌ Connected to banned network: EAIguest');
    });

    it('should pass and log network when no banned networks configured', async () => {
      const config: SecurityConfig = {
        wifiSecurity: {
          bannedNetworks: []
        }
      };

      const report = await auditor.auditSecurity(config);
      const wifiResult = report.results.find(r => r.setting === 'WiFi Network Security');

      expect(wifiResult).toBeDefined();
      expect(wifiResult?.expected).toBe('Network monitoring (no restrictions configured)');
      expect(wifiResult?.actual).toBe('Connected to: TestNetwork');
      expect(wifiResult?.passed).toBe(true);
      expect(wifiResult?.message).toContain('Currently connected to WiFi network: TestNetwork');
    });

    it('should pass when not connected to WiFi', async () => {
      // Modify mock to return not connected
      (auditor as any).checker.checkCurrentWifiNetwork = jest.fn().mockResolvedValue({
        networkName: null,
        connected: false
      });

      const config: SecurityConfig = {
        wifiSecurity: {
          bannedNetworks: ['EAIguest']
        }
      };

      const report = await auditor.auditSecurity(config);
      const wifiResult = report.results.find(r => r.setting === 'WiFi Network Security');

      expect(wifiResult).toBeDefined();
      expect(wifiResult?.expected).toBe('Not connected to banned networks: EAIguest');
      expect(wifiResult?.actual).toBe('Not connected to WiFi');
      expect(wifiResult?.passed).toBe(true);
      expect(wifiResult?.message).toBe('Not currently connected to any WiFi network');
    });

    it('should skip WiFi check when not configured', async () => {
      const config: SecurityConfig = {
        filevault: { enabled: true }
      };

      const report = await auditor.auditSecurity(config);
      const wifiResult = report.results.find(r => r.setting === 'WiFi Network Security');

      expect(wifiResult).toBeUndefined();
    });
  });
});
