// Mock child_process and util modules before importing the class
const mockExecAsync = jest.fn();

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  promisify: () => mockExecAsync
}));

import { MacOSSecurityChecker } from './security-checker';

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
      mockExecAsync.mockResolvedValue({
        stdout: 'FileVault is On.',
        stderr: ''
      });

      const result = await checker.checkFileVault();
      expect(result).toBe(true);
    });

    it('should return false when FileVault is disabled', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'FileVault is Off.',
        stderr: ''
      });

      const result = await checker.checkFileVault();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkFileVault();
      expect(result).toBe(false);
    });
  });

  describe('checkPasswordProtection', () => {
    it('should detect enabled password protection', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'enabled', stderr: '' }) // login password check
        .mockResolvedValueOnce({ stdout: 'true', stderr: '' }); // AppleScript lock screen check

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(true);
      expect(result.requirePasswordImmediately).toBe(true);
      expect(result.passwordRequiredAfterLock).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(false);
      expect(result.requirePasswordImmediately).toBe(false);
      expect(result.passwordRequiredAfterLock).toBe(false);
    });
  });

  describe('checkFirewall', () => {
    it('should detect enabled firewall', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'enabled', stderr: '' }) // globalstate check
        .mockResolvedValueOnce({ stdout: 'enabled', stderr: '' }); // stealth mode check

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
      expect(result.stealthMode).toBe(true);
    });

    it('should handle command errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(false);
      expect(result.stealthMode).toBe(false);
    });
  });

  describe('checkGatekeeper', () => {
    it('should detect enabled Gatekeeper', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'assessments enabled',
        stderr: ''
      });

      const result = await checker.checkGatekeeper();
      expect(result).toBe(true);
    });

    it('should detect disabled Gatekeeper', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'assessments disabled',
        stderr: ''
      });

      const result = await checker.checkGatekeeper();
      expect(result).toBe(false);
    });
  });

  describe('checkSystemIntegrityProtection', () => {
    it('should detect enabled SIP', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'System Integrity Protection status: enabled.',
        stderr: ''
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(true);
    });

    it('should detect disabled SIP', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'System Integrity Protection status: disabled.',
        stderr: ''
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(false);
    });
  });

  describe('checkRemoteLogin', () => {
    it('should detect enabled SSH', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'com.openssh.sshd', stderr: '' });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(true);
    });

    it('should detect disabled SSH', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(false);
    });
  });

  describe('checkAutomaticUpdates', () => {
    it('should detect enabled automatic updates', async () => {
      mockExecAsync
        .mockResolvedValueOnce({
          stdout: 'Automatic checking for updates is turned on.',
          stderr: ''
        })
        .mockResolvedValueOnce({ stdout: '1', stderr: '' })
        .mockResolvedValueOnce({ stdout: '1', stderr: '' })
        .mockResolvedValueOnce({ stdout: '1', stderr: '' })
        .mockResolvedValueOnce({ stdout: '1', stderr: '' });

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(true);
    });

    it('should handle command errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(false);
    });
  });

  describe('checkSharingServices', () => {
    it('should detect enabled sharing services', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '0', stderr: '' }) // smbd enabled (0 = enabled)
        .mockResolvedValueOnce({ stdout: '0', stderr: '' }) // screen sharing enabled
        .mockResolvedValueOnce({ stdout: '1', stderr: '' }) // music sharing enabled
        .mockResolvedValueOnce({ stdout: '1', stderr: '' }) // photos sharing enabled
        .mockResolvedValueOnce({ stdout: '1', stderr: '' }); // airplay receiver enabled

      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(true);
      expect(result.screenSharing).toBe(true);
      expect(result.mediaSharing).toBe(true);
    });

    it('should handle command errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

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
      mockExecAsync.mockResolvedValue({ stdout: '14.2.1', stderr: '' });

      const result = await checker.getCurrentMacOSVersion();
      expect(result).toBe('14.2.1');
    });

    it('should handle command errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const result = await checker.getCurrentMacOSVersion();
      expect(result).toBe('0.0.0');
    });
  });
});
