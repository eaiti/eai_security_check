import { MacOSSecurityChecker } from './security-checker';
import { SecurityConfig, SecurityCheckResult, SecurityReport } from './types';

export class SecurityAuditor {
  private checker: MacOSSecurityChecker;

  constructor() {
    this.checker = new MacOSSecurityChecker();
  }

  private getUpdateModeDescription(mode: string): string {
    switch (mode) {
      case 'disabled':
        return 'no automatic checking, downloading, or installing';
      case 'check-only':
        return 'automatic checking enabled, but manual download and install required';
      case 'download-only':
        return 'automatic checking and downloading, but manual install required';
      case 'fully-automatic':
        return 'automatic checking, downloading, and installing';
      default:
        return 'unknown update mode';
    }
  }

  async auditSecurity(config: SecurityConfig): Promise<SecurityReport> {
    const results: SecurityCheckResult[] = [];

    // Check FileVault (only if configured)
    if (config.filevault) {
      const fileVaultEnabled = await this.checker.checkFileVault();
      results.push({
        setting: 'FileVault',
        expected: config.filevault.enabled,
        actual: fileVaultEnabled,
        passed: fileVaultEnabled === config.filevault.enabled,
        message: fileVaultEnabled
          ? 'FileVault is enabled - disk encryption is active'
          : 'FileVault is disabled - disk is not encrypted'
      });
    }

    // Check password protection (only if configured)
    if (config.passwordProtection) {
      const passwordInfo = await this.checker.checkPasswordProtection();
      results.push({
        setting: 'Password Protection',
        expected: config.passwordProtection.enabled,
        actual: passwordInfo.enabled,
        passed: passwordInfo.enabled === config.passwordProtection.enabled,
        message: passwordInfo.enabled
          ? 'Password protection is enabled'
          : 'Password protection is disabled'
      });

      if (config.passwordProtection.requirePasswordImmediately !== undefined) {
        results.push({
          setting: 'Immediate Password Requirement',
          expected: config.passwordProtection.requirePasswordImmediately,
          actual: passwordInfo.requirePasswordImmediately,
          passed: passwordInfo.requirePasswordImmediately === config.passwordProtection.requirePasswordImmediately,
          message: passwordInfo.requirePasswordImmediately
            ? 'Password is required immediately after screen saver'
            : 'Password is not required immediately after screen saver'
        });
      }
    }

    // Check auto-lock timeout (only if configured)
    if (config.autoLock) {
      const autoLockTimeout = await this.checker.checkAutoLockTimeout();
      const autoLockPassed = autoLockTimeout <= config.autoLock.maxTimeoutMinutes && autoLockTimeout > 0;
      results.push({
        setting: 'Auto-lock Timeout',
        expected: `≤ ${config.autoLock.maxTimeoutMinutes} minutes`,
        actual: `${autoLockTimeout} minutes`,
        passed: autoLockPassed,
        message: autoLockPassed
          ? `Screen locks after ${autoLockTimeout} minutes (within acceptable limit)`
          : autoLockTimeout === 0
            ? 'Auto-lock is disabled'
            : `Screen locks after ${autoLockTimeout} minutes (exceeds ${config.autoLock.maxTimeoutMinutes} minute limit)`
      });
    }

    // Check Firewall (only if configured)
    if (config.firewall) {
      const firewallInfo = await this.checker.checkFirewall();
      results.push({
        setting: 'Firewall',
        expected: config.firewall.enabled,
        actual: firewallInfo.enabled,
        passed: firewallInfo.enabled === config.firewall.enabled,
        message: firewallInfo.enabled
          ? `Firewall is enabled${firewallInfo.stealthMode ? ' (stealth mode active)' : ''}`
          : 'Firewall is disabled - system is vulnerable to network attacks'
      });

      if (config.firewall.stealthMode !== undefined) {
        results.push({
          setting: 'Firewall Stealth Mode',
          expected: config.firewall.stealthMode,
          actual: firewallInfo.stealthMode,
          passed: firewallInfo.stealthMode === config.firewall.stealthMode,
          message: firewallInfo.stealthMode
            ? 'Firewall stealth mode is enabled - system is less visible to network scans'
            : 'Firewall stealth mode is disabled'
        });
      }
    }

    // Check Gatekeeper (only if configured)
    if (config.gatekeeper) {
      const gatekeeperEnabled = await this.checker.checkGatekeeper();
      results.push({
        setting: 'Gatekeeper',
        expected: config.gatekeeper.enabled,
        actual: gatekeeperEnabled,
        passed: gatekeeperEnabled === config.gatekeeper.enabled,
        message: gatekeeperEnabled
          ? 'Gatekeeper is enabled - unsigned applications are blocked'
          : 'Gatekeeper is disabled - unsigned applications can run'
      });
    }

    // Check System Integrity Protection (only if configured)
    if (config.systemIntegrityProtection) {
      const sipEnabled = await this.checker.checkSystemIntegrityProtection();
      results.push({
        setting: 'System Integrity Protection',
        expected: config.systemIntegrityProtection.enabled,
        actual: sipEnabled,
        passed: sipEnabled === config.systemIntegrityProtection.enabled,
        message: sipEnabled
          ? 'SIP is enabled - system files are protected'
          : 'SIP is disabled - system files are vulnerable'
      });
    }

    // Check Remote Login (only if configured)
    if (config.remoteLogin) {
      const remoteLoginEnabled = await this.checker.checkRemoteLogin();
      results.push({
        setting: 'Remote Login (SSH)',
        expected: config.remoteLogin.enabled,
        actual: remoteLoginEnabled,
        passed: remoteLoginEnabled === config.remoteLogin.enabled,
        message: remoteLoginEnabled
          ? 'Remote login is enabled - SSH access is available'
          : 'Remote login is disabled'
      });
    }

    // Check Remote Management (only if configured)
    if (config.remoteManagement) {
      const remoteManagementEnabled = await this.checker.checkRemoteManagement();
      results.push({
        setting: 'Remote Management',
        expected: config.remoteManagement.enabled,
        actual: remoteManagementEnabled,
        passed: remoteManagementEnabled === config.remoteManagement.enabled,
        message: remoteManagementEnabled
          ? 'Remote management is enabled - system can be managed remotely'
          : 'Remote management is disabled'
      });
    }

    // Check Automatic Updates (only if configured)
    if (config.automaticUpdates) {
      const updateInfo = await this.checker.checkAutomaticUpdates();
      
      // Check basic automatic updates enabled setting
      results.push({
        setting: 'Automatic Updates',
        expected: config.automaticUpdates.enabled,
        actual: updateInfo.enabled,
        passed: updateInfo.enabled === config.automaticUpdates.enabled,
        message: updateInfo.enabled
          ? 'Automatic update checking is enabled'
          : 'Automatic updates are disabled - security patches may be delayed'
      });

      // Check specific update mode if granular settings are provided
      if (config.automaticUpdates.downloadOnly !== undefined) {
        const downloadOnlyExpected = config.automaticUpdates.downloadOnly;
        const downloadOnlyActual = updateInfo.updateMode === 'download-only';
        results.push({
          setting: 'Automatic Update Mode',
          expected: downloadOnlyExpected ? 'download-only' : 'fully-automatic or disabled',
          actual: updateInfo.updateMode,
          passed: downloadOnlyExpected === downloadOnlyActual,
          message: `Update mode is "${updateInfo.updateMode}" - ${this.getUpdateModeDescription(updateInfo.updateMode)}`
        });
      } else if (config.automaticUpdates.automaticInstall !== undefined) {
        const automaticInstallExpected = config.automaticUpdates.automaticInstall;
        const automaticInstallActual = updateInfo.automaticInstall;
        results.push({
          setting: 'Automatic Installation',
          expected: automaticInstallExpected,
          actual: automaticInstallActual,
          passed: automaticInstallExpected === automaticInstallActual,
          message: automaticInstallActual
            ? 'All updates are installed automatically'
            : 'Updates require manual installation'
        });
      } else {
        // Provide general update mode information when no specific settings are configured
        results.push({
          setting: 'Automatic Update Mode',
          expected: 'At least download-only or fully-automatic',
          actual: updateInfo.updateMode,
          passed: updateInfo.updateMode !== 'disabled' && updateInfo.updateMode !== 'check-only',
          message: `Update mode is "${updateInfo.updateMode}" - ${this.getUpdateModeDescription(updateInfo.updateMode)}`
        });
      }

      // Check security updates setting - maintain backward compatibility
      if (config.automaticUpdates.securityUpdatesOnly !== undefined) {
        results.push({
          setting: 'Security Updates',
          expected: config.automaticUpdates.securityUpdatesOnly,
          actual: updateInfo.securityUpdatesOnly,
          passed: updateInfo.securityUpdatesOnly === config.automaticUpdates.securityUpdatesOnly,
          message: updateInfo.securityUpdatesOnly
            ? 'Security updates are automatically installed'
            : 'Security updates require manual installation'
        });
      } else if (config.automaticUpdates.automaticSecurityInstall !== undefined) {
        results.push({
          setting: 'Security Updates',
          expected: config.automaticUpdates.automaticSecurityInstall,
          actual: updateInfo.automaticSecurityInstall,
          passed: updateInfo.automaticSecurityInstall === config.automaticUpdates.automaticSecurityInstall,
          message: updateInfo.automaticSecurityInstall
            ? 'Security updates are automatically installed'
            : 'Security updates require manual installation'
        });
      }
    }

    // Check Sharing Services (only if configured)
    if (config.sharingServices) {
      const sharingInfo = await this.checker.checkSharingServices();

      if (config.sharingServices.fileSharing !== undefined) {
        results.push({
          setting: 'File Sharing',
          expected: config.sharingServices.fileSharing,
          actual: sharingInfo.fileSharing,
          passed: sharingInfo.fileSharing === config.sharingServices.fileSharing,
          message: sharingInfo.fileSharing
            ? 'File sharing is enabled'
            : 'File sharing is disabled'
        });
      }

      if (config.sharingServices.screenSharing !== undefined) {
        results.push({
          setting: 'Screen Sharing',
          expected: config.sharingServices.screenSharing,
          actual: sharingInfo.screenSharing,
          passed: sharingInfo.screenSharing === config.sharingServices.screenSharing,
          message: sharingInfo.screenSharing
            ? 'Screen sharing is enabled'
            : 'Screen sharing is disabled'
        });
      }
    }

    // Check OS Version (only if configured)
    if (config.osVersion) {
      const versionInfo = await this.checker.checkOSVersion(config.osVersion.targetVersion);
      const expectedMessage = versionInfo.isLatest ? 'latest macOS version' : `≥ ${versionInfo.target}`;
      
      results.push({
        setting: 'OS Version',
        expected: expectedMessage,
        actual: versionInfo.current,
        passed: versionInfo.passed,
        message: versionInfo.passed
          ? `macOS ${versionInfo.current} meets requirements (${versionInfo.isLatest ? 'checking against latest' : `target: ${versionInfo.target}`})`
          : `macOS ${versionInfo.current} is outdated (${versionInfo.isLatest ? 'latest available' : 'target'}: ${versionInfo.target})`
      });
    }

    // Check WiFi Network Security (only if configured)
    if (config.wifiSecurity) {
      const wifiInfo = await this.checker.checkCurrentWifiNetwork();
      const bannedNetworks = config.wifiSecurity.bannedNetworks || [];
      
      if (wifiInfo.connected && wifiInfo.networkName) {
        const isOnBannedNetwork = bannedNetworks.includes(wifiInfo.networkName);
        
        if (bannedNetworks.length === 0) {
          // If no banned networks configured, just log the current network and pass
          results.push({
            setting: 'WiFi Network Security',
            expected: 'Network monitoring (no restrictions configured)',
            actual: `Connected to: ${wifiInfo.networkName}`,
            passed: true,
            message: `Currently connected to WiFi network: ${wifiInfo.networkName} (no network restrictions configured)`
          });
        } else {
          // Check if current network is in banned list
          results.push({
            setting: 'WiFi Network Security',
            expected: `Not connected to banned networks: ${bannedNetworks.join(', ')}`,
            actual: `Connected to: ${wifiInfo.networkName}`,
            passed: !isOnBannedNetwork,
            message: isOnBannedNetwork
              ? `❌ Connected to banned network: ${wifiInfo.networkName}`
              : `✅ Connected to allowed network: ${wifiInfo.networkName}`
          });
        }
      } else {
        // Not connected to WiFi
        results.push({
          setting: 'WiFi Network Security',
          expected: bannedNetworks.length > 0 ? `Not connected to banned networks: ${bannedNetworks.join(', ')}` : 'Network monitoring',
          actual: 'Not connected to WiFi',
          passed: true,
          message: 'Not currently connected to any WiFi network'
        });
      }
    }

    const overallPassed = results.every(result => result.passed);

    return {
      timestamp: new Date().toISOString(),
      overallPassed,
      results
    };
  }

  async generateReport(config: SecurityConfig): Promise<string> {
    const systemInfo = await this.checker.getSystemInfo();
    const report = await this.auditSecurity(config);
    const explanations = this.checker.getSecurityExplanations();

    let output = `\n🔒 macOS Security Audit Report\n`;
    output += `📅 Generated: ${new Date(report.timestamp).toLocaleString()}\n`;
    output += `💻 System: ${systemInfo}\n`;
    output += `✅ Overall Status: ${report.overallPassed ? 'PASSED' : 'FAILED'}\n\n`;

    output += `📋 Security Check Results:\n`;
    output += `${'='.repeat(60)}\n`;

    for (const result of report.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const explanation = explanations[result.setting];

      output += `\n${status} ${result.setting}`;
      if (explanation) {
        output += ` [${explanation.riskLevel} Risk]`;
      }
      output += `\n`;
      output += `   Expected: ${result.expected}\n`;
      output += `   Actual: ${result.actual}\n`;
      output += `   Status: ${result.message}\n`;

      if (explanation) {
        output += `   📝 What it does: ${explanation.description}\n`;
        output += `   💡 Security advice: ${explanation.recommendation}\n`;
      }
    }

    if (!report.overallPassed) {
      output += `\n⚠️  Security Issues Found!\n`;
      output += `The checks marked as FAIL indicate potential security vulnerabilities.\n`;
      output += `Review the security advice above and adjust your system settings accordingly.\n`;

      // Group failed checks by risk level
      const failedChecks = report.results.filter(r => !r.passed);
      const highRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'High');
      const mediumRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'Medium');
      const lowRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'Low');

      if (highRisk.length > 0) {
        output += `\n🚨 HIGH PRIORITY: ${highRisk.map(r => r.setting).join(', ')}\n`;
      }
      if (mediumRisk.length > 0) {
        output += `⚠️  MEDIUM PRIORITY: ${mediumRisk.map(r => r.setting).join(', ')}\n`;
      }
      if (lowRisk.length > 0) {
        output += `📋 LOW PRIORITY: ${lowRisk.map(r => r.setting).join(', ')}\n`;
      }
    } else {
      output += `\n🎉 All security checks passed!\n`;
      output += `Your macOS system meets the specified security requirements.\n`;
      output += `Continue following security best practices to maintain protection.\n`;
    }

    return output;
  }

  async generateQuietReport(config: SecurityConfig): Promise<string> {
    const systemInfo = await this.checker.getSystemInfo();
    const report = await this.auditSecurity(config);

    let output = `🔒 macOS Security Audit Summary\n`;
    output += `📅 ${new Date(report.timestamp).toLocaleString()}\n`;
    output += `💻 ${systemInfo}\n`;
    output += `${report.overallPassed ? '✅ PASSED' : '❌ FAILED'} - ${report.results.filter(r => r.passed).length}/${report.results.length} checks passed\n`;

    if (!report.overallPassed) {
      const explanations = this.checker.getSecurityExplanations();
      const failedChecks = report.results.filter(r => !r.passed);
      const highRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'High');
      const mediumRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'Medium');
      const lowRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'Low');

      output += `\n🚨 Failed Checks:\n`;
      if (highRisk.length > 0) {
        output += `   HIGH (${highRisk.length}): ${highRisk.map(r => r.setting).join(', ')}\n`;
      }
      if (mediumRisk.length > 0) {
        output += `   MEDIUM (${mediumRisk.length}): ${mediumRisk.map(r => r.setting).join(', ')}\n`;
      }
      if (lowRisk.length > 0) {
        output += `   LOW (${lowRisk.length}): ${lowRisk.map(r => r.setting).join(', ')}\n`;
      }
      output += `\n💡 Run without --quiet for detailed recommendations\n`;
    }

    return output;
  }
}
