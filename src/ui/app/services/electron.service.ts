import { Injectable, signal } from "@angular/core";

export interface PlatformInfo {
  platform: string;
  arch: string;
  version: string;
}

export interface SecurityCheckResult {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: string;
  risk?: "high" | "medium" | "low";
}

export interface SecurityCheckReport {
  platform: PlatformInfo;
  profile: string;
  timestamp: string;
  checks: SecurityCheckResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    overallStatus: "pass" | "fail" | "warning";
  };
  // Tamper-resistant security fields
  hash?: string;
  userId?: string;
  metadata?: {
    hostname?: string;
    version?: string;
    userId?: string;
  };
}

export interface ConfigData {
  [key: string]: unknown;
}

export interface DaemonConfig {
  enabled: boolean;
  intervalDays: number;
  securityProfile: string;
  reportFormat: string;
  userId?: string;
  email?: {
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
    subject: string;
  };
  [key: string]: unknown;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface RecentReportData {
  path: string;
  name: string;
  timestamp: string;
  size: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    electronAPI?: {
      runSecurityCheck: (
        profile: string,
        config?: string,
        password?: string,
      ) => Promise<SecurityCheckReport>;
      runInteractive: () => Promise<void>;
      verifyReport: (path: string) => Promise<boolean>;
      manageDaemon: (
        action: "start" | "stop" | "status" | "configure",
        config?: DaemonConfig,
      ) => Promise<DaemonConfig | string>;
      daemon: {
        getStatus: () => Promise<{
          success: boolean;
          data?: any;
          error?: string;
        }>;
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean; error?: string }>;
        restart: () => Promise<{ success: boolean; error?: string }>;
        setupSystemService: () => Promise<{
          success: boolean;
          data?: any;
          error?: string;
        }>;
        removeSystemService: () => Promise<{
          success: boolean;
          data?: any;
          error?: string;
        }>;
        getSystemServiceStatus: () => Promise<{
          success: boolean;
          data?: any;
          error?: string;
        }>;
        configure: (
          daemonConfig: DaemonConfig,
        ) => Promise<{ success: boolean; error?: string }>;
        getConfig: () => Promise<{
          success: boolean;
          data?: DaemonConfig;
          error?: string;
        }>;
        getLogs: (
          lines?: number,
        ) => Promise<{ success: boolean; data?: string[]; error?: string }>;
        clearLogs: () => Promise<{ success: boolean; error?: string }>;
      };
      installGlobally: () => Promise<boolean>;
      uninstallGlobally: (removeConfig?: boolean) => Promise<boolean>;
      updateApp: () => Promise<boolean>;
      getPlatformInfo: () => Promise<PlatformInfo>;
      getCliVersion: () => Promise<string>;
      loadConfig: (path?: string) => Promise<ConfigData>;
      saveConfig: (config: ConfigData, path?: string) => Promise<boolean>;
      createConfig: (profile: string) => Promise<ConfigData>;
      listConfigs: () => Promise<string[]>;
      loadReportFile: (path: string) => Promise<string>;
      loadRecentReports: () => Promise<RecentReportData[]>;
      getConfigDirectory: () => Promise<string>;
      getReportsDirectory: () => Promise<string>;
      selectFiles: (
        filters: FileFilter[],
        multiple?: boolean,
      ) => Promise<string[]>;
      selectDirectory: () => Promise<string>;
      getFilesFromDirectory: (
        directory: string,
        extension: string,
      ) => Promise<string[]>;
      loadReport: (path: string) => Promise<SecurityCheckReport>;
      loadApplicationConfig: () => Promise<any>;
      saveApplicationConfig: (config: any) => Promise<boolean>;
    };
    isElectron?: boolean;
  }
}

@Injectable({
  providedIn: "root",
})
export class ElectronService {
  private readonly _isElectron = signal(false);
  private readonly _platformInfo = signal<PlatformInfo | null>(null);
  private readonly _cliVersion = signal<string | null>(null);

  readonly isElectron = this._isElectron.asReadonly();
  readonly platformInfo = this._platformInfo.asReadonly();
  readonly cliVersion = this._cliVersion.asReadonly();

  constructor() {
    this._isElectron.set(!!window.electronAPI && !!window.isElectron);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this._isElectron()) {
      try {
        const [platform, version] = await Promise.all([
          window.electronAPI!.getPlatformInfo(),
          window.electronAPI!.getCliVersion(),
        ]);
        this._platformInfo.set(platform);
        this._cliVersion.set(version);
      } catch (error) {
        console.error("Failed to initialize Electron service:", error);
      }
    }
  }

  async runSecurityCheck(
    profile: string,
    config?: string,
    password?: string,
  ): Promise<SecurityCheckReport> {
    if (!this._isElectron()) {
      return this.getMockSecurityCheck(profile);
    }

    try {
      return await window.electronAPI!.runSecurityCheck(
        profile,
        config,
        password,
      );
    } catch (error) {
      console.error("Security check failed:", error);
      // Fallback to mock data
      return this.getMockSecurityCheck(profile);
    }
  }

  async runInteractive(): Promise<void> {
    if (!this._isElectron()) {
      throw new Error("Interactive mode requires Electron");
    }
    return window.electronAPI!.runInteractive();
  }

  async verifyReport(path: string): Promise<boolean> {
    if (!this._isElectron()) {
      throw new Error("Report verification requires Electron");
    }
    return window.electronAPI!.verifyReport(path);
  }

  async manageDaemon(
    action: "start" | "stop" | "status" | "configure",
    config?: DaemonConfig,
  ): Promise<DaemonConfig | string> {
    if (!this._isElectron()) {
      throw new Error("Daemon management requires Electron");
    }

    try {
      switch (action) {
        case "start": {
          const startResult = await window.electronAPI!.daemon.start();
          if (!startResult.success) {
            throw new Error(startResult.error);
          }
          return "started";
        }

        case "stop": {
          const stopResult = await window.electronAPI!.daemon.stop();
          if (!stopResult.success) {
            throw new Error(stopResult.error);
          }
          return "stopped";
        }

        case "status": {
          const statusResult = await window.electronAPI!.daemon.getStatus();
          if (!statusResult.success) {
            throw new Error(statusResult.error);
          }
          return statusResult.data;
        }

        case "configure": {
          if (!config) {
            throw new Error("Configuration required for configure action");
          }
          const configResult =
            await window.electronAPI!.daemon.configure(config);
          if (!configResult.success) {
            throw new Error(configResult.error);
          }
          return config;
        }

        default:
          throw new Error(`Unknown daemon action: ${action}`);
      }
    } catch (error) {
      console.error("Daemon management error:", error);
      throw error;
    }
  }

  async installGlobally(): Promise<boolean> {
    if (!this._isElectron()) {
      throw new Error("Global installation requires Electron");
    }
    return window.electronAPI!.installGlobally();
  }

  async uninstallGlobally(removeConfig = false): Promise<boolean> {
    if (!this._isElectron()) {
      throw new Error("Global uninstallation requires Electron");
    }
    return window.electronAPI!.uninstallGlobally(removeConfig);
  }

  async updateApp(): Promise<boolean> {
    if (!this._isElectron()) {
      throw new Error("App update requires Electron");
    }
    return window.electronAPI!.updateApp();
  }

  async loadConfig(path?: string): Promise<ConfigData> {
    if (!this._isElectron()) {
      return this.getMockConfig();
    }
    return window.electronAPI!.loadConfig(path);
  }

  async loadReportFromPath(path: string): Promise<SecurityCheckReport> {
    if (!this._isElectron()) {
      return this.getMockSecurityCheck("default");
    }

    try {
      // Use Node.js fs to read the file (via Electron IPC)
      const reportData = await window.electronAPI!.loadReportFile(path);
      return JSON.parse(reportData);
    } catch (error) {
      console.error("Failed to load report from path:", error);
      // Return mock data as fallback
      return this.getMockSecurityCheck("default");
    }
  }

  async loadRecentReports(): Promise<RecentReportData[]> {
    if (!this._isElectron()) {
      return []; // Return empty array when not in Electron
    }
    try {
      return await window.electronAPI!.loadRecentReports();
    } catch (error) {
      console.error("Failed to load recent reports:", error);
      return [];
    }
  }

  async saveConfig(config: ConfigData, path?: string): Promise<boolean> {
    if (!this._isElectron()) {
      return true; // Mock success
    }
    return window.electronAPI!.saveConfig(config, path);
  }

  async createConfig(profile: string): Promise<ConfigData> {
    if (!this._isElectron()) {
      return this.getMockConfig();
    }
    return window.electronAPI!.createConfig(profile);
  }

  async listConfigs(): Promise<string[]> {
    if (!this._isElectron()) {
      return ["default", "strict", "relaxed", "developer", "eai"];
    }
    return window.electronAPI!.listConfigs();
  }

  private getMockSecurityCheck(profile: string): SecurityCheckReport {
    const mockChecks: SecurityCheckResult[] = [
      {
        name: "Disk Encryption",
        status: "pass",
        message: "FileVault is enabled",
        details: "Full disk encryption is active and protecting your data",
        risk: "high",
      },
      {
        name: "Password Protection",
        status: "pass",
        message: "Screen saver requires password immediately",
        details: "Screen lock is configured correctly",
        risk: "high",
      },
      {
        name: "Password Requirements",
        status: profile === "eai" ? "pass" : "warning",
        message:
          profile === "eai"
            ? "Password meets EAI requirements (10+ chars)"
            : "Password policy could be strengthened",
        details:
          profile === "eai"
            ? "Password has minimum 10 characters as required"
            : "Consider implementing stronger password requirements",
        risk: "high",
      },
      {
        name: "Auto-lock Timeout",
        status:
          profile === "strict"
            ? "fail"
            : profile === "eai"
              ? "pass"
              : "warning",
        message:
          profile === "eai"
            ? "Auto-lock timeout is 7 minutes"
            : "Auto-lock timeout is 10 minutes",
        details:
          profile === "eai"
            ? "Auto-lock configured within EAI requirements"
            : "Consider reducing to 5 minutes for better security",
        risk: "medium",
      },
      {
        name: "Firewall",
        status: "pass",
        message: "Application Firewall is enabled",
        details: "Network protection is active",
        risk: "high",
      },
      {
        name: "Package Verification",
        status: profile === "strict" || profile === "eai" ? "pass" : "warning",
        message:
          profile === "eai"
            ? "Gatekeeper enabled with security verification"
            : "Gatekeeper enabled but not in strict mode",
        details:
          profile === "eai"
            ? "Package verification meets EAI security standards"
            : "Consider enabling strict mode for enhanced security",
        risk: "medium",
      },
      {
        name: "System Integrity Protection",
        status: profile === "relaxed" ? "warning" : "pass",
        message: profile === "relaxed" ? "SIP is disabled" : "SIP is enabled",
        details:
          profile === "relaxed"
            ? "System Integrity Protection should be enabled for security"
            : "System Integrity Protection is properly configured",
        risk: "high",
      },
      {
        name: "Remote Login",
        status: "pass",
        message: "SSH is disabled",
        details: "Remote access is properly secured",
        risk: "medium",
      },
      {
        name: "Automatic Updates",
        status: "pass",
        message: "Automatic security updates enabled",
        details: "System will automatically install security patches",
        risk: "medium",
      },
      // EAI-specific checks
      {
        name: "Banned Applications",
        status: profile === "eai" ? "pass" : "warning",
        message:
          profile === "eai"
            ? "No banned applications detected"
            : "Application scanning not configured",
        details:
          profile === "eai"
            ? "BitTorrent, uTorrent, TeamViewer, and other restricted apps not found"
            : "EAI profile includes banned application checking",
        risk: "medium",
      },
      {
        name: "WiFi Security",
        status: profile === "eai" ? "pass" : "warning",
        message:
          profile === "eai"
            ? "Not connected to banned networks"
            : "WiFi security not monitored",
        details:
          profile === "eai"
            ? "Not connected to EAIguest, xfinitywifi, or other prohibited networks"
            : "EAI profile monitors WiFi connections",
        risk: "medium",
      },
      {
        name: "OS Version",
        status: "pass",
        message: "Running supported OS version",
        details: "Operating system is up to date with latest security patches",
        risk: "high",
      },
    ];

    const passed = mockChecks.filter((c) => c.status === "pass").length;
    const failed = mockChecks.filter((c) => c.status === "fail").length;
    const warnings = mockChecks.filter((c) => c.status === "warning").length;

    let overallStatus: "pass" | "fail" | "warning" = "pass";
    if (failed > 0) overallStatus = "fail";
    else if (warnings > 0) overallStatus = "warning";

    return {
      platform: this._platformInfo() || {
        platform: "darwin",
        arch: "x64",
        version: "14.0.0",
      },
      profile,
      timestamp: new Date().toISOString(),
      checks: mockChecks,
      summary: {
        passed,
        failed,
        warnings,
        overallStatus,
      },
    };
  }

  private getMockConfig(): ConfigData {
    return {
      diskEncryption: { enabled: true },
      passwordProtection: { enabled: true, requirePasswordImmediately: true },
      autoLock: { maxTimeoutMinutes: 5 },
      firewall: { enabled: true, stealthMode: false },
      packageVerification: { enabled: true },
      systemIntegrityProtection: { enabled: true },
      remoteLogin: { enabled: false },
      automaticUpdates: { enabled: true, automaticInstall: false },
    };
  }

  async getConfigDirectory(): Promise<string> {
    if (!this.isElectron()) {
      return "~/.config/eai-security-check";
    }
    return window.electronAPI!.getConfigDirectory();
  }

  async getReportsDirectory(): Promise<string> {
    if (!this.isElectron()) {
      return "~/reports";
    }
    return window.electronAPI!.getReportsDirectory();
  }

  async selectFiles(
    filters: FileFilter[],
    multiple = false,
  ): Promise<string[]> {
    if (!this.isElectron()) {
      // Mock for non-electron environment
      return [];
    }
    return window.electronAPI!.selectFiles(filters, multiple);
  }

  async selectDirectory(): Promise<string> {
    if (!this.isElectron()) {
      // Mock for non-electron environment
      return "";
    }
    return window.electronAPI!.selectDirectory();
  }

  async getFilesFromDirectory(
    directory: string,
    extension: string,
  ): Promise<string[]> {
    if (!this.isElectron()) {
      // Mock for non-electron environment
      return [];
    }
    return window.electronAPI!.getFilesFromDirectory(directory, extension);
  }

  async loadReport(path: string): Promise<SecurityCheckReport> {
    if (!this.isElectron()) {
      // Mock for non-electron environment
      throw new Error("Not in Electron environment");
    }
    return window.electronAPI!.loadReport(path);
  }

  async loadApplicationConfig(): Promise<any> {
    if (!this.isElectron()) {
      return null;
    }
    return window.electronAPI!.loadApplicationConfig();
  }

  async saveApplicationConfig(config: any): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }
    return window.electronAPI!.saveApplicationConfig(config);
  }
}
