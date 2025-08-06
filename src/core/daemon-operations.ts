import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { confirm } from "@inquirer/prompts";
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
   * Setup daemon automation with configuration
   */
  static async setupDaemonAutomation(
    options: DaemonSetupOptions = {},
  ): Promise<void> {
    console.log("🤖 Daemon Automation Setup\n");

    if (ConfigManager.hasSchedulingConfig() && !options.force) {
      console.log("⚠️  Daemon configuration already exists.");

      const reconfigure = await confirm({
        message: "Do you want to reconfigure it?",
        default: false,
      });

      if (!reconfigure) {
        console.log("❌ Daemon setup cancelled.");
        return;
      }
    }

    // Ensure security config exists first
    if (!ConfigManager.hasSecurityConfig()) {
      console.log("📝 Setting up security configuration first...\n");
      const profile = await ConfigManager.promptForSecurityProfile();
      ConfigManager.createAllSecurityConfigs(false, profile);
    }

    // Setup daemon configuration
    await ConfigManager.createSchedulingConfigInteractive("default");

    // Ask if user wants to setup system service
    const setupService =
      options.autoSetup ?? (await ConfigManager.promptForDaemonSetup());
    if (setupService) {
      await this.setupSystemService();
    }

    console.log("\n✅ Daemon automation setup complete!");
  }

  /**
   * Setup system service for daemon automation
   */
  static async setupSystemService(): Promise<void> {
    // Check for compatible global installation first
    console.log("\n🔍 Checking global installation compatibility...");
    const globalCheck = await this.checkGlobalInstallationCompatibility();
    console.log(`💡 ${globalCheck.message}`);

    if (!globalCheck.compatible) {
      console.log("");
      if (!globalCheck.exists) {
        console.log("⚠️  Daemon setup requires a global installation because:");
        console.log(
          "   • System services (LaunchAgent/systemd) need a fixed executable path",
        );
        console.log(
          "   • The global installation provides a stable command: eai-security-check",
        );
        console.log(
          "   • This ensures the daemon works reliably across system restarts",
        );
        console.log("");

        const installGlobal = await confirm({
          message: "Would you like to install globally now?",
          default: true,
        });

        if (installGlobal) {
          await ConfigManager.setupGlobalInstallation();
          console.log("✅ Global installation completed!");
          console.log("");
        } else {
          console.log(
            "❌ Daemon service setup cancelled. Global installation is required.",
          );
          console.log(
            "💡 You can still run the daemon manually without service setup.",
          );
          return;
        }
      } else {
        console.log("⚠️  Version mismatch detected:");
        console.log(
          `   • Current version: ${ConfigManager.getCurrentVersion()}`,
        );
        console.log(`   • Global version: ${globalCheck.version}`);
        console.log("");

        const updateGlobal = await confirm({
          message: "Would you like to update the global installation now?",
          default: true,
        });

        if (updateGlobal) {
          await ConfigManager.setupGlobalInstallation();
          console.log("✅ Global installation updated!");
          console.log("");
        } else {
          console.log(
            "❌ Daemon service setup cancelled. Version compatibility is required.",
          );
          console.log(
            "💡 You can still run the daemon manually without service setup.",
          );
          return;
        }
      }
    } else {
      console.log("✅ Global installation is compatible!");
      console.log("");
    }

    const platform = os.platform();

    if (platform === "darwin") {
      // macOS: Set up LaunchAgent directly
      console.log("🍎 macOS LaunchAgent Setup:");
      console.log("   Setting up automatic startup on login...");
      console.log("");

      try {
        await this.setupMacOSLaunchAgent();
        console.log("✅ LaunchAgent setup completed!");
        console.log(
          "💡 The daemon will now start automatically when you log in.",
        );
      } catch (error) {
        console.error(`❌ LaunchAgent setup failed: ${error}`);
        console.log("");
        console.log("🔧 Troubleshooting:");
        console.log(
          "   1. Check if you have permission to write to ~/Library/LaunchAgents/",
        );
        console.log(
          "   2. Make sure the daemon configuration exists (set up via interactive mode)",
        );
        console.log("   3. Check the error message above for specific details");
        console.log("");
      }
    } else {
      // Other platforms: Show manual setup instructions
      const serviceSetup = ConfigManager.copyDaemonServiceTemplates();

      console.log("\n🎯 Service Setup Instructions:");
      serviceSetup.instructions.forEach((instruction) =>
        console.log(instruction),
      );

      if (serviceSetup.templatesCopied.length > 0) {
        console.log(
          `\n📁 Template files copied: ${serviceSetup.templatesCopied.join(", ")}`,
        );
      }

      // Ask if user wants to attempt automatic setup
      if (await this.promptForAutoServiceSetup(serviceSetup.platform)) {
        await this.attemptAutoServiceSetup(serviceSetup);
      }
    }
  }

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
   * Prompt user if they want to attempt automatic service setup
   */
  static async promptForAutoServiceSetup(platform: string): Promise<boolean> {
    let canAutoSetup = false;
    let setupDescription = "";

    switch (platform) {
      case "Linux":
        canAutoSetup = true;
        setupDescription =
          "copy the systemd service file to the correct location";
        break;
      case "macOS":
        canAutoSetup = true;
        setupDescription =
          "copy the LaunchAgent plist file to the correct location";
        break;
      case "Windows":
        canAutoSetup = false;
        setupDescription =
          "setup requires Administrator privileges (manual setup recommended)";
        break;
      default:
        return false;
    }

    if (!canAutoSetup) {
      console.log(
        `💡 Note: Automatic setup not available for ${platform} - ${setupDescription}`,
      );
      return false;
    }

    console.log(
      `🤖 Auto-Setup Available: I can ${setupDescription} for you.\n`,
    );

    return await confirm({
      message: "Would you like me to attempt automatic service setup?",
      default: false,
    });
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
   * Manage daemon service operations
   */
  static async manageDaemonService(
    options: DaemonManagementOptions,
  ): Promise<void> {
    console.log("🤖 Daemon Service Management\n");

    if (!ConfigManager.hasSchedulingConfig()) {
      console.log(
        "❌ No daemon configuration found. Please set up daemon automation first.",
      );
      return;
    }

    switch (options.action) {
      case "start":
        console.log("🚀 Starting daemon in current session...");
        console.log(
          "💡 This will run until you stop it or close the terminal.",
        );
        console.log(
          "💡 For automatic startup, use the Setup Daemon Automation option.",
        );
        console.log("");
        await ConfigManager.manageDaemon("start");
        break;
      case "stop":
        await ConfigManager.manageDaemon("stop");
        break;
      case "restart":
        await ConfigManager.manageDaemon("restart");
        break;
      case "status":
        await ConfigManager.manageDaemon("status");
        break;
      case "remove": {
        console.log(
          "⚠️  This will remove all daemon configuration and stop the service.",
        );
        const confirmRemoval = await confirm({
          message: "Are you sure?",
          default: false,
        });

        if (confirmRemoval) {
          await ConfigManager.manageDaemon("remove");
        } else {
          console.log("❌ Removal cancelled.");
        }
        break;
      }
      default:
        console.log("❌ Invalid daemon action.");
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
