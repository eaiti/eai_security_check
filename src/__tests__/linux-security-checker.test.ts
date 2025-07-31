import { LinuxSecurityChecker } from '../linux-security-checker';

describe('LinuxSecurityChecker', () => {
  let checker: LinuxSecurityChecker;

  beforeEach(() => {
    checker = new LinuxSecurityChecker();
  });

  describe('constructor', () => {
    it('should create instance without password', () => {
      const checker = new LinuxSecurityChecker();
      expect(checker).toBeInstanceOf(LinuxSecurityChecker);
    });

    it('should create instance with password', () => {
      const checker = new LinuxSecurityChecker('testpass');
      expect(checker).toBeInstanceOf(LinuxSecurityChecker);
    });
  });

  describe('method existence', () => {
    it('should have checkDiskEncryption method', () => {
      expect(typeof checker.checkDiskEncryption).toBe('function');
    });

    it('should have checkPasswordProtection method', () => {
      expect(typeof checker.checkPasswordProtection).toBe('function');
    });

    it('should have checkAutoLockTimeout method', () => {
      expect(typeof checker.checkAutoLockTimeout).toBe('function');
    });

    it('should have checkFirewall method', () => {
      expect(typeof checker.checkFirewall).toBe('function');
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
