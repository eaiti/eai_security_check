import { LegacyMacOSSecurityChecker } from './legacy-security-checker';

describe('LegacyMacOSSecurityChecker', () => {
  let checker: LegacyMacOSSecurityChecker;

  beforeEach(() => {
    checker = new LegacyMacOSSecurityChecker();
  });

  describe('constructor', () => {
    it('should create instance without password', () => {
      const checker = new LegacyMacOSSecurityChecker();
      expect(checker).toBeInstanceOf(LegacyMacOSSecurityChecker);
    });

    it('should create instance with password', () => {
      const checker = new LegacyMacOSSecurityChecker('testpass');
      expect(checker).toBeInstanceOf(LegacyMacOSSecurityChecker);
    });
  });

  describe('security checks', () => {
    it('should return false for checkFileVault', async () => {
      const result = await checker.checkFileVault();
      expect(result).toBe(false);
    });

    it('should return disabled state for checkPasswordProtection', async () => {
      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(false);
      expect(result.requirePasswordImmediately).toBe(false);
      expect(result.passwordRequiredAfterLock).toBe(false);
    });

    it('should return 0 for checkAutoLockTimeout', async () => {
      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(0);
    });

    it('should return disabled state for checkFirewall', async () => {
      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(false);
      expect(result.stealthMode).toBe(false);
    });

    it('should return false for checkGatekeeper', async () => {
      const result = await checker.checkGatekeeper();
      expect(result).toBe(false);
    });

    it('should return false for checkSystemIntegrityProtection', async () => {
      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(false);
    });

    it('should return false for checkRemoteLogin', async () => {
      const result = await checker.checkRemoteLogin();
      expect(result).toBe(false);
    });

    it('should return false for checkRemoteManagement', async () => {
      const result = await checker.checkRemoteManagement();
      expect(result).toBe(false);
    });

    it('should return disabled state for checkAutomaticUpdates', async () => {
      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(false);
      expect(result.securityUpdatesOnly).toBe(false);
      expect(result.automaticDownload).toBe(false);
      expect(result.automaticInstall).toBe(false);
      expect(result.automaticSecurityInstall).toBe(false);
      expect(result.configDataInstall).toBe(false);
      expect(result.updateMode).toBe('disabled');
    });

    it('should return disabled state for checkSharingServices', async () => {
      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(false);
      expect(result.screenSharing).toBe(false);
      expect(result.remoteLogin).toBe(false);
      expect(result.mediaSharing).toBe(false);
    });
  });
});
