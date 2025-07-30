import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility functions for version detection and management
 */
export class VersionUtils {
  
  /**
   * Get the current version from package.json
   */
  static getCurrentVersion(): string {
    try {
      // In pkg environment, try to read from embedded package.json
      const isPkg = typeof (process as any).pkg !== 'undefined';
      
      if (isPkg) {
        // For pkg binaries, we embed the version at build time
        // Try to read from snapshot filesystem first
        const pkgPackageJson = path.join(path.dirname(process.execPath), 'package.json');
        if (fs.existsSync(pkgPackageJson)) {
          const content = fs.readFileSync(pkgPackageJson, 'utf-8');
          const packageInfo = JSON.parse(content);
          return packageInfo.version;
        }
        
        // Try embedded package.json
        const embeddedPath = path.join(__dirname, '..', 'package.json');
        if (fs.existsSync(embeddedPath)) {
          const content = fs.readFileSync(embeddedPath, 'utf-8');
          const packageInfo = JSON.parse(content);
          return packageInfo.version;
        }
      } else {
        // Regular Node.js environment
        const packagePath = path.join(__dirname, '..', 'package.json');
        if (fs.existsSync(packagePath)) {
          const content = fs.readFileSync(packagePath, 'utf-8');
          const packageInfo = JSON.parse(content);
          return packageInfo.version;
        }
      }
      
      // Fallback if package.json can't be found
      return '1.0.0';
    } catch (error) {
      console.warn('Warning: Could not determine current version:', error);
      return '1.0.0';
    }
  }

  /**
   * Compare two version strings (semver style)
   * Returns: -1 if version1 < version2, 0 if equal, 1 if version1 > version2
   */
  static compareVersions(version1: string, version2: string): number {
    const parseVersion = (version: string) => {
      return version.split('.').map(part => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
      });
    };

    const v1Parts = parseVersion(version1);
    const v2Parts = parseVersion(version2);
    
    // Ensure both arrays have the same length
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    while (v1Parts.length < maxLength) v1Parts.push(0);
    while (v2Parts.length < maxLength) v2Parts.push(0);

    for (let i = 0; i < maxLength; i++) {
      if (v1Parts[i] < v2Parts[i]) return -1;
      if (v1Parts[i] > v2Parts[i]) return 1;
    }

    return 0;
  }

  /**
   * Check if there's another instance of the same executable with a newer version
   * This checks if there are other processes running the same executable name
   * but with a different (potentially newer) version.
   */
  static async checkForNewerVersion(): Promise<{ hasNewer: boolean; newerVersion?: string; processInfo?: string }> {
    try {
      const currentVersion = this.getCurrentVersion();
      
      // Get the current executable path to find similar executables
      const currentExecutable = process.argv[0];
      const executableName = path.basename(currentExecutable);
      
      // On Linux/macOS, use ps to find similar processes
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Look for processes that might be different versions of the same tool
      const psCommand = process.platform === 'darwin' ? 
        'ps aux | grep -E "eai-security-check|index" | grep -v grep' :
        'ps aux | grep -E "eai-security-check|index" | grep -v grep';
      
      const result = await execAsync(psCommand);
      const processes = result.stdout.split('\n').filter(line => line.trim());
      
      let hasNewer = false;
      let newerVersion: string | undefined;
      let processInfo: string | undefined;
      
      for (const processLine of processes) {
        // Skip our own process
        if (processLine.includes(process.pid.toString())) {
          continue;
        }
        
        // Look for version patterns in the process command line
        const versionMatch = processLine.match(/eai-security-check-(?:macos|linux)-v?(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          const foundVersion = versionMatch[1];
          if (this.compareVersions(foundVersion, currentVersion) > 0) {
            hasNewer = true;
            newerVersion = foundVersion;
            processInfo = processLine.trim();
            break;
          }
        }
      }
      
      return { hasNewer, newerVersion, processInfo };
    } catch (error) {
      console.warn('Warning: Could not check for newer versions:', error);
      return { hasNewer: false };
    }
  }

  /**
   * Create a lock file to prevent multiple daemon instances
   */
  static createDaemonLock(lockFilePath: string): boolean {
    try {
      if (fs.existsSync(lockFilePath)) {
        // Check if the process is still running
        const lockContent = fs.readFileSync(lockFilePath, 'utf-8');
        const lockInfo = JSON.parse(lockContent);
        
        // Simple check - try to send signal 0 to the process (doesn't actually send a signal)
        try {
          process.kill(lockInfo.pid, 0);
          // Process exists, lock is valid
          return false;
        } catch (error) {
          // Process doesn't exist, remove stale lock
          fs.unlinkSync(lockFilePath);
        }
      }
      
      // Create new lock file
      const lockInfo = {
        pid: process.pid,
        version: this.getCurrentVersion(),
        started: new Date().toISOString(),
        executable: process.argv[0]
      };
      
      fs.writeFileSync(lockFilePath, JSON.stringify(lockInfo, null, 2));
      return true;
    } catch (error) {
      console.warn('Warning: Could not create daemon lock:', error);
      return false;
    }
  }

  /**
   * Remove daemon lock file
   */
  static removeDaemonLock(lockFilePath: string): void {
    try {
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
      }
    } catch (error) {
      console.warn('Warning: Could not remove daemon lock:', error);
    }
  }

  /**
   * Check if current instance should yield to a newer version
   */
  static async shouldYieldToNewerVersion(): Promise<{ shouldYield: boolean; reason?: string }> {
    const versionCheck = await this.checkForNewerVersion();
    
    if (versionCheck.hasNewer) {
      return {
        shouldYield: true,
        reason: `Found newer version ${versionCheck.newerVersion} running. Current version: ${this.getCurrentVersion()}`
      };
    }
    
    return { shouldYield: false };
  }
}