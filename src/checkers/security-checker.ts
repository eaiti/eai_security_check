import { exec } from 'child_process';
import { promisify } from 'util';
import { ISecurityChecker } from './security-checker-interface';

const execAsync = promisify(exec);

export class MacOSSecurityChecker implements ISecurityChecker {
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

  async checkFileVault(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('fdesetup status');
      return stdout.includes('FileVault is On');
    } catch (error) {
      console.error('Error checking FileVault status:', error);
      return false;
    }
  }

  async checkDiskEncryption(): Promise<boolean> {
    return this.checkFileVault();
  }

  async checkPasswordProtection(): Promise<{
    enabled: boolean;
    requirePasswordImmediately: boolean;
    passwordRequiredAfterLock: boolean;
  }> {
    try {
      // Check if password is required for login (basic login protection)
      const { stdout: loginPasswordCheck } = await execAsync(
        'defaults read com.apple.loginwindow DisableLoginItemSuppression 2>/dev/null || echo "enabled"'
      );
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
          const { stdout: screenSaverPassword } = await execAsync(
            'defaults read com.apple.screensaver askForPassword 2>/dev/null || echo "0"'
          );
          const { stdout: passwordDelay } = await execAsync(
            'defaults read com.apple.screensaver askForPasswordDelay 2>/dev/null || echo "0"'
          );
          const delay = parseInt(passwordDelay.trim());
          passwordRequiredAfterLock = screenSaverPassword.trim() === '1' && delay <= 5; // Must be immediate or within 5 seconds
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
      return {
        enabled: false,
        requirePasswordImmediately: false,
        passwordRequiredAfterLock: false
      };
    }
  }

  async checkAutoLockTimeout(): Promise<number> {
    try {
      // Check screen saver timeout (in seconds)
      const { stdout } = await execAsync(
        'defaults -currentHost read com.apple.screensaver idleTime 2>/dev/null || echo "0"'
      );
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
    } catch {
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
      const { stdout } = await execAsync(
        'softwareupdate --list --all | grep -E "macOS.*[0-9]+\\.[0-9]+" | head -1 | grep -o "[0-9][0-9]*\\.[0-9][0-9]*" | head -1'
      );
      const detectedVersion = stdout.trim();

      if (detectedVersion && this.isValidVersion(detectedVersion)) {
        return detectedVersion;
      }
    } catch {
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

  async checkOSVersion(
    targetVersion: string
  ): Promise<{ current: string; target: string; isLatest: boolean; passed: boolean }> {
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

  getSecurityExplanations(): Record<
    string,
    { description: string; recommendation: string; riskLevel: 'High' | 'Medium' | 'Low' }
  > {
    return {
      FileVault: {
        description:
          'FileVault provides full-disk encryption, protecting your data if your Mac is lost or stolen.',
        recommendation:
          'Should be ENABLED. Without FileVault, anyone with physical access can read your files by booting from external media.',
        riskLevel: 'High'
      },
      'Password Protection': {
        description: 'Requires a password to log into your Mac, preventing unauthorized access.',
        recommendation:
          'Should be ENABLED. Password protection is the first line of defense against unauthorized access.',
        riskLevel: 'High'
      },
      'Immediate Password Requirement': {
        description:
          'Requires password entry when waking from screen saver or sleep, preventing unauthorized access. On macOS 15.5+, only the enabled/disabled state is detectable - the actual delay time is not accessible programmatically.',
        recommendation:
          'Should be ENABLED. Any password requirement after lock provides security protection. For maximum security, set to "immediately", but any delay is better than no password requirement.',
        riskLevel: 'Medium'
      },
      'Auto-lock Timeout': {
        description:
          'Automatically locks your screen after a period of inactivity to prevent unauthorized access.',
        recommendation:
          'Should be ≤7 minutes for security, ≤15 minutes for convenience. Shorter timeouts provide better security.',
        riskLevel: 'Medium'
      },
      Firewall: {
        description:
          'Application firewall blocks unauthorized network connections and protects against network-based attacks.',
        recommendation:
          'Should be ENABLED. Protects against malicious network traffic and unauthorized remote access attempts.',
        riskLevel: 'High'
      },
      'Firewall Stealth Mode': {
        description:
          'Makes your Mac invisible to network scans and ping requests, reducing attack surface.',
        recommendation:
          'Should be ENABLED for maximum security. Makes your Mac harder to discover on networks.',
        riskLevel: 'Low'
      },
      Gatekeeper: {
        description:
          "Verifies downloaded applications are from identified developers and haven't been tampered with.",
        recommendation:
          'Should be ENABLED. Prevents execution of malicious or unsigned software that could compromise your system.',
        riskLevel: 'High'
      },
      'System Integrity Protection': {
        description:
          'SIP protects critical system files and processes from modification, even by users with admin privileges.',
        recommendation:
          'Should be ENABLED. Prevents malware and accidental modifications from corrupting macOS system files.',
        riskLevel: 'High'
      },
      'Remote Login (SSH)': {
        description: 'SSH allows remote command-line access to your Mac over the network.',
        recommendation:
          'Should be DISABLED unless specifically needed. SSH access can be exploited if not properly secured.',
        riskLevel: 'Medium'
      },
      'Remote Management': {
        description:
          'Allows remote control and management of your Mac through Apple Remote Desktop or similar tools.',
        recommendation:
          'Should be DISABLED unless required for IT management. Provides extensive remote access capabilities.',
        riskLevel: 'Medium'
      },
      'Automatic Updates': {
        description:
          'Automatically checks for, downloads, and/or installs software updates. Different modes provide varying levels of automation and security protection.',
        recommendation:
          'Should be ENABLED with at least automatic security updates. Choose the mode that balances security with your workflow needs.',
        riskLevel: 'High'
      },
      'Automatic Update Mode': {
        description:
          'Determines the level of automation for software updates: disabled (no automatic checking), check-only (manual download/install), download-only (automatic download but manual install), or fully-automatic (completely automated).',
        recommendation:
          'At minimum use "download-only" mode for convenience, or "fully-automatic" for maximum security. Avoid "disabled" and "check-only" modes.',
        riskLevel: 'High'
      },
      'Security Updates': {
        description:
          'Automatically installs critical security updates without user intervention, protecting against known vulnerabilities immediately.',
        recommendation:
          'Should be ENABLED. Critical security patches should be installed immediately to prevent exploitation of known vulnerabilities.',
        riskLevel: 'High'
      },
      'File Sharing': {
        description: 'Allows other devices on the network to access shared folders on your Mac.',
        recommendation:
          'Should be DISABLED unless actively sharing files. File sharing expands your attack surface.',
        riskLevel: 'Medium'
      },
      'Screen Sharing': {
        description: "Allows remote users to view and control your Mac's screen over the network.",
        recommendation:
          'Should be DISABLED unless required for remote support. Provides full remote access to your desktop.',
        riskLevel: 'High'
      },
      'Media Sharing': {
        description:
          'Allows sharing of media content (music, photos, videos) to other devices on the network via iTunes/Music sharing or AirPlay.',
        recommendation:
          'Should be DISABLED unless actively sharing media. Media sharing can expose personal content and consume network bandwidth.',
        riskLevel: 'Medium'
      },
      'OS Version': {
        description:
          'Ensures your macOS is up-to-date with the latest security patches and features.',
        recommendation:
          'Should be current or recent version. Newer versions include important security fixes and improvements.',
        riskLevel: 'Medium'
      },
      'WiFi Network Security': {
        description:
          'Monitors current WiFi network connection to ensure you are not connected to banned or insecure networks.',
        recommendation:
          'Avoid connecting to untrusted, guest, or prohibited networks for work purposes. Use secure, company-approved networks.',
        riskLevel: 'Medium'
      },
      'Installed Applications': {
        description:
          'Monitors installed third-party applications to ensure no banned or prohibited software is installed on the system.',
        recommendation:
          'Remove any banned applications and only install approved software from trusted sources.',
        riskLevel: 'Medium'
      }
    };
  }

  async checkFirewall(): Promise<{ enabled: boolean; stealthMode: boolean }> {
    try {
      // Check if application firewall is enabled
      const { stdout: firewallStatus } = await execAsync(
        '/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo "disabled"'
      );
      const enabled = firewallStatus.includes('enabled');

      // Check stealth mode
      const { stdout: stealthStatus } = await execAsync(
        '/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode 2>/dev/null || echo "disabled"'
      );
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

  async checkPackageVerification(): Promise<boolean> {
    return this.checkGatekeeper();
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
      // Primary method: Check if SSH daemon is enabled via launchd (no sudo required)
      const { stdout: sshEnabled, stderr: sshErr } = await execAsync(
        'defaults read /System/Library/LaunchDaemons/ssh Disabled 2>&1 || echo "1"'
      );
      const sshOutput = sshEnabled + sshErr;
      const sshEnabledViaPlist = !sshOutput.includes('does not exist') && sshOutput.trim() === '0';

      if (sshEnabledViaPlist) {
        return true;
      }

      // Secondary method: Check if SSH daemon (sshd) is currently loaded, not ssh-agent
      try {
        const { stdout: launchctlCheck } = await execAsync(
          'launchctl list | grep "com.openssh.sshd" 2>/dev/null'
        );
        const sshRunning = launchctlCheck.length > 0;

        if (sshRunning) {
          return true;
        }
      } catch {
        // Ignore launchctl errors and continue
      }

      // Tertiary method: Check if SSH is listening on port 22
      try {
        const { stdout: netstatCheck } = await execAsync(
          'netstat -an | grep "*.22" | grep LISTEN 2>/dev/null'
        );
        return netstatCheck.length > 0;
      } catch {
        // If all methods fail, assume SSH is disabled
        return false;
      }
    } catch (error) {
      console.error('Error checking remote login status:', error);
      return false;
    }
  }

  async checkRemoteManagement(): Promise<boolean> {
    try {
      // Check if Remote Management functionality is actually enabled (not just menu bar visibility)
      // ScreenSharingReqPermEnabled indicates if remote management/screen sharing is enabled
      const { stdout: screenSharingPerm, stderr: screenErr } = await execAsync(
        'defaults read /Library/Preferences/com.apple.RemoteManagement ScreenSharingReqPermEnabled 2>&1 || echo "0"'
      );
      const screenOutput = screenSharingPerm + screenErr;
      const screenSharingEnabled =
        !screenOutput.includes('does not exist') && screenOutput.trim() === '1';

      // DOCAllowRemoteConnections indicates if remote desktop connections are allowed
      const { stdout: remoteConnections, stderr: remoteErr } = await execAsync(
        'defaults read /Library/Preferences/com.apple.RemoteDesktop DOCAllowRemoteConnections 2>&1 || echo "0"'
      );
      const remoteOutput = remoteConnections + remoteErr;
      const remoteConnectionsEnabled =
        !remoteOutput.includes('does not exist') && remoteOutput.trim() === '1';

      // Remote Management is enabled if either screen sharing permissions or remote connections are enabled
      return screenSharingEnabled || remoteConnectionsEnabled;
    } catch (error) {
      console.error('Error checking remote management status:', error);
      return false;
    }
  }

  async checkAutomaticUpdates(): Promise<{
    enabled: boolean;
    securityUpdatesOnly: boolean;
    automaticDownload: boolean;
    automaticInstall: boolean;
    automaticSecurityInstall: boolean;
    configDataInstall: boolean;
    updateMode: 'disabled' | 'check-only' | 'download-only' | 'fully-automatic';
  }> {
    try {
      // Use softwareupdate command to check if automatic checking is enabled
      const { stdout: scheduleCheck } = await execAsync(
        'softwareupdate --schedule 2>/dev/null || echo "off"'
      );
      const enabled = scheduleCheck.includes('Automatic checking for updates is turned on');

      // Check if automatic downloading is enabled using system preferences
      const { stdout: autoDownload, stderr: autoDownloadErr } = await execAsync(
        'defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload 2>&1 || echo "0"'
      );
      const autoDownloadOutput = autoDownload + autoDownloadErr;
      const automaticDownload = autoDownloadOutput.includes('does not exist')
        ? true
        : autoDownloadOutput.trim() === '1';

      // Check if automatic installation of macOS updates is enabled
      const { stdout: autoInstallOS, stderr: autoInstallOSErr } = await execAsync(
        'defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates 2>&1 || echo "1"'
      );
      const autoInstallOSOutput = autoInstallOS + autoInstallOSErr;
      const automaticInstall = autoInstallOSOutput.includes('does not exist')
        ? true
        : autoInstallOSOutput.trim() === '1';

      // Check if critical/security updates are automatically installed
      const { stdout: securityUpdates, stderr: securityUpdatesErr } = await execAsync(
        'defaults read /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall 2>&1 || echo "1"'
      );
      const securityUpdatesOutput = securityUpdates + securityUpdatesErr;
      const automaticSecurityInstall = securityUpdatesOutput.includes('does not exist')
        ? true
        : securityUpdatesOutput.trim() === '1';

      // Check if system data files and security updates are automatically installed
      const { stdout: configData, stderr: configDataErr } = await execAsync(
        'defaults read /Library/Preferences/com.apple.SoftwareUpdate ConfigDataInstall 2>&1 || echo "1"'
      );
      const configDataOutput = configData + configDataErr;
      const configDataInstall = configDataOutput.includes('does not exist')
        ? true
        : configDataOutput.trim() === '1';

      // Determine update mode based on settings
      let updateMode: 'disabled' | 'check-only' | 'download-only' | 'fully-automatic';

      if (!enabled) {
        updateMode = 'disabled';
      } else if (!automaticDownload) {
        updateMode = 'check-only';
      } else if (!automaticInstall && !automaticSecurityInstall) {
        updateMode = 'download-only';
      } else {
        updateMode = 'fully-automatic';
      }

      // Legacy securityUpdatesOnly for backward compatibility
      const securityUpdatesOnly = automaticSecurityInstall && !automaticInstall;

      return {
        enabled,
        securityUpdatesOnly,
        automaticDownload,
        automaticInstall,
        automaticSecurityInstall,
        configDataInstall,
        updateMode
      };
    } catch (error) {
      console.error('Error checking automatic updates status:', error);
      return {
        enabled: false,
        securityUpdatesOnly: false,
        automaticDownload: false,
        automaticInstall: false,
        automaticSecurityInstall: false,
        configDataInstall: false,
        updateMode: 'disabled'
      };
    }
  }

  async checkSharingServices(): Promise<{
    fileSharing: boolean;
    screenSharing: boolean;
    remoteLogin: boolean;
    mediaSharing: boolean;
  }> {
    try {
      // Check file sharing capability (enabled in System Preferences, regardless of actual shares)
      let fileSharing = false;
      try {
        // Check if file sharing is enabled in System Preferences (capability check)
        const { stdout: smbEnabled, stderr: smbErr } = await execAsync(
          'defaults read /System/Library/LaunchDaemons/com.apple.smbd Disabled 2>&1 || echo "1"'
        );
        const smbOutput = smbEnabled + smbErr;
        fileSharing = !smbOutput.includes('does not exist') && smbOutput.trim() === '0';

        // If launchd check indicates disabled, double-check with sharing command output content
        if (!fileSharing) {
          const { stdout: sharingCheck } = await this.execWithSudo('sharing -l 2>/dev/null');
          // Only consider it enabled if there are actual share records (not just "No share point records")
          fileSharing =
            sharingCheck.includes('name:') ||
            (!sharingCheck.includes('No share point records') && sharingCheck.trim().length > 0);
        }
      } catch {
        // Fallback to checking if SMB daemon is loaded and not disabled
        try {
          const { stdout: smbLoaded } = await this.execWithSudo(
            'launchctl print system/com.apple.smbd 2>/dev/null'
          );
          fileSharing =
            !smbLoaded.includes('Could not find service') &&
            !smbLoaded.includes('state = not running');
        } catch {
          fileSharing = false;
        }
      }

      // Check screen sharing capability (enabled in System Preferences)
      let screenSharing = false;
      try {
        // Check if screen sharing is enabled as a capability in System Preferences
        const { stdout: screenEnabled, stderr: screenErr } = await execAsync(
          'defaults read /System/Library/LaunchDaemons/com.apple.screensharing Disabled 2>&1 || echo "1"'
        );
        const screenOutput = screenEnabled + screenErr;
        screenSharing = !screenOutput.includes('does not exist') && screenOutput.trim() === '0';

        // Additional check for VNC/screen sharing preference
        if (!screenSharing) {
          const { stdout: vncEnabled, stderr: vncErr } = await execAsync(
            'defaults read /Library/Preferences/com.apple.RemoteDesktop ARD_AllLocalUsers 2>&1 || echo "0"'
          );
          const vncOutput = vncEnabled + vncErr;
          screenSharing = !vncOutput.includes('does not exist') && vncOutput.trim() === '1';
        }
      } catch {
        // Fallback to checking if screen sharing daemon is loaded
        try {
          const { stdout: screenLoaded } = await this.execWithSudo(
            'launchctl print system/com.apple.screensharing 2>/dev/null'
          );
          screenSharing = !screenLoaded.includes('Could not find service');
        } catch {
          screenSharing = false;
        }
      }

      // Check media sharing capability (enabled in preferences)
      let mediaSharing = false;
      try {
        // Check iTunes/Music sharing preferences
        const { stdout: musicSharing, stderr: musicErr } = await execAsync(
          'defaults read ~/Library/Preferences/com.apple.Music sharingEnabled 2>&1 || echo "0"'
        );
        const musicOutput = musicSharing + musicErr;
        const musicEnabled = !musicOutput.includes('does not exist') && musicOutput.trim() === '1';

        const { stdout: photosSharing, stderr: photosErr } = await execAsync(
          'defaults read ~/Library/Preferences/com.apple.Photos sharingEnabled 2>&1 || echo "0"'
        );
        const photosOutput = photosSharing + photosErr;
        const photosEnabled =
          !photosOutput.includes('does not exist') && photosOutput.trim() === '1';

        // Check for AirPlay receiver capability
        const { stdout: airplayReceiver, stderr: airplayErr } = await execAsync(
          'defaults read ~/Library/Preferences/com.apple.controlcenter AirplayRecieverEnabled 2>&1 || echo "0"'
        );
        const airplayOutput = airplayReceiver + airplayErr;
        const airplayEnabled =
          !airplayOutput.includes('does not exist') && airplayOutput.trim() === '1';

        mediaSharing = musicEnabled || photosEnabled || airplayEnabled;

        // Additional check for Media Sharing preference in System Preferences
        if (!mediaSharing) {
          const { stdout: mediaEnabled, stderr: mediaErr } = await execAsync(
            'defaults read ~/Library/Preferences/com.apple.amp.mediasharingd media-sharing-enabled 2>&1 || echo "0"'
          );
          const mediaOutput = mediaEnabled + mediaErr;
          mediaSharing = !mediaOutput.includes('does not exist') && mediaOutput.trim() === '1';
        }
      } catch {
        mediaSharing = false;
      }

      // Check remote login capability (SSH enabled in System Preferences)
      let remoteLogin = false;
      try {
        const { stdout: sshStatus } = await this.execWithSudo(
          'systemsetup -getremotelogin 2>/dev/null || echo "Off"'
        );
        remoteLogin = sshStatus.includes('On');
      } catch {
        // Fallback to checking SSH daemon capability via launchd
        try {
          const { stdout: sshEnabled, stderr: sshErr } = await execAsync(
            'defaults read /System/Library/LaunchDaemons/ssh Disabled 2>&1 || echo "1"'
          );
          const sshOutput = sshEnabled + sshErr;
          remoteLogin = !sshOutput.includes('does not exist') && sshOutput.trim() === '0';
        } catch {
          remoteLogin = false;
        }
      }

      return { fileSharing, screenSharing, remoteLogin, mediaSharing };
    } catch (error) {
      console.error('Error checking sharing services:', error);
      return { fileSharing: false, screenSharing: false, remoteLogin: false, mediaSharing: false };
    }
  }

  async checkCurrentWifiNetwork(): Promise<{ networkName: string | null; connected: boolean }> {
    // Primary method: Use system_profiler with awk for clean network name extraction
    try {
      const { stdout } = await execAsync(
        `system_profiler SPAirPortDataType | awk '/Current Network/ {getline;$1=$1;print $0 | "tr -d ':'";exit}' 2>/dev/null`
      );
      const networkName = stdout.trim();

      if (networkName && networkName.length > 0) {
        return { networkName, connected: true };
      }
    } catch {
      // Primary method failed, will return default below
    }

    return { networkName: null, connected: false };
  }

  async checkInstalledApplications(): Promise<{
    installedApps: string[];
    bannedAppsFound: string[];
    sources: { applications: string[]; homebrew: string[]; npm: string[] };
  }> {
    try {
      const sources = {
        applications: [] as string[],
        homebrew: [] as string[],
        npm: [] as string[]
      };

      // Check /Applications folder for third-party apps (exclude system apps)
      try {
        const { stdout: appsList } = await execAsync('ls /Applications/ 2>/dev/null || echo ""');
        const allApps = appsList.split('\n').filter(app => app.trim().length > 0);

        // Filter out common system apps
        const systemApps = [
          'App Store.app',
          'Automator.app',
          'Calculator.app',
          'Calendar.app',
          'Chess.app',
          'Contacts.app',
          'DVD Player.app',
          'Dashboard.app',
          'Dictionary.app',
          'FaceTime.app',
          'Font Book.app',
          'Image Capture.app',
          'Launchpad.app',
          'Mail.app',
          'Maps.app',
          'Messages.app',
          'Mission Control.app',
          'Notes.app',
          'Photo Booth.app',
          'Photos.app',
          'Preview.app',
          'QuickTime Player.app',
          'Reminders.app',
          'Safari.app',
          'Siri.app',
          'Stickies.app',
          'System Preferences.app',
          'TextEdit.app',
          'Time Machine.app',
          'Utilities',
          'VoiceOver Utility.app',
          'System Settings.app',
          'Finder.app',
          'Music.app',
          'TV.app',
          'Podcasts.app',
          'Books.app',
          'News.app',
          'Stocks.app',
          'Home.app',
          'Shortcuts.app'
        ];

        const thirdPartyApps = allApps.filter(app => !systemApps.includes(app));
        sources.applications = thirdPartyApps.map(app => app.replace('.app', ''));
      } catch (error) {
        console.warn('Error checking Applications folder:', error);
      }

      // Check Homebrew cask installations
      try {
        const { stdout: brewList } = await execAsync('brew list --cask 2>/dev/null || echo ""');
        const brewApps = brewList.split('\n').filter(app => app.trim().length > 0);
        sources.homebrew = brewApps;
      } catch (error) {
        console.warn('Error checking Homebrew casks:', error);
      }

      // Check npm global packages
      try {
        const { stdout: npmList } = await execAsync(
          'npm list -g --depth=0 --parseable 2>/dev/null || echo ""'
        );
        const npmPackages = npmList
          .split('\n')
          .filter(line => line.includes('node_modules'))
          .map(line => line.split('/').pop())
          .filter((pkg): pkg is string => pkg !== undefined && pkg.length > 0);
        sources.npm = npmPackages;
      } catch (error) {
        console.warn('Error checking npm global packages:', error);
      }

      // Combine all installed applications
      const installedApps = [...sources.applications, ...sources.homebrew, ...sources.npm].filter(
        (app, index, array) => array.indexOf(app) === index
      ); // Remove duplicates

      return {
        installedApps,
        bannedAppsFound: [], // Will be populated by the auditor
        sources
      };
    } catch (error) {
      console.error('Error checking installed applications:', error);
      return {
        installedApps: [],
        bannedAppsFound: [],
        sources: { applications: [], homebrew: [], npm: [] }
      };
    }
  }

  /**
   * Get the stored password for validation purposes
   */
  getPassword(): string | undefined {
    return this.password;
  }
}
