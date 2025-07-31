import { MacOSSecurityChecker } from './security-checker';

describe('MacOSSecurityChecker', () => {
  let checker: MacOSSecurityChecker;

  beforeEach(() => {
    checker = new MacOSSecurityChecker();
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
});
