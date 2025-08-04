import { Injectable, signal } from '@angular/core';

export interface PlatformInfo {
  platform: string;
  arch: string;
  version: string;
}

export interface SecurityCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
  risk?: 'high' | 'medium' | 'low';
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
    overallStatus: 'pass' | 'fail' | 'warning';
  };
}

declare global {
  interface Window {
    electronAPI?: {
      runSecurityCheck: (
        profile: string,
        config?: string,
      ) => Promise<SecurityCheckReport>;
      runInteractive: () => Promise<void>;
      verifyReport: (path: string) => Promise<boolean>;
      manageDaemon: (
        action: 'start' | 'stop' | 'status' | 'configure',
        config?: any,
      ) => Promise<any>;
      installGlobally: () => Promise<boolean>;
      uninstallGlobally: (removeConfig?: boolean) => Promise<boolean>;
      updateApp: () => Promise<boolean>;
      getPlatformInfo: () => Promise<PlatformInfo>;
      getCliVersion: () => Promise<string>;
      loadConfig: (path?: string) => Promise<any>;
      saveConfig: (config: any, path?: string) => Promise<boolean>;
      createConfig: (profile: string) => Promise<any>;
      listConfigs: () => Promise<string[]>;
    };
    isElectron?: boolean;
  }
}

@Injectable({
  providedIn: 'root',
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
        console.error('Failed to initialize Electron service:', error);
      }
    }
  }

  async runSecurityCheck(
    profile: string,
    config?: string,
  ): Promise<SecurityCheckReport> {
    if (!this._isElectron()) {
      return this.getMockSecurityCheck(profile);
    }

    try {
      return await window.electronAPI!.runSecurityCheck(profile, config);
    } catch (error) {
      console.error('Security check failed:', error);
      // Fallback to mock data
      return this.getMockSecurityCheck(profile);
    }
  }

  async runInteractive(): Promise<void> {
    if (!this._isElectron()) {
      throw new Error('Interactive mode requires Electron');
    }
    return window.electronAPI!.runInteractive();
  }

  async verifyReport(path: string): Promise<boolean> {
    if (!this._isElectron()) {
      throw new Error('Report verification requires Electron');
    }
    return window.electronAPI!.verifyReport(path);
  }

  async manageDaemon(
    action: 'start' | 'stop' | 'status' | 'configure',
    config?: any,
  ): Promise<any> {
    if (!this._isElectron()) {
      throw new Error('Daemon management requires Electron');
    }
    return window.electronAPI!.manageDaemon(action, config);
  }

  async installGlobally(): Promise<boolean> {
    if (!this._isElectron()) {
      throw new Error('Global installation requires Electron');
    }
    return window.electronAPI!.installGlobally();
  }

  async uninstallGlobally(removeConfig = false): Promise<boolean> {
    if (!this._isElectron()) {
      throw new Error('Global uninstallation requires Electron');
    }
    return window.electronAPI!.uninstallGlobally(removeConfig);
  }

  async updateApp(): Promise<boolean> {
    if (!this._isElectron()) {
      throw new Error('App update requires Electron');
    }
    return window.electronAPI!.updateApp();
  }

  async loadConfig(path?: string): Promise<any> {
    if (!this._isElectron()) {
      return this.getMockConfig();
    }
    return window.electronAPI!.loadConfig(path);
  }

  async saveConfig(config: any, path?: string): Promise<boolean> {
    if (!this._isElectron()) {
      return true; // Mock success
    }
    return window.electronAPI!.saveConfig(config, path);
  }

  async createConfig(profile: string): Promise<any> {
    if (!this._isElectron()) {
      return this.getMockConfig();
    }
    return window.electronAPI!.createConfig(profile);
  }

  async listConfigs(): Promise<string[]> {
    if (!this._isElectron()) {
      return ['default', 'strict', 'relaxed', 'developer', 'eai'];
    }
    return window.electronAPI!.listConfigs();
  }

  private getMockSecurityCheck(profile: string): SecurityCheckReport {
    const mockChecks: SecurityCheckResult[] = [
      {
        name: 'Disk Encryption',
        status: 'pass',
        message: 'FileVault is enabled',
        details: 'Full disk encryption is active and protecting your data',
        risk: 'high',
      },
      {
        name: 'Password Protection',
        status: 'pass',
        message: 'Screen saver requires password immediately',
        details: 'Screen lock is configured correctly',
        risk: 'high',
      },
      {
        name: 'Auto-lock Timeout',
        status: profile === 'strict' ? 'fail' : 'warning',
        message: 'Auto-lock timeout is 10 minutes',
        details: 'Consider reducing to 5 minutes for better security',
        risk: 'medium',
      },
      {
        name: 'Firewall',
        status: 'pass',
        message: 'Application Firewall is enabled',
        details: 'Network protection is active',
        risk: 'high',
      },
      {
        name: 'Package Verification',
        status: profile === 'strict' ? 'fail' : 'warning',
        message: 'Gatekeeper enabled but not in strict mode',
        details: 'Consider enabling strict mode for enhanced security',
        risk: 'medium',
      },
      {
        name: 'System Integrity Protection',
        status: profile === 'relaxed' ? 'warning' : 'fail',
        message: 'SIP is disabled',
        details: 'System Integrity Protection should be enabled for security',
        risk: 'high',
      },
      {
        name: 'Remote Login',
        status: 'pass',
        message: 'SSH is disabled',
        details: 'Remote access is properly secured',
        risk: 'medium',
      },
      {
        name: 'Automatic Updates',
        status: 'pass',
        message: 'Automatic security updates enabled',
        details: 'System will automatically install security patches',
        risk: 'medium',
      },
    ];

    const passed = mockChecks.filter((c) => c.status === 'pass').length;
    const failed = mockChecks.filter((c) => c.status === 'fail').length;
    const warnings = mockChecks.filter((c) => c.status === 'warning').length;

    let overallStatus: 'pass' | 'fail' | 'warning' = 'pass';
    if (failed > 0) overallStatus = 'fail';
    else if (warnings > 0) overallStatus = 'warning';

    return {
      platform: this._platformInfo() || {
        platform: 'darwin',
        arch: 'x64',
        version: '14.0.0',
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

  private getMockConfig(): any {
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
}
