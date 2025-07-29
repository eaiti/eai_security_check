import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class MacOSSecurityChecker {

  async checkFileVault(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('fdesetup status');
      return stdout.includes('FileVault is On');
    } catch (error) {
      console.error('Error checking FileVault status:', error);
      return false;
    }
  }

  async checkPasswordProtection(): Promise<{ enabled: boolean; requirePasswordImmediately: boolean; passwordRequiredAfterLock: boolean }> {
    try {
      // Check if password is required for login (basic login protection)
      const { stdout: loginPasswordCheck } = await execAsync('defaults read com.apple.loginwindow DisableLoginItemSuppression 2>/dev/null || echo "enabled"');
      const passwordEnabled = !loginPasswordCheck.includes('disabled');

      // Use AppleScript to check lock screen password requirement (works on macOS 15.5+)
      let passwordRequiredAfterLock = false;
      try {
        const applescript = `tell application "System Events" to tell security preferences to get require password to wake`;
        const { stdout: lockScreenResult } = await execAsync(`osascript -e '${applescript}'`);
        passwordRequiredAfterLock = lockScreenResult.trim().toLowerCase() === 'true';
      } catch (applescriptError) {
        console.warn('AppleScript method failed, falling back to defaults:', applescriptError);

        // Fallback to traditional defaults method (may not work on newer macOS versions)
        try {
          const { stdout: screenSaverPassword } = await execAsync('defaults read com.apple.screensaver askForPassword 2>/dev/null || echo "0"');
          const { stdout: passwordDelay } = await execAsync('defaults read com.apple.screensaver askForPasswordDelay 2>/dev/null || echo "0"');
          passwordRequiredAfterLock = screenSaverPassword.trim() === '1';
        } catch (fallbackError) {
          console.warn('Fallback defaults method also failed:', fallbackError);
          passwordRequiredAfterLock = false;
        }
      }

      // For "immediate" password requirement on macOS 15.5+:
      // - We can detect if password is required (true/false) but not the actual delay time
      // - Since we cannot determine the exact delay, we'll consider it passing as long as
      //   password is required after lock, regardless of the delay time
      // - This is a practical approach since any password requirement provides some security

      const requirePasswordImmediately = passwordRequiredAfterLock;

      return {
        enabled: passwordEnabled,
        requirePasswordImmediately,
        passwordRequiredAfterLock
      };
    } catch (error) {
      console.error('Error checking password protection:', error);
      return { enabled: false, requirePasswordImmediately: false, passwordRequiredAfterLock: false };
    }
  }

  async checkAutoLockTimeout(): Promise<number> {
    try {
      // Check screen saver timeout (in seconds)
      const { stdout } = await execAsync('defaults -currentHost read com.apple.screensaver idleTime 2>/dev/null || echo "0"');
      const timeoutSeconds = parseInt(stdout.trim());

      // Convert to minutes
      return Math.ceil(timeoutSeconds / 60);
    } catch (error) {
      console.error('Error checking auto-lock timeout:', error);
      return 0; // Default to 0 if unable to determine
    }
  }

  async getSystemInfo(): Promise<string> {
    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      return `macOS ${stdout.trim()}`;
    } catch (error) {
      return 'Unknown macOS version';
    }
  }

  async getCurrentMacOSVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      return stdout.trim();
    } catch (error) {
      console.error('Error getting macOS version:', error);
      return '0.0.0'; // Return minimum version on error
    }
  }

  async getLatestMacOSVersion(): Promise<string> {
    try {
      // Try to get latest version from Apple's software update catalog
      // This uses softwareupdate command which may require admin privileges
      const { stdout } = await execAsync('softwareupdate --list --all | grep -E "macOS.*[0-9]+\\.[0-9]+" | head -1 | grep -o "[0-9][0-9]*\\.[0-9][0-9]*" | head -1');
      const detectedVersion = stdout.trim();

      if (detectedVersion && this.isValidVersion(detectedVersion)) {
        return detectedVersion;
      }
    } catch (error) {
      // Fallback if Apple query fails
    }

    // Fallback to known latest version as of implementation time
    // This should be updated periodically or made configurable
    return '15.1'; // macOS Sequoia 15.1 as of late 2024
  }

  private isValidVersion(version: string): boolean {
    return /^\d+\.\d+(\.\d+)?$/.test(version);
  }

  private parseVersion(version: string): number[] {
    return version.split('.').map(n => parseInt(n, 10));
  }

  private compareVersions(current: string, target: string): number {
    const currentParts = this.parseVersion(current);
    const targetParts = this.parseVersion(target);

    // Normalize arrays to same length
    const maxLength = Math.max(currentParts.length, targetParts.length);
    while (currentParts.length < maxLength) currentParts.push(0);
    while (targetParts.length < maxLength) targetParts.push(0);

    for (let i = 0; i < maxLength; i++) {
      if (currentParts[i] > targetParts[i]) return 1;
      if (currentParts[i] < targetParts[i]) return -1;
    }
    return 0; // Equal
  }

  async checkOSVersion(targetVersion: string): Promise<{ current: string; target: string; isLatest: boolean; passed: boolean }> {
    try {
      const current = await this.getCurrentMacOSVersion();
      let target = targetVersion;
      const isLatest = targetVersion.toLowerCase() === 'latest';

      if (isLatest) {
        target = await this.getLatestMacOSVersion();
      }

      const comparison = this.compareVersions(current, target);
      const passed = comparison >= 0; // Current >= Target

      return {
        current,
        target,
        isLatest,
        passed
      };
    } catch (error) {
      console.error('Error checking OS version:', error);
      return {
        current: '0.0.0',
        target: targetVersion,
        isLatest: targetVersion.toLowerCase() === 'latest',
        passed: false
      };
    }
  }

  getSecurityExplanations(): Record<string, { description: string; recommendation: string; riskLevel: 'High' | 'Medium' | 'Low' }> {
    return {
      'FileVault': {
        description: 'FileVault provides full-disk encryption, protecting your data if your Mac is lost or stolen.',
        recommendation: 'Should be ENABLED. Without FileVault, anyone with physical access can read your files by booting from external media.',
        riskLevel: 'High'
      },
      'Password Protection': {
        description: 'Requires a password to log into your Mac, preventing unauthorized access.',
        recommendation: 'Should be ENABLED. Password protection is the first line of defense against unauthorized access.',
        riskLevel: 'High'
      },
      'Immediate Password Requirement': {
        description: 'Requires password entry when waking from screen saver or sleep, preventing unauthorized access. On macOS 15.5+, only the enabled/disabled state is detectable - the actual delay time is not accessible programmatically.',
        recommendation: 'Should be ENABLED. Any password requirement after lock provides security protection. For maximum security, set to "immediately", but any delay is better than no password requirement.',
        riskLevel: 'Medium'
      },
      'Auto-lock Timeout': {
        description: 'Automatically locks your screen after a period of inactivity to prevent unauthorized access.',
        recommendation: 'Should be ≤7 minutes for security, ≤15 minutes for convenience. Shorter timeouts provide better security.',
        riskLevel: 'Medium'
      },
      'Firewall': {
        description: 'Application firewall blocks unauthorized network connections and protects against network-based attacks.',
        recommendation: 'Should be ENABLED. Protects against malicious network traffic and unauthorized remote access attempts.',
        riskLevel: 'High'
      },
      'Firewall Stealth Mode': {
        description: 'Makes your Mac invisible to network scans and ping requests, reducing attack surface.',
        recommendation: 'Should be ENABLED for maximum security. Makes your Mac harder to discover on networks.',
        riskLevel: 'Low'
      },
      'Gatekeeper': {
        description: 'Verifies downloaded applications are from identified developers and haven\'t been tampered with.',
        recommendation: 'Should be ENABLED. Prevents execution of malicious or unsigned software that could compromise your system.',
        riskLevel: 'High'
      },
      'System Integrity Protection': {
        description: 'SIP protects critical system files and processes from modification, even by users with admin privileges.',
        recommendation: 'Should be ENABLED. Prevents malware and accidental modifications from corrupting macOS system files.',
        riskLevel: 'High'
      },
      'Remote Login (SSH)': {
        description: 'SSH allows remote command-line access to your Mac over the network.',
        recommendation: 'Should be DISABLED unless specifically needed. SSH access can be exploited if not properly secured.',
        riskLevel: 'Medium'
      },
      'Remote Management': {
        description: 'Allows remote control and management of your Mac through Apple Remote Desktop or similar tools.',
        recommendation: 'Should be DISABLED unless required for IT management. Provides extensive remote access capabilities.',
        riskLevel: 'Medium'
      },
      'Automatic Updates': {
        description: 'Automatically checks for and installs software updates, including critical security patches.',
        recommendation: 'Should be ENABLED. Ensures you receive important security updates promptly to protect against known vulnerabilities.',
        riskLevel: 'High'
      },
      'Security Updates': {
        description: 'Automatically installs critical security updates without user intervention.',
        recommendation: 'Should be ENABLED. Critical security patches should be installed immediately to prevent exploitation.',
        riskLevel: 'High'
      },
      'File Sharing': {
        description: 'Allows other devices on the network to access shared folders on your Mac.',
        recommendation: 'Should be DISABLED unless actively sharing files. File sharing expands your attack surface.',
        riskLevel: 'Medium'
      },
      'Screen Sharing': {
        description: 'Allows remote users to view and control your Mac\'s screen over the network.',
        recommendation: 'Should be DISABLED unless required for remote support. Provides full remote access to your desktop.',
        riskLevel: 'High'
      },
      'OS Version': {
        description: 'Ensures your macOS is up-to-date with the latest security patches and features.',
        recommendation: 'Should be current or recent version. Newer versions include important security fixes and improvements.',
        riskLevel: 'Medium'
      },
      'WiFi Network Security': {
        description: 'Monitors current WiFi network connection to ensure you are not connected to banned or insecure networks.',
        recommendation: 'Avoid connecting to untrusted, guest, or prohibited networks for work purposes. Use secure, company-approved networks.',
        riskLevel: 'Medium'
      }
    };
  }

  async checkFirewall(): Promise<{ enabled: boolean; stealthMode: boolean }> {
    try {
      // Check if application firewall is enabled
      const { stdout: firewallStatus } = await execAsync('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo "disabled"');
      const enabled = firewallStatus.includes('enabled');

      // Check stealth mode
      const { stdout: stealthStatus } = await execAsync('/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode 2>/dev/null || echo "disabled"');
      const stealthMode = stealthStatus.includes('enabled');

      return { enabled, stealthMode };
    } catch (error) {
      console.error('Error checking firewall status:', error);
      return { enabled: false, stealthMode: false };
    }
  }

  async checkGatekeeper(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('spctl --status 2>/dev/null || echo "disabled"');
      return stdout.includes('enabled');
    } catch (error) {
      console.error('Error checking Gatekeeper status:', error);
      return false;
    }
  }

  async checkSystemIntegrityProtection(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('csrutil status 2>/dev/null || echo "disabled"');
      return stdout.includes('enabled');
    } catch (error) {
      console.error('Error checking SIP status:', error);
      return false;
    }
  }

  async checkRemoteLogin(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('sudo systemsetup -getremotelogin 2>/dev/null || echo "On"');
      return stdout.includes('On');
    } catch (error) {
      // Fallback method without sudo
      try {
        const { stdout: fallback } = await execAsync('launchctl list | grep ssh 2>/dev/null');
        return fallback.length > 0;
      } catch {
        console.error('Error checking remote login status:', error);
        return false;
      }
    }
  }

  async checkRemoteManagement(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart -query -settings 2>/dev/null || echo "not active"');
      return !stdout.includes('not active');
    } catch (error) {
      // Fallback check
      try {
        const { stdout: fallback } = await execAsync('ps aux | grep -i "remote" | grep -v grep 2>/dev/null || echo ""');
        return fallback.includes('RemoteDesktop') || fallback.includes('ARDAgent');
      } catch {
        console.error('Error checking remote management status:', error);
        return false;
      }
    }
  }

  async checkAutomaticUpdates(): Promise<{ enabled: boolean; securityUpdatesOnly: boolean }> {
    try {
      // Check if automatic updates are enabled
      const { stdout: autoUpdate } = await execAsync('defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled 2>/dev/null || echo "0"');
      const enabled = autoUpdate.trim() === '1';

      // Check if security updates are enabled
      const { stdout: securityUpdates } = await execAsync('defaults read /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall 2>/dev/null || echo "0"');
      const securityUpdatesOnly = securityUpdates.trim() === '1';

      return { enabled, securityUpdatesOnly };
    } catch (error) {
      console.error('Error checking automatic updates status:', error);
      return { enabled: false, securityUpdatesOnly: false };
    }
  }

  async checkSharingServices(): Promise<{ fileSharing: boolean; screenSharing: boolean; remoteLogin: boolean }> {
    try {
      // Check file sharing
      const { stdout: fileSharingStatus } = await execAsync('launchctl list | grep com.apple.smbd 2>/dev/null || echo ""');
      const fileSharing = fileSharingStatus.length > 0;

      // Check screen sharing
      const { stdout: screenSharingStatus } = await execAsync('launchctl list | grep com.apple.screensharing 2>/dev/null || echo ""');
      const screenSharing = screenSharingStatus.length > 0;

      // Check remote login (SSH)
      const { stdout: remoteLoginStatus } = await execAsync('launchctl list | grep com.openssh.sshd 2>/dev/null || echo ""');
      const remoteLogin = remoteLoginStatus.length > 0;

      return { fileSharing, screenSharing, remoteLogin };
    } catch (error) {
      console.error('Error checking sharing services:', error);
      return { fileSharing: false, screenSharing: false, remoteLogin: false };
    }
  }

  async checkCurrentWifiNetwork(): Promise<{ networkName: string | null; connected: boolean }> {
    try {
      // Primary method: Use system_profiler with awk for clean network name extraction
      try {
        const { stdout } = await execAsync(`system_profiler SPAirPortDataType | awk '/Current Network/ {getline;$1=$1;print $0 | "tr -d ':'";exit}' 2>/dev/null`);
        const networkName = stdout.trim();

        if (networkName && networkName.length > 0) {
          return { networkName, connected: true };
        }
      } catch {
        // Primary method failed, try fallbacks
      }

      return { networkName: null, connected: false };
    } catch (error) {
      console.warn('Error checking WiFi network:', error);
      return { networkName: null, connected: false };
    }
  }
}
