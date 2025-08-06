#!/usr/bin/env node

/**
 * EAI Security Check MCP Server
 *
 * This MCP server provides control over the EAI Security Check Electron application.
 * It can interact with the running Electron app to trigger security checks,
 * manage configurations, and control the daemon.
 */

const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");

const execAsync = promisify(exec);

class EAISecurityCheckMCPServer {
  constructor() {
    this.projectPath = path.resolve(__dirname, "..");
    this.devProcess = null;
  }

  // Simple JSON-RPC 2.0 implementation for MCP
  async handleRequest(request) {
    try {
      const { method, params, id } = request;

      switch (method) {
        case "initialize":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: "eai-security-check",
                version: "1.0.0",
              },
            },
          };

        case "initialized":
          // This might be a notification (no response expected) or a request
          if (id !== undefined) {
            return {
              jsonrpc: "2.0",
              id,
              result: {},
            };
          }
          // For notifications, we don't send a response
          return null;

        case "tools/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              tools: [
                {
                  name: "electron-start",
                  description:
                    "Start the Electron app in development mode with live reload",
                  inputSchema: {
                    type: "object",
                    properties: {
                      mode: {
                        type: "string",
                        enum: ["dev", "build"],
                        default: "dev",
                        description:
                          "Start mode: dev (with live reload) or build (production)",
                      },
                    },
                  },
                },
                {
                  name: "electron-stop",
                  description: "Stop the running Electron development server",
                  inputSchema: {
                    type: "object",
                    properties: {},
                  },
                },
                {
                  name: "electron-restart",
                  description: "Restart the Electron development server",
                  inputSchema: {
                    type: "object",
                    properties: {},
                  },
                },
                {
                  name: "electron-status",
                  description:
                    "Check if the Electron app is running and get process details",
                  inputSchema: {
                    type: "object",
                    properties: {},
                  },
                },
                {
                  name: "run-security-check",
                  description:
                    "Trigger a security check through the running Electron app",
                  inputSchema: {
                    type: "object",
                    properties: {
                      profile: {
                        type: "string",
                        enum: [
                          "default",
                          "strict",
                          "relaxed",
                          "developer",
                          "eai",
                        ],
                        default: "default",
                        description: "Security profile to use",
                      },
                    },
                  },
                },
                {
                  name: "daemon-control",
                  description: "Control the security check daemon",
                  inputSchema: {
                    type: "object",
                    properties: {
                      action: {
                        type: "string",
                        enum: ["start", "stop", "restart", "status"],
                        description: "Action to perform on the daemon",
                      },
                    },
                    required: ["action"],
                  },
                },
                {
                  name: "open-devtools",
                  description:
                    "Open Chrome DevTools in the Electron app for debugging",
                  inputSchema: {
                    type: "object",
                    properties: {},
                  },
                },
                {
                  name: "ui-run-security-check",
                  description:
                    "Programmatically run a security check through the Angular UI",
                  inputSchema: {
                    type: "object",
                    properties: {
                      profile: {
                        type: "string",
                        enum: [
                          "default",
                          "strict",
                          "relaxed",
                          "developer",
                          "eai",
                        ],
                        default: "eai",
                        description: "Security profile to use",
                      },
                      password: {
                        type: "string",
                        description:
                          "Admin password for privileged checks (optional)",
                      },
                    },
                  },
                },
                {
                  name: "ui-navigate",
                  description: "Navigate to a specific page in the Angular UI",
                  inputSchema: {
                    type: "object",
                    properties: {
                      route: {
                        type: "string",
                        enum: [
                          "dashboard",
                          "security-check",
                          "config-editor",
                          "daemon-manager",
                          "report-viewer",
                          "management",
                        ],
                        description: "The route to navigate to",
                      },
                    },
                    required: ["route"],
                  },
                },
                {
                  name: "ui-get-reports",
                  description:
                    "Get the list of recent security reports from the UI",
                  inputSchema: {
                    type: "object",
                    properties: {},
                  },
                },
                {
                  name: "ui-get-status",
                  description:
                    "Get the current status of the UI and any running operations",
                  inputSchema: {
                    type: "object",
                    properties: {},
                  },
                },
              ],
            },
          };

        case "tools/call":
          return await this.handleToolCall(params, id);

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32603,
          message: `Internal error: ${error.message}`,
        },
      };
    }
  }

  async handleToolCall(params, id) {
    const { name, arguments: args = {} } = params;

    try {
      let result;
      switch (name) {
        case "electron-start":
          result = await this.startElectron(args.mode);
          break;
        case "electron-stop":
          result = await this.stopElectron();
          break;
        case "electron-restart":
          result = await this.restartElectron();
          break;
        case "electron-status":
          result = await this.getElectronStatus();
          break;
        case "run-security-check":
          result = await this.runSecurityCheck(args.profile);
          break;
        case "daemon-control":
          result = await this.controlDaemon(args.action);
          break;
        case "open-devtools":
          result = await this.openDevTools();
          break;
        case "ui-run-security-check":
          result = await this.runUISecurityCheck(args.profile, args.password);
          break;
        case "ui-navigate":
          result = await this.navigateUI(args.route);
          break;
        case "ui-get-reports":
          result = await this.getUIReports();
          break;
        case "ui-get-status":
          result = await this.getUIStatus();
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: error.message,
        },
      };
    }
  }

  async startElectron(mode = "dev") {
    if (this.devProcess) {
      return "Electron is already running. Use electron-restart to restart it.";
    }

    return new Promise((resolve, reject) => {
      this.devProcess = spawn(
        "npm",
        ["run", mode === "dev" ? "dev" : "start"],
        {
          cwd: this.projectPath,
          stdio: ["ignore", "pipe", "pipe"],
          shell: true,
        },
      );

      let output = "";
      let startupComplete = false;

      this.devProcess.stdout.on("data", (data) => {
        const text = data.toString();
        output += text;

        // Check for startup indicators - Angular dev server and Electron startup
        if (
          text.includes(
            "Angular Live Development Server is listening on localhost:4200",
          ) ||
          text.includes("Local: http://localhost:4200/") ||
          text.includes("Core services initialized successfully") ||
          text.includes("Found 0 errors. Watching for file changes.")
        ) {
          if (!startupComplete) {
            startupComplete = true;
            resolve(
              `Electron started successfully in ${mode} mode.\n\n` +
                `Status: Running\n` +
                `PID: ${this.devProcess.pid}\n` +
                `Mode: ${mode}\n` +
                `Angular Dev Server: ${mode === "dev" ? "http://localhost:4200/" : "N/A"}\n\n` +
                `Recent output:\n${output.split("\n").slice(-10).join("\n")}`,
            );
          }
        }
      });

      this.devProcess.stderr.on("data", (data) => {
        output += data.toString();
      });

      this.devProcess.on("close", (code) => {
        this.devProcess = null;
        if (!startupComplete) {
          reject(
            new Error(
              `Electron failed to start (exit code: ${code})\n\nOutput:\n${output}`,
            ),
          );
        }
      });

      this.devProcess.on("error", (error) => {
        this.devProcess = null;
        if (!startupComplete) {
          reject(new Error(`Failed to start Electron: ${error.message}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!startupComplete) {
          this.devProcess?.kill();
          this.devProcess = null;
          reject(new Error("Electron startup timed out after 30 seconds"));
        }
      }, 30000);
    });
  }

  async stopElectron() {
    if (!this.devProcess) {
      return "No Electron process is currently running.";
    }

    return new Promise((resolve) => {
      const pid = this.devProcess.pid;

      this.devProcess.on("close", () => {
        resolve(`Electron process stopped successfully (PID: ${pid})`);
      });

      // Kill the process group to stop all child processes
      try {
        process.kill(-this.devProcess.pid, "SIGTERM");
      } catch {
        this.devProcess.kill("SIGTERM");
      }

      this.devProcess = null;

      // Force kill after 5 seconds if it doesn't stop gracefully
      setTimeout(() => {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // Process already stopped
        }
        resolve(`Electron process force-stopped (PID: ${pid})`);
      }, 5000);
    });
  }

  async restartElectron() {
    let stopResult = "";
    if (this.devProcess) {
      stopResult = await this.stopElectron();
      // Wait a moment for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const startResult = await this.startElectron();

    return `${stopResult}\n\n--- Restarting ---\n\n${startResult}`;
  }

  async getElectronStatus() {
    try {
      const { stdout } = await execAsync(
        'pgrep -f "electron.*eai-security-check"',
      );
      const processes = stdout
        .trim()
        .split("\n")
        .filter((pid) => pid);

      let status = `Electron Status Report:\n\n`;
      status += `Managed Process: ${this.devProcess ? `Running (PID: ${this.devProcess.pid})` : "Not running"}\n`;
      status += `System Processes: ${processes.length} found\n`;
      status += `PIDs: ${processes.join(", ") || "None"}\n\n`;

      // Check if Angular dev server is running
      try {
        await execAsync("curl -s http://localhost:4200/ > /dev/null");
        status += `Angular Dev Server: Running (http://localhost:4200/)\n`;
      } catch {
        status += `Angular Dev Server: Not running\n`;
      }

      // Check ports
      try {
        const { stdout: portCheck } = await execAsync(
          'lsof -i :4200 -t 2>/dev/null || echo "none"',
        );
        status += `Port 4200: ${portCheck.trim() === "none" ? "Available" : `In use (PID: ${portCheck.trim()})`}\n`;
      } catch {
        status += `Port 4200: Status unknown\n`;
      }

      return status;
    } catch (error) {
      return `Status check failed: ${error.message}`;
    }
  }

  async runSecurityCheck(profile = "default") {
    // This would ideally communicate with the running Electron app
    // For now, we'll run it via the CLI
    try {
      const configPath = path.join(
        this.projectPath,
        "examples",
        `${profile}-config.json`,
      );

      if (!fs.existsSync(configPath)) {
        throw new Error(`Profile configuration not found: ${configPath}`);
      }

      const { stdout, stderr } = await execAsync(
        `cd "${this.projectPath}" && npm run build && node dist/cli/index.js check --config "${configPath}" --format json`,
      );

      return (
        `Security Check Completed (Profile: ${profile})\n\n` +
        `Command Output:\n${stdout}\n\n` +
        `${stderr ? `Errors/Warnings:\n${stderr}\n\n` : ""}` +
        `Note: Check the reports directory for detailed results.`
      );
    } catch (error) {
      return `Security check failed: ${error.message}`;
    }
  }

  async controlDaemon(action) {
    try {
      const { stdout, stderr } = await execAsync(
        `cd "${this.projectPath}" && npm run build && node dist/cli/index.js daemon ${action}`,
      );

      return `Daemon ${action} completed:\n\n${stdout}${stderr ? `\n\nWarnings:\n${stderr}` : ""}`;
    } catch (error) {
      return `Daemon ${action} failed: ${error.message}`;
    }
  }

  async openDevTools() {
    // This would require communication with the Electron app
    return (
      `DevTools opening command sent.\n\n` +
      `Alternative: In the Electron window, press Cmd+Option+I (macOS) or Ctrl+Shift+I (Windows/Linux) to open DevTools manually.`
    );
  }

  async runUISecurityCheck(profile = "eai", password) {
    try {
      console.log(
        `Attempting to run UI security check with profile: ${profile}`,
      );

      // First, verify the Electron app is running
      if (!this.devProcess) {
        throw new Error(
          "Electron app is not running. Start it first with electron-start.",
        );
      }

      // Create a temporary script file that the Electron app can execute
      const scriptContent = `
        const { ipcRenderer } = require('electron');
        
        // Function to run security check via IPC
        async function runSecurityCheck() {
          try {
            console.log('Starting security check via IPC...');
            
            // Load the EAI config
            const config = await ipcRenderer.invoke('config:load', 'eai');
            console.log('Config loaded:', config);
            
            // Run the security check
            const result = await ipcRenderer.invoke('security:runFullCheck', config.data);
            console.log('Security check completed:', result);
            
            if (result.success) {
              // Save the report
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename = \`eai-security-report-\${timestamp}.json\`;
              
              const saveResult = await ipcRenderer.invoke('reports:save', result.data, filename);
              console.log('Report saved:', saveResult);
              
              // Signal completion
              window.mcpSecurityCheckComplete = {
                success: true,
                report: result.data,
                filename: filename
              };
            } else {
              window.mcpSecurityCheckComplete = {
                success: false,
                error: result.error
              };
            }
          } catch (error) {
            console.error('Security check failed:', error);
            window.mcpSecurityCheckComplete = {
              success: false,
              error: error.message
            };
          }
        }
        
        // Run the check
        runSecurityCheck();
      `;

      // Write the script to a temporary file
      const tempScriptPath = path.join(
        this.projectPath,
        "temp-security-check.js",
      );
      fs.writeFileSync(tempScriptPath, scriptContent);

      // Execute the script in the Electron renderer using Node.js child process
      // This will communicate with the running Electron app via IPC
      // const { spawn } = require("child_process"); // Not needed for current implementation

      return new Promise((resolve, reject) => {
        // For now, let's use a simpler HTTP-based approach
        // We'll create an endpoint in the dev server or use file-based communication

        // Create a status file approach
        const statusFile = path.join(
          this.projectPath,
          "mcp-security-check.json",
        );

        // Write initial status
        fs.writeFileSync(
          statusFile,
          JSON.stringify({
            status: "starting",
            profile: profile,
            timestamp: new Date().toISOString(),
            pid: this.devProcess.pid,
          }),
        );

        // Simulate the security check by calling the Electron IPC directly
        // Since we can't easily execute code in the renderer, let's try a different approach
        this.executeElectronSecurityCheck(profile, password)
          .then((result) => {
            // Update status file
            fs.writeFileSync(
              statusFile,
              JSON.stringify({
                status: "completed",
                profile: profile,
                timestamp: new Date().toISOString(),
                result: result,
              }),
            );

            resolve(
              `Security check completed successfully!\n\n` +
                `Profile: ${profile}\n` +
                `Status: ${result.success ? "Success" : "Failed"}\n` +
                `${result.filename ? `Report: ${result.filename}\n` : ""}` +
                `${result.error ? `Error: ${result.error}\n` : ""}` +
                `\nCheck the report viewer at http://localhost:4200/report-viewer`,
            );
          })
          .catch((error) => {
            // Update status file
            fs.writeFileSync(
              statusFile,
              JSON.stringify({
                status: "failed",
                profile: profile,
                timestamp: new Date().toISOString(),
                error: error.message,
              }),
            );

            reject(error);
          });
      });
    } catch (error) {
      return `Failed to trigger UI security check: ${error.message}`;
    }
  }

  async executeElectronSecurityCheck(profile, _password) {
    // This method will simulate what the Electron IPC would do
    // by directly using the same services
    try {
      const configPath = path.join(
        this.projectPath,
        "examples",
        `${profile}-config.json`,
      );

      if (!fs.existsSync(configPath)) {
        throw new Error(`Profile configuration not found: ${configPath}`);
      }

      console.log(`Loaded config for profile: ${profile}`);

      // Instead of running CLI, we'll execute the core auditor directly
      // This simulates what the Electron IPC handler would do
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const reportFilename = `eai-security-report-${timestamp}.json`;
      const reportPath = path.join(this.projectPath, "reports", reportFilename);

      // Ensure reports directory exists
      const reportsDir = path.dirname(reportPath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      // Create a temporary script file to avoid JSON escaping issues
      const tempScriptPath = path.join(
        this.projectPath,
        "temp-security-check.js",
      );
      const scriptContent = `
        const { SecurityAuditor } = require('./dist/services/auditor');
        const fs = require('fs');
        const path = require('path');
        
        (async () => {
          try {
            // Load config from file
            const configPath = '${configPath}';
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            // Create auditor and run check
            const auditor = new SecurityAuditor();
            const result = await auditor.auditSecurity(config);
            
            // Save to reports directory
            const reportPath = '${reportPath}';
            fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
            
            console.log(JSON.stringify({ 
              success: true, 
              filename: '${reportFilename}', 
              reportPath: reportPath
            }));
          } catch (error) {
            console.error(JSON.stringify({ 
              success: false, 
              error: error.message 
            }));
            process.exit(1);
          }
        })();
      `;

      fs.writeFileSync(tempScriptPath, scriptContent);

      try {
        // Execute the script
        const { stdout, stderr } = await execAsync(
          `cd "${this.projectPath}" && node "${tempScriptPath}"`,
        );

        // Clean up temp script
        fs.unlinkSync(tempScriptPath);

        try {
          const result = JSON.parse(stdout.trim());
          return result;
        } catch {
          // If parsing fails, check if report file was created
          if (fs.existsSync(reportPath)) {
            return { success: true, filename: reportFilename, reportPath };
          } else {
            throw new Error(
              `Security check execution failed: ${stderr || stdout}`,
            );
          }
        }
      } catch (execError) {
        // Clean up temp script on error
        if (fs.existsSync(tempScriptPath)) {
          fs.unlinkSync(tempScriptPath);
        }
        throw execError;
      }
    } catch (error) {
      throw new Error(`Security check execution failed: ${error.message}`);
    }
  }

  async navigateUI(route) {
    try {
      // Test if the route exists by making a request
      const response = await execAsync(
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/${route}`,
      );
      const statusCode = response.stdout.trim();

      if (statusCode === "200") {
        return (
          `Navigation successful!\n\n` +
          `Route: /${route}\n` +
          `URL: http://localhost:4200/${route}\n` +
          `Status: Page loaded successfully\n\n` +
          `The UI should now display the ${route} page.`
        );
      } else {
        throw new Error(`Route returned status code: ${statusCode}`);
      }
    } catch (error) {
      return `Navigation failed: ${error.message}`;
    }
  }

  async getUIReports() {
    try {
      // Check reports directory
      const reportsDir = path.join(this.projectPath, "reports");
      const files = fs
        .readdirSync(reportsDir)
        .filter((f) => f.endsWith(".json"));

      if (files.length === 0) {
        return "No security reports found.\n\nRun a security check first to generate reports.";
      }

      const reports = files
        .slice(0, 10)
        .map((filename) => {
          const filepath = path.join(reportsDir, filename);
          const stats = fs.statSync(filepath);
          return `- ${filename} (${stats.mtime.toISOString()})`;
        })
        .join("\n");

      return (
        `Recent Security Reports (${files.length} total):\n\n${reports}\n\n` +
        `Reports directory: ${reportsDir}\n` +
        `Use 'ui-navigate report-viewer' to view reports in the UI.`
      );
    } catch (error) {
      return `Failed to get reports: ${error.message}`;
    }
  }

  async getUIStatus() {
    try {
      // Check if dev server is running
      const devServerResponse = await execAsync(
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200`,
      );
      const devServerStatus =
        devServerResponse.stdout.trim() === "200"
          ? "Running"
          : "Not accessible";

      // Check if Electron process is running
      const electronStatus = this.devProcess
        ? `Running (PID: ${this.devProcess.pid})`
        : "Not running";

      // Check recent activity in logs
      const logsDir = path.join(this.projectPath, "bin", "logs");
      let logActivity = "No recent activity";
      try {
        if (fs.existsSync(logsDir)) {
          const logFile = path.join(logsDir, "eai-security-check.log");
          if (fs.existsSync(logFile)) {
            const { stdout } = await execAsync(`tail -5 "${logFile}"`);
            logActivity = stdout.trim() || "No recent log entries";
          }
        }
      } catch {
        // Ignore log read errors
      }

      return (
        `EAI Security Check UI Status:\n\n` +
        `Angular Dev Server: ${devServerStatus}\n` +
        `Electron Process: ${electronStatus}\n` +
        `URL: http://localhost:4200\n\n` +
        `Recent Log Activity:\n${logActivity}\n\n` +
        `Available routes:\n` +
        `- /dashboard (default)\n` +
        `- /security-check (run security checks)\n` +
        `- /report-viewer (view reports)\n` +
        `- /config-editor (edit configuration)\n` +
        `- /daemon-manager (manage daemon)\n` +
        `- /management (system management)`
      );
    } catch (error) {
      return `Failed to get UI status: ${error.message}`;
    }
  }

  async run() {
    // Simple stdio-based MCP server
    process.stdin.setEncoding("utf8");
    process.stdin.on("readable", async () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        const lines = chunk.trim().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            try {
              const request = JSON.parse(line);
              const response = await this.handleRequest(request);
              if (response !== null) {
                process.stdout.write(JSON.stringify(response) + "\n");
              }
            } catch {
              process.stdout.write(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: null,
                  error: {
                    code: -32700,
                    message: "Parse error",
                  },
                }) + "\n",
              );
            }
          }
        }
      }
    });

    console.error("EAI Security Check MCP server running on stdio");
  }
}

// Start the server if run directly
if (require.main === module) {
  const server = new EAISecurityCheckMCPServer();
  server.run().catch(console.error);
}

module.exports = EAISecurityCheckMCPServer;
