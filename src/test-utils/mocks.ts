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

  async checkAutomaticUpdates(): Promise<{ enabled: boolean; securityUpdatesOnly: boolean }> {
    return Promise.resolve({ enabled: true, securityUpdatesOnly: true });
  }

  async checkSharingServices(): Promise<{ fileSharing: boolean; screenSharing: boolean; remoteLogin: boolean }> {
    return Promise.resolve({ fileSharing: false, screenSharing: false, remoteLogin: false });
  }

  async getSystemInfo(): Promise<string> {
    return Promise.resolve('macOS 14.5 (Test Environment)');
  }

  getSecurityExplanations(): Record<string, { description: string; recommendation: string; riskLevel: 'High' | 'Medium' | 'Low' }> {
    return {
      'FileVault': {
        description: 'Test description for FileVault.',
        recommendation: 'Test recommendation for FileVault.',
        riskLevel: 'High'
      }
    };
  }
}
