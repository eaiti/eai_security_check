import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

export enum Platform {
  MACOS = 'macos',
  LINUX = 'linux',
  UNSUPPORTED = 'unsupported'
}

export interface PlatformInfo {
  platform: Platform;
  version: string;
  distribution?: string; // For Linux distributions
  isSupported: boolean;
  isApproved?: boolean; // For tested/approved versions
  warningMessage?: string;
}

export class PlatformDetector {
  /**
   * Detect the current platform and return detailed information
   */
  static async detectPlatform(): Promise<PlatformInfo> {
    const platform = os.platform();
    
    if (platform === 'darwin') {
      return await this.detectMacOS();
    } else if (platform === 'linux') {
      return await this.detectLinux();
    } else {
      return {
        platform: Platform.UNSUPPORTED,
        version: 'unknown',
        isSupported: false,
        warningMessage: `❌ Platform ${platform} is not supported. This tool supports macOS and Linux only.`
      };
    }
  }

  /**
   * Detect macOS version information
   */
  private static async detectMacOS(): Promise<PlatformInfo> {
    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      const version = stdout.trim();
      
      // Check if version is supported (15.0+)
      const isSupported = this.compareVersions(version, '15.0') >= 0;
      const approvedVersions = ['15.5', '15.6'];
      const isApproved = approvedVersions.includes(version);
      
      let warningMessage: string | undefined;
      if (!isSupported) {
        warningMessage = `⚠️  macOS ${version} is below version 15.0. Security checks may not work correctly.`;
      } else if (!isApproved) {
        warningMessage = `⚠️  macOS ${version} has not been fully tested. Tested versions: ${approvedVersions.join(', ')}.`;
      }
      
      return {
        platform: Platform.MACOS,
        version,
        isSupported,
        isApproved,
        warningMessage
      };
    } catch (error) {
      return {
        platform: Platform.MACOS,
        version: 'unknown',
        isSupported: false,
        warningMessage: `❌ Unable to detect macOS version: ${error}`
      };
    }
  }

  /**
   * Detect Linux distribution and version
   */
  private static async detectLinux(): Promise<PlatformInfo> {
    try {
      // Try to detect distribution from /etc/os-release
      let distribution = 'unknown';
      let version = 'unknown';
      
      try {
        const { stdout } = await execAsync('cat /etc/os-release');
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('ID=')) {
            distribution = line.split('=')[1].replace(/"/g, '');
          } else if (line.startsWith('VERSION_ID=')) {
            version = line.split('=')[1].replace(/"/g, '');
          }
        }
      } catch (error) {
        // Fallback to lsb_release if available
        try {
          const { stdout: distStdout } = await execAsync('lsb_release -is');
          distribution = distStdout.trim().toLowerCase();
          const { stdout: versionStdout } = await execAsync('lsb_release -rs');
          version = versionStdout.trim();
        } catch (lsbError) {
          // Use uname as final fallback
          const { stdout: unameStdout } = await execAsync('uname -r');
          version = unameStdout.trim();
        }
      }
      
      // Check if this is a supported distribution
      const supportedDistributions = ['fedora', 'ubuntu', 'debian', 'centos', 'rhel'];
      const isSupported = supportedDistributions.includes(distribution.toLowerCase());
      
      let warningMessage: string | undefined;
      if (!isSupported) {
        warningMessage = `⚠️  Linux distribution '${distribution}' is not officially supported. Supported: ${supportedDistributions.join(', ')}. Security checks may not work correctly.`;
      } else if (distribution.toLowerCase() !== 'fedora') {
        warningMessage = `⚠️  Linux distribution '${distribution}' has limited testing. Primary support is for Fedora. Some checks may not work correctly.`;
      }
      
      return {
        platform: Platform.LINUX,
        version,
        distribution,
        isSupported,
        isApproved,
        warningMessage
      };
    } catch (error) {
      return {
        platform: Platform.LINUX,
        version: 'unknown',
        distribution: 'unknown',
        isSupported: false,
        warningMessage: `❌ Unable to detect Linux distribution: ${error}`
      };
    }
  }

  /**
   * Compare version strings (e.g., "15.6" vs "15.0")
   * Returns: -1 if version1 < version2, 0 if equal, 1 if version1 > version2
   */
  private static compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  /**
   * Check if the current platform is macOS
   */
  static async isMacOS(): Promise<boolean> {
    const info = await this.detectPlatform();
    return info.platform === Platform.MACOS;
  }

  /**
   * Check if the current platform is Linux
   */
  static async isLinux(): Promise<boolean> {
    const info = await this.detectPlatform();
    return info.platform === Platform.LINUX;
  }

  /**
   * Check if the current platform is supported
   */
  static async isSupported(): Promise<boolean> {
    const info = await this.detectPlatform();
    return info.isSupported;
  }
}