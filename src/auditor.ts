import { MacOSSecurityChecker } from './security-checker';
import { LegacyMacOSSecurityChecker } from './legacy-security-checker';
import { LinuxSecurityChecker } from './linux-security-checker';
import { SecurityConfig, SecurityCheckResult, SecurityReport } from './types';
import { validatePasswordConfiguration } from './password-utils';
import { PlatformDetector, Platform, PlatformInfo } from './platform-detector';

export interface VersionCompatibilityInfo {
  currentVersion: string;
  isSupported: boolean;
  isApproved: boolean;
  warningMessage?: string;
  isLegacy: boolean;
  platform: Platform;
  distribution?: string;
}

export class SecurityAuditor {
  private checker: MacOSSecurityChecker | LinuxSecurityChecker;
  private versionInfo: VersionCompatibilityInfo | null = null;
  private initialPassword?: string;
  private platformInfo: PlatformInfo | null = null;

  constructor(password?: string) {
    this.initialPassword = password;
    // Default to macOS checker, will be updated in checkVersionCompatibility
    this.checker = new MacOSSecurityChecker(password);
  }

  /**
   * Check version compatibility for the current platform
   */
  async checkVersionCompatibility(): Promise<VersionCompatibilityInfo> {
    if (this.versionInfo) {
      return this.versionInfo;
    }

    // Detect platform first
    this.platformInfo = await PlatformDetector.detectPlatform();
    
    if (this.platformInfo.platform === Platform.MACOS) {
      return await this.checkMacOSCompatibility();
    } else if (this.platformInfo.platform === Platform.LINUX) {
      return await this.checkLinuxCompatibility();
    } else {
      // Unsupported platform
      this.versionInfo = {
        currentVersion: 'unknown',
        isSupported: false,
        isApproved: false,
        warningMessage: this.platformInfo.warningMessage,
        isLegacy: false,
        platform: Platform.UNSUPPORTED,
        distribution: this.platformInfo.distribution
      };
      return this.versionInfo;
    }
  }

  /**
   * Check macOS version compatibility
   */
  private async checkMacOSCompatibility(): Promise<VersionCompatibilityInfo> {
    const currentVersion = await (this.checker as MacOSSecurityChecker).getCurrentMacOSVersion();
    
    // Approved versions that have been tested
    const approvedVersions = ['15.5', '15.6'];
    const isApproved = approvedVersions.includes(currentVersion);
    
    // Check if version is legacy (below 15.0)
    const isLegacy = this.compareVersions(currentVersion, '15.0') < 0;
    
    // Version is supported if it's 15.0 or higher
    const isSupported = !isLegacy;
    
    let warningMessage: string | undefined;
    
    if (isLegacy) {
      warningMessage = `⚠️  macOS ${currentVersion} is below version 15.0. Security checks may not work correctly and will return failure states. Please upgrade to macOS 15.0 or later for full functionality.`;
    } else if (!isApproved) {
      warningMessage = `⚠️  macOS ${currentVersion} has not been fully tested with this tool. This tool has been tested with macOS 15.5 and 15.6. Results may include false positives or false negatives.`;
    }

    this.versionInfo = {
      currentVersion,
      isSupported,
      isApproved,
      warningMessage,
      isLegacy,
      platform: Platform.MACOS
    };

    // Switch to legacy checker if needed
    if (isLegacy) {
      this.checker = new LegacyMacOSSecurityChecker(this.initialPassword);
    }

    return this.versionInfo;
  }

  /**
   * Check Linux version compatibility
   */
  private async checkLinuxCompatibility(): Promise<VersionCompatibilityInfo> {
    // Switch to Linux checker
    this.checker = new LinuxSecurityChecker(this.initialPassword);
    
    const currentVersion = await (this.checker as LinuxSecurityChecker).getCurrentLinuxVersion();
    const distribution = await (this.checker as LinuxSecurityChecker).getCurrentLinuxDistribution();
    
    // Supported distributions
    const supportedDistributions = ['fedora', 'ubuntu', 'debian', 'centos', 'rhel'];
    const isSupported = supportedDistributions.includes(distribution.toLowerCase());
    
    // Primary support is for Fedora
    const isApproved = distribution.toLowerCase() === 'fedora';
    
    let warningMessage: string | undefined;
    
    if (!isSupported) {
      warningMessage = `⚠️  Linux distribution '${distribution}' is not officially supported. Supported: ${supportedDistributions.join(', ')}. Security checks may not work correctly.`;
    } else if (!isApproved) {
      warningMessage = `⚠️  Linux distribution '${distribution}' has limited testing. Primary support is for Fedora. Some checks may not work correctly.`;
    }

    this.versionInfo = {
      currentVersion,
      isSupported,
      isApproved,
      warningMessage,
      isLegacy: false, // Linux doesn't have legacy versions in our context
      platform: Platform.LINUX,
      distribution
    };

    return this.versionInfo;
  }

  private parseVersion(version: string): number[] {
    return version.split('.').map(n => parseInt(n, 10));
  }

  private compareVersions(current: string, target: string): number {
    const currentParts = this.parseVersion(current);
    const targetParts = this.parseVersion(target);

    // Normalize arrays to same length
    const maxLength = Math.max(currentParts.length, targetParts.length);
    while (currentParts.length < maxLength) currentParts.push(0);
    while (targetParts.length < maxLength) targetParts.push(0);

    for (let i = 0; i < maxLength; i++) {
      if (currentParts[i] > targetParts[i]) return 1;
      if (currentParts[i] < targetParts[i]) return -1;
    }
    return 0; // Equal
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
    // Check version compatibility first
    const versionInfo = await this.checkVersionCompatibility();
    
    const results: SecurityCheckResult[] = [];

    // Add version compatibility result if there are warnings
    if (versionInfo.warningMessage) {
      const platformName = versionInfo.platform === Platform.MACOS ? 'macOS' : 
                          versionInfo.platform === Platform.LINUX ? 'Linux' : 'Platform';
      const compatibilityName = `${platformName} Version Compatibility`;
      
      let expectedText = '';
      if (versionInfo.platform === Platform.MACOS) {
        expectedText = versionInfo.isLegacy ? '≥ 15.0 (for full functionality)' : 'Tested version (15.5 or 15.6)';
      } else if (versionInfo.platform === Platform.LINUX) {
        expectedText = 'Supported distribution (Fedora recommended)';
      } else {
        expectedText = 'Supported platform';
      }
      
      const actualText = versionInfo.distribution ? 
        `${versionInfo.distribution} ${versionInfo.currentVersion}` : 
        versionInfo.currentVersion;
      
      results.push({
        setting: compatibilityName,
        expected: expectedText,
        actual: actualText,
        passed: versionInfo.isApproved,
        message: versionInfo.warningMessage
      });
    }

    // Check password configuration (only if configured)
    if (config.password) {
      let currentPassword: string | undefined;
      
      // Only get password from macOS checker (Linux checker doesn't have this method)
      if (versionInfo.platform === Platform.MACOS) {
        currentPassword = (this.checker as MacOSSecurityChecker).getPassword();
      }
      
      const passwordValidation = await validatePasswordConfiguration(currentPassword, config.password);
      
      // Generate description of requirements
      const requirements = [];
      if (config.password.minLength > 0) {
        requirements.push(`${config.password.minLength}+ characters`);
      }
      
      const charTypes = [];
      if (config.password.requireUppercase) charTypes.push('uppercase');
      if (config.password.requireLowercase) charTypes.push('lowercase');
      if (config.password.requireNumber) charTypes.push('number');
      if (config.password.requireSpecialChar) charTypes.push('special character');
      
      if (charTypes.length > 0) {
        requirements.push(`with ${charTypes.join(', ')}`);
      } else if (config.password.minLength > 0) {
        requirements.push('(any characters allowed)');
      }
      
      const requirementsText = requirements.join(' ');
      const expectedText = config.password.required 
        ? `Required: Yes, Requirements: ${requirementsText}, Max Age: ${config.password.maxAgeDays} days`
        : 'Required: No';
      
      const actualText = config.password.required 
        ? (passwordValidation.overallValid ? 'Configuration loaded' : 'Validation failed')
        : 'Configuration loaded';
      
      let statusMessage = '';
      if (!config.password.required) {
        statusMessage = 'Password validation is disabled';
      } else if (passwordValidation.overallValid) {
        statusMessage = `Password validation is enabled with ${requirementsText} and ${config.password.maxAgeDays}-day expiration`;
      } else {
        const issues = [];
        if (!passwordValidation.requirementsValid) {
          issues.push(`Requirements: ${passwordValidation.requirementsMessage}`);
        }
        if (!passwordValidation.expirationValid) {
          issues.push(`Expiration: ${passwordValidation.expirationMessage}`);
        }
        statusMessage = issues.join('; ');
      }
      
      results.push({
        setting: 'Password Configuration',
        expected: expectedText,
        actual: actualText,
        passed: !config.password.required || passwordValidation.overallValid,
        message: statusMessage
      });
    }

    // Check disk encryption (FileVault on macOS, LUKS on Linux)
    if (config.filevault || config.diskEncryption) {
      const encryptionEnabled = versionInfo.platform === Platform.MACOS ? 
        await (this.checker as MacOSSecurityChecker).checkFileVault() :
        await (this.checker as LinuxSecurityChecker).checkDiskEncryption();
      
      const configEnabled = config.filevault?.enabled ?? config.diskEncryption?.enabled ?? false;
      const settingName = versionInfo.platform === Platform.MACOS ? 'FileVault' : 'Disk Encryption (LUKS)';
      const enabledMessage = versionInfo.platform === Platform.MACOS ? 
        'FileVault is enabled - disk encryption is active' :
        'Disk encryption is enabled - LUKS encryption is active';
      const disabledMessage = versionInfo.platform === Platform.MACOS ? 
        'FileVault is disabled - disk is not encrypted' :
        'Disk encryption is disabled - disk is not encrypted';
      
      results.push({
        setting: settingName,
        expected: configEnabled,
        actual: encryptionEnabled,
        passed: encryptionEnabled === configEnabled,
        message: encryptionEnabled ? enabledMessage : disabledMessage
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

    // Check Gatekeeper/Package Verification (only if configured)
    if (config.gatekeeper || config.packageVerification) {
      const verificationEnabled = versionInfo.platform === Platform.MACOS ? 
        await (this.checker as MacOSSecurityChecker).checkGatekeeper() :
        await (this.checker as LinuxSecurityChecker).checkPackageVerification();
      
      const configEnabled = config.gatekeeper?.enabled ?? config.packageVerification?.enabled ?? false;
      const settingName = versionInfo.platform === Platform.MACOS ? 'Gatekeeper' : 'Package Verification';
      const enabledMessage = versionInfo.platform === Platform.MACOS ? 
        'Gatekeeper is enabled - unsigned applications are blocked' :
        'Package verification is enabled - unsigned packages are blocked';
      const disabledMessage = versionInfo.platform === Platform.MACOS ? 
        'Gatekeeper is disabled - unsigned applications can run' :
        'Package verification is disabled - unsigned packages can be installed';
      
      results.push({
        setting: settingName,
        expected: configEnabled,
        actual: verificationEnabled,
        passed: verificationEnabled === configEnabled,
        message: verificationEnabled ? enabledMessage : disabledMessage
      });
    }

    // Check System Integrity Protection (only if configured)
    if (config.systemIntegrityProtection) {
      const sipEnabled = await this.checker.checkSystemIntegrityProtection();
      const settingName = versionInfo.platform === Platform.MACOS ? 
        'System Integrity Protection' : 'System Integrity Protection (SELinux/AppArmor)';
      const enabledMessage = versionInfo.platform === Platform.MACOS ? 
        'SIP is enabled - system files are protected' :
        'System integrity protection is enabled (SELinux/AppArmor)';
      const disabledMessage = versionInfo.platform === Platform.MACOS ? 
        'SIP is disabled - system files are vulnerable' :
        'System integrity protection is disabled';
      
      results.push({
        setting: settingName,
        expected: config.systemIntegrityProtection.enabled,
        actual: sipEnabled,
        passed: sipEnabled === config.systemIntegrityProtection.enabled,
        message: sipEnabled ? enabledMessage : disabledMessage
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
        
        let downloadOnlyActual = false;
        let actualModeText = '';
        
        if (versionInfo.platform === Platform.MACOS) {
          const macUpdateInfo = updateInfo as any; // Type assertion for macOS-specific fields
          downloadOnlyActual = macUpdateInfo.updateMode === 'download-only';
          actualModeText = macUpdateInfo.updateMode;
        } else {
          const linuxUpdateInfo = updateInfo as any; // Type assertion for Linux-specific fields
          downloadOnlyActual = linuxUpdateInfo.downloadOnly || false;
          actualModeText = linuxUpdateInfo.downloadOnly ? 'download-only' : (linuxUpdateInfo.automaticInstall ? 'fully-automatic' : 'disabled');
        }
        
        results.push({
          setting: 'Automatic Update Mode',
          expected: downloadOnlyExpected ? 'download-only' : 'fully-automatic or disabled',
          actual: actualModeText,
          passed: downloadOnlyExpected === downloadOnlyActual,
          message: `Update mode is "${actualModeText}" - ${this.getUpdateModeDescription(actualModeText)}`
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
        let actualModeText = '';
        let modePassed = false;
        
        if (versionInfo.platform === Platform.MACOS) {
          const macUpdateInfo = updateInfo as any; // Type assertion for macOS-specific fields
          actualModeText = macUpdateInfo.updateMode;
          modePassed = macUpdateInfo.updateMode !== 'disabled' && macUpdateInfo.updateMode !== 'check-only';
        } else {
          const linuxUpdateInfo = updateInfo as any; // Type assertion for Linux-specific fields
          actualModeText = linuxUpdateInfo.downloadOnly ? 'download-only' : (linuxUpdateInfo.automaticInstall ? 'fully-automatic' : 'disabled');
          modePassed = linuxUpdateInfo.downloadOnly || linuxUpdateInfo.automaticInstall;
        }
        
        results.push({
          setting: 'Automatic Update Mode',
          expected: 'At least download-only or fully-automatic',
          actual: actualModeText,
          passed: modePassed,
          message: `Update mode is "${actualModeText}" - ${this.getUpdateModeDescription(actualModeText)}`
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

    // Check OS Version (only if configured and supported on platform)
    if (config.osVersion && versionInfo.platform === Platform.MACOS) {
      const macChecker = this.checker as MacOSSecurityChecker;
      const versionInfo = await macChecker.checkOSVersion(config.osVersion.targetVersion);
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

    // Check WiFi Network Security (only if configured and supported on platform)
    if (config.wifiSecurity && versionInfo.platform === Platform.MACOS) {
      const macChecker = this.checker as MacOSSecurityChecker;
      const wifiInfo = await macChecker.checkCurrentWifiNetwork();
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

    // Check Installed Applications (only if configured and supported on platform)
    if (config.installedApps && versionInfo.platform === Platform.MACOS) {
      const macChecker = this.checker as MacOSSecurityChecker;
      const appInfo = await macChecker.checkInstalledApplications();
      const bannedApps = config.installedApps.bannedApplications || [];
      
      // Find any banned apps that are currently installed
      const bannedAppsFound = appInfo.installedApps.filter((app: any) => 
        bannedApps.some(banned => 
          app.toLowerCase().includes(banned.toLowerCase()) || 
          banned.toLowerCase().includes(app.toLowerCase())
        )
      );

      const totalAppsCount = appInfo.installedApps.length;
      const appSummary = `${totalAppsCount} total apps: ${appInfo.sources.applications.length} in Applications, ${appInfo.sources.homebrew.length} via Homebrew, ${appInfo.sources.npm.length} via npm`;
      
      if (bannedApps.length === 0) {
        // If no banned apps configured, just report the installed apps and pass
        results.push({
          setting: 'Installed Applications',
          expected: 'Application monitoring (no restrictions configured)',
          actual: appSummary,
          passed: true,
          message: `Detected applications: ${appInfo.installedApps.join(', ')}`
        });
      } else {
        // Check if any banned apps are installed
        const hasBannedApps = bannedAppsFound.length > 0;
        
        results.push({
          setting: 'Installed Applications',
          expected: `No banned applications: ${bannedApps.join(', ')}`,
          actual: appSummary,
          passed: !hasBannedApps,
          message: hasBannedApps
            ? `❌ Banned applications found: ${bannedAppsFound.join(', ')} | All apps: ${appInfo.installedApps.join(', ')}`
            : `✅ No banned applications detected | All apps: ${appInfo.installedApps.join(', ')}`
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
    const versionInfo = await this.checkVersionCompatibility();
    const report = await this.auditSecurity(config);
    
    // Get system info and explanations (macOS only)
    let systemInfo = null;
    let explanations = null;
    
    if (versionInfo.platform === Platform.MACOS) {
      const macChecker = this.checker as MacOSSecurityChecker;
      systemInfo = await macChecker.getSystemInfo();
      explanations = macChecker.getSecurityExplanations();
    }

    const platformName = versionInfo.platform === Platform.MACOS ? 'macOS' : 'Linux';
    let output = `\n🔒 ${platformName} Security Audit Report\n`;
    output += `📅 Generated: ${new Date(report.timestamp).toLocaleString()}\n`;
    
    if (systemInfo) {
      output += `💻 System: ${systemInfo}\n`;
    } else {
      // Generic system info for Linux
      const distribution = versionInfo.distribution || 'Unknown';
      output += `💻 System: ${distribution} ${versionInfo.currentVersion}\n`;
    }
    
    // Add version compatibility information
    if (versionInfo.warningMessage) {
      output += `⚠️  Version Status: ${versionInfo.warningMessage}\n`;
    } else {
      const systemText = versionInfo.platform === Platform.MACOS ? 
        `macOS ${versionInfo.currentVersion}` : 
        `${versionInfo.distribution} ${versionInfo.currentVersion}`;
      output += `✅ Version Status: ${systemText} is fully supported\n`;
    }
    
    output += `✅ Overall Status: ${report.overallPassed ? 'PASSED' : 'FAILED'}\n\n`;

    // Special message for legacy versions
    if (versionInfo.isLegacy) {
      output += `🚨 IMPORTANT: You are running macOS ${versionInfo.currentVersion}, which is below the minimum supported version (15.0).\n`;
      output += `All security checks will report as failed because automated checking is not supported on this version.\n`;
      output += `Please upgrade to macOS 15.0 or later, or manually verify your security settings.\n\n`;
    } else if (!versionInfo.isApproved) {
      output += `📝 NOTE: This tool has been tested primarily with macOS 15.5 and 15.6.\n`;
      output += `Results on macOS ${versionInfo.currentVersion} may include false positives or false negatives.\n`;
      output += `Please review results carefully and verify manually if needed.\n\n`;
    }

    output += `📋 Security Check Results:\n`;
    output += `${'='.repeat(60)}\n`;

    for (const result of report.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const explanation = explanations ? explanations[result.setting] : null;

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

      // Group failed checks by risk level (only if explanations are available)
      const failedChecks = report.results.filter(r => !r.passed);
      
      if (explanations) {
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
      } else if (failedChecks.length > 0) {
        output += `\n❌ FAILED CHECKS: ${failedChecks.map(r => r.setting).join(', ')}\n`;
      }
    } else {
      output += `\n🎉 All security checks passed!\n`;
      output += `Your macOS system meets the specified security requirements.\n`;
      output += `Continue following security best practices to maintain protection.\n`;
    }

    return output;
  }

  async generateQuietReport(config: SecurityConfig): Promise<string> {
    const versionInfo = await this.checkVersionCompatibility();
    const report = await this.auditSecurity(config);

    // Get system info (macOS only)
    let systemInfo = null;
    let explanations = null;
    
    if (versionInfo.platform === Platform.MACOS) {
      const macChecker = this.checker as MacOSSecurityChecker;
      systemInfo = await macChecker.getSystemInfo();
      explanations = macChecker.getSecurityExplanations();
    }

    const platformName = versionInfo.platform === Platform.MACOS ? 'macOS' : 'Linux';
    let output = `🔒 ${platformName} Security Audit Summary\n`;
    output += `📅 ${new Date(report.timestamp).toLocaleString()}\n`;
    
    if (systemInfo) {
      output += `💻 ${systemInfo}\n`;
    } else {
      const distribution = versionInfo.distribution || 'Unknown';
      output += `💻 ${distribution} ${versionInfo.currentVersion}\n`;
    }
    
    // Add version compatibility status
    if (versionInfo.isLegacy) {
      output += `⚠️  Version: ${versionInfo.currentVersion} (legacy - checks not supported)\n`;
    } else if (!versionInfo.isApproved) {
      const systemText = versionInfo.platform === Platform.MACOS ? 
        versionInfo.currentVersion : 
        `${versionInfo.distribution} ${versionInfo.currentVersion}`;
      output += `⚠️  Version: ${systemText} (untested - may have false positives/negatives)\n`;
    } else {
      const systemText = versionInfo.platform === Platform.MACOS ? 
        versionInfo.currentVersion : 
        `${versionInfo.distribution} ${versionInfo.currentVersion}`;
      output += `✅ Version: ${systemText} (fully supported)\n`;
    }
    
    output += `${report.overallPassed ? '✅ PASSED' : '❌ FAILED'} - ${report.results.filter(r => r.passed).length}/${report.results.length} checks passed\n`;

    if (!report.overallPassed) {
      const failedChecks = report.results.filter(r => !r.passed);
      
      output += `\n🚨 Failed Checks:\n`;
      
      if (explanations) {
        const highRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'High');
        const mediumRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'Medium');
        const lowRisk = failedChecks.filter(r => explanations[r.setting]?.riskLevel === 'Low');

        if (highRisk.length > 0) {
          output += `   HIGH (${highRisk.length}): ${highRisk.map(r => r.setting).join(', ')}\n`;
        }
        if (mediumRisk.length > 0) {
          output += `   MEDIUM (${mediumRisk.length}): ${mediumRisk.map(r => r.setting).join(', ')}\n`;
        }
        if (lowRisk.length > 0) {
          output += `   LOW (${lowRisk.length}): ${lowRisk.map(r => r.setting).join(', ')}\n`;
        }
      } else {
        output += `   ${failedChecks.map(r => r.setting).join(', ')}\n`;
      }
      output += `\n💡 Run without --quiet for detailed recommendations\n`;
    }

    return output;
  }
}
