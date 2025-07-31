import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import { PlatformDetector, Platform } from './platform-detector';
import { VersionUtils } from './version-utils';

const execAsync = promisify(exec);

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  body: string;
  published_at: string;
  assets: GitHubAsset[];
}

/**
 * Utility functions for checking and downloading updates from GitHub releases
 */
export class UpdateUtils {
  private static readonly GITHUB_API_URL =
    'https://api.github.com/repos/eaiti/eai_security_check/releases';
  private static readonly GITHUB_RELEASES_URL =
    'https://github.com/eaiti/eai_security_check/releases/download';

  /**
   * Get platform-specific executable name for downloads
   */
  private static getPlatformExecutableName(platform: Platform): string {
    switch (platform) {
      case Platform.MACOS:
        return 'eai-security-check-macos';
      case Platform.LINUX:
        return 'eai-security-check-linux';
      case Platform.WINDOWS:
        return 'eai-security-check-win.exe';
      default:
        throw new Error(`Unsupported platform for updates: ${platform}`);
    }
  }

  /**
   * Fetch latest release information from GitHub API
   */
  static async fetchLatestRelease(): Promise<{
    version: string;
    tagName: string;
    downloadUrl: string;
    releaseNotes: string;
    publishedAt: string;
  }> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: '/repos/eaiti/eai_security_check/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'eai-security-check-updater',
          Accept: 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(
                new Error(`GitHub API request failed: ${res.statusCode} ${res.statusMessage}`)
              );
              return;
            }

            const release: GitHubRelease = JSON.parse(data);
            const platform = PlatformDetector.getSimplePlatform();
            const executableName = this.getPlatformExecutableName(platform);

            // Find the asset for current platform
            const asset = release.assets.find(asset => asset.name === executableName);

            if (!asset) {
              reject(
                new Error(
                  `No release asset found for platform: ${platform} (looking for ${executableName})`
                )
              );
              return;
            }

            resolve({
              version: release.tag_name.replace(/^v/, ''), // Remove 'v' prefix if present
              tagName: release.tag_name,
              downloadUrl: asset.browser_download_url,
              releaseNotes: release.body || 'No release notes available',
              publishedAt: release.published_at
            });
          } catch (error) {
            reject(new Error(`Failed to parse GitHub API response: ${error}`));
          }
        });
      });

      req.on('error', error => {
        reject(new Error(`GitHub API request failed: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('GitHub API request timed out'));
      });

      req.end();
    });
  }

  /**
   * Check if an update is available
   */
  static async checkForUpdates(): Promise<{
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseInfo?: {
      tagName: string;
      downloadUrl: string;
      releaseNotes: string;
      publishedAt: string;
    };
  }> {
    try {
      const currentVersion = VersionUtils.getCurrentVersion();
      const latestRelease = await this.fetchLatestRelease();

      const comparison = VersionUtils.compareVersions(latestRelease.version, currentVersion);
      const updateAvailable = comparison > 0;

      return {
        updateAvailable,
        currentVersion,
        latestVersion: latestRelease.version,
        releaseInfo: updateAvailable
          ? {
              tagName: latestRelease.tagName,
              downloadUrl: latestRelease.downloadUrl,
              releaseNotes: latestRelease.releaseNotes,
              publishedAt: latestRelease.publishedAt
            }
          : undefined
      };
    } catch (error) {
      console.warn('Warning: Could not check for updates:', error);
      return {
        updateAvailable: false,
        currentVersion: VersionUtils.getCurrentVersion(),
        latestVersion: 'unknown'
      };
    }
  }

  /**
   * Download a file from URL to a local path
   */
  private static async downloadFile(url: string, destinationPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destinationPath);

      const request = https.get(url, response => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          if (response.headers.location) {
            this.downloadFile(response.headers.location, destinationPath)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', error => {
          fs.unlink(destinationPath, () => {}); // Delete partial file
          reject(error);
        });
      });

      request.on('error', error => {
        fs.unlink(destinationPath, () => {}); // Delete partial file
        reject(error);
      });

      request.setTimeout(120000, () => {
        request.destroy();
        fs.unlink(destinationPath, () => {}); // Delete partial file
        reject(new Error('Download timed out'));
      });
    });
  }

  /**
   * Update the current executable with a new version
   */
  static async updateExecutable(
    downloadUrl: string,
    version: string
  ): Promise<{
    success: boolean;
    error?: string;
    backupPath?: string;
    newExecutablePath: string;
  }> {
    try {
      const currentExecutablePath = process.execPath;
      const executableDir = path.dirname(currentExecutablePath);
      const executableName = path.basename(currentExecutablePath);

      // Create temporary download path
      const tempDownloadPath = path.join(executableDir, `${executableName}.download.tmp`);

      // Create backup path
      const backupPath = path.join(executableDir, `${executableName}.backup.${Date.now()}`);

      console.log('📥 Downloading new version...');
      await this.downloadFile(downloadUrl, tempDownloadPath);

      // Make the downloaded file executable (Unix systems)
      if (process.platform !== 'win32') {
        await execAsync(`chmod +x "${tempDownloadPath}"`);
      }

      console.log('💾 Creating backup of current executable...');
      fs.copyFileSync(currentExecutablePath, backupPath);

      console.log('🔄 Replacing current executable...');
      fs.renameSync(tempDownloadPath, currentExecutablePath);

      // Verify the new executable works
      try {
        const testResult = await execAsync(`"${currentExecutablePath}" --version`, {
          timeout: 10000
        });
        if (!testResult.stdout.includes(version)) {
          throw new Error('Version verification failed');
        }
      } catch (error) {
        // Restore from backup if verification fails
        console.log('❌ New executable verification failed, restoring backup...');
        fs.copyFileSync(backupPath, currentExecutablePath);
        throw new Error(`New executable verification failed: ${error}`);
      }

      console.log('✅ Executable updated successfully!');

      return {
        success: true,
        backupPath,
        newExecutablePath: currentExecutablePath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        newExecutablePath: process.execPath
      };
    }
  }

  /**
   * Update global installation after executable update
   */
  static async updateGlobalInstallation(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🌍 Updating global installation...');

      // Import ConfigManager dynamically to avoid circular dependencies
      const { ConfigManager } = await import('../config/config-manager');

      // Check if global installation exists
      const systemStatus = await ConfigManager.getSystemStatus();
      if (systemStatus.globalInstall.exists) {
        // Update the global installation to point to the new executable
        await ConfigManager.setupGlobalInstallation();
        console.log('✅ Global installation updated!');
        return { success: true };
      } else {
        console.log('ℹ️  No global installation found, skipping global update.');
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Update daemon service after executable update
   */
  static async updateDaemonService(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🤖 Updating daemon service...');

      // Import ConfigManager dynamically to avoid circular dependencies
      const { ConfigManager } = await import('../config/config-manager');

      // Check if daemon is configured
      const systemStatus = await ConfigManager.getSystemStatus();
      if (systemStatus.config.schedulingConfigExists) {
        // Stop daemon
        console.log('🛑 Stopping daemon service...');
        await ConfigManager.manageDaemon('stop');

        // Restart daemon with new executable
        console.log('🚀 Starting daemon service with new executable...');
        await ConfigManager.manageDaemon('start');

        console.log('✅ Daemon service updated and restarted!');
        return { success: true };
      } else {
        console.log('ℹ️  No daemon configuration found, skipping daemon update.');
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Perform a complete update process
   */
  static async performUpdate(): Promise<{
    success: boolean;
    error?: string;
    updateInfo?: {
      oldVersion: string;
      newVersion: string;
      backupPath?: string;
    };
  }> {
    try {
      console.log('🔍 Checking for updates...');

      const updateCheck = await this.checkForUpdates();

      if (!updateCheck.updateAvailable) {
        return {
          success: false,
          error: 'No updates available. You are running the latest version.'
        };
      }

      if (!updateCheck.releaseInfo) {
        return {
          success: false,
          error: 'Unable to fetch release information.'
        };
      }

      const oldVersion = updateCheck.currentVersion;
      const newVersion = updateCheck.latestVersion;

      console.log(`🚀 Updating from version ${oldVersion} to ${newVersion}...`);
      console.log('');

      // Update executable
      const executableUpdate = await this.updateExecutable(
        updateCheck.releaseInfo.downloadUrl,
        newVersion
      );

      if (!executableUpdate.success) {
        return {
          success: false,
          error: `Failed to update executable: ${executableUpdate.error}`
        };
      }

      // Update global installation if it exists
      const globalUpdate = await this.updateGlobalInstallation();
      if (!globalUpdate.success) {
        console.warn(`⚠️  Warning: Failed to update global installation: ${globalUpdate.error}`);
      }

      // Update daemon service if it exists
      const daemonUpdate = await this.updateDaemonService();
      if (!daemonUpdate.success) {
        console.warn(`⚠️  Warning: Failed to update daemon service: ${daemonUpdate.error}`);
      }

      // Update version tracking
      const { ConfigManager } = await import('../config/config-manager');
      ConfigManager.updateTrackedVersion();

      console.log('');
      console.log('🎉 Update completed successfully!');
      console.log(`✅ Updated from version ${oldVersion} to ${newVersion}`);

      if (executableUpdate.backupPath) {
        console.log(`💾 Backup created at: ${executableUpdate.backupPath}`);
        console.log('💡 You can remove the backup file if the update works correctly.');
      }

      return {
        success: true,
        updateInfo: {
          oldVersion,
          newVersion,
          backupPath: executableUpdate.backupPath
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
