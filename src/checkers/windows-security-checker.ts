import { exec } from 'child_process';
import { promisify } from 'util';
import { ISecurityChecker } from '../types';

const execAsync = promisify(exec);

export class WindowsSecurityChecker implements ISecurityChecker {
  private password?: string;

  constructor(password?: string) {
    this.password = password;
  }

  /**
   * Execute PowerShell command
   */
  private async execPowerShell(command: string): Promise<{ stdout: string; stderr: string }> {
    const psCommand = `powershell -Command "${command.replace(/"/g, '\\"')}"`;
    return execAsync(psCommand);
  }

  /**
   * Execute command with elevated privileges if needed
   */
  private async execWithElevation(command: string): Promise<{ stdout: string; stderr: string }> {
    // On Windows, we'll try regular PowerShell first, then suggest running as admin if needed
    return this.execPowerShell(command);
  }

  /**
   * Check if BitLocker disk encryption is enabled
   * Windows equivalent of FileVault/LUKS
   */
  async checkDiskEncryption(): Promise<boolean> {
    try {
      // Check BitLocker status using manage-bde
      const { stdout } = await execAsync('manage-bde -status');

      // Check if any drive has BitLocker enabled and unlocked/protected
      const lines = stdout.split('\n');
      let hasEncryptedDrive = false;

      for (const line of lines) {
        if (line.includes('Protection Status:') && line.includes('Protection On')) {
          hasEncryptedDrive = true;
          break;
        }
      }

      return hasEncryptedDrive;
    } catch {
      // Fallback: try PowerShell Get-BitLockerVolume
      try {
        const { stdout } = await this.execPowerShell(
          'Get-BitLockerVolume | Where-Object {$_.ProtectionStatus -eq "On"} | Measure-Object | Select-Object -ExpandProperty Count'
        );
        const count = parseInt(stdout.trim());
        return count > 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Check password protection and screen lock settings
   */
  async checkPasswordProtection(): Promise<{
    enabled: boolean;
    requirePasswordImmediately: boolean;
    passwordRequiredAfterLock: boolean;
  }> {
    try {
      // Check if password is required on wakeup
      const { stdout } = await this.execPowerShell(`
        $policy = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "InactivityTimeoutSecs" -ErrorAction SilentlyContinue;
        $screensaver = Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "ScreenSaveActive" -ErrorAction SilentlyContinue;
        $screensaverSecure = Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "ScreenSaverIsSecure" -ErrorAction SilentlyContinue;
        Write-Output "InactivityTimeout: $($policy.InactivityTimeoutSecs)";
        Write-Output "ScreenSaverActive: $($screensaver.ScreenSaveActive)";
        Write-Output "ScreenSaverIsSecure: $($screensaverSecure.ScreenSaverIsSecure)";
      `);

      const lines = stdout.split('\n');
      let screensaverActive = false;
      let screensaverSecure = false;

      for (const line of lines) {
        if (line.includes('ScreenSaverActive:') && line.includes('1')) {
          screensaverActive = true;
        }
        if (line.includes('ScreenSaverIsSecure:') && line.includes('1')) {
          screensaverSecure = true;
        }
      }

      const enabled = screensaverActive;
      const requirePasswordImmediately = screensaverSecure;

      return {
        enabled,
        requirePasswordImmediately,
        passwordRequiredAfterLock: screensaverSecure
      };
    } catch {
      return {
        enabled: false,
        requirePasswordImmediately: false,
        passwordRequiredAfterLock: false
      };
    }
  }

  /**
   * Check auto-lock timeout settings (in minutes)
   */
  async checkAutoLockTimeout(): Promise<number> {
    try {
      // Check screen saver timeout
      const { stdout } = await this.execPowerShell(`
        $timeout = Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "ScreenSaveTimeOut" -ErrorAction SilentlyContinue;
        if ($timeout) { Write-Output $timeout.ScreenSaveTimeOut } else { Write-Output "0" }
      `);

      const timeoutSeconds = parseInt(stdout.trim());
      return Math.floor(timeoutSeconds / 60); // Convert seconds to minutes
    } catch {
      return 0; // No timeout configured
    }
  }

  /**
   * Check Windows Defender Firewall status
   */
  async checkFirewall(): Promise<{ enabled: boolean; stealthMode: boolean }> {
    try {
      // Check Windows Firewall status for all profiles
      const { stdout } = await this.execPowerShell(`
        $profiles = Get-NetFirewallProfile;
        $domainEnabled = ($profiles | Where-Object {$_.Name -eq "Domain"}).Enabled;
        $privateEnabled = ($profiles | Where-Object {$_.Name -eq "Private"}).Enabled;
        $publicEnabled = ($profiles | Where-Object {$_.Name -eq "Public"}).Enabled;
        Write-Output "Domain: $domainEnabled";
        Write-Output "Private: $privateEnabled";
        Write-Output "Public: $publicEnabled";
      `);

      const lines = stdout.split('\n');
      let domainEnabled = false;
      let privateEnabled = false;
      let publicEnabled = false;

      for (const line of lines) {
        if (line.includes('Domain:') && line.includes('True')) {
          domainEnabled = true;
        } else if (line.includes('Private:') && line.includes('True')) {
          privateEnabled = true;
        } else if (line.includes('Public:') && line.includes('True')) {
          publicEnabled = true;
        }
      }

      // Consider firewall enabled if at least public profile is enabled
      const enabled = publicEnabled || (domainEnabled && privateEnabled);

      // Check for stealth mode (NotifyOnListen setting)
      let stealthMode = false;
      try {
        const { stdout: stealthStdout } = await this.execPowerShell(`
          $publicProfile = Get-NetFirewallProfile -Name Public;
          Write-Output $publicProfile.NotifyOnListen;
        `);
        stealthMode = stealthStdout.trim() === 'False'; // NotifyOnListen False means stealth mode
      } catch {
        stealthMode = false;
      }

      return { enabled, stealthMode };
    } catch {
      return { enabled: false, stealthMode: false };
    }
  }

  /**
   * Check Windows code signing and Windows Defender SmartScreen
   * Windows equivalent of Gatekeeper/package verification
   */
  async checkPackageVerification(): Promise<boolean> {
    try {
      // Check Windows Defender SmartScreen status
      const { stdout } = await this.execPowerShell(`
        $smartscreen = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" -Name "SmartScreenEnabled" -ErrorAction SilentlyContinue;
        if ($smartscreen) { Write-Output $smartscreen.SmartScreenEnabled } else { Write-Output "Off" }
      `);

      const smartScreenStatus = stdout.trim();
      return smartScreenStatus === 'RequireAdmin' || smartScreenStatus === 'Prompt';
    } catch {
      return false;
    }
  }

  /**
   * Check Windows Defender and system integrity features
   * Windows equivalent of SIP/SELinux/AppArmor
   */
  async checkSystemIntegrityProtection(): Promise<boolean> {
    try {
      // Check Windows Defender real-time protection
      const { stdout } = await this.execPowerShell(`
        $defender = Get-MpComputerStatus -ErrorAction SilentlyContinue;
        if ($defender) { 
          Write-Output "RealTimeProtectionEnabled: $($defender.RealTimeProtectionEnabled)";
          Write-Output "TamperProtectionEnabled: $($defender.TamperProtectionSource -ne 'NotSet')";
        } else { 
          Write-Output "RealTimeProtectionEnabled: False";
          Write-Output "TamperProtectionEnabled: False";
        }
      `);

      const lines = stdout.split('\n');
      let realTimeProtection = false;
      let tamperProtection = false;

      for (const line of lines) {
        if (line.includes('RealTimeProtectionEnabled:') && line.includes('True')) {
          realTimeProtection = true;
        }
        if (line.includes('TamperProtectionEnabled:') && line.includes('True')) {
          tamperProtection = true;
        }
      }

      return realTimeProtection && tamperProtection; // Both are important for system integrity protection
    } catch {
      return false;
    }
  }

  /**
   * Check SSH service status (Windows OpenSSH)
   */
  async checkRemoteLogin(): Promise<boolean> {
    try {
      // Check OpenSSH Server service
      const { stdout } = await this.execPowerShell(`
        $service = Get-Service -Name "sshd" -ErrorAction SilentlyContinue;
        if ($service) { Write-Output $service.Status } else { Write-Output "NotFound" }
      `);

      const status = stdout.trim();
      return status === 'Running';
    } catch {
      return false;
    }
  }

  /**
   * Check Remote Desktop and remote management services
   */
  async checkRemoteManagement(): Promise<boolean> {
    try {
      // Check Remote Desktop service and registry setting
      const { stdout } = await this.execPowerShell(`
        $rdpService = Get-Service -Name "TermService" -ErrorAction SilentlyContinue;
        $rdpEnabled = Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections" -ErrorAction SilentlyContinue;
        Write-Output "RDPService: $($rdpService.Status)";
        Write-Output "RDPEnabled: $($rdpEnabled.fDenyTSConnections)";
      `);

      const lines = stdout.split('\n');
      let rdpServiceRunning = false;
      let rdpEnabled = false;

      for (const line of lines) {
        if (line.includes('RDPService:') && line.includes('Running')) {
          rdpServiceRunning = true;
        }
        if (line.includes('RDPEnabled:') && line.includes('0')) {
          rdpEnabled = true; // fDenyTSConnections = 0 means RDP is enabled
        }
      }

      return rdpServiceRunning && rdpEnabled;
    } catch {
      return false;
    }
  }

  /**
   * Check Windows Update automatic update settings
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
      // Check Windows Update settings
      const { stdout } = await this.execPowerShell(`
        $wuSettings = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update" -Name "AUOptions" -ErrorAction SilentlyContinue;
        $wuService = Get-Service -Name "wuauserv" -ErrorAction SilentlyContinue;
        Write-Output "AUOptions: $($wuSettings.AUOptions)";
        Write-Output "WUService: $($wuService.Status)";
      `);

      const lines = stdout.split('\n');
      let auOptions = 0;
      let serviceRunning = false;

      for (const line of lines) {
        if (line.includes('AUOptions:')) {
          const match = line.match(/AUOptions:\s*(\d+)/);
          if (match) {
            auOptions = parseInt(match[1]);
          }
        }
        if (line.includes('WUService:') && line.includes('Running')) {
          serviceRunning = true;
        }
      }

      // AUOptions values:
      // 1 = Keep my computer up to date has been disabled
      // 2 = Notify for download and notify for install
      // 3 = Auto download and notify for install
      // 4 = Auto download and schedule the install

      const enabled = serviceRunning && auOptions > 1;
      const automaticDownload = auOptions >= 3;
      const automaticInstall = auOptions >= 4;

      let updateMode: 'disabled' | 'check-only' | 'download-only' | 'fully-automatic';
      if (auOptions <= 1) {
        updateMode = 'disabled';
      } else if (auOptions === 2) {
        updateMode = 'check-only';
      } else if (auOptions === 3) {
        updateMode = 'download-only';
      } else {
        updateMode = 'fully-automatic';
      }

      return {
        enabled,
        securityUpdatesOnly: false, // Windows doesn't separate security updates in this way
        automaticDownload,
        automaticInstall,
        automaticSecurityInstall: automaticInstall, // Treat same as automatic install
        downloadOnly: auOptions === 3,
        updateMode
      };
    } catch {
      return {
        enabled: false,
        securityUpdatesOnly: false,
        automaticDownload: false,
        automaticInstall: false,
        automaticSecurityInstall: false,
        downloadOnly: false,
        updateMode: 'disabled'
      };
    }
  }

  /**
   * Check Windows sharing services (file sharing, remote desktop)
   */
  async checkSharingServices(): Promise<{
    fileSharing: boolean;
    screenSharing: boolean;
    remoteLogin: boolean;
    mediaSharing?: boolean;
  }> {
    try {
      // Check various sharing services
      const { stdout } = await this.execPowerShell(`
        $lanmanServer = Get-Service -Name "LanmanServer" -ErrorAction SilentlyContinue;
        $rdpService = Get-Service -Name "TermService" -ErrorAction SilentlyContinue;
        $sshService = Get-Service -Name "sshd" -ErrorAction SilentlyContinue;
        $wmpNetSvc = Get-Service -Name "WMPNetworkSvc" -ErrorAction SilentlyContinue;
        
        Write-Output "FileSharing: $($lanmanServer.Status)";
        Write-Output "RDP: $($rdpService.Status)";
        Write-Output "SSH: $($sshService.Status)";
        Write-Output "MediaSharing: $($wmpNetSvc.Status)";
      `);

      const lines = stdout.split('\n');
      let fileSharing = false;
      let screenSharing = false;
      let remoteLogin = false;
      let mediaSharing = false;

      for (const line of lines) {
        if (line.includes('FileSharing:') && line.includes('Running')) {
          fileSharing = true;
        } else if (line.includes('RDP:') && line.includes('Running')) {
          screenSharing = true;
        } else if (line.includes('SSH:') && line.includes('Running')) {
          remoteLogin = true;
        } else if (line.includes('MediaSharing:') && line.includes('Running')) {
          mediaSharing = true;
        }
      }

      return {
        fileSharing,
        screenSharing,
        remoteLogin,
        mediaSharing
      };
    } catch {
      return {
        fileSharing: false,
        screenSharing: false,
        remoteLogin: false,
        mediaSharing: false
      };
    }
  }

  /**
   * Get stored password for validation purposes
   */
  getPassword(): string | undefined {
    return this.password;
  }

  /**
   * Get current Windows version
   */
  async getCurrentWindowsVersion(): Promise<string> {
    try {
      const { stdout } = await this.execPowerShell(
        '[System.Environment]::OSVersion.Version.ToString()'
      );
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<string> {
    try {
      const { stdout } = await this.execPowerShell(`
        $os = Get-WmiObject -Class Win32_OperatingSystem;
        $computer = Get-WmiObject -Class Win32_ComputerSystem;
        Write-Output "$($os.Caption) $($os.Version) on $($computer.Model)";
      `);
      return stdout.trim();
    } catch {
      return 'Windows (unknown version)';
    }
  }

  /**
   * Check OS version against target
   */
  async checkOSVersion(targetVersion: string): Promise<{
    current: string;
    target: string;
    isLatest: boolean;
    passed: boolean;
  }> {
    const current = await this.getCurrentWindowsVersion();

    if (targetVersion === 'latest') {
      // For Windows, we consider Windows 11 as latest
      const isLatest = current.startsWith('10.0.22') || current.startsWith('11.');
      return {
        current,
        target: targetVersion,
        isLatest,
        passed: isLatest
      };
    }

    const passed = current === targetVersion || current.startsWith(targetVersion);
    return {
      current,
      target: targetVersion,
      isLatest: false,
      passed
    };
  }

  /**
   * Get security explanations for different checks
   */
  getSecurityExplanations(): Record<
    string,
    {
      description: string;
      recommendation: string;
      riskLevel: 'High' | 'Medium' | 'Low';
    }
  > {
    return {
      diskEncryption: {
        description:
          'BitLocker provides full-disk encryption, protecting your data if your device is lost or stolen.',
        recommendation:
          'Should be ENABLED. Without disk encryption, anyone with physical access can read your files.',
        riskLevel: 'High'
      },
      passwordProtection: {
        description:
          'Password protection ensures your device locks and requires authentication after being idle.',
        recommendation:
          'Should be ENABLED with immediate password requirement for maximum security.',
        riskLevel: 'High'
      },
      autoLock: {
        description: 'Auto-lock automatically locks your screen after a period of inactivity.',
        recommendation:
          'Should be set to 15 minutes or less. Shorter timeouts provide better security.',
        riskLevel: 'Medium'
      },
      firewall: {
        description:
          'Windows Defender Firewall helps protect your computer from unauthorized network access.',
        recommendation: 'Should be ENABLED on all network profiles, especially Public networks.',
        riskLevel: 'High'
      },
      packageVerification: {
        description:
          'Windows Defender SmartScreen helps protect against malicious downloads and applications.',
        recommendation: 'Should be ENABLED to verify application authenticity and prevent malware.',
        riskLevel: 'High'
      },
      systemIntegrityProtection: {
        description:
          'Windows Defender provides real-time protection against malware and system tampering.',
        recommendation: 'Should be ENABLED with real-time protection and tamper protection active.',
        riskLevel: 'High'
      },
      remoteLogin: {
        description: 'SSH and remote login services allow external access to your computer.',
        recommendation: 'Should be DISABLED unless specifically needed for remote administration.',
        riskLevel: 'Medium'
      },
      remoteManagement: {
        description: 'Remote Desktop allows others to control your computer remotely.',
        recommendation: 'Should be DISABLED unless specifically needed for remote support.',
        riskLevel: 'Medium'
      },
      automaticUpdates: {
        description: 'Windows Update automatically downloads and installs security updates.',
        recommendation:
          'Should be ENABLED to ensure you receive critical security patches promptly.',
        riskLevel: 'High'
      },
      sharingServices: {
        description: 'File and media sharing services make your files accessible over the network.',
        recommendation:
          'Should be DISABLED unless you specifically need to share files with other computers.',
        riskLevel: 'Medium'
      }
    };
  }
}
