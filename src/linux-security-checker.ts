import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { ISecurityChecker } from './security-checker-interface';

const execAsync = promisify(exec);

export class LinuxSecurityChecker implements ISecurityChecker {
  private password?: string;

  constructor(password?: string) {
    this.password = password;
  }

  /**
   * Execute command with sudo using stored password if available
   */
  private async execWithSudo(command: string): Promise<{ stdout: string; stderr: string }> {
    if (this.password) {
      // Use non-interactive sudo with password
      const sudoCommand = `echo "${this.password}" | sudo -S ${command}`;
      return execAsync(sudoCommand);
    } else {
      // Fallback to regular sudo (will prompt for password)
      return execAsync(`sudo ${command}`);
    }
  }

  /**
   * Check if disk encryption (LUKS) is enabled
   * Linux equivalent of FileVault
   */
  async checkDiskEncryption(): Promise<boolean> {
    try {
      // Check for LUKS encrypted devices
      const { stdout } = await execAsync('lsblk -f');
      const hasLuks = stdout.includes('crypto_LUKS');
      
      if (hasLuks) {
        return true;
      }
      
      // Alternative check using dmsetup
      try {
        const { stdout: dmStdout } = await execAsync('dmsetup ls --target crypt 2>/dev/null || echo ""');
        return dmStdout.trim().length > 0;
      } catch (error) {
        return false;
      }
    } catch (error) {
      console.error('Error checking disk encryption status:', error);
      return false;
    }
  }

  /**
   * Check password protection and screen lock settings
   * Linux equivalent of macOS password protection
   */
  async checkPasswordProtection(): Promise<{ enabled: boolean; requirePasswordImmediately: boolean; passwordRequiredAfterLock: boolean }> {
    try {
      let passwordEnabled = false;
      let requirePasswordImmediately = false;
      let passwordRequiredAfterLock = false;

      // Check if user has a password (not passwordless)
      try {
        const { stdout } = await execAsync('passwd -S $(whoami) 2>/dev/null || echo "unknown"');
        passwordEnabled = !stdout.includes('NP') && !stdout.includes('unknown'); // NP means no password
      } catch (error) {
        // Assume password is enabled if we can't determine
        passwordEnabled = true;
      }

      // Check screen lock settings (GNOME/KDE)
      try {
        // GNOME settings
        const { stdout: gnomeTimeout } = await execAsync('gsettings get org.gnome.desktop.screensaver lock-delay 2>/dev/null || echo "not-found"');
        if (!gnomeTimeout.includes('not-found')) {
          const delay = parseInt(gnomeTimeout.replace(/[^0-9]/g, ''));
          requirePasswordImmediately = delay === 0;
          passwordRequiredAfterLock = true;
        }
      } catch (gnomeError) {
        // Try KDE settings
        try {
          const kdeConfigPath = `${process.env.HOME}/.config/kscreenlockerrc`;
          if (fs.existsSync(kdeConfigPath)) {
            const kdeConfig = fs.readFileSync(kdeConfigPath, 'utf-8');
            passwordRequiredAfterLock = !kdeConfig.includes('Autolock=false');
          }
        } catch (kdeError) {
          // Default to requiring password for screen lock
          passwordRequiredAfterLock = true;
        }
      }

      return {
        enabled: passwordEnabled,
        requirePasswordImmediately,
        passwordRequiredAfterLock
      };
    } catch (error) {
      console.error('Error checking password protection:', error);
      return {
        enabled: false,
        requirePasswordImmediately: false,
        passwordRequiredAfterLock: false
      };
    }
  }

  /**
   * Check auto-lock timeout settings
   * Linux equivalent of macOS auto-lock
   */
  async checkAutoLockTimeout(): Promise<number> {
    try {
      // GNOME screen timeout
      try {
        const { stdout } = await execAsync('gsettings get org.gnome.desktop.session idle-delay 2>/dev/null');
        const seconds = parseInt(stdout.replace(/[^0-9]/g, ''));
        if (!isNaN(seconds)) {
          return Math.round(seconds / 60); // Convert to minutes
        }
      } catch (gnomeError) {
        // Try KDE settings
        try {
          const kdeConfigPath = `${process.env.HOME}/.config/kscreenlockerrc`;
          if (fs.existsSync(kdeConfigPath)) {
            const kdeConfig = fs.readFileSync(kdeConfigPath, 'utf-8');
            const match = kdeConfig.match(/Timeout=(\d+)/);
            if (match) {
              return Math.round(parseInt(match[1]) / 60); // Convert to minutes
            }
          }
        } catch (kdeError) {
          // Default timeout
        }
      }

      // Default to 15 minutes if we can't determine
      return 15;
    } catch (error) {
      console.error('Error checking auto-lock timeout:', error);
      return 15;
    }
  }

  /**
   * Check firewall status using ufw or firewalld
   * Linux equivalent of macOS firewall
   */
  async checkFirewall(): Promise<{ enabled: boolean; stealthMode: boolean }> {
    try {
      let enabled = false;
      let stealthMode = false;

      // Check ufw (Ubuntu/Debian)
      try {
        const { stdout } = await execAsync('ufw status 2>/dev/null');
        enabled = stdout.includes('Status: active');
        // Check for stealth mode (reject vs deny)
        stealthMode = stdout.includes('REJECT');
      } catch (ufwError) {
        // Check firewalld (Fedora/RHEL)
        try {
          const { stdout } = await execAsync('firewall-cmd --state 2>/dev/null');
          enabled = stdout.trim() === 'running';
          
          if (enabled) {
            // Check for drop vs reject policy
            const { stdout: policy } = await execAsync('firewall-cmd --get-default-zone 2>/dev/null');
            const zone = policy.trim();
            const { stdout: target } = await execAsync(`firewall-cmd --zone=${zone} --query-target 2>/dev/null || echo "default"`);
            stealthMode = target.includes('DROP');
          }
        } catch (firewalldError) {
          // Check iptables directly
          try {
            const { stdout } = await this.execWithSudo('iptables -L 2>/dev/null || echo "not-available"');
            enabled = !stdout.includes('not-available') && stdout.includes('Chain');
            stealthMode = stdout.includes('DROP');
          } catch (iptablesError) {
            enabled = false;
          }
        }
      }

      return { enabled, stealthMode };
    } catch (error) {
      console.error('Error checking firewall status:', error);
      return { enabled: false, stealthMode: false };
    }
  }

  /**
   * Check if package signature verification is enabled
   * Linux equivalent of Gatekeeper
   */
  async checkPackageVerification(): Promise<boolean> {
    try {
      // Check based on package manager
      
      // DNF (Fedora)
      try {
        const { stdout } = await execAsync('dnf config-manager --dump 2>/dev/null | grep gpgcheck || echo "not-found"');
        if (!stdout.includes('not-found')) {
          return stdout.includes('gpgcheck = 1') || stdout.includes('gpgcheck=1');
        }
      } catch (dnfError) {
        // APT (Ubuntu/Debian)
        try {
          const { stdout } = await execAsync('apt-config dump | grep -i gpg 2>/dev/null || echo "not-found"');
          if (!stdout.includes('not-found')) {
            // APT generally has GPG verification enabled by default
            return true;
          }
        } catch (aptError) {
          // YUM (older RHEL/CentOS)
          try {
            const yumConfPath = '/etc/yum.conf';
            if (fs.existsSync(yumConfPath)) {
              const yumConfig = fs.readFileSync(yumConfPath, 'utf-8');
              return yumConfig.includes('gpgcheck=1');
            }
          } catch (yumError) {
            // Default to true for security
            return true;
          }
        }
      }

      // Default to true if we can't determine (assume secure default)
      return true;
    } catch (error) {
      console.error('Error checking package verification:', error);
      return false;
    }
  }

  /**
   * Check if SELinux/AppArmor is enabled
   * Linux equivalent of System Integrity Protection
   */
  async checkSystemIntegrityProtection(): Promise<boolean> {
    try {
      // Check SELinux (Fedora/RHEL)
      try {
        const { stdout } = await execAsync('getenforce 2>/dev/null');
        if (stdout.trim() === 'Enforcing') {
          return true;
        }
      } catch (selinuxError) {
        // Check AppArmor (Ubuntu/Debian)
        try {
          const { stdout } = await execAsync('aa-status 2>/dev/null');
          return stdout.includes('apparmor module is loaded');
        } catch (apparmorError) {
          // Check for other security modules
          try {
            const { stdout } = await execAsync('cat /sys/kernel/security/lsm 2>/dev/null');
            return stdout.includes('selinux') || stdout.includes('apparmor');
          } catch (lsmError) {
            return false;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking system integrity protection:', error);
      return false;
    }
  }

  /**
   * Check SSH service status
   * Linux equivalent of remote login
   */
  async checkRemoteLogin(): Promise<boolean> {
    try {
      // Check if SSH service is running
      try {
        const { stdout } = await execAsync('systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null || echo "inactive"');
        return stdout.trim() === 'active';
      } catch (systemctlError) {
        // Fallback to checking if SSH daemon is running
        try {
          const { stdout } = await execAsync('pgrep sshd 2>/dev/null || echo "not-running"');
          return !stdout.includes('not-running');
        } catch (pgrepError) {
          return false;
        }
      }
    } catch (error) {
      console.error('Error checking SSH status:', error);
      return false;
    }
  }

  /**
   * Check if VNC or other remote management services are running
   * Linux equivalent of remote management
   */
  async checkRemoteManagement(): Promise<boolean> {
    try {
      // Check for VNC services
      const vncServices = ['vncserver', 'x11vnc', 'tigervnc', 'realvnc'];
      
      for (const service of vncServices) {
        try {
          const { stdout } = await execAsync(`pgrep ${service} 2>/dev/null || echo "not-running"`);
          if (!stdout.includes('not-running')) {
            return true;
          }
        } catch (error) {
          // Continue checking other services
        }
      }

      // Check for TeamViewer
      try {
        const { stdout } = await execAsync('pgrep teamviewer 2>/dev/null || echo "not-running"');
        if (!stdout.includes('not-running')) {
          return true;
        }
      } catch (error) {
        // Continue
      }

      return false;
    } catch (error) {
      console.error('Error checking remote management status:', error);
      return false;
    }
  }

  /**
   * Check automatic updates configuration
   * Linux equivalent of automatic updates
   */
  async checkAutomaticUpdates(): Promise<{
    enabled: boolean;
    securityUpdatesOnly: boolean;
    automaticDownload?: boolean;
    automaticInstall?: boolean;
    automaticSecurityInstall?: boolean;
    configDataInstall?: boolean;
    updateMode?: 'disabled' | 'check-only' | 'download-only' | 'fully-automatic';
    downloadOnly?: boolean;
  }> {
    try {
      let enabled = false;
      let securityUpdatesOnly = false;
      let downloadOnly = false;
      let automaticInstall = false;
      let automaticSecurityInstall = false;

      // Check DNF automatic (Fedora)
      try {
        const dnfAutoConfigPath = '/etc/dnf/automatic.conf';
        if (fs.existsSync(dnfAutoConfigPath)) {
          const dnfConfig = fs.readFileSync(dnfAutoConfigPath, 'utf-8');
          enabled = dnfConfig.includes('apply_updates = yes') || dnfConfig.includes('apply_updates=yes');
          downloadOnly = dnfConfig.includes('download_updates = yes') && !enabled;
          automaticInstall = enabled;
          
          // Check if only security updates
          securityUpdatesOnly = dnfConfig.includes('upgrade_type = security');
          automaticSecurityInstall = securityUpdatesOnly && automaticInstall;
        }
      } catch (dnfError) {
        // Check unattended-upgrades (Ubuntu/Debian)
        try {
          const unattendedConfigPath = '/etc/apt/apt.conf.d/50unattended-upgrades';
          if (fs.existsSync(unattendedConfigPath)) {
            const aptConfig = fs.readFileSync(unattendedConfigPath, 'utf-8');
            enabled = !aptConfig.includes('//') || aptConfig.includes('Unattended-Upgrade::Automatic-Reboot "true"');
            securityUpdatesOnly = aptConfig.includes('security') || aptConfig.includes('Security');
            automaticInstall = enabled;
            automaticSecurityInstall = securityUpdatesOnly;
          }
        } catch (aptError) {
          // Check yum-cron (older systems)
          try {
            const yumCronConfigPath = '/etc/yum/yum-cron.conf';
            if (fs.existsSync(yumCronConfigPath)) {
              const yumConfig = fs.readFileSync(yumCronConfigPath, 'utf-8');
              enabled = yumConfig.includes('apply_updates = yes');
              automaticInstall = enabled;
            }
          } catch (yumError) {
            enabled = false;
          }
        }
      }

      return {
        enabled,
        securityUpdatesOnly,
        automaticDownload: downloadOnly, // Use downloadOnly for automaticDownload
        automaticInstall,
        automaticSecurityInstall,
        downloadOnly
      };
    } catch (error) {
      console.error('Error checking automatic updates:', error);
      return {
        enabled: false,
        securityUpdatesOnly: false,
        automaticDownload: false,
        automaticInstall: false,
        automaticSecurityInstall: false,
        downloadOnly: false
      };
    }
  }

  /**
   * Check file and screen sharing services
   * Linux equivalent of sharing services
   */
  async checkSharingServices(): Promise<{ fileSharing: boolean; screenSharing: boolean; remoteLogin: boolean; mediaSharing: boolean }> {
    try {
      // File sharing - check Samba, NFS
      let fileSharing = false;
      try {
        const { stdout: sambaStatus } = await execAsync('systemctl is-active smbd 2>/dev/null || systemctl is-active nmbd 2>/dev/null || echo "inactive"');
        fileSharing = sambaStatus.includes('active');
        
        if (!fileSharing) {
          const { stdout: nfsStatus } = await execAsync('systemctl is-active nfs-server 2>/dev/null || echo "inactive"');
          fileSharing = nfsStatus.includes('active');
        }
      } catch (error) {
        fileSharing = false;
      }

      // Screen sharing - check VNC services
      let screenSharing = false;
      try {
        const vncServices = ['vncserver', 'x11vnc', 'tigervnc'];
        for (const service of vncServices) {
          const { stdout } = await execAsync(`pgrep ${service} 2>/dev/null || echo "not-running"`);
          if (!stdout.includes('not-running')) {
            screenSharing = true;
            break;
          }
        }
      } catch (error) {
        screenSharing = false;
      }

      // Remote login - SSH status
      const remoteLogin = await this.checkRemoteLogin();

      return {
        fileSharing,
        screenSharing,
        remoteLogin,
        mediaSharing: false // Linux doesn't typically have equivalent to macOS media sharing
      };
    } catch (error) {
      console.error('Error checking sharing services:', error);
      return {
        fileSharing: false,
        screenSharing: false,
        remoteLogin: false,
        mediaSharing: false
      };
    }
  }

  /**
   * Get current Linux version
   */
  async getCurrentLinuxVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('cat /etc/os-release | grep VERSION_ID | cut -d= -f2 | tr -d \'"\'');
      return stdout.trim();
    } catch (error) {
      try {
        const { stdout } = await execAsync('lsb_release -rs 2>/dev/null');
        return stdout.trim();
      } catch (lsbError) {
        return 'unknown';
      }
    }
  }

  /**
   * Get current Linux distribution
   */
  async getCurrentLinuxDistribution(): Promise<string> {
    try {
      const { stdout } = await execAsync('cat /etc/os-release | grep "^ID=" | cut -d= -f2 | tr -d \'"\'');
      return stdout.trim();
    } catch (error) {
      try {
        const { stdout } = await execAsync('lsb_release -is 2>/dev/null');
        return stdout.trim().toLowerCase();
      } catch (lsbError) {
        return 'unknown';
      }
    }
  }
}