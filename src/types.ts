export interface SecurityConfig {
  filevault?: {
    enabled: boolean;
  };
  passwordProtection?: {
    enabled: boolean;
    requirePasswordImmediately?: boolean;
  };
  autoLock?: {
    maxTimeoutMinutes: number;
  };
  firewall?: {
    enabled: boolean;
    stealthMode?: boolean;
  };
  gatekeeper?: {
    enabled: boolean;
  };
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
  };
  sharingServices?: {
    fileSharing?: boolean;
    screenSharing?: boolean;
    remoteLogin?: boolean;
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
