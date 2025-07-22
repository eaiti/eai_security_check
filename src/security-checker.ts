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

  async checkPasswordProtection(): Promise<{ enabled: boolean; requirePasswordImmediately: boolean }> {
    try {
      // Check if password is required for login
      const { stdout: loginPasswordCheck } = await execAsync('defaults read com.apple.loginwindow DisableLoginItemSuppression 2>/dev/null || echo "enabled"');
      
      // Check screen saver password requirement
      const { stdout: screenSaverPassword } = await execAsync('defaults read com.apple.screensaver askForPassword 2>/dev/null || echo "0"');
      
      // Check password delay
      const { stdout: passwordDelay } = await execAsync('defaults read com.apple.screensaver askForPasswordDelay 2>/dev/null || echo "0"');
      
      const passwordEnabled = !loginPasswordCheck.includes('disabled');
      const requirePasswordImmediately = screenSaverPassword.trim() === '1' && parseInt(passwordDelay.trim()) === 0;
      
      return {
        enabled: passwordEnabled,
        requirePasswordImmediately
      };
    } catch (error) {
      console.error('Error checking password protection:', error);
      return { enabled: false, requirePasswordImmediately: false };
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
        description: 'Forces immediate password entry when waking from screen saver, preventing brief unauthorized access.',
        recommendation: 'Should be ENABLED for maximum security. Prevents someone from accessing your Mac if you step away briefly.',
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
}
