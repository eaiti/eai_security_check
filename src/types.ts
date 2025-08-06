export interface SecurityConfig {
  // Disk encryption (FileVault on macOS, LUKS on Linux)
  diskEncryption?: {
    enabled: boolean;
  };
  passwordProtection?: {
    enabled: boolean;
    requirePasswordImmediately?: boolean;
  };
  password?: {
    required: boolean;
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecialChar: boolean;
    maxAgeDays: number;
  };
  autoLock?: {
    maxTimeoutMinutes: number;
  };
  firewall?: {
    enabled: boolean;
    stealthMode?: boolean;
  };
  // Code signing/package verification (Gatekeeper on macOS, package verification on Linux)
  packageVerification?: {
    enabled: boolean;
  };
  // System protection (SIP on macOS, SELinux/AppArmor on Linux)
  systemIntegrityProtection?: {
    enabled: boolean;
  };
  remoteLogin?: {
    enabled: boolean;
  };
  remoteManagement?: {
    enabled: boolean;
  };
  automaticUpdates?: {
    enabled: boolean;
    securityUpdatesOnly?: boolean;
    // New granular settings for improved detection
    downloadOnly?: boolean; // Check and download, but don't install
    automaticInstall?: boolean; // Install all updates automatically
    automaticSecurityInstall?: boolean; // Install security updates automatically
  };
  sharingServices?: {
    fileSharing?: boolean;
    screenSharing?: boolean;
    remoteLogin?: boolean;
  };
  osVersion?: {
    targetVersion: string; // Version number like "14.0" or "latest" for Apple's current release
  };
  wifiSecurity?: {
    bannedNetworks: string[]; // List of WiFi network names that should not be used
  };
  installedApps?: {
    bannedApplications: string[]; // List of application names that should not be installed
  };
  // Platform-specific settings
  platform?: {
    target: "macos" | "linux" | "auto"; // Target platform, 'auto' detects automatically
  };
}

export interface SecurityCheckResult {
  setting: string;
  expected: any;
  actual: any;
  passed: boolean;
  message: string;
}

export interface SecurityReport {
  timestamp: string;
  overallPassed: boolean;
  results: SecurityCheckResult[];
}

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  to: string[];
  subject?: string;
}

export interface ScpConfig {
  enabled: boolean;
  host: string;
  username: string;
  destinationDirectory: string;
  authMethod: "password" | "key";
  password?: string; // For password authentication
  privateKeyPath?: string; // For key-based authentication
  port?: number; // SSH port, defaults to 22
}

export interface SchedulingConfig {
  enabled: boolean;
  intervalDays: number; // How often to run checks (default: 7 days)
  intervalMinutes?: number; // Alternative interval in minutes for testing (overrides intervalDays)
  email?: EmailConfig; // Optional email configuration
  scp?: ScpConfig; // Optional SCP file transfer configuration
  reportFormat: "email" | "plain" | "markdown" | "json";
  securityProfile: string; // Which security profile to use for checks
  customConfigPath?: string; // Optional path to custom security config
  userId?: string; // User identifier included in reports and emails
}

export interface DaemonState {
  lastReportSent: string; // ISO timestamp
  totalReportsGenerated: number;
  daemonStarted: string; // ISO timestamp
  currentVersion?: string; // Version of the daemon currently running
  lastVersionCheck?: string; // ISO timestamp of last version check
}

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
    updateMode?:
      | "disabled"
      | "check-only"
      | "download-only"
      | "fully-automatic";
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
      riskLevel: "High" | "Medium" | "Low";
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
