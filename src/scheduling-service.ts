import * as cron from 'node-cron';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityAuditor } from './auditor';
import { SecurityConfig, SchedulingConfig, DaemonState } from './types';
import { OutputUtils, OutputFormat } from './output-utils';
import { PlatformDetector } from './platform-detector';
import { VersionUtils } from './version-utils';

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

  constructor(configPath?: string, stateFilePath?: string) {
    this.stateFilePath = stateFilePath || path.resolve('./daemon-state.json');
    this.lockFilePath = path.resolve('./daemon.lock');
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
    if (this.config.customConfigPath) {
      // Use custom config file
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
        const nextCheck = new Date(lastSent.getTime() + (this.config.intervalDays * 24 * 60 * 60 * 1000));
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
      const formattedOutput = OutputUtils.formatReport(report, this.config.reportFormat as OutputFormat, {
        platform: platformInfo.platform,
        timestamp: new Date().toISOString(),
        overallPassed: auditResult.overallPassed
      });

      // Send email
      await this.sendEmailReport(formattedOutput.content, auditResult.overallPassed);

      // Update state
      state.lastReportSent = new Date().toISOString();
      state.totalReportsGenerated++;
      this.saveDaemonState(state);

      console.log(`[${new Date().toISOString()}] Security report sent successfully. Overall status: ${auditResult.overallPassed ? 'PASSED' : 'FAILED'}`);

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

    const subject = this.config.email.subject || 
      `Security Audit Report - ${overallPassed ? 'PASSED' : 'FAILED'} - ${new Date().toLocaleDateString()}`;

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
    console.log(`Daemon state: ${state.totalReportsGenerated} reports sent, last report: ${state.lastReportSent || 'never'}`);

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
    this.versionCheckInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.checkForNewerVersions();
      }
    }, 60 * 60 * 1000); // Every hour

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
}