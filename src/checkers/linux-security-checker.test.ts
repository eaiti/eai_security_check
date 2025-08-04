import { LinuxSecurityChecker } from './linux-security-checker';
import { exec } from 'child_process';
import * as fs from 'fs';

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs');

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

describe('LinuxSecurityChecker', () => {
  let checker: LinuxSecurityChecker;

  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('checkDiskEncryption', () => {
    it('should return true when LUKS encryption is detected', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'NAME FSTYPE\nsda1 crypto_LUKS\n', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(true);
    });

    it('should return true when dmsetup shows encrypted devices', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          // First call - lsblk without LUKS
          callback(null, { stdout: 'NAME FSTYPE\nsda1 ext4\n', stderr: '' });
        } else {
          // Second call - dmsetup with crypt devices
          callback(null, { stdout: 'luks-device: /dev/mapper/luks-device\n', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(true);
    });

    it('should return false when no encryption is found', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          // First call - lsblk without LUKS
          callback(null, { stdout: 'NAME FSTYPE\nsda1 ext4\n', stderr: '' });
        } else {
          // Second call - dmsetup with no crypt devices
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(false);
    });
  });

  describe('checkPasswordProtection', () => {
    it('should detect password protection when required', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (cmd.includes('passwd -S')) {
          callback(null, { stdout: 'user P 01/01/2024 0 99999 7 -1\n', stderr: '' });
        } else if (cmd.includes('gsettings get org.gnome.desktop.screensaver lock-delay')) {
          callback(null, { stdout: 'uint32 0\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(true);
    });

    it('should detect when no password is set', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('passwd -S')) {
          callback(null, { stdout: 'user NP 01/01/2024 0 99999 7 -1\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(false);
      expect(result.requirePasswordImmediately).toBe(false);
      expect(result.passwordRequiredAfterLock).toBe(false);
    });
  });

  describe('checkAutoLockTimeout', () => {
    it('should detect GNOME auto-lock timeout', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('gsettings get org.gnome.desktop.session idle-delay')) {
          callback(null, { stdout: 'uint32 300\n', stderr: '' });
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(300);
    });

    it('should detect KDE auto-lock timeout', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (cmd.includes('gsettings get org.gnome.desktop.session idle-delay')) {
          callback(new Error('GNOME not available'), null);
        } else if (cmd.includes('kreadconfig5 --group ScreenSaver --key Timeout')) {
          callback(null, { stdout: '600\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(600);
    });

    it('should return -1 when auto-lock is not configured', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command not found'), null);
        return {} as any;
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(-1);
    });
  });

  describe('checkFirewall', () => {
    it('should detect enabled UFW firewall', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('ufw status')) {
          callback(null, { stdout: 'Status: active\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
      expect(result.stealthMode).toBe(false);
    });

    it('should detect disabled UFW firewall', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('ufw status')) {
          callback(null, { stdout: 'Status: inactive\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(false);
    });

    it('should detect enabled firewalld', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (cmd.includes('ufw status')) {
          callback(new Error('UFW not found'), null);
        } else if (cmd.includes('firewall-cmd --state')) {
          callback(null, { stdout: 'running\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
    });

    it('should fallback to iptables check', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (cmd.includes('ufw status') || cmd.includes('firewall-cmd --state')) {
          callback(new Error('Command not found'), null);
        } else if (cmd.includes('iptables -L')) {
          callback(null, { stdout: 'Chain INPUT (policy ACCEPT)\ntarget     prot opt source\nDROP       all  --  anywhere\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
    });
  });

  describe('checkPackageVerification', () => {
    it('should detect DNF GPG verification enabled', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('dnf config-manager --dump') && cmd.includes('gpgcheck')) {
          callback(null, { stdout: 'gpgcheck = 1\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(true);
    });

    it('should detect APT GPG verification enabled', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (cmd.includes('dnf config-manager')) {
          callback(new Error('DNF not found'), null);
        } else if (cmd.includes('apt-config dump') && cmd.includes('APT::Get::AllowUnauthenticated')) {
          callback(null, { stdout: 'APT::Get::AllowUnauthenticated "false";\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(true);
    });

    it('should return false when verification is disabled', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('dnf config-manager')) {
          callback(null, { stdout: 'gpgcheck = 0\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(false);
    });
  });

  describe('checkSystemIntegrityProtection', () => {
    it('should detect enabled SELinux', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('getenforce')) {
          callback(null, { stdout: 'Enforcing\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(true);
    });

    it('should detect enabled AppArmor', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (cmd.includes('getenforce')) {
          callback(new Error('SELinux not found'), null);
        } else if (cmd.includes('aa-status')) {
          callback(null, { stdout: 'apparmor module is loaded.\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(true);
    });

    it('should return false when no integrity protection is found', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command not found'), null);
        return {} as any;
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(false);
    });
  });

  describe('checkRemoteLogin', () => {
    it('should detect SSH service running', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('systemctl is-active ssh')) {
          callback(null, { stdout: 'active\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(true);
    });

    it('should detect SSHD service running', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (cmd.includes('systemctl is-active ssh')) {
          callback(new Error('SSH not found'), null);
        } else if (cmd.includes('systemctl is-active sshd')) {
          callback(null, { stdout: 'active\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(true);
    });

    it('should return false when SSH is not running', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'inactive\n', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(false);
    });
  });

  describe('checkAutomaticUpdates', () => {
    it('should detect enabled automatic updates on Ubuntu', async () => {
      mockReadFileSync.mockReturnValue(`APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";`);
      mockExistsSync.mockImplementation((path: any) => {
        return path.includes('50unattended-upgrades') || path.includes('20auto-upgrades');
      });

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(true);
      expect(result.securityUpdatesOnly).toBe(false);
    });

    it('should detect enabled automatic updates via DNF', async () => {
      mockReadFileSync.mockReturnValue(`[commands]
apply_updates = yes
upgrade_type = security`);
      mockExistsSync.mockImplementation((path: any) => {
        return path.includes('/etc/dnf/automatic.conf');
      });
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('systemctl is-enabled dnf-automatic.timer')) {
          callback(null, { stdout: 'enabled\n', stderr: '' });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(true);
    });

    it('should return false when automatic updates are disabled', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Service not found'), null);
        return {} as any;
      });

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(false);
      expect(result.securityUpdatesOnly).toBe(false);
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
