import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { ConfigManager } from "../config/config-manager";
import { SchedulingService } from "../services/scheduling-service";

export interface DaemonSetupOptions {
  autoSetup?: boolean;
  force?: boolean;
}

export interface DaemonManagementOptions {
  action: "start" | "stop" | "restart" | "status" | "remove";
  configPath?: string;
  statePath?: string;
  securityConfigPath?: string;
}

/**
 * Core daemon operations shared between CLI and interactive modes
 */
export class DaemonOperations {
  /**
   * Check if a compatible global installation exists
   */
  static async checkGlobalInstallationCompatibility(): Promise<{
    exists: boolean;
    version?: string;
    compatible: boolean;
    message: string;
  }> {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const currentVersion = ConfigManager.getCurrentVersion();

    try {
      // Check if global eai-security-check exists and get its version
      const { stdout } = await execAsync(
        "eai-security-check --version 2>/dev/null",
      );
      const globalVersion = stdout.trim();

      if (globalVersion === currentVersion) {
        return {
          exists: true,
          version: globalVersion,
          compatible: true,
          message: `Global installation exists with matching version ${globalVersion}`,
        };
      } else {
        return {
          exists: true,
          version: globalVersion,
          compatible: false,
          message: `Global installation exists but version mismatch (global: ${globalVersion}, current: ${currentVersion})`,
        };
      }
    } catch {
      return {
        exists: false,
        compatible: false,
        message:
          "No global installation found. The daemon requires a global installation to work properly.",
      };
    }
  }

  /**
   * Setup macOS LaunchAgent for daemon automation
   */
  static async setupMacOSLaunchAgent(): Promise<void> {
    const execAsync = promisify(exec);

    // Use the global executable path since that's what the daemon service should use
    const globalExecutable = "eai-security-check"; // This will resolve to the global installation

    // Create LaunchAgents directory
    const launchAgentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
    const plistPath = path.join(
      launchAgentsDir,
      "com.eai.security-check.daemon.plist",
    );

    if (!fs.existsSync(launchAgentsDir)) {
      fs.mkdirSync(launchAgentsDir, { recursive: true });
      console.log("✅ Created LaunchAgents directory");
    }

    // Stop existing service if running
    try {
      const { stdout } = await execAsync(
        "launchctl list | grep com.eai.security-check.daemon",
      );
      if (stdout.trim()) {
        console.log("🛑 Stopping existing daemon service...");
        await execAsync("launchctl stop com.eai.security-check.daemon").catch(
          () => {},
        );
        await execAsync(`launchctl unload "${plistPath}"`).catch(() => {});
      }
    } catch {
      // No existing service, that's fine
    }

    // Create plist content
    const logPaths = this.getLogPaths();
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.eai.security-check.daemon</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/${globalExecutable}</string>
        <string>daemon</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/usr/local/bin</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${logPaths.output}</string>

    <key>StandardErrorPath</key>
    <string>${logPaths.error}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>

    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>`;

    // Write plist file
    fs.writeFileSync(plistPath, plistContent);
    console.log(`✅ Created plist file: ${plistPath}`);

    // Load the service
    console.log("🔄 Loading LaunchAgent...");
    await execAsync(`launchctl load "${plistPath}"`);
    console.log("✅ LaunchAgent loaded successfully!");

    // Start the service
    console.log("🚀 Starting daemon service...");
    try {
      await execAsync("launchctl start com.eai.security-check.daemon");
      console.log("✅ Daemon service started!");
    } catch {
      console.log("⚠️  Service loaded but may have failed to start");
      console.log(
        "💡 Check status with: launchctl list com.eai.security-check.daemon",
      );
    }

    console.log("");
    console.log("🎉 Setup complete! The daemon will:");
    console.log("   ✅ Start automatically when you log in");
    console.log("   ✅ Restart automatically if it crashes");
    console.log("   ✅ Run security checks according to your schedule");
  }

  /**
   * Get the correct log file paths - centralized alongside executable
   */
  static getLogPaths() {
    // Get the directory where the actual executable is located (resolve symlinks)
    let executablePath = process.execPath;

    try {
      // Resolve symlinks to get the actual executable path
      const stats = fs.lstatSync(executablePath);
      if (stats && stats.isSymbolicLink()) {
        executablePath = fs.readlinkSync(executablePath);
        // If it's a relative symlink, resolve it relative to the symlink directory
        if (!path.isAbsolute(executablePath)) {
          executablePath = path.resolve(
            path.dirname(process.execPath),
            executablePath,
          );
        }
      }
    } catch (_error) {
      // If we can't resolve the symlink, use the original path
      console.warn(
        "Warning: Could not resolve symlink for executable path:",
        _error,
      );
    }

    const executableDir = path.dirname(executablePath);
    const logsDir = path.join(executableDir, "logs");

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    return {
      output: path.join(logsDir, "eai-security-check.log"),
      error: path.join(logsDir, "eai-security-check.error.log"),
      logsDir,
    };
  }

  /**
   * Attempt automatic service setup where possible
   */
  static async attemptAutoServiceSetup(serviceSetup: {
    templatesCopied: string[];
    instructions: string[];
    platform: string;
  }): Promise<void> {
    const { configDir } = ConfigManager.ensureCentralizedDirectories();
    const templatesDir = path.join(configDir, "daemon-templates");

    try {
      switch (serviceSetup.platform) {
        case "Linux":
          await this.attemptLinuxServiceSetup(templatesDir);
          break;
        case "macOS":
          await this.attemptMacOSServiceSetup(templatesDir);
          break;
        default:
          console.log("⚠️  Automatic setup not supported for this platform");
      }
    } catch (error) {
      console.error(`❌ Automatic setup failed: ${error}`);
      console.log("💡 Please follow the manual setup instructions above");
    }
  }

  /**
   * Attempt Linux systemd service setup
   */
  static async attemptLinuxServiceSetup(templatesDir: string): Promise<void> {
    const execAsync = promisify(exec);

    const serviceFile = path.join(templatesDir, "eai-security-check.service");
    const userSystemdDir = path.join(
      os.homedir(),
      ".config",
      "systemd",
      "user",
    );
    const destServiceFile = path.join(
      userSystemdDir,
      "eai-security-check.service",
    );

    try {
      // Create systemd user directory if it doesn't exist
      if (!fs.existsSync(userSystemdDir)) {
        fs.mkdirSync(userSystemdDir, { recursive: true });
        console.log("✅ Created systemd user directory");
      }

      // Copy service file
      if (fs.existsSync(serviceFile)) {
        fs.copyFileSync(serviceFile, destServiceFile);
        console.log("✅ Copied service file to systemd directory");

        // Reload systemd
        await execAsync("systemctl --user daemon-reload");
        console.log("✅ Systemd daemon reloaded");

        // Enable service
        await execAsync("systemctl --user enable eai-security-check.service");
        console.log("✅ Service enabled for auto-start");

        console.log("\n🎉 Linux systemd service setup completed successfully!");
        console.log(
          "💡 To start now: systemctl --user start eai-security-check.service",
        );
        console.log(
          "💡 To enable login-less start: sudo loginctl enable-linger $USER",
        );
      } else {
        throw new Error("Service template file not found");
      }
    } catch (error) {
      throw new Error(`Linux service setup failed: ${error}`);
    }
  }

  /**
   * Attempt macOS LaunchAgent setup
   */
  static async attemptMacOSServiceSetup(templatesDir: string): Promise<void> {
    const plistFile = path.join(templatesDir, "com.eai.security-check.plist");
    const launchAgentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
    const destPlistFile = path.join(
      launchAgentsDir,
      "com.eai.security-check.plist",
    );

    try {
      // Create LaunchAgents directory if it doesn't exist
      if (!fs.existsSync(launchAgentsDir)) {
        fs.mkdirSync(launchAgentsDir, { recursive: true });
        console.log("✅ Created LaunchAgents directory");
      }

      // Copy plist file
      if (fs.existsSync(plistFile)) {
        fs.copyFileSync(plistFile, destPlistFile);
        console.log("✅ Copied plist file to LaunchAgents directory");

        console.log("\n🎉 macOS LaunchAgent setup completed successfully!");
        console.log(
          "💡 To load now: launchctl load ~/Library/LaunchAgents/com.eai.security-check.plist",
        );
        console.log("💡 Service will auto-start on next login");
      } else {
        throw new Error("plist template file not found");
      }
    } catch (_error) {
      throw new Error(`macOS service setup failed: ${_error}`);
    }
  }

  /**
   * Get daemon status information
   */
  static getDaemonStatus(): {
    running: boolean;
    configExists: boolean;
    lastReport?: string;
    totalReports?: number;
  } {
    if (!ConfigManager.hasSchedulingConfig()) {
      return {
        running: false,
        configExists: false,
      };
    }

    // Use SchedulingService to get detailed status
    try {
      const configPath = ConfigManager.getSchedulingConfigPath();
      const statePath = ConfigManager.getDaemonStatePath();
      const schedulingService = new SchedulingService(configPath, statePath);
      const status = schedulingService.getDaemonStatus();

      return {
        running: status.running,
        configExists: true,
        lastReport: status.state.lastReportSent,
        totalReports: status.state.totalReportsGenerated,
      };
    } catch {
      return {
        running: false,
        configExists: true,
      };
    }
  }
}
