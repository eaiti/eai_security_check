import { ChangeDetectionStrategy, Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../services/electron.service';

interface DaemonStatus {
  running: boolean;
  schedule?: string;
  nextRun?: string;
  lastRun?: string;
  config?: any;
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
              <span class="value" [class]="'status-' + (status()!.running ? 'running' : 'stopped')">
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
            (click)="startDaemon()">
            ▶️ Start Daemon
          </button>
          
          <button 
            class="btn btn-secondary" 
            [disabled]="isOperating()"
            (click)="stopDaemon()">
            ⏹️ Stop Daemon
          </button>
          
          <button 
            class="btn btn-secondary" 
            [disabled]="isOperating()"
            (click)="refreshStatus()">
            🔄 Refresh Status
          </button>
        </div>
      </div>

      <div class="configuration">
        <h2>Daemon Configuration</h2>
        
        <div class="config-form">
          <div class="form-group">
            <label for="schedule">Schedule (Cron Expression)</label>
            <input 
              type="text" 
              id="schedule" 
              [(ngModel)]="scheduleInput" 
              placeholder="0 */6 * * *"
              class="form-control"
            />
            <small class="help-text">Example: "0 */6 * * *" runs every 6 hours</small>
          </div>

          <div class="form-group">
            <label for="profile">Security Profile</label>
            <select id="profile" [(ngModel)]="profileInput" class="form-control">
              <option value="default">Default Profile</option>
              <option value="strict">Strict Profile</option>
              <option value="relaxed">Relaxed Profile</option>
              <option value="developer">Developer Profile</option>
              <option value="eai">EAI Profile</option>
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
            <small class="help-text">Email address for security report notifications</small>
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
            <small class="help-text">Directory to save security check reports</small>
          </div>

          <div class="form-actions">
            <button 
              class="btn btn-primary" 
              [disabled]="isOperating()"
              (click)="saveDaemonConfig()">
              💾 Save Configuration
            </button>
            
            <button 
              class="btn btn-secondary" 
              (click)="resetForm()">
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
  changeDetection: ChangeDetectionStrategy.OnPush
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

  scheduleInput = '0 */6 * * *';
  profileInput = 'default';
  emailInput = '';
  outputDirInput = '';

  ngOnInit(): void {
    this.refreshStatus();
  }

  async refreshStatus(): Promise<void> {
    try {
      this._isOperating.set(true);
      const result = await this.electronService.manageDaemon('status');
      this._status.set(result as DaemonStatus);
      this.showMessage('Status refreshed', 'success');
    } catch (error) {
      console.error('Failed to get daemon status:', error);
      this.showMessage('Failed to get daemon status', 'error');
      // Set mock status for demo
      this._status.set({
        running: false,
        schedule: undefined,
        nextRun: undefined,
        lastRun: undefined
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
    this.scheduleInput = '0 */6 * * *';
    this.profileInput = 'default';
    this.emailInput = '';
    this.outputDirInput = '';
    this.showMessage('Form reset to defaults', 'info');
  }

  private buildDaemonConfig(): any {
    return {
      schedule: this.scheduleInput,
      profile: this.profileInput,
      email: this.emailInput || undefined,
      outputDir: this.outputDirInput || undefined
    };
  }

  private validateConfig(config: any): boolean {
    // Basic cron expression validation
    const cronRegex = /^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) (\*|[0-2]?\d|3[01]) (\*|[01]?\d) (\*|[0-6])$/;
    if (!cronRegex.test(config.schedule)) {
      return false;
    }

    // Email validation if provided
    if (config.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(config.email)) {
        return false;
      }
    }

    return true;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this._message.set(message);
    this._messageType.set(type);
    
    setTimeout(() => {
      this._message.set('');
    }, 5000);
  }
}