export interface SecurityConfig {
  // Disk encryption (FileVault on macOS, LUKS on Linux)
  filevault?: {
    enabled: boolean;
  };
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
  gatekeeper?: {
    enabled: boolean;
  };
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
    downloadOnly?: boolean;           // Check and download, but don't install
    automaticInstall?: boolean;       // Install all updates automatically
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
    target: 'macos' | 'linux' | 'auto'; // Target platform, 'auto' detects automatically
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

export interface SchedulingConfig {
  enabled: boolean;
  intervalDays: number;  // How often to run checks (default: 7 days)
  email: EmailConfig;
  reportFormat: 'email' | 'plain' | 'markdown' | 'json';
  securityProfile: string;  // Which security profile to use for checks
  customConfigPath?: string;  // Optional path to custom security config
}

export interface DaemonState {
  lastReportSent: string;  // ISO timestamp
  totalReportsGenerated: number;
  daemonStarted: string;  // ISO timestamp
}
