const { app, BrowserWindow, ipcMain } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

class ElectronMain {
  constructor() {
    this.mainWindow = null;
    this.cliPath = null;
    this.initialize();
  }

  initialize() {
    app.whenReady().then(() => {
      this.findCliPath();
      this.createWindow();
      this.setupIpcHandlers();
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  findCliPath() {
    // Try to find the CLI executable in various locations
    const possiblePaths = [
      path.join(__dirname, "../../dist/cli/index.js"),
      path.join(process.resourcesPath, "app/dist/cli/index.js"),
      path.join(__dirname, "../../../dist/cli/index.js"),
    ];

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        this.cliPath = testPath;
        console.log("Found CLI at:", this.cliPath);
        break;
      }
    }

    if (!this.cliPath) {
      console.warn("CLI not found, UI will use mock data");
    }
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, "preload.js"),
      },
      icon: path.join(__dirname, "../public/favicon.ico"),
      title: "EAI Security Check",
      show: false,
    });

    // Load the Angular app
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      this.mainWindow.loadURL("http://localhost:4200");
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, "../dist/ui/index.html"));
    }

    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow.show();
    });
  }

  setupIpcHandlers() {
    ipcMain.handle("run-security-check", async (event, profile, config, password) => {
      return this.runSecurityCheck(profile, config, password);
    });

    ipcMain.handle("run-interactive", async () => {
      return this.runCliCommand("interactive");
    });

    ipcMain.handle("verify-report", async (event, filePath) => {
      try {
        if (!this.cliPath) {
          console.warn("CLI not available for verification");
          return false;
        }

        const result = await this.runCliCommand(`verify "${filePath}"`);
        
        if (result.error) {
          console.error("Verification command failed:", result.stderr);
          return false;
        }

        // Check if the CLI output indicates success
        const output = result.stdout?.toLowerCase() || '';
        return output.includes('passed') || output.includes('valid') || output.includes('success');
      } catch (error) {
        console.error("Verification failed:", error);
        return false;
      }
    });

    ipcMain.handle("load-recent-reports", async () => {
      try {
        const reportsDir = path.join(app.getPath("userData"), "reports");
        
        if (!fs.existsSync(reportsDir)) {
          return [];
        }

        const files = fs.readdirSync(reportsDir)
          .filter(file => file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.html'))
          .map(file => {
            const filePath = path.join(reportsDir, file);
            const stats = fs.statSync(filePath);
            return {
              path: filePath,
              name: file,
              timestamp: stats.mtime.toISOString(),
              size: this.formatFileSize(stats.size)
            };
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10); // Return only the 10 most recent reports

        return files;
      } catch (error) {
        console.error("Failed to load recent reports:", error);
        return [];
      }
    });

    ipcMain.handle("manage-daemon", async (event, action, config) => {
      if (action === "configure") {
        // Handle configuration save
        try {
          const configPath = path.join(
            app.getPath("userData"),
            "daemon-config.json",
          );
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          return { success: true };
        } catch (error) {
          console.error("Failed to save daemon config:", error);
          return { success: false, error: error.message };
        }
      } else {
        const configArg = config
          ? `--config "${JSON.stringify(config).replace(/"/g, '\\"')}"`
          : "";
        return this.runCliCommand(`daemon ${action} ${configArg}`);
      }
    });

    ipcMain.handle("install-globally", async () => {
      return this.runCliCommand("install");
    });

    ipcMain.handle("uninstall-globally", async (event, removeConfig) => {
      const flag = removeConfig ? "--remove-config" : "";
      return this.runCliCommand(`uninstall ${flag}`);
    });

    ipcMain.handle("update-app", async () => {
      return this.runCliCommand("update");
    });

    ipcMain.handle("get-platform-info", async () => {
      const os = require("os");
      return {
        platform: os.platform(),
        arch: os.arch(),
        version: os.release(),
      };
    });

    ipcMain.handle("get-cli-version", async () => {
      try {
        const result = await this.runCliCommand("--version");
        return result.stdout?.trim() || "1.1.0";
      } catch (error) {
        return "1.1.0";
      }
    });

    ipcMain.handle("load-config", async (event, configPath) => {
      try {
        if (configPath && fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, "utf8");
          return JSON.parse(content);
        }
        // Return default config
        const defaultConfigPath = path.join(
          __dirname,
          "../../examples/default-config.json",
        );
        if (fs.existsSync(defaultConfigPath)) {
          const content = fs.readFileSync(defaultConfigPath, "utf8");
          return JSON.parse(content);
        }
        return this.getDefaultConfig();
      } catch (error) {
        console.error("Failed to load config:", error);
        return this.getDefaultConfig();
      }
    });

    ipcMain.handle("save-config", async (event, config, configPath) => {
      try {
        const savePath =
          configPath ||
          path.join(app.getPath("userData"), "security-config.json");
        fs.writeFileSync(savePath, JSON.stringify(config, null, 2));
        return true;
      } catch (error) {
        console.error("Failed to save config:", error);
        return false;
      }
    });

    ipcMain.handle("create-config", async (event, profile) => {
      // Load actual config from examples directory
      try {
        const configPath = path.join(__dirname, `../../examples/${profile}-config.json`);
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, "utf8");
          return JSON.parse(content);
        }
      } catch (error) {
        console.error(`Failed to load ${profile} config from examples:`, error);
      }
      
      // Fallback to hardcoded configs
      const configs = {
        default: this.getDefaultConfig(),
        strict: this.getStrictConfig(),
        relaxed: this.getRelaxedConfig(),
        developer: this.getDeveloperConfig(),
        eai: this.getEaiConfig(),
      };
      return configs[profile] || this.getDefaultConfig();
    });

    ipcMain.handle("list-configs", async () => {
      return ["default", "strict", "relaxed", "developer", "eai"];
    });

    ipcMain.handle("load-report-file", async (event, filePath) => {
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch (error) {
        console.error('Failed to load report file:', error);
        throw error;
      }
    });

    ipcMain.handle("get-config-directory", async () => {
      return path.join(app.getPath("userData"), "config");
    });

    ipcMain.handle("get-reports-directory", async () => {
      return path.join(app.getPath("userData"), "reports");
    });
  }

  async runSecurityCheck(profile, config, password) {
    try {
      if (!this.cliPath) {
        throw new Error("CLI not available - cannot run real security checks");
      }

      // Use the default profile configs from examples directory
      let configArg = '';
      if (config) {
        configArg = `--config "${config}"`;
      } else {
        // Load the appropriate profile config from examples
        const profileConfigPath = path.join(__dirname, `../../examples/${profile}-config.json`);
        if (fs.existsSync(profileConfigPath)) {
          configArg = `--config "${profileConfigPath}"`;
        } else {
          configArg = profile; // Fallback to profile name
        }
      }
      
      const passwordArg = password ? `--password "${password}"` : '';
      const command = `node "${this.cliPath}" check ${configArg} ${passwordArg} --format json --quiet`;

      console.log(`Running security check: ${command}`);
      const result = await this.executeCommand(command);

      if (result.error) {
        console.error("CLI command failed:", result.stderr || result.error.message);
        throw new Error(result.stderr || result.error.message);
      }

      // Parse the JSON output from CLI
      try {
        const report = JSON.parse(result.stdout);
        console.log(`Security check completed successfully for profile: ${profile}`);
        return report;
      } catch (parseError) {
        console.warn("Failed to parse CLI output:", parseError.message);
        console.warn("CLI stdout:", result.stdout);
        throw new Error("Failed to parse security check results");
      }
    } catch (error) {
      console.error("Security check failed:", error);
      throw error; // Don't fall back to mock data, throw the error
    }
  }

  async runCliCommand(command) {
    if (!this.cliPath) {
      throw new Error("CLI not available");
    }

    const fullCommand = `node "${this.cliPath}" ${command}`;
    return this.executeCommand(fullCommand);
  }

  executeCommand(command) {
    return new Promise((resolve) => {
      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });
  }

  getDefaultConfig() {
    return {
      diskEncryption: { enabled: true },
      passwordProtection: { enabled: true, requirePasswordImmediately: true },
      autoLock: { maxTimeoutMinutes: 15 },
      firewall: { enabled: true, stealthMode: false },
      packageVerification: { enabled: true },
      systemIntegrityProtection: { enabled: true },
      remoteLogin: { enabled: false },
      automaticUpdates: { enabled: true, automaticInstall: false },
    };
  }

  getStrictConfig() {
    return {
      diskEncryption: { enabled: true },
      passwordProtection: { enabled: true, requirePasswordImmediately: true },
      autoLock: { maxTimeoutMinutes: 3 },
      firewall: { enabled: true, stealthMode: true },
      packageVerification: { enabled: true },
      systemIntegrityProtection: { enabled: true },
      remoteLogin: { enabled: false },
      automaticUpdates: { enabled: true, automaticInstall: true },
    };
  }

  getRelaxedConfig() {
    return {
      diskEncryption: { enabled: false },
      passwordProtection: { enabled: true, requirePasswordImmediately: false },
      autoLock: { maxTimeoutMinutes: 30 },
      firewall: { enabled: true, stealthMode: false },
      packageVerification: { enabled: false },
      systemIntegrityProtection: { enabled: false },
      remoteLogin: { enabled: true },
      automaticUpdates: { enabled: true, automaticInstall: false },
    };
  }

  getDeveloperConfig() {
    return {
      diskEncryption: { enabled: true },
      passwordProtection: { enabled: true, requirePasswordImmediately: false },
      autoLock: { maxTimeoutMinutes: 20 },
      firewall: { enabled: true, stealthMode: false },
      packageVerification: { enabled: false },
      systemIntegrityProtection: { enabled: false },
      remoteLogin: { enabled: true },
      automaticUpdates: { enabled: true, automaticInstall: false },
    };
  }

  getEaiConfig() {
    return {
      diskEncryption: { enabled: true },
      passwordProtection: { enabled: true, requirePasswordImmediately: true },
      autoLock: { maxTimeoutMinutes: 10 },
      firewall: { enabled: true, stealthMode: true },
      packageVerification: { enabled: true },
      systemIntegrityProtection: { enabled: true },
      remoteLogin: { enabled: false },
      automaticUpdates: { enabled: true, automaticInstall: true },
    };
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

new ElectronMain();
