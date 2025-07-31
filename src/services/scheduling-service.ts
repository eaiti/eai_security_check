import * as cron from 'node-cron';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SecurityAuditor } from './auditor';
import { SecurityConfig, SchedulingConfig, DaemonState } from '../types';
import { OutputUtils, OutputFormat } from '../utils/output-utils';
import { PlatformDetector, Platform } from '../utils/platform-detector';
import { VersionUtils } from '../utils/version-utils';

const execAsync = promisify(exec);

/**
 * SchedulingService handles the daemon mode for automated security checks
 */
export class SchedulingService {
  private config: SchedulingConfig;
  private stateFilePath: string;
  private lockFilePath: string;
  private isShuttingDown = false;
  private currentJob?: cron.ScheduledTask;
  private versionCheckInterval?: NodeJS.Timeout;
  private securityConfigPath?: string;

  constructor(configPath?: string, stateFilePath?: string, securityConfigPath?: string) {
    this.stateFilePath = stateFilePath || path.resolve('./daemon-state.json');
    this.lockFilePath = path.resolve('./daemon.lock');
    this.securityConfigPath = securityConfigPath;
    this.config = this.loadSchedulingConfig(configPath);
  }

  /**
   * Load scheduling configuration from file
   */
  private loadSchedulingConfig(configPath?: string): SchedulingConfig {
    const defaultPath = path.resolve('./scheduling-config.json');
    const resolvedPath = configPath || defaultPath;

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Scheduling configuration not found: ${resolvedPath}`);
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const config = JSON.parse(content) as SchedulingConfig;

      // Validate required fields
      if (!config.email?.smtp?.host || !config.email?.to?.length) {
        throw new Error('Invalid scheduling configuration: missing email settings');
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to load scheduling configuration: ${error}`);
    }
  }

  /**
   * Load daemon state from file
   */
  private loadDaemonState(): DaemonState {
    if (!fs.existsSync(this.stateFilePath)) {
      // Create initial state
      const initialState: DaemonState = {
        lastReportSent: '',
        totalReportsGenerated: 0,
        daemonStarted: new Date().toISOString(),
        currentVersion: VersionUtils.getCurrentVersion(),
        lastVersionCheck: new Date().toISOString()
      };
      this.saveDaemonState(initialState);
      return initialState;
    }

    try {
      const content = fs.readFileSync(this.stateFilePath, 'utf-8');
      const state = JSON.parse(content) as DaemonState;

      // Update version info if not present or different
      const currentVersion = VersionUtils.getCurrentVersion();
      if (!state.currentVersion || state.currentVersion !== currentVersion) {
        state.currentVersion = currentVersion;
        state.lastVersionCheck = new Date().toISOString();
        this.saveDaemonState(state);
      }

      return state;
    } catch (error) {
      console.error('Failed to load daemon state, creating new:', error);
      const newState: DaemonState = {
        lastReportSent: '',
        totalReportsGenerated: 0,
        daemonStarted: new Date().toISOString(),
        currentVersion: VersionUtils.getCurrentVersion(),
        lastVersionCheck: new Date().toISOString()
      };
      this.saveDaemonState(newState);
      return newState;
    }
  }

  /**
   * Save daemon state to file
   */
  private saveDaemonState(state: DaemonState): void {
    try {
      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Failed to save daemon state:', error);
    }
  }

  /**
   * Check if a report should be sent based on the last sent time
   */
  private shouldSendReport(state: DaemonState): boolean {
    if (!state.lastReportSent) {
      return true; // Never sent a report
    }

    const lastSent = new Date(state.lastReportSent);
    const now = new Date();
    const daysSinceLastReport = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceLastReport >= this.config.intervalDays;
  }

  /**
   * Load security configuration for checks
   */
  private loadSecurityConfig(): SecurityConfig {
    // Priority: 1. Explicit security config path, 2. Custom config path from schedule config, 3. Profile
    if (this.securityConfigPath) {
      // Use explicit security config file from command line
      const content = fs.readFileSync(this.securityConfigPath, 'utf-8');
      return JSON.parse(content);
    } else if (this.config.customConfigPath) {
      // Use custom config file from schedule config
      const content = fs.readFileSync(this.config.customConfigPath, 'utf-8');
      return JSON.parse(content);
    } else {
      // Use profile-based config (reuse logic from index.ts)
      return this.getConfigByProfile(this.config.securityProfile);
    }
  }

  /**
   * Generate security config by profile (copied from index.ts)
   */
  private getConfigByProfile(profile: string): SecurityConfig {
    const baseConfig = {
      filevault: { enabled: true },
      packageVerification: { enabled: true },
      systemIntegrityProtection: { enabled: true }
    };

    switch (profile) {
      case 'strict':
        return {
          ...baseConfig,
          passwordProtection: {
            enabled: true,
            requirePasswordImmediately: true
          },
          password: {
            required: false,
            minLength: 8,
            requireUppercase: false,
            requireLowercase: false,
            requireNumber: false,
            requireSpecialChar: false,
            maxAgeDays: 180
          },
          autoLock: { maxTimeoutMinutes: 3 },
          firewall: { enabled: true, stealthMode: true },
          remoteLogin: { enabled: false },
          remoteManagement: { enabled: false },
          automaticUpdates: { enabled: true, securityUpdatesOnly: true },
          sharingServices: {
            fileSharing: false,
            screenSharing: false,
            remoteLogin: false
          }
        };

      case 'relaxed':
        return {
          ...baseConfig,
          passwordProtection: {
            enabled: true,
            requirePasswordImmediately: false
          },
          password: {
            required: false,
            minLength: 8,
            requireUppercase: false,
            requireLowercase: false,
            requireNumber: false,
            requireSpecialChar: false,
            maxAgeDays: 180
          },
          autoLock: { maxTimeoutMinutes: 15 },
          firewall: { enabled: true, stealthMode: false },
          remoteLogin: { enabled: false },
          remoteManagement: { enabled: false },
          automaticUpdates: { enabled: true },
          sharingServices: {
            fileSharing: false,
            screenSharing: false,
            remoteLogin: false
          }
        };

      default: // 'default' profile
        return {
          ...baseConfig,
          passwordProtection: {
            enabled: true,
            requirePasswordImmediately: true
          },
          password: {
            required: false,
            minLength: 8,
            requireUppercase: false,
            requireLowercase: false,
            requireNumber: false,
            requireSpecialChar: false,
            maxAgeDays: 180
          },
          autoLock: { maxTimeoutMinutes: 7 },
          firewall: { enabled: true, stealthMode: true },
          remoteLogin: { enabled: false },
          remoteManagement: { enabled: false },
          automaticUpdates: { enabled: true, securityUpdatesOnly: true },
          sharingServices: {
            fileSharing: false,
            screenSharing: false,
            remoteLogin: false
          }
        };
    }
  }

  /**
   * Run security check and send email if needed
   */
  async runScheduledCheck(): Promise<void> {
    console.log(`[${new Date().toISOString()}] Running scheduled security check...`);

    try {
      const state = this.loadDaemonState();

      if (!this.shouldSendReport(state)) {
        const lastSent = new Date(state.lastReportSent);
        const nextCheck = new Date(
          lastSent.getTime() + this.config.intervalDays * 24 * 60 * 60 * 1000
        );
        console.log(`Report not due yet. Next report scheduled for: ${nextCheck.toLocaleString()}`);
        return;
      }

      // Check platform compatibility
      const platformInfo = await PlatformDetector.detectPlatform();
      if (!platformInfo.isSupported) {
        console.error('Platform not supported for security checks');
        return;
      }

      // Load security configuration
      const securityConfig = this.loadSecurityConfig();

      // Run security audit
      const auditor = new SecurityAuditor();
      const report = await auditor.generateReport(securityConfig);
      const auditResult = await auditor.auditSecurity(securityConfig);

      // Format report for email
      const reportMetadata = {
        platform: platformInfo.platform,
        timestamp: new Date().toISOString(),
        overallPassed: auditResult.overallPassed,
        ...(this.config.userId && { userId: this.config.userId })
      };

      const formattedOutput = OutputUtils.formatReport(
        report,
        this.config.reportFormat as OutputFormat,
        reportMetadata
      );

      // Send email
      await this.sendEmailReport(formattedOutput.content, auditResult.overallPassed);

      // Send via SCP if configured
      if (this.config.scp?.enabled) {
        try {
          await this.sendScpReport(
            formattedOutput.content,
            auditResult.overallPassed,
            reportMetadata
          );
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Failed to send report via SCP:`, error);
          // Don't fail the entire process if SCP fails, just log the error
        }
      }

      // Update state
      state.lastReportSent = new Date().toISOString();
      state.totalReportsGenerated++;
      this.saveDaemonState(state);

      console.log(
        `[${new Date().toISOString()}] Security report sent successfully. Overall status: ${auditResult.overallPassed ? 'PASSED' : 'FAILED'}`
      );
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error running scheduled check:`, error);
    }
  }

  /**
   * Send email report using nodemailer
   */
  private async sendEmailReport(reportContent: string, overallPassed: boolean): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.email.smtp.host,
      port: this.config.email.smtp.port,
      secure: this.config.email.smtp.secure,
      auth: {
        user: this.config.email.smtp.auth.user,
        pass: this.config.email.smtp.auth.pass
      }
    });

    const userIdPrefix = this.config.userId ? `[${this.config.userId}] ` : '';
    const subject =
      this.config.email.subject ||
      `${userIdPrefix}Security Audit Report - ${overallPassed ? 'PASSED' : 'FAILED'} - ${new Date().toLocaleDateString()}`;

    const mailOptions = {
      from: this.config.email.from,
      to: this.config.email.to.join(', '),
      subject: subject,
      text: reportContent,
      html: this.config.reportFormat === 'email' ? this.convertToHtml(reportContent) : undefined
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to: ${this.config.email.to.join(', ')}`);
    } catch (error) {
      throw new Error(`Failed to send email: ${error}`);
    }
  }

  /**
   * Convert report content to HTML for better email formatting
   */
  private convertToHtml(content: string): string {
    // Simple conversion - replace newlines with <br> and wrap in <pre> for formatting
    return `<html><body><pre style="font-family: monospace; font-size: 12px;">${content.replace(/\n/g, '<br>')}</pre></body></html>`;
  }

  /**
   * Send report via SCP to remote server
   */
  private async sendScpReport(
    reportContent: string,
    overallPassed: boolean,
    _reportMetadata: any
  ): Promise<void> {
    if (!this.config.scp?.enabled) {
      return;
    }

    const scpConfig = this.config.scp;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const userIdPrefix = this.config.userId
      ? `${this.config.userId.replace(/[^a-zA-Z0-9]/g, '_')}-`
      : '';
    const status = overallPassed ? 'PASSED' : 'FAILED';
    const filename = `${userIdPrefix}security-report-${status}-${timestamp}.txt`;

    // Create temporary file
    const tempDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, filename);

    try {
      // Write report to temporary file
      fs.writeFileSync(tempFilePath, reportContent);

      // Build SCP command
      const port = scpConfig.port || 22;
      const remoteDestination = `${scpConfig.username}@${scpConfig.host}:${scpConfig.destinationDirectory}/${filename}`;

      let scpCommand: string;

      if (scpConfig.authMethod === 'key' && scpConfig.privateKeyPath) {
        // Key-based authentication
        scpCommand = `scp -P ${port} -i "${scpConfig.privateKeyPath}" -o StrictHostKeyChecking=no "${tempFilePath}" "${remoteDestination}"`;
      } else if (scpConfig.authMethod === 'password' && scpConfig.password) {
        // Password authentication using sshpass
        scpCommand = `sshpass -p "${scpConfig.password}" scp -P ${port} -o StrictHostKeyChecking=no "${tempFilePath}" "${remoteDestination}"`;
      } else {
        throw new Error('Invalid SCP configuration: missing authentication credentials');
      }

      console.log(
        `[${new Date().toISOString()}] Transferring report via SCP to ${scpConfig.host}:${scpConfig.destinationDirectory}/`
      );

      // Execute SCP command
      const { stderr } = await execAsync(scpCommand);

      if (stderr && !stderr.includes('Warning:')) {
        console.warn(`SCP stderr: ${stderr}`);
      }

      console.log(
        `[${new Date().toISOString()}] Report successfully transferred via SCP: ${filename}`
      );
    } catch (error) {
      console.error(`SCP transfer failed:`, error);
      throw error;
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup temporary file: ${tempFilePath}`, cleanupError);
        }
      }
    }
  }

  /**
   * Start the daemon with cron scheduling
   */
  async startDaemon(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Scheduling is disabled in configuration');
      return;
    }

    // Check for and create daemon lock to prevent multiple instances
    if (!VersionUtils.createDaemonLock(this.lockFilePath)) {
      console.error('❌ Another daemon instance is already running or failed to create lock file');
      console.log('💡 Use "eai-security-check daemon --status" to check daemon status');
      process.exit(1);
    }

    console.log(`Starting EAI Security Check daemon v${VersionUtils.getCurrentVersion()}...`);
    console.log(`Check interval: every ${this.config.intervalDays} days`);
    console.log(`Email recipients: ${this.config.email.to.join(', ')}`);
    console.log(`Security profile: ${this.config.securityProfile}`);

    const state = this.loadDaemonState();
    console.log(
      `Daemon state: ${state.totalReportsGenerated} reports sent, last report: ${state.lastReportSent || 'never'}`
    );

    // Check for newer versions on startup
    console.log('🔍 Checking for newer versions...');
    await this.checkForNewerVersions();

    // Set up graceful shutdown
    process.on('SIGINT', async () => await this.shutdown('SIGINT'));
    process.on('SIGTERM', async () => await this.shutdown('SIGTERM'));
    process.on('exit', () => {
      VersionUtils.removeDaemonLock(this.lockFilePath);
    });

    // Check immediately on startup if report is due
    if (this.shouldSendReport(state)) {
      console.log('Report is due, running initial check...');
      await this.runScheduledCheck();
    }

    // Schedule to run daily at 9 AM (but only send reports based on interval)
    this.currentJob = cron.schedule('0 9 * * *', async () => {
      if (!this.isShuttingDown) {
        await this.runScheduledCheck();
      }
    });

    // Check for newer versions every hour
    this.versionCheckInterval = setInterval(
      async () => {
        if (!this.isShuttingDown) {
          await this.checkForNewerVersions();
        }
      },
      60 * 60 * 1000
    ); // Every hour

    console.log('Daemon started successfully. Scheduled to check daily at 9:00 AM.');
    console.log('🔄 Version checks will run hourly to detect newer versions.');
    console.log('Press Ctrl+C to stop the daemon.');

    // Keep the process running
    this.keepAlive();
  }

  /**
   * Check for newer versions and potentially yield control
   */
  private async checkForNewerVersions(): Promise<void> {
    try {
      const yieldCheck = await VersionUtils.shouldYieldToNewerVersion();

      if (yieldCheck.shouldYield) {
        console.log(`⬆️  ${yieldCheck.reason}`);
        console.log('🔄 Gracefully shutting down to allow newer version to take over...');

        // Update state with version check timestamp
        const state = this.loadDaemonState();
        state.lastVersionCheck = new Date().toISOString();
        this.saveDaemonState(state);

        // Shutdown gracefully
        await this.shutdown('VERSION_UPGRADE');
        return;
      }

      // Update version check timestamp
      const state = this.loadDaemonState();
      state.lastVersionCheck = new Date().toISOString();
      this.saveDaemonState(state);
    } catch (error) {
      console.warn('Warning: Version check failed:', error);
    }
  }

  /**
   * Keep the daemon process alive
   */
  private keepAlive(): void {
    const keepAliveInterval = setInterval(() => {
      if (this.isShuttingDown) {
        clearInterval(keepAliveInterval);
      }
    }, 60000); // Check every minute
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(signal: string): Promise<void> {
    console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down gracefully...`);
    this.isShuttingDown = true;

    if (this.currentJob) {
      this.currentJob.stop();
      console.log('Stopped scheduled tasks');
    }

    if (this.versionCheckInterval) {
      clearInterval(this.versionCheckInterval);
      console.log('Stopped version checking');
    }

    // Clean up daemon lock
    VersionUtils.removeDaemonLock(this.lockFilePath);
    console.log('Removed daemon lock');

    console.log('Daemon stopped');
    process.exit(signal === 'VERSION_UPGRADE' ? 0 : 0);
  }

  /**
   * Get current daemon status
   */
  getDaemonStatus(): { running: boolean; state: DaemonState; config: SchedulingConfig } {
    const state = this.loadDaemonState();
    return {
      running: !this.isShuttingDown,
      state,
      config: this.config
    };
  }

  /**
   * Stop a running daemon by sending SIGTERM to the process
   */
  static async stopDaemon(lockFilePath?: string): Promise<{ success: boolean; message: string }> {
    const resolvedLockPath = lockFilePath || path.resolve('./daemon.lock');

    try {
      if (!fs.existsSync(resolvedLockPath)) {
        return {
          success: false,
          message: 'No daemon lock file found. Daemon may not be running.'
        };
      }

      const lockContent = fs.readFileSync(resolvedLockPath, 'utf-8');
      const lockInfo = JSON.parse(lockContent);

      // Check if process is still running first
      try {
        process.kill(lockInfo.pid, 0);
      } catch (error) {
        // Process doesn't exist, clean up stale lock file
        fs.unlinkSync(resolvedLockPath);
        return {
          success: false,
          message: 'Daemon process not found. Cleaned up stale lock file.'
        };
      }

      // Send SIGTERM to gracefully shutdown the daemon
      console.log(`Sending shutdown signal to daemon process ${lockInfo.pid}...`);
      process.kill(lockInfo.pid, 'SIGTERM');

      // Wait for the process to shutdown and lock file to be removed
      let attempts = 0;
      const maxAttempts = 30; // Wait up to 30 seconds

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;

        try {
          // Check if process is still running
          process.kill(lockInfo.pid, 0);

          // Process still running, continue waiting
          if (attempts % 5 === 0) {
            console.log(`Waiting for daemon to shutdown... (${attempts}s)`);
          }
        } catch (error) {
          // Process has stopped
          // Clean up lock file if it still exists
          if (fs.existsSync(resolvedLockPath)) {
            fs.unlinkSync(resolvedLockPath);
          }

          return {
            success: true,
            message: `Daemon stopped successfully after ${attempts} seconds.`
          };
        }
      }

      // If we get here, the process didn't shutdown gracefully
      console.log('Daemon did not respond to graceful shutdown, forcing termination...');
      try {
        process.kill(lockInfo.pid, 'SIGKILL');

        // Clean up lock file
        if (fs.existsSync(resolvedLockPath)) {
          fs.unlinkSync(resolvedLockPath);
        }

        return {
          success: true,
          message: 'Daemon forcefully terminated after timeout.'
        };
      } catch (killError) {
        return {
          success: false,
          message: `Failed to stop daemon: ${killError}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error stopping daemon: ${error}`
      };
    }
  }

  /**
   * Restart the daemon (stop current instance and start a new one)
   */
  static async restartDaemon(
    configPath?: string,
    stateFilePath?: string,
    securityConfigPath?: string
  ): Promise<{ success: boolean; message: string }> {
    console.log('🔄 Restarting daemon...');

    // First, stop the current daemon
    const stopResult = await this.stopDaemon();
    if (!stopResult.success && !stopResult.message.includes('not running')) {
      return {
        success: false,
        message: `Failed to stop current daemon: ${stopResult.message}`
      };
    }

    console.log('✅ Current daemon stopped');

    // Wait a moment to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Start a new daemon instance
      console.log('🚀 Starting new daemon instance...');
      const newService = new SchedulingService(configPath, stateFilePath, securityConfigPath);
      await newService.startDaemon();

      return {
        success: true,
        message: 'Daemon restarted successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to start new daemon: ${error}`
      };
    }
  }

  /**
   * Uninstall daemon and clean up all related files
   */
  static async uninstallDaemon(
    options: {
      configPath?: string;
      stateFilePath?: string;
      removeExecutable?: boolean;
      force?: boolean;
    } = {}
  ): Promise<{ success: boolean; message: string; removedFiles: string[] }> {
    const removedFiles: string[] = [];
    const messages: string[] = [];

    try {
      // Stop daemon if running
      console.log('🛑 Stopping daemon...');
      const stopResult = await this.stopDaemon();
      if (stopResult.success) {
        messages.push('Daemon stopped successfully');
      } else if (
        !stopResult.message.includes('not running') &&
        !stopResult.message.includes('not found') &&
        !stopResult.message.includes('may not be running')
      ) {
        if (!options.force) {
          return {
            success: false,
            message: `Cannot uninstall: ${stopResult.message}. Use --force to override.`,
            removedFiles
          };
        } else {
          messages.push(`Warning: ${stopResult.message}`);
        }
      }

      // Remove daemon state file
      const stateFile = options.stateFilePath || path.resolve('./daemon-state.json');
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
        removedFiles.push(stateFile);
        messages.push('Removed daemon state file');
      }

      // Remove scheduling config file
      const configFile = options.configPath || path.resolve('./scheduling-config.json');
      if (fs.existsSync(configFile)) {
        if (options.force) {
          fs.unlinkSync(configFile);
          removedFiles.push(configFile);
          messages.push('Removed scheduling configuration file');
        } else {
          messages.push(`Scheduling config preserved: ${configFile} (use --force to remove)`);
        }
      }

      // Remove lock file if it exists
      const lockFile = path.resolve('./daemon.lock');
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        removedFiles.push(lockFile);
        messages.push('Removed daemon lock file');
      }

      // Remove executable if requested
      if (options.removeExecutable && options.force) {
        try {
          const executablePath = process.argv[0];
          if (
            fs.existsSync(executablePath) &&
            path.basename(executablePath).includes('eai-security-check')
          ) {
            fs.unlinkSync(executablePath);
            removedFiles.push(executablePath);
            messages.push('Removed executable file');
          }
        } catch (error) {
          messages.push(`Warning: Could not remove executable: ${error}`);
        }
      } else if (options.removeExecutable) {
        messages.push('Use --force with --remove-executable to actually remove the executable');
      }

      return {
        success: true,
        message: messages.join('\n'),
        removedFiles
      };
    } catch (error) {
      return {
        success: false,
        message: `Error during uninstall: ${error}`,
        removedFiles
      };
    }
  }

  /**
   * Get platform-specific daemon setup information
   */
  static getDaemonPlatformInfo(): {
    platform: string;
    supportsScheduling: boolean;
    supportsRestart: boolean;
    supportsAutoStart: boolean;
    setupInstructions: string[];
    limitations: string[];
  } {
    const platform = PlatformDetector.getSimplePlatform();
    
    switch (platform) {
      case Platform.WINDOWS:
        return {
          platform: 'Windows',
          supportsScheduling: true,
          supportsRestart: true,
          supportsAutoStart: false, // Would require Windows Service setup
          setupInstructions: [
            'Daemon runs as a Node.js process with cron-based scheduling',
            'Manual restart supported via "eai-security-check daemon --restart"',
            'For auto-start on boot, consider using Windows Task Scheduler',
            'See daemon-examples/windows-task-scheduler.ps1 for setup script'
          ],
          limitations: [
            'Does not automatically start on system boot (requires manual setup)',
            'Runs as user process, not Windows Service',
            'Requires manual restart if system reboots'
          ]
        };
      
      case Platform.MACOS:
        return {
          platform: 'macOS',
          supportsScheduling: true,
          supportsRestart: true,
          supportsAutoStart: false, // Would require launchd plist
          setupInstructions: [
            'Daemon runs as a Node.js process with cron-based scheduling',
            'Manual restart supported via "eai-security-check daemon --restart"',
            'For auto-start on boot, create a launchd plist file',
            'See daemon-examples/com.eai.security-check.plist for template'
          ],
          limitations: [
            'Does not automatically start on system boot (requires launchd setup)',
            'Runs as user process, not system daemon',
            'Requires manual restart if system reboots'
          ]
        };
      
      case Platform.LINUX:
        return {
          platform: 'Linux',
          supportsScheduling: true,
          supportsRestart: true,
          supportsAutoStart: false, // Would require systemd service
          setupInstructions: [
            'Daemon runs as a Node.js process with cron-based scheduling',
            'Manual restart supported via "eai-security-check daemon --restart"',
            'For auto-start on boot, create a systemd service unit',
            'See daemon-examples/eai-security-check.service for template'
          ],
          limitations: [
            'Does not automatically start on system boot (requires systemd setup)',
            'Runs as user process, not system service',
            'Requires manual restart if system reboots'
          ]
        };
      
      default:
        return {
          platform: 'Unknown',
          supportsScheduling: false,
          supportsRestart: false,
          supportsAutoStart: false,
          setupInstructions: ['Platform not supported'],
          limitations: ['Daemon functionality not available on this platform']
        };
    }
  }
}
