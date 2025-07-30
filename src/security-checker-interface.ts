/**
 * Common interface for platform-specific security checkers
 * Provides unified API for checking security settings across different operating systems
 */
export interface ISecurityChecker {
  /**
   * Check disk encryption status (FileVault on macOS, LUKS on Linux)
   */
  checkDiskEncryption?(): Promise<boolean>;

  /**
   * Check password protection and screen lock settings
   */
  checkPasswordProtection(): Promise<{
    enabled: boolean;
    requirePasswordImmediately: boolean;
    passwordRequiredAfterLock: boolean;
  }>;

  /**
   * Check auto-lock timeout settings
   */
  checkAutoLockTimeout(): Promise<number>;

  /**
   * Check firewall status
   */
  checkFirewall(): Promise<{ enabled: boolean; stealthMode: boolean }>;

  /**
   * Check package verification/code signing (Gatekeeper on macOS, package verification on Linux)
   */
  checkPackageVerification?(): Promise<boolean>;

  /**
   * Check system integrity protection (SIP on macOS, SELinux/AppArmor on Linux)
   */
  checkSystemIntegrityProtection(): Promise<boolean>;

  /**
   * Check SSH/remote login status
   */
  checkRemoteLogin(): Promise<boolean>;

  /**
   * Check remote management services
   */
  checkRemoteManagement(): Promise<boolean>;

  /**
   * Check automatic updates configuration
   */
  checkAutomaticUpdates(): Promise<{
    enabled: boolean;
    securityUpdatesOnly: boolean;
    automaticDownload?: boolean;
    automaticInstall?: boolean;
    automaticSecurityInstall?: boolean;
    configDataInstall?: boolean;
    updateMode?: 'disabled' | 'check-only' | 'download-only' | 'fully-automatic';
    downloadOnly?: boolean;
  }>;

  /**
   * Check sharing services (file, screen, media sharing)
   */
  checkSharingServices(): Promise<{
    fileSharing: boolean;
    screenSharing: boolean;
    remoteLogin: boolean;
    mediaSharing?: boolean;
  }>;

  /**
   * Get stored password for validation purposes
   */
  getPassword?(): string | undefined;

  // Platform-specific methods (optional)

  /**
   * Check FileVault status (macOS only)
   * @deprecated Use checkDiskEncryption() instead for cross-platform compatibility
   */
  checkFileVault?(): Promise<boolean>;

  /**
   * Check Gatekeeper status (macOS only)
   * @deprecated Use checkPackageVerification() instead for cross-platform compatibility
   */
  checkGatekeeper?(): Promise<boolean>;

  /**
   * Get security explanations for different checks
   */
  getSecurityExplanations?(): Record<
    string,
    {
      description: string;
      recommendation: string;
      riskLevel: 'High' | 'Medium' | 'Low';
    }
  >;

  /**
   * Get system information
   */
  getSystemInfo?(): Promise<string>;

  /**
   * Check OS version
   */
  checkOSVersion?(targetVersion: string): Promise<{
    current: string;
    target: string;
    isLatest: boolean;
    passed: boolean;
  }>;

  /**
   * Check current WiFi network
   */
  checkCurrentWifiNetwork?(): Promise<{
    networkName: string | null;
    connected: boolean;
  }>;

  /**
   * Check installed applications
   */
  checkInstalledApplications?(): Promise<{
    installedApps: string[];
    bannedAppsFound: string[];
    sources: { applications: string[]; homebrew: string[]; npm: string[] };
  }>;

  /**
   * Get current platform version
   */
  getCurrentLinuxVersion?(): Promise<string>;
  getCurrentMacOSVersion?(): Promise<string>;

  /**
   * Get current platform distribution
   */
  getCurrentLinuxDistribution?(): Promise<string>;
}