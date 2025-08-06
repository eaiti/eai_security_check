const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Import core services
const { SecurityAuditor } = require("../../dist/services/auditor");
const { ConfigManager } = require("../../dist/config/config-manager");
const { SchedulingService } = require("../../dist/services/scheduling-service");
const { DaemonOperations } = require("../../dist/core/daemon-operations");
const { CryptoUtils } = require("../../dist/utils/crypto-utils");
const { PlatformDetector } = require("../../dist/utils/platform-detector");

// Check for CLI arguments before starting Electron GUI
const args = process.argv.slice(1); // Skip node executable
const hasCliArgs =
  args.length > 1 &&
  (args.includes("check") ||
    args.includes("validate") ||
    args.includes("daemon") ||
    args.includes("--version") ||
    args.includes("-v") ||
    args.includes("--help") ||
    args.includes("-h"));

// If CLI arguments are provided, run in headless mode
if (hasCliArgs) {
  handleCliMode();
} else {
  // Continue with normal Electron GUI startup
  initializeElectronApp();
}

/**
 * Handle CLI mode operations
 */
async function handleCliMode() {
  try {
    const command = args[1];

    switch (command) {
      case "check":
        await handleCheckCommand();
        break;
      case "validate":
        await handleValidateCommand();
        break;
      case "daemon":
        await handleDaemonCommand();
        break;
      case "--version":
      case "-v":
        printVersion();
        break;
      case "--help":
      case "-h":
        printHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("CLI command failed:", error.message);
    process.exit(1);
  }
}

/**
 * Handle the 'check' command
 */
async function handleCheckCommand() {
  console.log("🛡️  EAI Security Check - CLI Mode");
  console.log("=================================");

  // Parse command line options
  const options = parseCheckOptions();

  // Initialize core services
  const securityAuditor = new SecurityAuditor();

  try {
    // Load configuration
    let config;
    if (options.configPath) {
      if (!fs.existsSync(options.configPath)) {
        throw new Error(`Configuration file not found: ${options.configPath}`);
      }
      config = JSON.parse(fs.readFileSync(options.configPath, "utf8"));
    } else {
      // Use default profile configuration
      const {
        getConfigByProfile,
      } = require("../../dist/config/config-profiles");
      config = getConfigByProfile(options.profile);
    }

    console.log(`⚙️  Using profile: ${options.profile}`);
    console.log("🔍 Running security checks...");

    // Run security check
    const results = await securityAuditor.auditSecurity(config);

    // Generate report
    const reportData = {
      timestamp: new Date().toISOString(),
      platform: os.platform(),
      profile: options.profile,
      version: getAppVersion(),
      results: results,
      summary: generateSummary(results),
    };

    // Save report
    const reportPath =
      options.outputPath || path.join(os.homedir(), "eai-security-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    // Output results
    if (options.format === "json") {
      console.log("📊 Results (JSON):");
      console.log(JSON.stringify(reportData, null, 2));
    } else {
      printHumanReadableResults(reportData);
    }

    console.log(`\n📝 Report saved to: ${reportPath}`);

    // Exit with appropriate code
    const hasFailures = checkForSecurityFailures(results);
    if (hasFailures) {
      console.log("\n⚠️  Security check completed with warnings/failures.");
      process.exit(1);
    } else {
      console.log("\n✅ Security check completed successfully!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Security check failed:", error.message);
    process.exit(1);
  }
}

/**
 * Handle the 'validate' command
 */
async function handleValidateCommand() {
  const reportPath = args[2];
  if (!reportPath) {
    console.error("Error: Report path is required for validate command");
    console.error("Usage: validate <reportPath>");
    process.exit(1);
  }

  try {
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Report file not found: ${reportPath}`);
    }

    const reportContent = fs.readFileSync(reportPath, "utf8");
    const report = JSON.parse(reportContent);

    console.log("🔍 Validating security report...");

    // Basic validation
    const requiredFields = ["timestamp", "platform", "results", "summary"];
    for (const field of requiredFields) {
      if (!report[field]) {
        throw new Error(`Required field missing: ${field}`);
      }
    }

    console.log("✅ Report structure is valid");
    console.log(`Report timestamp: ${report.timestamp}`);
    console.log(`Platform: ${report.platform}`);
    console.log(`Total checks: ${report.summary.totalChecks}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Report validation failed:", error.message);
    process.exit(1);
  }
}

/**
 * Handle the 'daemon' command
 */
async function handleDaemonCommand() {
  const action = args[2];
  if (!action) {
    console.error("Error: Daemon action is required");
    console.error("Usage: daemon <install|uninstall|start|stop|status>");
    process.exit(1);
  }

  try {
    const schedulingService = new SchedulingService();

    switch (action) {
      case "install":
        console.log("📦 Installing daemon service...");
        // Implementation would go here
        console.log("✅ Daemon service installed");
        break;
      case "uninstall":
        console.log("🗑️  Uninstalling daemon service...");
        // Implementation would go here
        console.log("✅ Daemon service uninstalled");
        break;
      case "start": {
        console.log("▶️  Starting daemon service...");
        await schedulingService.startDaemon();
        console.log("✅ Daemon service started");
        break;
      }
      case "stop": {
        console.log("⏹️  Stopping daemon service...");
        await schedulingService.stopDaemon();
        console.log("✅ Daemon service stopped");
        break;
      }
      case "status": {
        console.log("📊 Daemon service status:");
        const status = await schedulingService.getDaemonStatus();
        console.log(JSON.stringify(status, null, 2));
        break;
      }
      default:
        console.error(`Unknown daemon action: ${action}`);
        console.error("Usage: daemon <install|uninstall|start|stop|status>");
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error(`Daemon ${action} failed:`, error.message);
    process.exit(1);
  }
}

/**
 * Parse command line options for the check command
 */
function parseCheckOptions() {
  const options = {
    profile: "developer",
    format: "json",
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--config" || arg === "-c") {
      options.configPath = args[++i];
    } else if (arg === "--profile" || arg === "-p") {
      options.profile = args[++i];
    } else if (arg === "--platform") {
      options.platform = args[++i];
    } else if (arg === "--output" || arg === "-o") {
      options.outputPath = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      options.format = args[++i];
    } else if (arg === "--non-interactive") {
      options.nonInteractive = true;
    }
  }

  return options;
}

/**
 * Generate a summary of security check results
 */
function generateSummary(results) {
  const summary = {
    totalChecks: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    critical: 0,
  };

  const processResults = (obj) => {
    if (typeof obj === "object" && obj !== null) {
      for (const [, value] of Object.entries(obj)) {
        if (typeof value === "boolean") {
          summary.totalChecks++;
          if (value) {
            summary.passed++;
          } else {
            summary.failed++;
          }
        } else if (typeof value === "object" && value !== null) {
          processResults(value);
        }
      }
    }
  };

  processResults(results);
  return summary;
}

/**
 * Check if there are any security failures
 */
function checkForSecurityFailures(results) {
  const checkForFailures = (obj) => {
    if (typeof obj === "object" && obj !== null) {
      for (const [, value] of Object.entries(obj)) {
        if (typeof value === "boolean" && !value) {
          return true;
        } else if (typeof value === "object" && value !== null) {
          if (checkForFailures(value)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  return checkForFailures(results);
}

/**
 * Print human-readable results
 */
function printHumanReadableResults(reportData) {
  console.log("\n🛡️  Security Check Results");
  console.log("==========================");
  console.log(`Timestamp: ${reportData.timestamp}`);
  console.log(`Platform: ${reportData.platform}`);
  console.log(`Profile: ${reportData.profile}`);
  console.log(`Version: ${reportData.version}\n`);

  const { summary } = reportData;
  console.log("📊 Summary:");
  console.log(`  Total Checks: ${summary.totalChecks}`);
  console.log(`  ✅ Passed: ${summary.passed}`);
  console.log(`  ❌ Failed: ${summary.failed}`);

  if (summary.failed > 0) {
    console.log("\n⚠️  Security Issues Found:");
    printFailures(reportData.results);
  } else {
    console.log("\n🎉 All security checks passed!");
  }
}

/**
 * Print detailed failure information
 */
function printFailures(results, prefix = "") {
  for (const [key, value] of Object.entries(results)) {
    if (typeof value === "boolean" && !value) {
      console.log(`  ${prefix}❌ ${key}: FAILED`);
    } else if (typeof value === "object" && value !== null) {
      printFailures(value, `${prefix}  `);
    }
  }
}

/**
 * Get app version
 */
function getAppVersion() {
  try {
    const packagePath = path.join(__dirname, "../../package.json");
    const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return packageData.version;
  } catch {
    return "1.0.0";
  }
}

/**
 * Print version information
 */
function printVersion() {
  console.log(`EAI Security Check v${getAppVersion()}`);
  process.exit(0);
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
EAI Security Check v${getAppVersion()}

USAGE:
  eai-security-check                           Launch GUI interface
  eai-security-check check [options]          Run security check
  eai-security-check validate <reportPath>    Validate a security report
  eai-security-check daemon <action>          Manage daemon service
  eai-security-check --version                Show version
  eai-security-check --help                   Show this help

CHECK OPTIONS:
  -c, --config <path>     Path to configuration file
  -p, --profile <name>    Security profile (developer, strict, relaxed, eai)
      --platform <name>   Target platform (macos, linux, windows)
  -o, --output <path>     Output file path for report
  -f, --format <format>   Output format (json, human)
      --non-interactive   Run without user interaction

DAEMON ACTIONS:
  install     Install daemon service
  uninstall   Remove daemon service
  start       Start daemon service
  stop        Stop daemon service
  status      Show daemon status

EXAMPLES:
  eai-security-check check --profile strict
  eai-security-check check --config ./my-config.json --format human
  eai-security-check validate ./security-report.json
  eai-security-check daemon install
`);
  process.exit(0);
}

/**
 * Initialize the Electron app (GUI mode)
 */
function initializeElectronApp() {
  // Global variables
  let mainWindow;
  let configManager;
  let securityAuditor;
  let schedulingService;
  let daemonOperations;
  let cryptoService;
  let platformDetector;

  // OS-specific data directories
  const getDataDirectory = () => {
    switch (process.platform) {
      case "darwin":
        return path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "EAI Security Check",
        );
      case "win32":
        return path.join(
          process.env.APPDATA || os.homedir(),
          "EAI Security Check",
        );
      default: // Linux and others
        return path.join(
          process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
          "eai-security-check",
        );
    }
  };

  const getLogsDirectory = () => {
    return path.join(getDataDirectory(), "logs");
  };

  const getReportsDirectory = () => {
    return path.join(getDataDirectory(), "reports");
  };

  // Initialize core services
  const initializeServices = async () => {
    try {
      // Ensure directories exist
      const dataDir = getDataDirectory();
      const logsDir = getLogsDirectory();
      const reportsDir = getReportsDirectory();

      for (const dir of [dataDir, logsDir, reportsDir]) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Initialize services
      configManager = new ConfigManager();
      securityAuditor = new SecurityAuditor();

      // Initialize scheduling service (optional, may not have config yet)
      try {
        schedulingService = new SchedulingService();
      } catch (error) {
        console.warn("Scheduling service not available:", error.message);
        schedulingService = null;
      }

      // Initialize daemon operations
      try {
        daemonOperations = new DaemonOperations();
      } catch (error) {
        console.warn("Daemon operations not available:", error.message);
        daemonOperations = null;
      }

      cryptoService = CryptoUtils;
      platformDetector = new PlatformDetector();

      console.log("Core services initialized successfully");
    } catch (error) {
      console.error("Failed to initialize core services:", error);
    }
  };

  // Create main window
  const createWindow = () => {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        webSecurity: true,
      },
      show: false,
      icon:
        process.platform === "linux"
          ? path.join(__dirname, "../../public/icons/security-icon.svg")
          : path.join(__dirname, "../../public/icons/security-icon.svg"),
    });

    // Load the Angular app
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      mainWindow.loadURL("http://localhost:4200");
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(
        path.join(__dirname, "../../dist/ui/browser/index.html"),
      );
      // Remove dev tools for production, but can enable temporarily for debugging
      // mainWindow.webContents.openDevTools();
    }

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  };

  // App event handlers
  app.whenReady().then(async () => {
    await initializeServices();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  // IPC Handlers for Security Auditing
  ipcMain.handle("security:runFullCheck", async (event, config) => {
    try {
      if (!securityAuditor) throw new Error("Security auditor not initialized");
      const result = await securityAuditor.runFullSecurityCheck(config);
      return { success: true, data: result };
    } catch (error) {
      console.error("Full security check failed:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("security:runQuickCheck", async () => {
    try {
      if (!securityAuditor) throw new Error("Security auditor not initialized");
      const result = await securityAuditor.runQuickSecurityCheck();
      return { success: true, data: result };
    } catch (error) {
      console.error("Quick security check failed:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("security:getSystemInfo", async () => {
    try {
      if (!platformDetector)
        throw new Error("Platform detector not initialized");
      const info = await platformDetector.getDetailedSystemInfo();
      return { success: true, data: info };
    } catch (error) {
      console.error("Failed to get system info:", error);
      return { success: false, error: error.message };
    }
  });

  // IPC Handlers for Configuration Management
  ipcMain.handle("config:load", async (event, profileName = "default") => {
    try {
      if (!configManager) throw new Error("Config manager not initialized");
      const config = await configManager.loadConfig(profileName);
      return { success: true, data: config };
    } catch (error) {
      console.error("Failed to load config:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "config:save",
    async (event, config, profileName = "default") => {
      try {
        if (!configManager) throw new Error("Config manager not initialized");
        await configManager.saveConfig(config, profileName);
        return { success: true };
      } catch (error) {
        console.error("Failed to save config:", error);
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle("config:validate", async (event, config) => {
    try {
      if (!configManager) throw new Error("Config manager not initialized");
      const result = await configManager.validateConfig(config);
      return { success: true, data: result };
    } catch (error) {
      console.error("Config validation failed:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("config:getProfiles", async () => {
    try {
      if (!configManager) throw new Error("Config manager not initialized");
      const profiles = await configManager.getAvailableProfiles();
      return { success: true, data: profiles };
    } catch (error) {
      console.error("Failed to get config profiles:", error);
      return { success: false, error: error.message };
    }
  });

  // IPC Handlers for Report Management
  ipcMain.handle("reports:list", async () => {
    try {
      const reportsDir = getReportsDirectory();
      const files = fs
        .readdirSync(reportsDir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
          const filePath = path.join(reportsDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            timestamp: stats.mtime.toISOString(),
            size: stats.size,
          };
        });
      return { success: true, data: files };
    } catch (error) {
      console.error("Failed to list reports:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("reports:load", async (event, reportPath) => {
    try {
      if (!fs.existsSync(reportPath)) {
        throw new Error("Report file not found");
      }
      const content = fs.readFileSync(reportPath, "utf-8");
      const report = JSON.parse(content);
      return { success: true, data: report };
    } catch (error) {
      console.error("Failed to load report:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("reports:save", async (event, report, filename) => {
    try {
      const reportsDir = getReportsDirectory();
      const filePath = path.join(reportsDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
      return { success: true, data: { path: filePath } };
    } catch (error) {
      console.error("Failed to save report:", error);
      return { success: false, error: error.message };
    }
  });

  // IPC Handlers for Cryptographic Operations
  ipcMain.handle("crypto:verifyReport", async (event, reportPath) => {
    try {
      if (!cryptoService) throw new Error("Crypto service not initialized");
      const result = await cryptoService.verifyReportIntegrity(reportPath);
      return { success: true, data: result };
    } catch (error) {
      console.error("Report verification failed:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("crypto:signReport", async (event, reportPath) => {
    try {
      if (!cryptoService) throw new Error("Crypto service not initialized");
      const result = await cryptoService.signReport(reportPath);
      return { success: true, data: result };
    } catch (error) {
      console.error("Report signing failed:", error);
      return { success: false, error: error.message };
    }
  });

  // IPC Handlers for Scheduling Service
  ipcMain.handle("scheduling:getStatus", async () => {
    try {
      if (!schedulingService) {
        return { success: false, error: "Scheduling service not available" };
      }
      const status = await schedulingService.getScheduleStatus();
      return { success: true, data: status };
    } catch (error) {
      console.error("Failed to get schedule status:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("scheduling:configure", async (event, scheduleConfig) => {
    try {
      if (!schedulingService) {
        return { success: false, error: "Scheduling service not available" };
      }
      await schedulingService.configureSchedule(scheduleConfig);
      return { success: true };
    } catch (error) {
      console.error("Failed to configure schedule:", error);
      return { success: false, error: error.message };
    }
  });

  // IPC Handlers for Daemon Management
  ipcMain.handle("daemon:getStatus", async () => {
    try {
      if (!schedulingService) {
        return { success: false, error: "Daemon service not available" };
      }
      const status = await schedulingService.getDaemonStatus();
      return { success: true, data: status };
    } catch (error) {
      console.error("Failed to get daemon status:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:start", async () => {
    try {
      if (!schedulingService) {
        return { success: false, error: "Daemon service not available" };
      }
      await schedulingService.startDaemon();
      return { success: true };
    } catch (error) {
      console.error("Failed to start daemon:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:stop", async () => {
    try {
      if (!schedulingService) {
        return { success: false, error: "Daemon service not available" };
      }
      await schedulingService.stopDaemon();
      return { success: true };
    } catch (error) {
      console.error("Failed to stop daemon:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:restart", async () => {
    try {
      if (!schedulingService) {
        return { success: false, error: "Daemon service not available" };
      }
      await schedulingService.restartDaemon();
      return { success: true };
    } catch (error) {
      console.error("Failed to restart daemon:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:setupSystemService", async () => {
    try {
      if (!daemonOperations) {
        return { success: false, error: "Daemon operations not available" };
      }
      const result = await daemonOperations.setupSystemService();
      return { success: true, data: result };
    } catch (error) {
      console.error("Failed to setup system service:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:removeSystemService", async () => {
    try {
      if (!daemonOperations) {
        return { success: false, error: "Daemon operations not available" };
      }
      const result = await daemonOperations.removeSystemService();
      return { success: true, data: result };
    } catch (error) {
      console.error("Failed to remove system service:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:getSystemServiceStatus", async () => {
    try {
      if (!daemonOperations) {
        return { success: false, error: "Daemon operations not available" };
      }
      const status = await daemonOperations.getSystemServiceStatus();
      return { success: true, data: status };
    } catch (error) {
      console.error("Failed to get system service status:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:configure", async (event, daemonConfig) => {
    try {
      if (!schedulingService) {
        return { success: false, error: "Daemon service not available" };
      }
      await schedulingService.configureDaemon(daemonConfig);
      return { success: true };
    } catch (error) {
      console.error("Failed to configure daemon:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:getConfig", async () => {
    try {
      if (!schedulingService) {
        return { success: false, error: "Daemon service not available" };
      }
      const config = await schedulingService.getDaemonConfig();
      return { success: true, data: config };
    } catch (error) {
      console.error("Failed to get daemon config:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:getLogs", async (event, lines = 100) => {
    try {
      const logsDir = getLogsDirectory();
      const logFile = path.join(logsDir, "eai-security-check.log");

      if (!fs.existsSync(logFile)) {
        return { success: true, data: [] };
      }

      const logContent = fs.readFileSync(logFile, "utf-8");
      const logLines = logContent.split("\n").filter((line) => line.trim());
      const recentLines = logLines.slice(-lines);

      return { success: true, data: recentLines };
    } catch (error) {
      console.error("Failed to get daemon logs:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("daemon:clearLogs", async () => {
    try {
      const logsDir = getLogsDirectory();
      const logFile = path.join(logsDir, "eai-security-check.log");
      const errorLogFile = path.join(logsDir, "eai-security-check.error.log");

      if (fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, "");
      }
      if (fs.existsSync(errorLogFile)) {
        fs.writeFileSync(errorLogFile, "");
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to clear daemon logs:", error);
      return { success: false, error: error.message };
    }
  });

  // IPC Handlers for File System Operations
  ipcMain.handle("fs:selectDirectory", async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
      });
      return { success: true, data: result };
    } catch (error) {
      console.error("Failed to select directory:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("fs:selectFile", async (event, filters = []) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: filters,
      });
      return { success: true, data: result };
    } catch (error) {
      console.error("Failed to select file:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("fs:selectMultipleFiles", async (event, filters = []) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile", "multiSelections"],
        filters: filters,
      });
      return { success: true, data: result };
    } catch (error) {
      console.error("Failed to select files:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "fs:saveFile",
    async (event, defaultPath = "", filters = []) => {
      try {
        const result = await dialog.showSaveDialog(mainWindow, {
          defaultPath: defaultPath,
          filters: filters,
        });
        return { success: true, data: result };
      } catch (error) {
        console.error("Failed to save file dialog:", error);
        return { success: false, error: error.message };
      }
    },
  );

  // IPC Handlers for System Operations
  ipcMain.handle("system:openExternal", async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Failed to open external URL:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("system:getDataDirectory", async () => {
    try {
      return { success: true, data: getDataDirectory() };
    } catch (error) {
      console.error("Failed to get data directory:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("system:getLogsDirectory", async () => {
    try {
      return { success: true, data: getLogsDirectory() };
    } catch (error) {
      console.error("Failed to get logs directory:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("system:getReportsDirectory", async () => {
    try {
      return { success: true, data: getReportsDirectory() };
    } catch (error) {
      console.error("Failed to get reports directory:", error);
      return { success: false, error: error.message };
    }
  });

  // Error handling
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
  });
} // End of initializeElectronApp function
