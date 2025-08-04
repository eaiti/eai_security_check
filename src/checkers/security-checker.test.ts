/* eslint-disable @typescript-eslint/no-explicit-any */
import { MacOSSecurityChecker } from './security-checker';
import { exec } from 'child_process';

jest.mock('child_process');
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('MacOSSecurityChecker', () => {
  let checker: MacOSSecurityChecker;
  let checkerWithPassword: MacOSSecurityChecker;

  beforeEach(() => {
    checker = new MacOSSecurityChecker();
    checkerWithPassword = new MacOSSecurityChecker('testpass123');
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance without password', () => {
      const checker = new MacOSSecurityChecker();
      expect(checker).toBeInstanceOf(MacOSSecurityChecker);
    });

    it('should create instance with password', () => {
      const checker = new MacOSSecurityChecker('testpass');
      expect(checker).toBeInstanceOf(MacOSSecurityChecker);
    });
  });

  describe('method existence', () => {
    it('should have checkFileVault method', () => {
      expect(typeof checker.checkFileVault).toBe('function');
    });

    it('should have checkDiskEncryption method', () => {
      expect(typeof checker.checkDiskEncryption).toBe('function');
    });

    it('should have checkPasswordProtection method', () => {
      expect(typeof checker.checkPasswordProtection).toBe('function');
    });

    it('should have checkAutoLockTimeout method', () => {
      expect(typeof checker.checkAutoLockTimeout).toBe('function');
    });

    it('should have getCurrentMacOSVersion method', () => {
      expect(typeof checker.getCurrentMacOSVersion).toBe('function');
    });

    it('should have checkFirewall method', () => {
      expect(typeof checker.checkFirewall).toBe('function');
    });

    it('should have checkGatekeeper method', () => {
      expect(typeof checker.checkGatekeeper).toBe('function');
    });

    it('should have checkPackageVerification method', () => {
      expect(typeof checker.checkPackageVerification).toBe('function');
    });

    it('should have checkSystemIntegrityProtection method', () => {
      expect(typeof checker.checkSystemIntegrityProtection).toBe('function');
    });

    it('should have checkRemoteLogin method', () => {
      expect(typeof checker.checkRemoteLogin).toBe('function');
    });

    it('should have checkRemoteManagement method', () => {
      expect(typeof checker.checkRemoteManagement).toBe('function');
    });

    it('should have checkAutomaticUpdates method', () => {
      expect(typeof checker.checkAutomaticUpdates).toBe('function');
    });

    it('should have checkSharingServices method', () => {
      expect(typeof checker.checkSharingServices).toBe('function');
    });
  });

  describe('checkFileVault', () => {
    it('should return true when FileVault is enabled', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'FileVault is On.', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkFileVault();
      expect(result).toBe(true);
    });

    it('should return false when FileVault is disabled', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'FileVault is Off.', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkFileVault();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.checkFileVault();
      expect(result).toBe(false);
    });
  });

  describe('checkPasswordProtection', () => {
    it('should detect enabled password protection', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('askForPassword')) {
          callback(null, { stdout: '1', stderr: '' });
        } else if (cmd.includes('askForPasswordDelay')) {
          callback(null, { stdout: '0', stderr: '' });
        } else {
          callback(null, { stdout: 'enabled', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(true);
      expect(result.requirePasswordImmediately).toBe(true);
      expect(result.passwordRequiredAfterLock).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(false);
    });
  });

  describe('checkFirewall', () => {
    it('should detect enabled firewall', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('getglobalstate')) {
          callback(null, { stdout: 'enabled', stderr: '' });
        } else if (cmd.includes('getstealthmode')) {
          callback(null, { stdout: 'enabled', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
      expect(result.stealthMode).toBe(true);
    });

    it('should handle command errors', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(false);
      expect(result.stealthMode).toBe(false);
    });
  });

  describe('checkGatekeeper', () => {
    it('should detect enabled Gatekeeper', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'assessments enabled', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkGatekeeper();
      expect(result).toBe(true);
    });

    it('should detect disabled Gatekeeper', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'assessments disabled', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkGatekeeper();
      expect(result).toBe(false);
    });
  });

  describe('checkSystemIntegrityProtection', () => {
    it('should detect enabled SIP', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'System Integrity Protection status: enabled.', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(true);
    });

    it('should detect disabled SIP', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'System Integrity Protection status: disabled.', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(false);
    });
  });

  describe('checkRemoteLogin', () => {
    it('should detect enabled SSH', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'com.openssh.sshd', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(true);
    });

    it('should detect disabled SSH', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(false);
    });
  });

  describe('checkAutomaticUpdates', () => {
    it('should detect enabled automatic updates', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('softwareupdate --schedule')) {
          callback(null, { stdout: 'Automatic checking for updates is turned on.', stderr: '' });
        } else if (cmd.includes('AutomaticDownload')) {
          callback(null, { stdout: '1', stderr: '' });
        } else if (cmd.includes('AutomaticallyInstallMacOSUpdates')) {
          callback(null, { stdout: '1', stderr: '' });
        } else if (cmd.includes('CriticalUpdateInstall')) {
          callback(null, { stdout: '1', stderr: '' });
        } else if (cmd.includes('ConfigDataInstall')) {
          callback(null, { stdout: '1', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(true);
    });

    it('should handle command errors', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(false);
    });
  });

  describe('checkSharingServices', () => {
    it('should detect enabled sharing services', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('com.apple.smbd Disabled')) {
          callback(null, { stdout: '0', stderr: '' });
        } else if (cmd.includes('sharing -l')) {
          callback(null, { stdout: 'name: TestShare', stderr: '' });
        } else if (cmd.includes('com.apple.screensharing')) {
          callback(null, { stdout: '0', stderr: '' });
        } else if (cmd.includes('com.apple.Music sharingEnabled')) {
          callback(null, { stdout: '1', stderr: '' });
        } else if (cmd.includes('com.apple.Photos sharingEnabled')) {
          callback(null, { stdout: '1', stderr: '' });
        } else if (cmd.includes('AirplayRecieverEnabled')) {
          callback(null, { stdout: '1', stderr: '' });
        } else if (cmd.includes('launchctl print')) {
          callback(null, { stdout: 'state = running', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(true);
      expect(result.screenSharing).toBe(true);
      expect(result.mediaSharing).toBe(true);
    });

    it('should handle command errors', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(false);
    });
  });

  describe('password handling', () => {
    it('should store and return password correctly', () => {
      const password = checkerWithPassword.getPassword();
      expect(password).toBe('testpass123');
    });

    it('should return undefined when no password is set', () => {
      const password = checker.getPassword();
      expect(password).toBeUndefined();
    });
  });

  describe('getCurrentMacOSVersion', () => {
    it('should return macOS version', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: '14.2.1', stderr: '' });
        return {} as any;
      });

      const result = await checker.getCurrentMacOSVersion();
      expect(result).toBe('14.2.1');
    });

    it('should handle command errors', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.getCurrentMacOSVersion();
      expect(result).toBe('0.0.0');
    });
  });
});
