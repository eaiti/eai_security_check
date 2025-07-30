import { SecurityAuditor } from '../auditor';
import { SecurityConfig } from '../types';
import { MockMacOSSecurityChecker } from '../test-utils/mocks';
import { PlatformDetector, Platform } from '../platform-detector';

// Mock platform detection to always return macOS
jest.mock('../platform-detector');
const mockPlatformDetector = PlatformDetector as jest.Mocked<typeof PlatformDetector>;

describe('SecurityAuditor', () => {
  let auditor: SecurityAuditor;

  beforeEach(() => {
    // Mock platform detection to return macOS
    mockPlatformDetector.detectPlatform = jest.fn().mockResolvedValue({
      platform: Platform.MACOS,
      version: '15.5',
      isSupported: true,
      isApproved: true,
      warningMessage: undefined
    });

    auditor = new SecurityAuditor();
    // Replace the real checker with a mock
    (auditor as any).checker = new MockMacOSSecurityChecker();
    // Mock version info to an approved version to avoid switching to legacy checker
    (auditor as any).versionInfo = {
      currentVersion: '15.5',
      isSupported: true,
      isApproved: true,
      isLegacy: false,
      warningMessage: undefined,
      platform: Platform.MACOS
    };
  });

  describe('auditSecurity', () => {
    it('should return a security report with correct structure', async () => {
      const config: SecurityConfig = {
        diskEncryption: { enabled: true },
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: true, stealthMode: true },
        packageVerification: { enabled: true },
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
        diskEncryption: { enabled: true },
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: true },
        packageVerification: { enabled: true },
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
        diskEncryption: { enabled: true },
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: true },
        packageVerification: { enabled: true },
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
        diskEncryption: { enabled: true },
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
        diskEncryption: { enabled: true }
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
        diskEncryption: { enabled: true }
      };

      const report = await auditor.auditSecurity(config);
      const wifiResult = report.results.find(r => r.setting === 'WiFi Network Security');

      expect(wifiResult).toBeUndefined();
    });

    describe('Automatic Updates Checks', () => {
      it('should check basic automatic updates setting', async () => {
        const config: SecurityConfig = {
          automaticUpdates: { enabled: true }
        };

        const report = await auditor.auditSecurity(config);
        const automaticUpdatesResult = report.results.find(r => r.setting === 'Automatic Updates');
        const updateModeResult = report.results.find(r => r.setting === 'Automatic Update Mode');

        expect(automaticUpdatesResult).toBeDefined();
        expect(automaticUpdatesResult?.passed).toBe(true);
        expect(automaticUpdatesResult?.actual).toBe(true);

        expect(updateModeResult).toBeDefined();
        expect(updateModeResult?.actual).toBe('download-only');
        expect(updateModeResult?.message).toContain(
          'automatic checking and downloading, but manual install required'
        );
      });

      it('should check granular automatic update settings with downloadOnly', async () => {
        const config: SecurityConfig = {
          automaticUpdates: {
            enabled: true,
            downloadOnly: true
          }
        };

        const report = await auditor.auditSecurity(config);
        const updateModeResult = report.results.find(r => r.setting === 'Automatic Update Mode');

        expect(updateModeResult).toBeDefined();
        expect(updateModeResult?.passed).toBe(true);
        expect(updateModeResult?.actual).toBe('download-only');
        expect(updateModeResult?.expected).toBe('download-only');
      });

      it('should check granular automatic update settings with automaticInstall', async () => {
        const config: SecurityConfig = {
          automaticUpdates: {
            enabled: true,
            automaticInstall: false
          }
        };

        const report = await auditor.auditSecurity(config);
        const automaticInstallResult = report.results.find(
          r => r.setting === 'Automatic Installation'
        );

        expect(automaticInstallResult).toBeDefined();
        expect(automaticInstallResult?.passed).toBe(true);
        expect(automaticInstallResult?.actual).toBe(false);
        expect(automaticInstallResult?.expected).toBe(false);
      });

      it('should check granular security updates setting with automaticSecurityInstall', async () => {
        const config: SecurityConfig = {
          automaticUpdates: {
            enabled: true,
            automaticSecurityInstall: true
          }
        };

        const report = await auditor.auditSecurity(config);
        const securityUpdatesResult = report.results.find(r => r.setting === 'Security Updates');

        expect(securityUpdatesResult).toBeDefined();
        expect(securityUpdatesResult?.passed).toBe(true);
        expect(securityUpdatesResult?.actual).toBe(true);
        expect(securityUpdatesResult?.expected).toBe(true);
      });

      it('should maintain backward compatibility with securityUpdatesOnly', async () => {
        const config: SecurityConfig = {
          automaticUpdates: {
            enabled: true,
            securityUpdatesOnly: true
          }
        };

        const report = await auditor.auditSecurity(config);
        const securityUpdatesResult = report.results.find(r => r.setting === 'Security Updates');

        expect(securityUpdatesResult).toBeDefined();
        expect(securityUpdatesResult?.passed).toBe(true);
        expect(securityUpdatesResult?.actual).toBe(true);
        expect(securityUpdatesResult?.expected).toBe(true);
      });

      it('should skip automatic updates check when not configured', async () => {
        const config: SecurityConfig = {
          diskEncryption: { enabled: true }
        };

        const report = await auditor.auditSecurity(config);
        const automaticUpdatesResult = report.results.find(r => r.setting === 'Automatic Updates');

        expect(automaticUpdatesResult).toBeUndefined();
      });

      it('should test different update modes', async () => {
        // Test disabled mode
        (auditor as any).checker.checkAutomaticUpdates = jest.fn().mockResolvedValue({
          enabled: false,
          securityUpdatesOnly: false,
          automaticDownload: false,
          automaticInstall: false,
          automaticSecurityInstall: false,
          configDataInstall: false,
          updateMode: 'disabled'
        });

        const config: SecurityConfig = {
          automaticUpdates: { enabled: false }
        };

        const report = await auditor.auditSecurity(config);
        const updateModeResult = report.results.find(r => r.setting === 'Automatic Update Mode');

        expect(updateModeResult?.actual).toBe('disabled');
        expect(updateModeResult?.message).toContain(
          'no automatic checking, downloading, or installing'
        );
      });

      it('should handle fully-automatic mode', async () => {
        // Test fully-automatic mode
        (auditor as any).checker.checkAutomaticUpdates = jest.fn().mockResolvedValue({
          enabled: true,
          securityUpdatesOnly: false,
          automaticDownload: true,
          automaticInstall: true,
          automaticSecurityInstall: true,
          configDataInstall: true,
          updateMode: 'fully-automatic'
        });

        const config: SecurityConfig = {
          automaticUpdates: {
            enabled: true,
            automaticInstall: true
          }
        };

        const report = await auditor.auditSecurity(config);
        const installResult = report.results.find(r => r.setting === 'Automatic Installation');

        expect(installResult?.actual).toBe(true);
        expect(installResult?.passed).toBe(true);
        expect(installResult?.message).toContain('All updates are installed automatically');
      });
    });

    describe('Installed Applications Checks', () => {
      it('should pass when no banned applications are configured', async () => {
        const config: SecurityConfig = {
          installedApps: { bannedApplications: [] }
        };

        const report = await auditor.auditSecurity(config);
        const appsResult = report.results.find(r => r.setting === 'Installed Applications');

        expect(appsResult).toBeDefined();
        expect(appsResult?.passed).toBe(true);
        expect(appsResult?.expected).toBe('Application monitoring (no restrictions configured)');
        expect(appsResult?.message).toContain('Detected applications:');
      });

      it('should pass when no banned applications are installed', async () => {
        const config: SecurityConfig = {
          installedApps: { bannedApplications: ['BannedApp', 'AnotherBannedApp'] }
        };

        const report = await auditor.auditSecurity(config);
        const appsResult = report.results.find(r => r.setting === 'Installed Applications');

        expect(appsResult).toBeDefined();
        expect(appsResult?.passed).toBe(true);
        expect(appsResult?.expected).toBe('No banned applications: BannedApp, AnotherBannedApp');
        expect(appsResult?.message).toContain('✅ No banned applications detected');
        expect(appsResult?.message).toContain('All apps:');
      });

      it('should fail when banned applications are installed', async () => {
        // Mock the checker to return banned apps
        (auditor as any).checker.checkInstalledApplications = jest.fn().mockResolvedValue({
          installedApps: ['Chrome', 'Firefox', 'Slack', 'BannedApp', 'TestApp'],
          bannedAppsFound: [],
          sources: {
            applications: ['Chrome', 'Firefox', 'Slack', 'BannedApp', 'TestApp'],
            homebrew: [],
            npm: []
          }
        });

        const config: SecurityConfig = {
          installedApps: { bannedApplications: ['BannedApp'] }
        };

        const report = await auditor.auditSecurity(config);
        const appsResult = report.results.find(r => r.setting === 'Installed Applications');

        expect(appsResult).toBeDefined();
        expect(appsResult?.passed).toBe(false);
        expect(appsResult?.expected).toBe('No banned applications: BannedApp');
        expect(appsResult?.message).toContain('❌ Banned applications found: BannedApp');
        expect(appsResult?.message).toContain('All apps:');
      });

      it('should handle partial string matches for banned applications', async () => {
        // Mock the checker to return apps with partial matches
        (auditor as any).checker.checkInstalledApplications = jest.fn().mockResolvedValue({
          installedApps: ['Google Chrome', 'Firefox', 'Slack'],
          bannedAppsFound: [],
          sources: {
            applications: ['Google Chrome', 'Firefox', 'Slack'],
            homebrew: [],
            npm: []
          }
        });

        const config: SecurityConfig = {
          installedApps: { bannedApplications: ['chrome'] }
        };

        const report = await auditor.auditSecurity(config);
        const appsResult = report.results.find(r => r.setting === 'Installed Applications');

        expect(appsResult).toBeDefined();
        expect(appsResult?.passed).toBe(false);
        expect(appsResult?.message).toContain('❌ Banned applications found: Google Chrome');
      });

      it('should skip installed applications check when not configured', async () => {
        const config: SecurityConfig = {
          diskEncryption: { enabled: true }
        };

        const report = await auditor.auditSecurity(config);
        const appsResult = report.results.find(r => r.setting === 'Installed Applications');

        expect(appsResult).toBeUndefined();
      });

      it('should report applications from multiple sources', async () => {
        // Mock the checker to return apps from different sources
        (auditor as any).checker.checkInstalledApplications = jest.fn().mockResolvedValue({
          installedApps: ['Chrome', 'git', 'typescript'],
          bannedAppsFound: [],
          sources: {
            applications: ['Chrome'],
            homebrew: ['git'],
            npm: ['typescript']
          }
        });

        const config: SecurityConfig = {
          installedApps: { bannedApplications: [] }
        };

        const report = await auditor.auditSecurity(config);
        const appsResult = report.results.find(r => r.setting === 'Installed Applications');

        expect(appsResult).toBeDefined();
        expect(appsResult?.actual).toContain('1 in Applications, 1 via Homebrew, 1 via npm');
        expect(appsResult?.message).toContain('Chrome, git, typescript');
      });
    });
  });

  describe('Version Compatibility Checks', () => {
    it('should check version compatibility for approved version', async () => {
      // Mock the getCurrentMacOSVersion to return an approved version
      (auditor as any).versionInfo = null;
      jest.spyOn((auditor as any).checker, 'getCurrentMacOSVersion').mockResolvedValue('15.5');

      const versionInfo = await auditor.checkVersionCompatibility();

      expect(versionInfo.currentVersion).toBe('15.5');
      expect(versionInfo.isSupported).toBe(true);
      expect(versionInfo.isApproved).toBe(true);
      expect(versionInfo.isLegacy).toBe(false);
      expect(versionInfo.warningMessage).toBeUndefined();
    });

    it('should check version compatibility for untested but supported version', async () => {
      // Mock the getCurrentMacOSVersion to return a supported but untested version
      (auditor as any).versionInfo = null;
      jest.spyOn((auditor as any).checker, 'getCurrentMacOSVersion').mockResolvedValue('15.7');

      const versionInfo = await auditor.checkVersionCompatibility();

      expect(versionInfo.currentVersion).toBe('15.7');
      expect(versionInfo.isSupported).toBe(true);
      expect(versionInfo.isApproved).toBe(false);
      expect(versionInfo.isLegacy).toBe(false);
      expect(versionInfo.warningMessage).toContain('has not been fully tested');
      expect(versionInfo.warningMessage).toContain('false positives or false negatives');
    });

    it('should check version compatibility for legacy version', async () => {
      // Mock the getCurrentMacOSVersion to return a legacy version
      (auditor as any).versionInfo = null;
      jest.spyOn((auditor as any).checker, 'getCurrentMacOSVersion').mockResolvedValue('14.5');

      const versionInfo = await auditor.checkVersionCompatibility();

      expect(versionInfo.currentVersion).toBe('14.5');
      expect(versionInfo.isSupported).toBe(false);
      expect(versionInfo.isApproved).toBe(false);
      expect(versionInfo.isLegacy).toBe(true);
      expect(versionInfo.warningMessage).toContain('below version 15.0');
      expect(versionInfo.warningMessage).toContain('will return failure states');
    });

    it('should use LegacyMacOSSecurityChecker for legacy versions', async () => {
      // Mock the getCurrentMacOSVersion to return a legacy version
      (auditor as any).versionInfo = null;
      jest.spyOn((auditor as any).checker, 'getCurrentMacOSVersion').mockResolvedValue('14.5');

      await auditor.checkVersionCompatibility();

      // The checker should now be an instance of LegacyMacOSSecurityChecker
      expect((auditor as any).checker.constructor.name).toBe('LegacyMacOSSecurityChecker');
    });

    it('should include version compatibility result in audit for untested version', async () => {
      // Mock the getCurrentMacOSVersion to return an untested version
      (auditor as any).versionInfo = null;
      jest.spyOn((auditor as any).checker, 'getCurrentMacOSVersion').mockResolvedValue('16.0');

      const config: SecurityConfig = {
        diskEncryption: { enabled: true }
      };

      const report = await auditor.auditSecurity(config);

      const versionResult = report.results.find(r => r.setting === 'macOS Version Compatibility');
      expect(versionResult).toBeDefined();
      expect(versionResult?.passed).toBe(false);
      expect(versionResult?.actual).toBe('16.0');
      expect(versionResult?.message).toContain('has not been fully tested');
    });

    it('should include version compatibility result in audit for legacy version', async () => {
      // Mock the getCurrentMacOSVersion to return a legacy version
      (auditor as any).versionInfo = null;
      jest.spyOn((auditor as any).checker, 'getCurrentMacOSVersion').mockResolvedValue('13.0');

      const config: SecurityConfig = {
        diskEncryption: { enabled: true }
      };

      const report = await auditor.auditSecurity(config);

      const versionResult = report.results.find(r => r.setting === 'macOS Version Compatibility');
      expect(versionResult).toBeDefined();
      expect(versionResult?.passed).toBe(false);
      expect(versionResult?.actual).toBe('13.0');
      expect(versionResult?.message).toContain('below version 15.0');
    });

    it('should not include version compatibility result for approved versions', async () => {
      // Mock the getCurrentMacOSVersion to return an approved version
      (auditor as any).versionInfo = null;
      jest.spyOn((auditor as any).checker, 'getCurrentMacOSVersion').mockResolvedValue('15.6');

      const config: SecurityConfig = {
        diskEncryption: { enabled: true }
      };

      const report = await auditor.auditSecurity(config);

      const versionResult = report.results.find(r => r.setting === 'macOS Version Compatibility');
      expect(versionResult).toBeUndefined();
    });

    it('should cache version compatibility info', async () => {
      // Reset versionInfo cache to test caching behavior
      (auditor as any).versionInfo = null;
      const getCurrentVersionSpy = jest
        .spyOn((auditor as any).checker, 'getCurrentMacOSVersion')
        .mockResolvedValue('15.5');

      // Call twice
      await auditor.checkVersionCompatibility();
      await auditor.checkVersionCompatibility();

      // Should only call the actual method once due to caching
      expect(getCurrentVersionSpy).toHaveBeenCalledTimes(1);
    });
  });
});
