import { MacOSSecurityChecker } from '../security-checker';

export class MockMacOSSecurityChecker extends MacOSSecurityChecker {
  async checkFileVault(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async checkPasswordProtection(): Promise<{ enabled: boolean; requirePasswordImmediately: boolean; passwordRequiredAfterLock: boolean }> {
    return Promise.resolve({ enabled: true, requirePasswordImmediately: true, passwordRequiredAfterLock: true });
  }

  async checkAutoLockTimeout(): Promise<number> {
    return Promise.resolve(5);
  }

  async checkFirewall(): Promise<{ enabled: boolean; stealthMode: boolean }> {
    return Promise.resolve({ enabled: true, stealthMode: true });
  }

  async checkGatekeeper(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async checkSystemIntegrityProtection(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async checkRemoteLogin(): Promise<boolean> {
    return Promise.resolve(false);
  }

  async checkRemoteManagement(): Promise<boolean> {
    return Promise.resolve(false);
  }

  async checkAutomaticUpdates(): Promise<{ 
    enabled: boolean; 
    securityUpdatesOnly: boolean;
    automaticDownload: boolean;
    automaticInstall: boolean;
    automaticSecurityInstall: boolean;
    configDataInstall: boolean;
    updateMode: 'disabled' | 'check-only' | 'download-only' | 'fully-automatic';
  }> {
    return Promise.resolve({ 
      enabled: true, 
      securityUpdatesOnly: true,
      automaticDownload: true,
      automaticInstall: false,
      automaticSecurityInstall: true,
      configDataInstall: true,
      updateMode: 'download-only'
    });
  }

  async checkSharingServices(): Promise<{ fileSharing: boolean; screenSharing: boolean; remoteLogin: boolean }> {
    return Promise.resolve({ fileSharing: false, screenSharing: false, remoteLogin: false });
  }

  async getSystemInfo(): Promise<string> {
    return Promise.resolve('macOS 14.5 (Test Environment)');
  }

  async getCurrentMacOSVersion(): Promise<string> {
    return Promise.resolve('14.5');
  }

  async getLatestMacOSVersion(): Promise<string> {
    return Promise.resolve('15.1');
  }

  async checkOSVersion(targetVersion: string): Promise<{ current: string; target: string; isLatest: boolean; passed: boolean }> {
    const current = '14.5';
    const isLatest = targetVersion.toLowerCase() === 'latest';
    const target = isLatest ? '15.1' : targetVersion;
    
    // Mock logic: 14.5 passes for targets 14.5 and below, fails for higher versions
    const passed = isLatest ? false : this.mockCompareVersions(current, target) >= 0;
    
    return Promise.resolve({
      current,
      target,
      isLatest,
      passed
    });
  }

  private mockCompareVersions(current: string, target: string): number {
    const currentParts = current.split('.').map(n => parseInt(n, 10));
    const targetParts = target.split('.').map(n => parseInt(n, 10));
    
    const maxLength = Math.max(currentParts.length, targetParts.length);
    while (currentParts.length < maxLength) currentParts.push(0);
    while (targetParts.length < maxLength) targetParts.push(0);
    
    for (let i = 0; i < maxLength; i++) {
      if (currentParts[i] > targetParts[i]) return 1;
      if (currentParts[i] < targetParts[i]) return -1;
    }
    return 0;
  }

  async checkCurrentWifiNetwork(): Promise<{ networkName: string | null; connected: boolean }> {
    // Mock: Return a test network name for testing
    return Promise.resolve({ networkName: 'TestNetwork', connected: true });
  }

  getSecurityExplanations(): Record<string, { description: string; recommendation: string; riskLevel: 'High' | 'Medium' | 'Low' }> {
    return {
      'FileVault': {
        description: 'Test description for FileVault.',
        recommendation: 'Test recommendation for FileVault.',
        riskLevel: 'High'
      },
      'Automatic Updates': {
        description: 'Test description for Automatic Updates.',
        recommendation: 'Test recommendation for Automatic Updates.',
        riskLevel: 'High'
      },
      'Automatic Update Mode': {
        description: 'Test description for Automatic Update Mode.',
        recommendation: 'Test recommendation for Automatic Update Mode.',
        riskLevel: 'High'
      },
      'Security Updates': {
        description: 'Test description for Security Updates.',
        recommendation: 'Test recommendation for Security Updates.',
        riskLevel: 'High'
      },
      'OS Version': {
        description: 'Test description for OS Version.',
        recommendation: 'Test recommendation for OS Version.',
        riskLevel: 'Medium'
      },
      'WiFi Network Security': {
        description: 'Test description for WiFi Network Security.',
        recommendation: 'Test recommendation for WiFi Network Security.',
        riskLevel: 'Medium'
      }
    };
  }
}
