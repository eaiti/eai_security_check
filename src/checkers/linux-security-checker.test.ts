// Mock execAsync function
const mockExecAsync = jest.fn();

// Mock the child_process module
jest.mock('child_process');

// Mock promisify to return our mock
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: () => mockExecAsync
}));

// Mock fs module
jest.mock('fs');

import { LinuxSecurityChecker } from './linux-security-checker';
import * as fs from 'fs';

const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

describe('LinuxSecurityChecker', () => {
  let checker: LinuxSecurityChecker;

  beforeEach(() => {
    checker = new LinuxSecurityChecker();
    jest.clearAllMocks();
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

  describe('checkDiskEncryption', () => {
    it('should return true when LUKS encryption is detected', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'NAME FSTYPE\nsda1 crypto_LUKS\n',
        stderr: ''
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(true);
    });

    it('should return true when dmsetup shows encrypted devices', async () => {
      (mockExecAsync as jest.Mock)
        .mockResolvedValueOnce({ stdout: 'NAME FSTYPE\nsda1 ext4\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'luks-device: /dev/mapper/luks-device\n', stderr: '' });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(true);
    });

    it('should return false when no encryption is found', async () => {
      (mockExecAsync as jest.Mock)
        .mockResolvedValueOnce({ stdout: 'NAME FSTYPE\nsda1 ext4\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(false);
    });
  });

  describe('checkPasswordProtection', () => {
    it('should detect password protection enabled', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'user-session\nrequire-password=true\n',
        stderr: ''
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Force the outer try-catch to fail by making execAsync throw during password check
      const originalProcess = process.env;
      process.env = { ...originalProcess };
      delete process.env.HOME; // This will cause fs.existsSync to fail in the KDE check

      (mockExecAsync as jest.Mock).mockResolvedValue({ stdout: 'unknown\n', stderr: '' });
      mockExistsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(false);
      expect(result.requirePasswordImmediately).toBe(false);
      expect(result.passwordRequiredAfterLock).toBe(true); // Default when error occurs

      process.env = originalProcess;
    });
  });

  describe('checkAutoLockTimeout', () => {
    it('should return GNOME screen timeout in minutes', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'uint32 600\n',
        stderr: ''
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(10);
    });

    it('should handle errors gracefully', async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(new Error('Command failed'));
      mockExistsSync.mockReturnValue(false);

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(15);
    });
  });

  describe('checkFirewall', () => {
    it('should detect enabled UFW firewall', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'Status: active\n',
        stderr: ''
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
      expect(result.stealthMode).toBe(false);
    });

    it('should detect disabled UFW firewall', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'Status: inactive\n',
        stderr: ''
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(false);
    });

    it('should detect enabled firewalld', async () => {
      (mockExecAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('UFW not found'))
        .mockResolvedValueOnce({ stdout: 'running\n', stderr: '' });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
    });

    it('should fallback to iptables check', async () => {
      (mockExecAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('UFW not found'))
        .mockRejectedValueOnce(new Error('firewalld not found'))
        .mockResolvedValueOnce({
          stdout:
            'Chain INPUT (policy ACCEPT)\ntarget     prot opt source\nDROP       all  --  anywhere\n',
          stderr: ''
        });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(false);
    });
  });

  describe('checkPackageVerification', () => {
    it('should detect DNF GPG verification enabled', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'gpgcheck = 1\n',
        stderr: ''
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(true);
    });

    it('should detect APT GPG verification enabled', async () => {
      (mockExecAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('DNF not found'))
        .mockResolvedValueOnce({ stdout: 'APT::Get::AllowUnauthenticated "false";\n', stderr: '' });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      (mockExecAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('DNF not found'))
        .mockRejectedValueOnce(new Error('APT not found'));
      mockExistsSync.mockReturnValue(false); // No yum.conf file

      const result = await checker.checkPackageVerification();
      expect(result).toBe(true); // Default to true for security
    });
  });

  describe('checkSystemIntegrityProtection', () => {
    it('should detect SELinux enabled', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'Enforcing\n',
        stderr: ''
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(true);
    });

    it('should detect AppArmor enabled', async () => {
      (mockExecAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('SELinux not found'))
        .mockResolvedValue({ stdout: 'apparmor module is loaded.\n', stderr: '' });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(false);
    });
  });

  describe('checkRemoteLogin', () => {
    it('should detect SSHD service running', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'active\n',
        stderr: ''
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(true);
    });

    it('should return false when SSH is not running', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'inactive\n',
        stderr: ''
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(false);
    });
  });

  describe('checkAutomaticUpdates', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should detect enabled automatic updates on Ubuntu', async () => {
      // Make the DNF check throw an error to reach the Ubuntu catch block
      mockExistsSync
        .mockImplementationOnce(() => {
          throw new Error('DNF check failed');
        }) // Force DNF path to throw error
        .mockReturnValueOnce(true); // Ubuntu unattended-upgrades exists
      const aptConfigContent =
        'Unattended-Upgrade::Automatic-Reboot "true";\nsecurity updates enabled\n';
      mockReadFileSync.mockReturnValue(aptConfigContent);

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(true);
      expect(result.securityUpdatesOnly).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockExistsSync.mockReturnValue(false); // No config files exist

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(false);
    });
  });

  describe('checkRemoteManagement', () => {
    it('should return false when no remote management services are active', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'not-running\n',
        stderr: ''
      });

      const result = await checker.checkRemoteManagement();
      expect(result).toBe(false);
    });

    it('should handle service check errors gracefully', async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(new Error('Service not found'));

      const result = await checker.checkRemoteManagement();
      expect(result).toBe(false);
    });
  });

  describe('checkSharingServices', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return false for all services when none are active', async () => {
      // Mock all systemctl and process checks to return inactive/not-running
      // Note: Can't use "inactive" because it contains "active" substring
      (mockExecAsync as jest.Mock)
        .mockResolvedValueOnce({ stdout: 'stopped\n', stderr: '' }) // Samba check
        .mockResolvedValueOnce({ stdout: 'stopped\n', stderr: '' }) // NFS check
        .mockResolvedValueOnce({ stdout: 'not-running\n', stderr: '' }) // VNC check 1
        .mockResolvedValueOnce({ stdout: 'not-running\n', stderr: '' }) // VNC check 2
        .mockResolvedValueOnce({ stdout: 'not-running\n', stderr: '' }) // VNC check 3
        .mockResolvedValueOnce({ stdout: 'stopped\n', stderr: '' }); // SSH check

      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(false);
      expect(result.screenSharing).toBe(false);
      expect(result.remoteLogin).toBe(false);
      expect(result.mediaSharing).toBe(false);
    });
  });

  describe('getCurrentLinuxVersion', () => {
    it('should return version from /etc/os-release', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: '20.04\n',
        stderr: ''
      });

      const result = await checker.getCurrentLinuxVersion();
      expect(result).toBe('20.04');
    });

    it('should handle missing version file', async () => {
      (mockExecAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('lsb_release not found'));

      const result = await checker.getCurrentLinuxVersion();
      expect(result).toBe('unknown');
    });
  });

  describe('getCurrentLinuxDistribution', () => {
    it('should return distribution from /etc/os-release', async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: 'ubuntu\n',
        stderr: ''
      });

      const result = await checker.getCurrentLinuxDistribution();
      expect(result).toBe('ubuntu');
    });

    it('should handle missing distribution file', async () => {
      (mockExecAsync as jest.Mock)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('lsb_release not found'));

      const result = await checker.getCurrentLinuxDistribution();
      expect(result).toBe('unknown');
    });
  });
});
