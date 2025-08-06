import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { SecurityConfig, SchedulingConfig } from "../types";
import { getConfigByProfile } from "./config-profiles";
import { Platform, PlatformDetector } from "../utils/platform-detector";

// Define pkg property interface for process
interface ProcessWithPkg extends NodeJS.Process {
  pkg?: {
    entrypoint?: string;
    mount?: Record<string, string>;
  };
}

// Type assertion for the process object
declare const process: ProcessWithPkg;

/**
 * ConfigManager handles configuration directory setup and management
 */
export class ConfigManager {
  private static readonly APP_NAME = "eai-security-check";

  /**
   * Get the path to the current executable (handles both Node.js and pkg)
   */
  static getActualExecutablePath(): string {
    // In pkg environment, process.execPath points to the pkg executable
    if (process.pkg) {
      const executablePath = process.execPath;

      try {
        // Check if it's a symlink and resolve it
        const stats = fs.lstatSync(executablePath);
        if (stats && stats.isSymbolicLink()) {
          let resolvedPath = fs.readlinkSync(executablePath);
          // If it's a relative symlink, resolve it relative to the symlink directory
          if (!path.isAbsolute(resolvedPath)) {
            resolvedPath = path.resolve(
              path.dirname(executablePath),
              resolvedPath,
            );
          }
          return resolvedPath;
        }
      } catch (error) {
        // If we can't resolve symlink, fall back to original path
        console.warn("Warning: Could not resolve symlink:", error);
      }

      return executablePath;
    } else {
      // In Node.js environment, we need to determine the actual CLI script path
      // This is more complex because process.execPath points to node, not our script

      // In test environments, process.execPath is often mocked to point to our executable
      // Check if process.execPath looks like our executable (not the node binary)
      const execPath = process.execPath;
      if (
        execPath &&
        !execPath.includes("/node") &&
        !execPath.includes("\\node.exe")
      ) {
        return execPath;
      }

      // Try to get the main module filename (our CLI script)
      if (require.main && require.main.filename) {
        return require.main.filename;
      }

      // Fallback: use process.argv[1] which should be the script path
      if (process.argv[1]) {
        return path.resolve(process.argv[1]);
      }

      // Last resort fallback - assume we're in the built CLI
      return path.resolve(__dirname, "..", "cli", "index.js");
    }
  }

  /**
   * Get the directory where the actual executable is located
   */
  static getExecutableDirectory(): string {
    return path.dirname(this.getActualExecutablePath());
  }

  /**
   * Get the centralized configuration directory (executable-relative)
   * All application data is stored alongside the executable
   */
  static getCentralizedConfigDirectory(): string {
    return path.join(this.getExecutableDirectory(), "config");
  }

  /**
   * Get the centralized reports directory (executable-relative)
   */
  static getCentralizedReportsDirectory(): string {
    return path.join(this.getExecutableDirectory(), "reports");
  }

  /**
   * Get the centralized logs directory (executable-relative)
   */
  static getCentralizedLogsDirectory(): string {
    return path.join(this.getExecutableDirectory(), "logs");
  }

  /**
   * Create the centralized configuration and reports directories if they don't exist
   */
  static ensureCentralizedDirectories(): {
    configDir: string;
    reportsDir: string;
    logsDir: string;
  } {
    const configDir = this.getCentralizedConfigDirectory();
    const reportsDir = this.getCentralizedReportsDirectory();
    const logsDir = this.getCentralizedLogsDirectory();

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    return { configDir, reportsDir, logsDir };
  }

  /**
   * Install the application globally with symlinks
   */
  static async installGlobally(): Promise<{
    success: boolean;
    message: string;
    executablePath?: string;
    symlinkPath?: string;
  }> {
    const platform = os.platform();
    const executablePath = this.getActualExecutablePath();
    const executableName = path.basename(executablePath);

    // Determine the global installation paths
    let targetDir: string;
    let symlinkPath: string;

    if (platform === "win32") {
      // Windows doesn't use symlinks, we'll copy to a standard location
      targetDir = "C:\\Program Files\\eai-security-check";
      symlinkPath = path.join(targetDir, executableName);
    } else {
      // Unix-like systems
      targetDir = "/usr/local/lib/eai-security-check";
      symlinkPath = "/usr/local/bin/eai-security-check";
    }

    try {
      const execAsync = promisify(exec);

      // Check if we have necessary permissions
      if (platform !== "win32") {
        // Check if we're already running as root
        const isRoot = process.getuid && process.getuid() === 0;

        if (!isRoot) {
          try {
            await execAsync("sudo -n true");
          } catch {
            return {
              success: false,
              message:
                "This operation requires sudo privileges. Please run with elevated permissions or run: sudo eai-security-check install",
            };
          }
        }
      }

      // Create target directory
      if (!fs.existsSync(targetDir)) {
        if (platform === "win32") {
          fs.mkdirSync(targetDir, { recursive: true });
        } else {
          await execAsync(`sudo mkdir -p "${targetDir}"`);
        }
      }

      let targetPath = path.join(targetDir, executableName);

      // Copy the executable to the target location
      if (platform === "win32") {
        if (process.pkg) {
          // pkg executable: just copy the single file
          fs.copyFileSync(executablePath, targetPath);
        } else {
          // Node.js mode: copy the entire dist directory structure
          const distDir = path.resolve(__dirname, "..");
          const projectRoot = path.resolve(distDir, "..");

          // Copy the entire dist directory
          await this.copyDirectory(distDir, path.join(targetDir, "dist"));

          // Copy package.json for dependencies
          const packageJsonPath = path.join(projectRoot, "package.json");
          if (fs.existsSync(packageJsonPath)) {
            fs.copyFileSync(
              packageJsonPath,
              path.join(targetDir, "package.json"),
            );
          }

          // Copy node_modules if it exists (needed for dependencies)
          const nodeModulesPath = path.join(projectRoot, "node_modules");
          if (fs.existsSync(nodeModulesPath)) {
            await this.copyDirectory(
              nodeModulesPath,
              path.join(targetDir, "node_modules"),
            );
          }

          // Update targetPath to point to the CLI within the copied structure
          targetPath = path.join(targetDir, "dist", "cli", "index.js");
        }

        // Also copy any data directories if they exist
        const execDir = this.getExecutableDirectory();
        const configDir = path.join(execDir, "config");
        const reportsDir = path.join(execDir, "reports");
        const logsDir = path.join(execDir, "logs");

        if (fs.existsSync(configDir)) {
          await this.copyDirectory(configDir, path.join(targetDir, "config"));
        }
        if (fs.existsSync(reportsDir)) {
          await this.copyDirectory(reportsDir, path.join(targetDir, "reports"));
        }
        if (fs.existsSync(logsDir)) {
          await this.copyDirectory(logsDir, path.join(targetDir, "logs"));
        }
      } else {
        if (process.pkg) {
          // pkg executable: copy the single file
          await execAsync(`sudo cp "${executablePath}" "${targetPath}"`);
          await execAsync(`sudo chmod +x "${targetPath}"`);
        } else {
          // Node.js mode: copy the entire application structure
          const distDir = path.resolve(__dirname, "..");
          const projectRoot = path.resolve(distDir, "..");

          // Copy the entire dist directory
          await execAsync(`sudo cp -r "${distDir}" "${targetDir}/"`);

          // Copy package.json for dependencies
          const packageJsonPath = path.join(projectRoot, "package.json");
          if (fs.existsSync(packageJsonPath)) {
            await execAsync(`sudo cp "${packageJsonPath}" "${targetDir}/"`);
          }

          // Copy node_modules if it exists (needed for dependencies)
          const nodeModulesPath = path.join(projectRoot, "node_modules");
          if (fs.existsSync(nodeModulesPath)) {
            await execAsync(`sudo cp -r "${nodeModulesPath}" "${targetDir}/"`);
          }

          // Update targetPath to point to the CLI within the copied structure
          targetPath = path.join(targetDir, "dist", "cli", "index.js");
          await execAsync(`sudo chmod +x "${targetPath}"`);
        }

        // Copy data directories if they exist
        const execDir = this.getExecutableDirectory();
        const configDir = path.join(execDir, "config");
        const reportsDir = path.join(execDir, "reports");
        const logsDir = path.join(execDir, "logs");

        if (fs.existsSync(configDir)) {
          await execAsync(`sudo cp -r "${configDir}" "${targetDir}/"`);
        }
        if (fs.existsSync(reportsDir)) {
          await execAsync(`sudo cp -r "${reportsDir}" "${targetDir}/"`);
        }
        if (fs.existsSync(logsDir)) {
          await execAsync(`sudo cp -r "${logsDir}" "${targetDir}/"`);
        }

        // Create symlink in /usr/local/bin
        if (fs.existsSync(symlinkPath)) {
          await execAsync(`sudo rm "${symlinkPath}"`);
        }
        await execAsync(`sudo ln -s "${targetPath}" "${symlinkPath}"`);
      }

      return {
        success: true,
        message:
          platform === "win32"
            ? `Successfully installed to ${targetPath}`
            : `Successfully installed with symlink: ${symlinkPath} → ${targetPath}`,
        executablePath: targetPath,
        symlinkPath: platform === "win32" ? undefined : symlinkPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error}`,
      };
    }
  }

  /**
   * Uninstall the application globally
   */
  static async uninstallGlobally(cleanupData: boolean = false): Promise<{
    success: boolean;
    message: string;
  }> {
    const platform = os.platform();
    const execAsync = promisify(exec);

    let targetDir: string;
    let symlinkPath: string;

    if (platform === "win32") {
      targetDir = "C:\\Program Files\\eai-security-check";
      symlinkPath = path.join(targetDir, "eai-security-check.exe");
    } else {
      targetDir = "/usr/local/lib/eai-security-check";
      symlinkPath = "/usr/local/bin/eai-security-check";
    }

    try {
      // Check permissions
      if (platform !== "win32") {
        // Check if we're already running as root
        const isRoot = process.getuid && process.getuid() === 0;

        if (!isRoot) {
          try {
            await execAsync("sudo -n true");
          } catch {
            return {
              success: false,
              message:
                "This operation requires sudo privileges. Please run with elevated permissions.",
            };
          }
        }
      }

      const removedItems: string[] = [];

      // Remove symlink (Unix only)
      if (platform !== "win32" && fs.existsSync(symlinkPath)) {
        await execAsync(`sudo rm "${symlinkPath}"`);
        removedItems.push(`symlink: ${symlinkPath}`);
      }

      // Remove installation directory
      if (fs.existsSync(targetDir)) {
        if (cleanupData) {
          // Remove everything
          if (platform === "win32") {
            fs.rmSync(targetDir, { recursive: true, force: true });
          } else {
            await execAsync(`sudo rm -rf "${targetDir}"`);
          }
          removedItems.push(
            `installation directory and all data: ${targetDir}`,
          );
        } else {
          // Only remove the executable, keep data
          const executableFiles = fs
            .readdirSync(targetDir)
            .filter((f) => !["config", "reports", "logs"].includes(f));

          for (const file of executableFiles) {
            const filePath = path.join(targetDir, file);
            if (platform === "win32") {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              // Check if it's a directory or file and use appropriate command
              const isDirectory =
                fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
              const rmCommand = isDirectory ? "sudo rm -rf" : "sudo rm -f";
              await execAsync(`${rmCommand} "${filePath}"`);
            }
          }
          removedItems.push(`executable files from: ${targetDir}`);
          removedItems.push(`(kept configuration, reports, and logs)`);
        }
      }

      return {
        success: true,
        message: `Successfully uninstalled: ${removedItems.join(", ")}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Uninstallation failed: ${error}`,
      };
    }
  }

  /**
   * Helper method to copy directory recursively
   */
  private static async copyDirectory(src: string, dest: string): Promise<void> {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(src);

    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);

      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Update the application by downloading the latest version
   */
  static async updateApplication(): Promise<{
    success: boolean;
    message: string;
    oldVersion?: string;
    newVersion?: string;
  }> {
    const platform = os.platform();
    const execAsync = promisify(exec);

    try {
      const currentVersion = this.getCurrentVersion();

      // Determine the download URL based on platform
      let downloadUrl: string;
      let executableName: string;

      const baseUrl =
        "https://github.com/eaiti/eai_security_check/releases/latest/download";

      switch (platform) {
        case "darwin":
          downloadUrl = `${baseUrl}/eai-security-check-macos`;
          executableName = "eai-security-check-macos";
          break;
        case "linux":
          downloadUrl = `${baseUrl}/eai-security-check-linux`;
          executableName = "eai-security-check-linux";
          break;
        case "win32":
          downloadUrl = `${baseUrl}/eai-security-check-win.exe`;
          executableName = "eai-security-check-win.exe";
          break;
        default:
          return {
            success: false,
            message: `Unsupported platform: ${platform}`,
          };
      }

      // Create temporary directory
      const tempDir = path.join(os.tmpdir(), "eai-security-check-update");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempExecutable = path.join(tempDir, executableName);

      // Download the new executable
      const downloadCommand =
        platform === "win32"
          ? `powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${tempExecutable}'"`
          : `curl -L -o "${tempExecutable}" "${downloadUrl}"`;

      await execAsync(downloadCommand);

      if (!fs.existsSync(tempExecutable)) {
        return {
          success: false,
          message: "Failed to download the new executable",
        };
      }

      // Make executable (Unix only)
      if (platform !== "win32") {
        await execAsync(`chmod +x "${tempExecutable}"`);
      }

      // Determine where to install the update
      const currentPath = this.getActualExecutablePath();
      const isGlobalInstall =
        currentPath.includes("/usr/local/") ||
        currentPath.includes("Program Files");

      if (isGlobalInstall) {
        // Update global installation
        if (platform !== "win32") {
          try {
            await execAsync("sudo -n true");
          } catch {
            return {
              success: false,
              message:
                "Global update requires sudo privileges. Please run with elevated permissions.",
            };
          }
          await execAsync(`sudo cp "${tempExecutable}" "${currentPath}"`);
        } else {
          fs.copyFileSync(tempExecutable, currentPath);
        }
      } else {
        // Update local installation
        fs.copyFileSync(tempExecutable, currentPath);
      }

      // Clean up temp file
      fs.rmSync(tempExecutable, { force: true });
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Update version tracking
      this.updateTrackedVersion();

      return {
        success: true,
        message: `Successfully updated from ${currentVersion} to latest version`,
        oldVersion: currentVersion,
        newVersion: "latest",
      };
    } catch (error) {
      return {
        success: false,
        message: `Update failed: ${error}`,
      };
    }
  }
  static testCentralizedStructure(): {
    executablePath: string;
    resolvedPath: string;
    executableDir: string;
    configDir: string;
    reportsDir: string;
    logsDir: string;
    isSymlink: boolean;
  } {
    const executablePath = process.execPath;
    const resolvedPath = this.getActualExecutablePath();
    const isSymlink = executablePath !== resolvedPath;

    return {
      executablePath,
      resolvedPath,
      executableDir: this.getExecutableDirectory(),
      configDir: this.getCentralizedConfigDirectory(),
      reportsDir: this.getCentralizedReportsDirectory(),
      logsDir: this.getCentralizedLogsDirectory(),
      isSymlink,
    };
  }

  /**
   * Get the path to the centralized security configuration file
   */
  static getCentralizedSecurityConfigPath(): string {
    return path.join(
      this.getCentralizedConfigDirectory(),
      "security-config.json",
    );
  }

  /**
   * Get the path to the centralized scheduling configuration file
   */
  static getCentralizedSchedulingConfigPath(): string {
    return path.join(
      this.getCentralizedConfigDirectory(),
      "scheduling-config.json",
    );
  }

  /**
   * Get the path to the default security configuration file (centralized)
   */
  static getSecurityConfigPath(): string {
    const { configDir } = this.ensureCentralizedDirectories();
    return path.join(configDir, "security-config.json");
  }

  /**
   * Get the path to the scheduling configuration file (centralized)
   */
  static getSchedulingConfigPath(): string {
    const { configDir } = this.ensureCentralizedDirectories();
    return path.join(configDir, "scheduling-config.json");
  }

  /**
   * Get the path to the daemon state file (centralized)
   */
  static getDaemonStatePath(): string {
    const { configDir } = this.ensureCentralizedDirectories();
    return path.join(configDir, "daemon-state.json");
  }

  /**
   * Get the path to the version tracking file (centralized)
   */
  static getVersionFilePath(): string {
    const { configDir } = this.ensureCentralizedDirectories();
    return path.join(configDir, "version.json");
  }

  /**
   * Get current application version
   */
  static getCurrentVersion(): string {
    try {
      // Try to read from package.json in different locations
      const possiblePaths = [
        path.join(__dirname, "..", "..", "package.json"),
        path.join(process.cwd(), "package.json"),
      ];

      for (const pkgPath of possiblePaths) {
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          if (pkg.version) {
            return pkg.version;
          }
        }
      }

      // Fallback to command line version if available
      return "1.0.0"; // Hard-coded fallback
    } catch {
      return "1.0.0"; // Hard-coded fallback
    }
  }

  /**
   * Get the last tracked version from config
   */
  static getLastTrackedVersion(): string | null {
    const versionFile = this.getVersionFilePath();
    if (!fs.existsSync(versionFile)) {
      return null;
    }

    try {
      const versionData = JSON.parse(fs.readFileSync(versionFile, "utf-8"));
      return versionData.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Update the tracked version
   */
  static updateTrackedVersion(): void {
    this.ensureCentralizedDirectories();
    const currentVersion = this.getCurrentVersion();
    const versionFile = this.getVersionFilePath();

    const versionData = {
      version: currentVersion,
      lastUpdated: new Date().toISOString(),
      executable: process.execPath,
    };

    fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
  }

  /**
   * Check if this is a version upgrade
   */
  static isVersionUpgrade(): boolean {
    const currentVersion = this.getCurrentVersion();
    const lastVersion = this.getLastTrackedVersion();

    if (!lastVersion) {
      return false; // First time setup
    }

    return currentVersion !== lastVersion;
  }

  /**
   * Check if global installation exists and is different version
   */
  static async checkGlobalInstallVersion(): Promise<{
    exists: boolean;
    isDifferentVersion: boolean;
    globalVersion: string | null;
    currentVersion: string;
  }> {
    const currentVersion = this.getCurrentVersion();
    const execAsync = promisify(exec);

    try {
      // Check if global installation exists
      const globalPath = "/usr/local/bin/eai-security-check";
      if (!fs.existsSync(globalPath)) {
        return {
          exists: false,
          isDifferentVersion: false,
          globalVersion: null,
          currentVersion,
        };
      }

      // Try to get version from global installation
      const { stdout } = await execAsync("eai-security-check --version");
      const globalVersion = stdout.trim();

      return {
        exists: true,
        isDifferentVersion: globalVersion !== currentVersion,
        globalVersion,
        currentVersion,
      };
    } catch {
      return {
        exists: true, // File exists but can't get version
        isDifferentVersion: true, // Assume different to be safe
        globalVersion: null,
        currentVersion,
      };
    }
  }

  /**
   * Check if daemon is running and needs version update
   */
  static async checkDaemonVersion(): Promise<{
    isRunning: boolean;
    needsUpdate: boolean;
    daemonVersion: string | null;
    currentVersion: string;
  }> {
    const currentVersion = this.getCurrentVersion();

    try {
      // Check if daemon state file exists
      const stateFile = this.getDaemonStatePath();
      if (!fs.existsSync(stateFile)) {
        return {
          isRunning: false,
          needsUpdate: false,
          daemonVersion: null,
          currentVersion,
        };
      }

      const stateData = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      const daemonVersion = stateData.currentVersion || null;
      const isRunning =
        stateData.lastHeartbeat &&
        Date.now() - new Date(stateData.lastHeartbeat).getTime() < 300000; // 5 minutes

      return {
        isRunning,
        needsUpdate: daemonVersion !== currentVersion,
        daemonVersion,
        currentVersion,
      };
    } catch {
      return {
        isRunning: false,
        needsUpdate: false,
        daemonVersion: null,
        currentVersion,
      };
    }
  }

  /**
   * Remove all configuration files
   */
  static resetAllConfigurations(): void {
    const { configDir } = this.ensureCentralizedDirectories();

    if (fs.existsSync(configDir)) {
      // Remove all files in config directory
      const files = fs.readdirSync(configDir);
      for (const file of files) {
        const filePath = path.join(configDir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Remove subdirectories (like daemon-templates)
          fs.rmSync(filePath, { recursive: true });
        } else {
          // Remove files
          fs.unlinkSync(filePath);
        }
      }

      console.log("✅ All configuration files removed");
    }
  }

  /**
   * Create a default security configuration file
   */
  static createSecurityConfig(profile: string = "default"): void {
    this.ensureCentralizedDirectories();
    const configPath = this.getSecurityConfigPath();

    if (fs.existsSync(configPath)) {
      throw new Error(`Security configuration already exists: ${configPath}`);
    }

    const config = getConfigByProfile(profile);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Create all security profile configuration files
   */
  static createAllSecurityConfigs(
    force: boolean = false,
    defaultProfile: string = "default",
  ): void {
    const { configDir } = this.ensureCentralizedDirectories();
    const profiles = ["default", "strict", "relaxed", "developer", "eai"];
    const createdProfiles: string[] = [];
    const skippedProfiles: string[] = [];

    // Create main security config (using specified default profile)
    const mainConfigPath = this.getSecurityConfigPath();
    if (!fs.existsSync(mainConfigPath) || force) {
      const defaultConfig = getConfigByProfile(defaultProfile);
      fs.writeFileSync(mainConfigPath, JSON.stringify(defaultConfig, null, 2));
      createdProfiles.push(`default (${defaultProfile} profile)`);
    } else {
      skippedProfiles.push(`default (${defaultProfile} profile)`);
    }

    // Create profile-specific config files
    for (const profile of profiles) {
      if (profile === "default") continue; // Already handled above

      const profileConfigPath = path.join(configDir, `${profile}-config.json`);
      if (!fs.existsSync(profileConfigPath) || force) {
        const config = getConfigByProfile(profile);
        fs.writeFileSync(profileConfigPath, JSON.stringify(config, null, 2));
        createdProfiles.push(profile);
      } else {
        skippedProfiles.push(profile);
      }
    }

    if (createdProfiles.length > 0) {
      console.log(`✅ Created security configs: ${createdProfiles.join(", ")}`);
    }
    if (skippedProfiles.length > 0) {
      console.log(
        `⚠️  Skipped existing configs: ${skippedProfiles.join(", ")}`,
      );
    }
  }

  /**
   * Copy daemon service template files to user's config directory
   */
  static copyDaemonServiceTemplates(): {
    templatesCopied: string[];
    instructions: string[];
    platform: string;
  } {
    const platform = PlatformDetector.getSimplePlatform();
    const { configDir } = this.ensureCentralizedDirectories();
    const templatesCopied: string[] = [];
    const instructions: string[] = [];

    // Ensure daemon-templates subdirectory exists
    const templatesDir = path.join(configDir, "daemon-templates");
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    try {
      // Find daemon-examples directory - check multiple possible locations
      let daemonExamplesDir: string | null = null;

      // For development/npm environments
      const devPath = path.join(__dirname, "..", "..", "daemon-examples");
      if (fs.existsSync(devPath)) {
        daemonExamplesDir = devPath;
      } else {
        // For pkg environments - check relative to executable
        const pkgPath = path.join(
          path.dirname(process.execPath),
          "daemon-examples",
        );
        if (fs.existsSync(pkgPath)) {
          daemonExamplesDir = pkgPath;
        } else {
          // For npm global installs
          const globalPath = path.join(
            __dirname,
            "..",
            "..",
            "..",
            "daemon-examples",
          );
          if (fs.existsSync(globalPath)) {
            daemonExamplesDir = globalPath;
          }
        }
      }

      if (!daemonExamplesDir) {
        console.log(
          "⚠️  Daemon template files not found - providing manual instructions only",
        );
        return this.getManualDaemonInstructions(platform);
      }

      // Copy platform-specific templates
      switch (platform) {
        case Platform.LINUX:
          this.copyLinuxTemplates(
            daemonExamplesDir,
            templatesDir,
            templatesCopied,
            instructions,
          );
          break;
        case Platform.MACOS:
          this.copyMacOSTemplates(
            daemonExamplesDir,
            templatesDir,
            templatesCopied,
            instructions,
          );
          break;
        case Platform.WINDOWS:
          this.copyWindowsTemplates(
            daemonExamplesDir,
            templatesDir,
            templatesCopied,
            instructions,
          );
          break;
        default:
          console.log("⚠️  Platform not supported for automated daemon setup");
          return {
            templatesCopied: [],
            instructions: ["Platform not supported"],
            platform: "Unknown",
          };
      }

      // Copy common files
      const commonFiles = ["README.md", "schedule-config-example.json"];
      for (const file of commonFiles) {
        const srcPath = path.join(daemonExamplesDir, file);
        const destPath = path.join(templatesDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          templatesCopied.push(file);
        }
      }
    } catch (error) {
      console.log(`⚠️  Error copying daemon templates: ${error}`);
      return this.getManualDaemonInstructions(platform);
    }

    return { templatesCopied, instructions, platform };
  }

  private static copyLinuxTemplates(
    srcDir: string,
    destDir: string,
    templatesCopied: string[],
    instructions: string[],
  ): void {
    const serviceFile = "eai-security-check.service";
    const srcPath = path.join(srcDir, serviceFile);
    const destPath = path.join(destDir, serviceFile);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      templatesCopied.push(serviceFile);

      instructions.push(
        "🐧 Linux systemd Service Setup (copy/paste these commands):",
      );
      instructions.push("");
      instructions.push(
        "# Create systemd user directory and copy service file",
      );
      instructions.push("mkdir -p ~/.config/systemd/user");
      instructions.push(`cp "${destPath}" ~/.config/systemd/user/`);
      instructions.push("");
      instructions.push("# Reload systemd and enable the service");
      instructions.push("systemctl --user daemon-reload");
      instructions.push("systemctl --user enable eai-security-check.service");
      instructions.push("systemctl --user start eai-security-check.service");
      instructions.push("");
      instructions.push("# Enable auto-start on boot (optional)");
      instructions.push("sudo loginctl enable-linger $USER");
      instructions.push("");
      instructions.push("# Check service status");
      instructions.push("systemctl --user status eai-security-check.service");
    }
  }

  private static copyMacOSTemplates(
    srcDir: string,
    destDir: string,
    templatesCopied: string[],
    instructions: string[],
  ): void {
    const plistFile = "com.eai.security-check.plist";
    const srcPath = path.join(srcDir, plistFile);
    const destPath = path.join(destDir, plistFile);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      templatesCopied.push(plistFile);

      instructions.push(
        "🍎 macOS launchd Service Setup (copy/paste these commands):",
      );
      instructions.push("");
      instructions.push("# Create LaunchAgents directory and copy plist file");
      instructions.push("mkdir -p ~/Library/LaunchAgents");
      instructions.push(`cp "${destPath}" ~/Library/LaunchAgents/`);
      instructions.push("");
      instructions.push("# Load and start the service");
      instructions.push(
        "launchctl load ~/Library/LaunchAgents/com.eai.security-check.plist",
      );
      instructions.push("launchctl start com.eai.security-check");
      instructions.push("");
      instructions.push("# Verify service is running");
      instructions.push("launchctl list | grep com.eai.security-check");
      instructions.push("");
      instructions.push(
        "✅ Service will auto-start on login (no additional setup needed)",
      );
    }
  }

  private static copyWindowsTemplates(
    srcDir: string,
    destDir: string,
    templatesCopied: string[],
    instructions: string[],
  ): void {
    const scriptFile = "windows-task-scheduler.ps1";
    const srcPath = path.join(srcDir, scriptFile);
    const destPath = path.join(destDir, scriptFile);

    if (fs.existsSync(srcPath)) {
      // Read the template and customize it with the actual executable path
      let scriptContent = fs.readFileSync(srcPath, "utf-8");

      // Try to determine the executable path
      let exePath = process.execPath;
      if (
        typeof (process as unknown as { pkg?: unknown }).pkg !== "undefined"
      ) {
        // Running as pkg executable
        exePath = process.execPath;
      } else {
        // Running with Node.js - provide example path
        exePath = "C:\\path\\to\\eai-security-check.exe";
        scriptContent = scriptContent.replace(
          /\$ExePath = "C:\\path\\to\\eai-security-check\.exe"/,
          `# Update this path to your actual executable location\n$ExePath = "${exePath}"`,
        );
      }

      fs.writeFileSync(destPath, scriptContent);
      templatesCopied.push(scriptFile);

      instructions.push(
        "🪟 Windows Task Scheduler Setup (copy/paste these commands):",
      );
      instructions.push("");
      instructions.push(
        "# 1. Edit the PowerShell script to update the executable path",
      );
      instructions.push(`notepad "${destPath}"`);
      instructions.push("");
      instructions.push(
        "# 2. Run PowerShell as Administrator and execute the script",
      );
      instructions.push("# Open PowerShell as Administrator, then run:");
      instructions.push(`& "${destPath}"`);
      instructions.push("");
      instructions.push("# 3. Verify the task was created");
      instructions.push(
        'Get-ScheduledTask -TaskName "EAI Security Check Daemon"',
      );
      instructions.push("");
      instructions.push("# 4. Manually test the task (optional)");
      instructions.push(
        'Start-ScheduledTask -TaskName "EAI Security Check Daemon"',
      );
    }
  }

  private static getManualDaemonInstructions(platform: Platform): {
    templatesCopied: string[];
    instructions: string[];
    platform: string;
  } {
    const instructions: string[] = [];

    switch (platform) {
      case Platform.LINUX:
        instructions.push("🐧 Linux Manual Setup (copy/paste these commands):");
        instructions.push("");
        instructions.push("# Create systemd user service directory");
        instructions.push("mkdir -p ~/.config/systemd/user");
        instructions.push("");
        instructions.push(
          "# Create service file (copy this content to ~/.config/systemd/user/eai-security-check.service)",
        );
        instructions.push(
          "cat > ~/.config/systemd/user/eai-security-check.service << EOF",
        );
        instructions.push("[Unit]");
        instructions.push("Description=EAI Security Check Daemon");
        instructions.push("After=network.target");
        instructions.push("");
        instructions.push("[Service]");
        instructions.push("Type=simple");
        instructions.push("ExecStart=/usr/local/bin/eai-security-check daemon");
        instructions.push("Restart=always");
        instructions.push("RestartSec=10");
        instructions.push("");
        instructions.push("[Install]");
        instructions.push("WantedBy=default.target");
        instructions.push("EOF");
        instructions.push("");
        instructions.push("# Enable and start the service");
        instructions.push("systemctl --user daemon-reload");
        instructions.push("systemctl --user enable eai-security-check.service");
        instructions.push("systemctl --user start eai-security-check.service");
        break;
      case Platform.MACOS:
        instructions.push("🍎 macOS Manual Setup (copy/paste these commands):");
        instructions.push("");
        instructions.push("# Create LaunchAgents directory");
        instructions.push("mkdir -p ~/Library/LaunchAgents");
        instructions.push("");
        instructions.push(
          "# Create plist file (copy this content to ~/Library/LaunchAgents/com.eai.security-check.plist)",
        );
        instructions.push(
          "cat > ~/Library/LaunchAgents/com.eai.security-check.plist << EOF",
        );
        instructions.push('<?xml version="1.0" encoding="UTF-8"?>');
        instructions.push(
          '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        );
        instructions.push('<plist version="1.0">');
        instructions.push("<dict>");
        instructions.push("    <key>Label</key>");
        instructions.push("    <string>com.eai.security-check</string>");
        instructions.push("    <key>ProgramArguments</key>");
        instructions.push("    <array>");
        instructions.push(
          "        <string>/usr/local/bin/eai-security-check</string>",
        );
        instructions.push("        <string>daemon</string>");
        instructions.push("    </array>");
        instructions.push("    <key>RunAtLoad</key>");
        instructions.push("    <true/>");
        instructions.push("    <key>KeepAlive</key>");
        instructions.push("    <true/>");
        instructions.push("</dict>");
        instructions.push("</plist>");
        instructions.push("EOF");
        instructions.push("");
        instructions.push("# Load and start the service");
        instructions.push(
          "launchctl load ~/Library/LaunchAgents/com.eai.security-check.plist",
        );
        instructions.push("launchctl start com.eai.security-check");
        break;
      case Platform.WINDOWS:
        instructions.push("🪟 Windows Manual Setup:");
        instructions.push("1. Use Task Scheduler to create a startup task");
        instructions.push("2. Set program: path\\to\\eai-security-check.exe");
        instructions.push("3. Set arguments: daemon");
        instructions.push("4. Configure to run at startup");
        break;
      default:
        instructions.push("Platform not supported for daemon setup");
    }

    return {
      templatesCopied: [],
      instructions,
      platform: platform || "Unknown",
    };
  }

  /**
   * Check if security configuration exists
   */
  static hasSecurityConfig(): boolean {
    return fs.existsSync(this.getSecurityConfigPath());
  }

  /**
   * Check if scheduling configuration exists
   */
  static hasSchedulingConfig(): boolean {
    return fs.existsSync(this.getSchedulingConfigPath());
  }

  /**
   * Load security configuration
   */
  static loadSecurityConfig(): SecurityConfig | null {
    const configPath = this.getSecurityConfigPath();

    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load security configuration: ${error}`);
    }
  }

  /**
   * Load scheduling configuration
   */
  static loadSchedulingConfig(): SchedulingConfig | null {
    const configPath = this.getSchedulingConfigPath();

    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load scheduling configuration: ${error}`);
    }
  }

  /**
   * Get configuration status summary
   */
  static getConfigStatus(): {
    configDirectory: string;
    reportsDirectory: string;
    securityConfigExists: boolean;
    schedulingConfigExists: boolean;
    securityConfigPath: string;
    schedulingConfigPath: string;
  } {
    const { configDir, reportsDir } = this.ensureCentralizedDirectories();
    return {
      configDirectory: configDir,
      reportsDirectory: reportsDir,
      securityConfigExists: this.hasSecurityConfig(),
      schedulingConfigExists: this.hasSchedulingConfig(),
      securityConfigPath: this.getSecurityConfigPath(),
      schedulingConfigPath: this.getSchedulingConfigPath(),
    };
  }

  /**
   * Get comprehensive system status including global install, config, and daemon status
   */
  static async getSystemStatus(): Promise<{
    globalInstall: {
      exists: boolean;
      globalVersion?: string | null;
      isDifferentVersion?: boolean;
    };
    config: {
      configDirectory: string;
      reportsDirectory: string;
      securityConfigExists: boolean;
      securityConfigPath: string;
      schedulingConfigExists: boolean;
      schedulingConfigPath: string;
    };
    daemon: {
      isRunning: boolean;
      daemonVersion?: string | null;
      needsUpdate?: boolean;
    };
  }> {
    const fs = await import("fs");

    // Check global installation
    const globalPath = "/usr/local/bin/eai-security-check";
    const globalExists = fs.existsSync(globalPath);
    let globalVersion: string | null = null;
    let isDifferentVersion = false;

    if (globalExists) {
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);
        const { stdout } = await execAsync(`${globalPath} --version`);
        globalVersion = stdout.trim();

        const currentVersion = this.getCurrentVersion();
        isDifferentVersion = globalVersion !== currentVersion;
      } catch {
        // Global version check failed, but global exists
        globalVersion = null;
        isDifferentVersion = true;
      }
    }

    // Get config status
    const configStatus = this.getConfigStatus();

    // Check daemon status
    let daemonRunning = false;
    let daemonVersion: string | null = null;
    let daemonNeedsUpdate = false;

    try {
      const daemonStatePath = this.getDaemonStatePath();
      if (fs.existsSync(daemonStatePath)) {
        const stateContent = fs.readFileSync(daemonStatePath, "utf8");
        const state = JSON.parse(stateContent);
        daemonRunning = state.isRunning || false;
        daemonVersion = state.version || null;

        if (daemonVersion) {
          const currentVersion = this.getCurrentVersion();
          daemonNeedsUpdate = daemonVersion !== currentVersion;
        }
      }
    } catch {
      // Daemon state check failed, assume not running
      daemonRunning = false;
    }

    return {
      globalInstall: {
        exists: globalExists,
        globalVersion,
        isDifferentVersion,
      },
      config: {
        configDirectory: configStatus.configDirectory,
        reportsDirectory: configStatus.reportsDirectory,
        securityConfigExists: configStatus.securityConfigExists,
        securityConfigPath: configStatus.securityConfigPath,
        schedulingConfigExists: configStatus.schedulingConfigExists,
        schedulingConfigPath: configStatus.schedulingConfigPath,
      },
      daemon: {
        isRunning: daemonRunning,
        daemonVersion,
        needsUpdate: daemonNeedsUpdate,
      },
    };
  }

  /**
   * Manage daemon operations
   */
  static async manageDaemon(
    action: "start" | "stop" | "restart" | "status" | "remove",
  ): Promise<void> {
    const { SchedulingService } = await import(
      "../services/scheduling-service"
    );
    const configPath = this.getSchedulingConfigPath();
    const statePath = this.getDaemonStatePath();

    if (
      !fs.existsSync(configPath) &&
      action !== "status" &&
      action !== "remove"
    ) {
      throw new Error("Daemon configuration not found. Run setup first.");
    }

    switch (action) {
      case "start": {
        console.log("🚀 Starting daemon...");
        const schedulingService = new SchedulingService(configPath, statePath);
        await schedulingService.startDaemon();
        console.log("✅ Daemon started successfully");
        break;
      }
      case "stop": {
        console.log("🛑 Stopping daemon...");
        const result = await SchedulingService.stopDaemon();
        if (result.success) {
          console.log("✅ Daemon stopped successfully");
        } else {
          throw new Error(`Failed to stop daemon: ${result.message}`);
        }
        break;
      }
      case "restart": {
        console.log("🔄 Restarting daemon...");
        const result = await SchedulingService.restartDaemon(
          configPath,
          statePath,
        );
        if (result.success) {
          console.log("✅ Daemon restarted successfully");
        } else {
          throw new Error(`Failed to restart daemon: ${result.message}`);
        }
        break;
      }
      case "status": {
        if (fs.existsSync(configPath)) {
          const schedulingService = new SchedulingService(
            configPath,
            statePath,
          );
          const status = schedulingService.getDaemonStatus();
          console.log("🤖 Daemon Status:");
          console.log(`   Running: ${status.running ? "✅ Yes" : "❌ No"}`);
          if (status.running) {
            console.log(
              `   Version: ${status.state.currentVersion || "Unknown"}`,
            );
            console.log(
              `   Last Check: ${new Date(status.state.lastReportSent || 0).toLocaleString() || "Never"}`,
            );
            console.log(
              `   Reports Sent: ${status.state.totalReportsGenerated}`,
            );
          }
        } else {
          console.log("🤖 Daemon Status:");
          console.log("   Running: ❌ No");
          console.log("   Configuration: ❌ Not found");
        }
        break;
      }
      case "remove": {
        console.log("🗑️  Removing daemon configuration...");
        const result = await SchedulingService.uninstallDaemon({
          configPath,
          stateFilePath: statePath,
          force: true,
        });
        if (result.success) {
          console.log("✅ Daemon configuration removed successfully");
          if (result.removedFiles.length > 0) {
            console.log("📁 Removed files:");
            result.removedFiles.forEach((file) => console.log(`   - ${file}`));
          }
        } else {
          throw new Error(`Failed to remove daemon: ${result.message}`);
        }
        break;
      }
    }
  }

  /**
   * Setup global installation (with confirmation)
   */
  static async setupGlobalInstallation(): Promise<void> {
    const platform = os.platform();
    const executablePath = process.execPath;
    const executableFile = path.basename(executablePath);

    const execAsync = promisify(exec);

    // First, create the centralized directory structure alongside the executable
    console.log("📁 Setting up centralized directory structure...");
    try {
      const directories = this.ensureCentralizedDirectories();
      console.log(`✅ Created config directory: ${directories.configDir}`);
      console.log(`✅ Created reports directory: ${directories.reportsDir}`);
      console.log(`✅ Created logs directory: ${directories.logsDir}`);

      // Create all default security configuration profiles
      console.log("📝 Creating default security configuration profiles...");
      this.createAllSecurityConfigs(false, "default");
      console.log("✅ Created all security configuration profiles");
    } catch (error) {
      console.log(
        `⚠️  Warning: Could not create centralized directories: ${error}`,
      );
    }

    switch (platform) {
      case "win32":
        await this.setupWindowsGlobalInstall(
          executablePath,
          executableFile,
          execAsync,
        );
        break;
      case "darwin":
      case "linux":
        await this.setupUnixGlobalInstall(
          executablePath,
          executableFile,
          execAsync,
        );
        break;
      default:
        throw new Error(
          `Global installation not supported on platform: ${platform}`,
        );
    }
  }

  /**
   * Setup global installation on Windows
   */
  private static async setupWindowsGlobalInstall(
    executablePath: string,
    executableFile: string,
    execAsync: typeof exec.__promisify__,
  ): Promise<void> {
    // Strategy 1: Try to add to PATH via environment variables
    try {
      const binDir = path.dirname(executablePath);

      // Check if already in PATH
      const currentPath = process.env.PATH || "";
      if (currentPath.includes(binDir)) {
        console.log("✅ Executable directory already in PATH");
        return;
      }

      // Try to add to user PATH (doesn't require admin)
      console.log("💡 Adding to user PATH environment variable...");

      await execAsync(
        `powershell -Command "[Environment]::SetEnvironmentVariable('PATH', [Environment]::GetEnvironmentVariable('PATH', 'User') + ';${binDir}', 'User')"`,
      );

      console.log(
        "✅ Added to user PATH - restart terminal or log out/in for changes to take effect",
      );
      console.log(`📁 Executable location: ${executablePath}`);
    } catch (pathError) {
      // Strategy 2: Create a batch file wrapper in a common location
      try {
        console.log("💡 Creating batch file wrapper...");

        const userProfile = process.env.USERPROFILE;
        if (!userProfile) {
          throw new Error("USERPROFILE environment variable not found");
        }
        const binDir = path.join(
          userProfile,
          "AppData",
          "Local",
          "Microsoft",
          "WindowsApps",
        );

        if (fs.existsSync(binDir)) {
          const batchFile = path.join(binDir, "eai-security-check.bat");
          const batchContent = `@echo off\n"${executablePath}" %*`;

          fs.writeFileSync(batchFile, batchContent);
          console.log("✅ Created batch file wrapper");
          console.log(`📁 Wrapper location: ${batchFile}`);
        } else {
          throw new Error("Windows Apps directory not found");
        }
      } catch (batchError) {
        throw new Error(
          `Failed to setup global installation: ${pathError}. Batch file creation also failed: ${batchError}`,
        );
      }
    }
  }

  /**
   * Setup global installation on Unix-like systems (macOS/Linux)
   */
  private static async setupUnixGlobalInstall(
    executablePath: string,
    executableFile: string,

    execAsync: typeof exec.__promisify__,
    password: string = "", // Password for sudo, if needed
  ): Promise<void> {
    const targetDir = "/usr/local/bin";
    const targetPath = path.join(targetDir, "eai-security-check");

    // Check if target directory exists and is writable
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Target directory ${targetDir} does not exist`);
    }

    // Check if symlink already exists
    if (fs.existsSync(targetPath)) {
      try {
        const stats = fs.lstatSync(targetPath);
        if (stats.isSymbolicLink()) {
          const linkTarget = fs.readlinkSync(targetPath);
          if (linkTarget === executablePath) {
            console.log(
              "✅ Symbolic link already exists and points to current executable",
            );
            return;
          } else {
            console.log(
              "⚠️  Existing symbolic link points to different executable, removing...",
            );

            await execAsync(`echo "${password}" | sudo -S rm "${targetPath}"`);
          }
        } else {
          throw new Error(
            `File ${targetPath} exists but is not a symbolic link`,
          );
        }
      } catch (statError) {
        throw new Error(`Error checking existing installation: ${statError}`);
      }
    }

    // Create symbolic link
    try {
      console.log(
        "💡 Creating symbolic link (requires administrator privileges)...",
      );

      // Create symlink using sudo with password
      await execAsync(
        `echo "${password}" | sudo -S ln -s "${executablePath}" "${targetPath}"`,
      );

      // Verify the link was created
      if (fs.existsSync(targetPath)) {
        const linkTarget = fs.readlinkSync(targetPath);
        if (linkTarget === executablePath) {
          console.log("✅ Symbolic link created successfully");
          console.log(`🔗 ${targetPath} -> ${executablePath}`);
        } else {
          throw new Error("Symbolic link verification failed");
        }
      } else {
        throw new Error("Symbolic link was not created");
      }
    } catch (symlinkError) {
      // Fallback: try creating without sudo (if user has write access)
      try {
        console.log("💡 Attempting to create link without sudo...");
        fs.symlinkSync(executablePath, targetPath);
        console.log("✅ Symbolic link created successfully");
        console.log(`🔗 ${targetPath} -> ${executablePath}`);
      } catch (fallbackError) {
        throw new Error(
          `Failed to create symbolic link with sudo: ${symlinkError}. Fallback also failed: ${fallbackError}`,
        );
      }
    }
  }
}
