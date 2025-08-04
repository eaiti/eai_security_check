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
      mockExec.mockImplementation((cmd: any, callback: any) => {
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
      expect(result.requirePasswordImmediately).toBe(true);
      expect(result.passwordRequiredAfterLock).toBe(true);
    });

    it('should detect when no password is set', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('passwd -S')) {
          callback(null, { stdout: 'user NP 01/01/2024 0 99999 7 -1\n', stderr: '' });
        } else {
          callback(null, { stdout: 'not-found', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(false);
    });

    it('should handle passwd command errors gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('passwd -S')) {
          callback(new Error('Command failed'), null);
        } else {
          callback(null, { stdout: 'not-found', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkPasswordProtection();
      // When passwd command fails, we assume password is enabled
      expect(result.enabled).toBe(true);
      expect(result.requirePasswordImmediately).toBe(false);
      expect(result.passwordRequiredAfterLock).toBe(true);
    });

    it('should detect KDE screen lock settings when GNOME fails', async () => {
      // Mock the KDE config file
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('[ScreenLocker]\nAutolock=true\n');

      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('passwd -S')) {
          callback(null, { stdout: 'user P 01/01/2024 0 99999 7 -1\n', stderr: '' });
        } else if (cmd.includes('gsettings')) {
          callback(new Error('GNOME not available'), null);
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkPasswordProtection();
      expect(result.enabled).toBe(true);
      expect(result.passwordRequiredAfterLock).toBe(true);
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
      expect(result).toBe(5); // 300 seconds / 60 = 5 minutes
    });

    it('should detect KDE auto-lock timeout', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('[ScreenLocker]\nTimeout=600\n');

      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('gsettings get org.gnome.desktop.session idle-delay')) {
          callback(new Error('GNOME not available'), null);
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(10); // 600 seconds / 60 = 10 minutes
    });

    it('should return default timeout when auto-lock is not configured', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command not found'), null);
        return {} as any;
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(15); // Default 15 minutes
    });

    it('should handle invalid GNOME timeout gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('gsettings get org.gnome.desktop.session idle-delay')) {
          callback(null, { stdout: 'invalid-value\n', stderr: '' });
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(15); // Should return default
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

    it('should have getCurrentLinuxVersion method', () => {
      expect(typeof checker.getCurrentLinuxVersion).toBe('function');
    });

    it('should have getCurrentLinuxDistribution method', () => {
      expect(typeof checker.getCurrentLinuxDistribution).toBe('function');
    });
  });

  // NEW COMPREHENSIVE TESTS
  describe('checkRemoteManagement', () => {
    it('should detect enabled VNC service', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('systemctl is-active vnc') || cmd.includes('systemctl is-active vncserver')) {
          callback(null, { stdout: 'active\n', stderr: '' });
        } else {
          callback(null, { stdout: 'inactive\n', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkRemoteManagement();
      expect(result).toBe(true);
    });

    it('should detect enabled TeamViewer service', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('systemctl is-active teamviewerd')) {
          callback(null, { stdout: 'active\n', stderr: '' });
        } else {
          callback(null, { stdout: 'inactive\n', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkRemoteManagement();
      expect(result).toBe(true);
    });

    it('should return false when no remote management services are active', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'inactive\n', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkRemoteManagement();
      expect(result).toBe(false);
    });

    it('should handle service check errors gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Service check failed'), null);
        return {} as any;
      });

      const result = await checker.checkRemoteManagement();
      expect(result).toBe(false);
    });
  });

  describe('checkSharingServices', () => {
    it('should detect enabled Samba service', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('systemctl is-active smbd') || cmd.includes('systemctl is-active nmbd')) {
          callback(null, { stdout: 'active\n', stderr: '' });
        } else {
          callback(null, { stdout: 'inactive\n', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(true);
    });

    it('should detect enabled NFS service', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('systemctl is-active nfs-server')) {
          callback(null, { stdout: 'active\n', stderr: '' });
        } else {
          callback(null, { stdout: 'inactive\n', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(true);
    });

    it('should detect enabled screen sharing service', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('pgrep vncserver') || cmd.includes('pgrep x11vnc')) {
          callback(null, { stdout: '1234\n', stderr: '' }); // Process ID indicates running
        } else {
          callback(null, { stdout: 'not-running\n', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkSharingServices();
      expect(result.screenSharing).toBe(true);
    });

    it('should return false for all services when none are active', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'inactive\n', stderr: '' });
        return {} as any;
      });

      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(false);
      expect(result.screenSharing).toBe(false);
      expect(result.remoteLogin).toBe(false);
      expect(result.mediaSharing).toBe(false);
    });

    it('should handle service check errors gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Service check failed'), null);
        return {} as any;
      });

      const result = await checker.checkSharingServices();
      expect(result.fileSharing).toBe(false);
      expect(result.screenSharing).toBe(false);
      expect(result.remoteLogin).toBe(false);
      expect(result.mediaSharing).toBe(false);
    });
  });

  describe('getCurrentLinuxVersion', () => {
    it('should return kernel version', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('uname -r')) {
          callback(null, { stdout: '5.15.0-72-generic\n', stderr: '' });
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.getCurrentLinuxVersion();
      expect(result).toBe('5.15.0-72-generic');
    });

    it('should handle uname command failure', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('uname command failed'), null);
        return {} as any;
      });

      const result = await checker.getCurrentLinuxVersion();
      expect(result).toBe('Unknown');
    });

    it('should handle empty output gracefully', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const result = await checker.getCurrentLinuxVersion();
      expect(result).toBe('Unknown');
    });
  });

  describe('getCurrentLinuxDistribution', () => {
    it('should detect Ubuntu distribution', async () => {
      mockReadFileSync.mockReturnValue('NAME="Ubuntu"\nVERSION="22.04.2 LTS (Jammy Jellyfish)"\nID=ubuntu\n');
      mockExistsSync.mockReturnValue(true);

      const result = await checker.getCurrentLinuxDistribution();
      expect(result).toContain('Ubuntu');
    });

    it('should detect Red Hat distribution', async () => {
      mockReadFileSync.mockReturnValue('NAME="Red Hat Enterprise Linux"\nVERSION="9.2 (Plow)"\nID="rhel"\n');
      mockExistsSync.mockReturnValue(true);

      const result = await checker.getCurrentLinuxDistribution();
      expect(result).toContain('Red Hat Enterprise Linux');
    });

    it('should detect Fedora distribution', async () => {
      mockReadFileSync.mockReturnValue('NAME="Fedora Linux"\nVERSION="38 (Workstation Edition)"\nID=fedora\n');
      mockExistsSync.mockReturnValue(true);

      const result = await checker.getCurrentLinuxDistribution();
      expect(result).toContain('Fedora Linux');
    });

    it('should fallback to lsb_release when os-release is not available', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('lsb_release -d')) {
          callback(null, { stdout: 'Description:\tDebian GNU/Linux 11 (bullseye)\n', stderr: '' });
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.getCurrentLinuxDistribution();
      expect(result).toContain('Debian GNU/Linux 11');
    });

    it('should return Unknown when all detection methods fail', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command failed'), null);
        return {} as any;
      });

      const result = await checker.getCurrentLinuxDistribution();
      expect(result).toBe('Unknown');
    });

    it('should handle malformed os-release file', async () => {
      mockReadFileSync.mockReturnValue('invalid content without proper format');
      mockExistsSync.mockReturnValue(true);

      const result = await checker.getCurrentLinuxDistribution();
      expect(result).toBe('Unknown');
    });
  });

  // COMPREHENSIVE ERROR HANDLING TESTS
  describe('error handling scenarios', () => {
    beforeEach(() => {
      // Suppress console.error for these tests
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle disk encryption check with partial command failures', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (callCount === 1) {
          // First call (lsblk) fails
          callback(new Error('lsblk command failed'), null);
        } else if (callCount === 2) {
          // Second call (dmsetup) succeeds
          callback(null, { stdout: 'luks-device-name\n', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(true);
    });

    it('should handle firewall check with mixed results', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('ufw status')) {
          callback(new Error('UFW not installed'), null);
        } else if (cmd.includes('firewall-cmd --state')) {
          callback(null, { stdout: 'running\n', stderr: '' });
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
    });

    it('should handle package verification with unknown package manager', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(new Error('Command not found'), null);
        return {} as any;
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(false);
    });
  });

  // INTEGRATION-STYLE TESTS
  describe('integration scenarios', () => {
    it('should handle system with GNOME desktop environment', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('NAME="Ubuntu"\nVERSION="22.04"\n');

      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('gsettings')) {
          callback(null, { stdout: 'uint32 300\n', stderr: '' });
        } else if (cmd.includes('passwd -S')) {
          callback(null, { stdout: 'user P 01/01/2024 0 99999 7 -1\n', stderr: '' });
        } else {
          callback(new Error('Command not available'), null);
        }
        return {} as any;
      });

      const passwordResult = await checker.checkPasswordProtection();
      const timeoutResult = await checker.checkAutoLockTimeout();
      const distroResult = await checker.getCurrentLinuxDistribution();

      expect(passwordResult.enabled).toBe(true);
      expect(timeoutResult).toBe(5); // 300 seconds / 60
      expect(distroResult).toContain('Ubuntu');
    });

    it('should handle system with KDE desktop environment', async () => {
      mockExistsSync.mockImplementation((path) => {
        return (path as string).includes('kscreenlockerrc');
      });
      mockReadFileSync.mockImplementation((path) => {
        if ((path as string).includes('kscreenlockerrc')) {
          return '[ScreenLocker]\nTimeout=600\nAutolock=true\n';
        }
        return 'NAME="Fedora"\nVERSION="38"\n';
      });

      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('gsettings')) {
          callback(new Error('GNOME not available'), null);
        } else if (cmd.includes('passwd -S')) {
          callback(null, { stdout: 'user P 01/01/2024 0 99999 7 -1\n', stderr: '' });
        } else {
          callback(new Error('Command not available'), null);
        }
        return {} as any;
      });

      const passwordResult = await checker.checkPasswordProtection();
      const timeoutResult = await checker.checkAutoLockTimeout();

      expect(passwordResult.enabled).toBe(true);
      expect(passwordResult.passwordRequiredAfterLock).toBe(true);
      expect(timeoutResult).toBe(10); // 600 seconds / 60
    });
  });

  // EDGE CASE TESTS
  describe('edge cases', () => {
    it('should handle firewall with stealth mode enabled', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('ufw status verbose')) {
          callback(null, { 
            stdout: 'Status: active\nLogging: on (low)\nDefault: deny (incoming), allow (outgoing), disabled (routed)\n', 
            stderr: '' 
          });
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
      expect(result.stealthMode).toBe(true); // Default deny is considered stealth mode
    });

    it('should handle mixed LUKS and unencrypted partitions', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('lsblk -f')) {
          callback(null, { 
            stdout: 'NAME FSTYPE\nsda1 ext4\nsda2 crypto_LUKS\nsda3 swap\n', 
            stderr: '' 
          });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(true); // Should detect encryption even if not all partitions are encrypted
    });

    it('should handle systems with multiple desktop environments', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('[ScreenLocker]\nTimeout=600\n');

      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('gsettings get org.gnome.desktop.session idle-delay')) {
          callback(null, { stdout: 'uint32 300\n', stderr: '' }); // GNOME setting found
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(5); // Should prefer GNOME setting when available
    });
  });

  // ADVANCED INTEGRATION TESTS
  describe('advanced scenarios', () => {
    it('should handle password-based sudo commands', async () => {
      const checkerWithPassword = new LinuxSecurityChecker('testpassword');
      
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('echo "testpassword" | sudo -S')) {
          callback(null, { stdout: 'active\n', stderr: '' });
        } else {
          callback(new Error('Permission denied'), null);
        }
        return {} as any;
      });

      const result = await checkerWithPassword.checkRemoteLogin();
      expect(result).toBe(true);
    });

    it('should handle complex firewall configurations', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('ufw status')) {
          callback(null, { 
            stdout: 'Status: active\n\nTo                         Action      From\n--                         ------      ----\n22/tcp                     ALLOW       Anywhere\n', 
            stderr: '' 
          });
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(result.enabled).toBe(true);
    });

    it('should detect specific package managers correctly', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('dnf config-manager --dump')) {
          callback(null, { 
            stdout: '[main]\ngpgcheck = True\nrepo_gpgcheck = True\n', 
            stderr: '' 
          });
        } else {
          callback(new Error('Command not found'), null);
        }
        return {} as any;
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(true);
    });

    it('should handle multiple security frameworks', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('sestatus')) {
          callback(null, { stdout: 'SELinux status: enabled\nCurrent mode: enforcing\n', stderr: '' });
        } else if (cmd.includes('aa-status')) {
          callback(null, { stdout: 'apparmor module is loaded.\n', stderr: '' });
        } else {
          callback(new Error('Command failed'), null);
        }
        return {} as any;
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(true); // Should detect SELinux
    });
  });

  // PERFORMANCE AND RELIABILITY TESTS
  describe('performance and reliability', () => {
    it('should handle concurrent security checks', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        // Simulate async delay
        setTimeout(() => {
          callback(null, { stdout: 'success\n', stderr: '' });
        }, 10);
        return {} as any;
      });

      const promises = [
        checker.checkDiskEncryption(),
        checker.checkFirewall(),
        checker.checkRemoteLogin()
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });

    it('should handle very long command output', async () => {
      const longOutput = 'line\n'.repeat(1000);
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: longOutput, stderr: '' });
        return {} as any;
      });

      const result = await checker.getCurrentLinuxVersion();
      expect(typeof result).toBe('string');
    });

    it('should handle commands with special characters', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callback(null, { 
          stdout: 'Status: Special chars !@#$%^&*()_+{}|:"<>?`~\n', 
          stderr: '' 
        });
        return {} as any;
      });

      const result = await checker.checkFirewall();
      expect(typeof result.enabled).toBe('boolean');
    });
  });
});
