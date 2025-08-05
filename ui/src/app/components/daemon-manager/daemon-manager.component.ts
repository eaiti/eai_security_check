import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService, ConfigData, DaemonConfig } from '../../services/electron.service';

interface DaemonStatus {
  running: boolean;
  schedule?: string;
  nextRun?: string;
  lastRun?: string;
  config?: ConfigData;
}

@Component({
  selector: 'app-daemon-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="daemon-manager-container">
      <div class="header">
        <h1>🔄 Daemon Manager</h1>
        <p>Configure and manage automated security check scheduling</p>
      </div>

      <div class="status-card">
        <h2>Current Status</h2>
        @if (status()) {
          <div class="status-info">
            <div class="status-item">
              <span class="label">Status:</span>
              <span
                class="value"
                [class]="
                  'status-' + (status()!.running ? 'running' : 'stopped')
                "
              >
                {{ status()!.running ? '🟢 Running' : '🔴 Stopped' }}
              </span>
            </div>
            @if (status()!.schedule) {
              <div class="status-item">
                <span class="label">Schedule:</span>
                <span class="value">{{ status()!.schedule }}</span>
              </div>
            }
            @if (status()!.nextRun) {
              <div class="status-item">
                <span class="label">Next Run:</span>
                <span class="value">{{ formatDate(status()!.nextRun!) }}</span>
              </div>
            }
            @if (status()!.lastRun) {
              <div class="status-item">
                <span class="label">Last Run:</span>
                <span class="value">{{ formatDate(status()!.lastRun!) }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="loading">Loading daemon status...</div>
        }
      </div>

      <div class="controls">
        <div class="control-buttons">
          <button
            class="btn btn-primary"
            [disabled]="isOperating()"
            (click)="startDaemon()"
          >
            ▶️ Start Daemon
          </button>

          <button
            class="btn btn-secondary"
            [disabled]="isOperating()"
            (click)="stopDaemon()"
          >
            ⏹️ Stop Daemon
          </button>

          <button
            class="btn btn-secondary"
            [disabled]="isOperating()"
            (click)="refreshStatus()"
          >
            🔄 Refresh Status
          </button>
        </div>
      </div>

      <div class="configuration">
        <h2>Daemon Configuration</h2>

        <div class="config-form">
          <div class="form-group">
            <label for="intervalDays">Check Interval (Days)</label>
            <input
              type="number"
              id="intervalDays"
              [(ngModel)]="intervalDaysInput"
              placeholder="7"
              min="1"
              max="365"
              class="form-control"
            />
            <small class="help-text"
              >How often to run security checks (e.g., 7 for weekly)</small
            >
          </div>

          <div class="form-group">
            <label for="profile">Security Profile</label>
            <select
              id="profile"
              [(ngModel)]="profileInput"
              class="form-control"
            >
              <option value="default">Default Profile</option>
              <option value="strict">Strict Profile</option>
              <option value="relaxed">Relaxed Profile</option>
              <option value="developer">Developer Profile</option>
              <option value="eai">EAI Profile</option>
            </select>
          </div>

          <div class="form-group">
            <label for="userId">User ID</label>
            <input
              type="text"
              id="userId"
              [(ngModel)]="userIdInput"
              placeholder="admin-workstation"
              class="form-control"
            />
            <small class="help-text"
              >Identifier included in reports and emails</small
            >
          </div>

          <div class="form-group">
            <label for="intervalDays">Check Interval (Days)</label>
            <input
              type="number"
              id="intervalDays"
              [(ngModel)]="intervalDaysInput"
              min="1"
              max="365"
              placeholder="7"
              class="form-control"
            />
            <small class="help-text"
              >How often to run security checks (1-365 days)</small
            >
          </div>

          <div class="form-group">
            <label for="reportFormat">Report Format</label>
            <select
              id="reportFormat"
              [(ngModel)]="reportFormatInput"
              class="form-control"
            >
              <option value="email">Email (HTML)</option>
              <option value="plain">Plain Text</option>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div class="form-group">
            <label for="email">Email Notifications</label>
            <input
              type="email"
              id="email"
              [(ngModel)]="emailInput"
              placeholder="admin@company.com"
              class="form-control"
            />
            <small class="help-text"
              >Email address for security report notifications</small
            >
          </div>

          <!-- SMTP Configuration (expandable) -->
          <div class="form-group">
            <div class="collapsible-section">
              <button
                type="button"
                class="btn btn-link collapsible-toggle"
                (click)="toggleSmtpSection()"
              >
                📧 SMTP Configuration
                <span class="toggle-icon">{{
                  showSmtpConfig() ? '−' : '+'
                }}</span>
              </button>
              
              @if (showSmtpConfig()) {
                <div class="collapsible-content">
                  <div class="form-row">
                    <div class="form-group half-width">
                      <label for="smtpHost">SMTP Host</label>
                      <input
                        type="text"
                        id="smtpHost"
                        [(ngModel)]="smtpHostInput"
                        placeholder="smtp.gmail.com"
                        class="form-control"
                      />
                    </div>
                    <div class="form-group half-width">
                      <label for="smtpPort">Port</label>
                      <input
                        type="number"
                        id="smtpPort"
                        [(ngModel)]="smtpPortInput"
                        placeholder="587"
                        class="form-control"
                      />
                    </div>
                  </div>
                  
                  <div class="form-row">
                    <div class="form-group half-width">
                      <label for="smtpUser">Username</label>
                      <input
                        type="text"
                        id="smtpUser"
                        [(ngModel)]="smtpUserInput"
                        placeholder="your-email@gmail.com"
                        class="form-control"
                      />
                    </div>
                    <div class="form-group half-width">
                      <label for="smtpPass">Password</label>
                      <input
                        type="password"
                        id="smtpPass"
                        [(ngModel)]="smtpPassInput"
                        placeholder="app-password"
                        class="form-control"
                      />
                    </div>
                  </div>
                  
                  <div class="form-row">
                    <div class="form-group half-width">
                      <label for="emailFrom">From Address</label>
                      <input
                        type="email"
                        id="emailFrom"
                        [(ngModel)]="emailFromInput"
                        placeholder="EAI Security <security@company.com>"
                        class="form-control"
                      />
                    </div>
                    <div class="form-group half-width">
                      <label for="emailSubject">Email Subject</label>
                      <input
                        type="text"
                        id="emailSubject"
                        [(ngModel)]="emailSubjectInput"
                        placeholder="Security Audit Report"
                        class="form-control"
                      />
                    </div>
                  </div>
                  
                  <div class="form-group">
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        [(ngModel)]="smtpSecureInput"
                      />
                      Use SSL/TLS (recommended)
                    </label>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="form-group">
            <label for="output">Output Directory</label>
            <input
              type="text"
              id="output"
              [(ngModel)]="outputDirInput"
              placeholder="/var/log/security-checks"
              class="form-control"
            />
            <small class="help-text"
              >Directory to save security check reports</small
            >
          </div>

          <div class="form-actions">
            <button
              class="btn btn-primary"
              [disabled]="isOperating()"
              (click)="saveDaemonConfig()"
            >
              💾 Save Configuration
            </button>

            <button class="btn btn-secondary" (click)="resetForm()">
              🔄 Reset
            </button>
          </div>
        </div>
      </div>

      @if (message()) {
        <div class="message" [class]="'message-' + messageType()">
          {{ message() }}
        </div>
      }
    </div>
  `,
  styleUrls: ['./daemon-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DaemonManagerComponent implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly _status = signal<DaemonStatus | null>(null);
  private readonly _isOperating = signal(false);
  private readonly _message = signal<string>('');
  private readonly _messageType = signal<'success' | 'error' | 'info'>('info');

  readonly status = this._status.asReadonly();
  readonly isOperating = this._isOperating.asReadonly();
  readonly message = this._message.asReadonly();
  readonly messageType = this._messageType.asReadonly();
  private readonly _showSmtpConfig = signal(false);
  readonly showSmtpConfig = this._showSmtpConfig.asReadonly();

  profileInput = 'eai';
  emailInput = '';
  outputDirInput = '';
  userIdInput = '';
  intervalDaysInput = 7;
  reportFormatInput = 'email';
  smtpHostInput = '';
  smtpPortInput = 587;
  smtpUserInput = '';
  smtpPassInput = '';
  smtpSecureInput = true;
  emailFromInput = '';
  emailSubjectInput = '';

  ngOnInit(): void {
    this.refreshStatus();
  }

  async refreshStatus(): Promise<void> {
    try {
      this._isOperating.set(true);
      const result = await this.electronService.manageDaemon('status');
      // Convert result to DaemonStatus if it's an object
      if (typeof result === 'object' && result !== null) {
        const status: DaemonStatus = {
          running: Boolean((result as any).running),
          schedule: (result as any).schedule,
          nextRun: (result as any).nextRun,
          lastRun: (result as any).lastRun,
          config: result as ConfigData
        };
        this._status.set(status);
      } else {
        // If it's a string, create a minimal status
        this._status.set({
          running: false,
          config: {}
        });
      }
      this.showMessage('Status refreshed', 'success');
    } catch (error) {
      console.error('Failed to get daemon status:', error);
      this.showMessage('Failed to get daemon status', 'error');
      // Set mock status for demo
      this._status.set({
        running: false,
        schedule: undefined,
        nextRun: undefined,
        lastRun: undefined,
      });
    } finally {
      this._isOperating.set(false);
    }
  }

  async startDaemon(): Promise<void> {
    try {
      this._isOperating.set(true);
      const config = this.buildDaemonConfig();
      await this.electronService.manageDaemon('start', config);
      this.showMessage('Daemon started successfully', 'success');
      await this.refreshStatus();
    } catch (error) {
      console.error('Failed to start daemon:', error);
      this.showMessage('Failed to start daemon', 'error');
    } finally {
      this._isOperating.set(false);
    }
  }

  async stopDaemon(): Promise<void> {
    try {
      this._isOperating.set(true);
      await this.electronService.manageDaemon('stop');
      this.showMessage('Daemon stopped successfully', 'success');
      await this.refreshStatus();
    } catch (error) {
      console.error('Failed to stop daemon:', error);
      this.showMessage('Failed to stop daemon', 'error');
    } finally {
      this._isOperating.set(false);
    }
  }

  async saveDaemonConfig(): Promise<void> {
    try {
      this._isOperating.set(true);
      const config = this.buildDaemonConfig();

      // Validate configuration
      if (!this.validateConfig(config)) {
        this.showMessage('Please check configuration values', 'error');
        return;
      }

      await this.electronService.manageDaemon('configure', config);
      this.showMessage('Configuration saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save daemon config:', error);
      this.showMessage('Failed to save configuration', 'error');
    } finally {
      this._isOperating.set(false);
    }
  }

  resetForm(): void {
    this.profileInput = 'eai';
    this.emailInput = '';
    this.outputDirInput = '';
    this.userIdInput = '';
    this.intervalDaysInput = 7;
    this.reportFormatInput = 'email';
    this.smtpHostInput = '';
    this.smtpPortInput = 587;
    this.smtpUserInput = '';
    this.smtpPassInput = '';
    this.smtpSecureInput = true;
    this.emailFromInput = '';
    this.emailSubjectInput = '';
    this.showMessage('Form reset to defaults', 'info');
  }

  toggleSmtpSection(): void {
    this._showSmtpConfig.set(!this._showSmtpConfig());
  }

  private buildDaemonConfig(): DaemonConfig {
    const config: DaemonConfig = {
      enabled: true,
      intervalDays: this.intervalDaysInput,
      securityProfile: this.profileInput,
      reportFormat: this.reportFormatInput as 'email' | 'plain' | 'markdown' | 'json',
      userId: this.userIdInput || undefined,
    };

    // Add email configuration if provided
    if (this.emailInput && this.smtpHostInput) {
      config.email = {
        smtp: {
          host: this.smtpHostInput,
          port: this.smtpPortInput,
          secure: this.smtpSecureInput,
          auth: {
            user: this.smtpUserInput,
            pass: this.smtpPassInput,
          },
        },
        from: this.emailFromInput || this.smtpUserInput,
        to: [this.emailInput],
        subject: this.emailSubjectInput || 'Security Audit Report',
      };
    }

    return config;
  }

  private validateConfig(config: DaemonConfig): boolean {
    // Validate interval days
    if (!config.intervalDays || config.intervalDays < 1 || config.intervalDays > 365) {
      return false;
    }

    // Email validation if email format is selected
    if (config.reportFormat === 'email' && config.email) {
      if (!config.email.smtp || !config.email.smtp.host || !config.email.from || !config.email.to) {
        return false;
      }
    }

    return true;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  private showMessage(
    message: string,
    type: 'success' | 'error' | 'info',
  ): void {
    this._message.set(message);
    this._messageType.set(type);

    setTimeout(() => {
      this._message.set('');
    }, 5000);
  }
}
