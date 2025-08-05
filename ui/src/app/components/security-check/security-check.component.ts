import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ElectronService,
  SecurityCheckReport,
} from '../../services/electron.service';
import { ReportService } from '../../services/report.service';
import { PasswordDialogComponent } from '../password-dialog/password-dialog.component';

@Component({
  selector: 'app-security-check',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordDialogComponent],
  template: `
    <div class="security-check-container">
      <div class="header">
        <h1>🔒 Security Check</h1>
        <p>
          Audit your system's security settings against configurable
          requirements
        </p>
        <div class="platform-info" *ngIf="platformInfo()">
          Running on {{ platformInfo()!.platform }}
          {{ platformInfo()!.arch }} (v{{ platformInfo()!.version }})
          @if (cliVersion()) {
            | CLI v{{ cliVersion() }}
          }
          @if (isElectron()) {
            | Electron Mode
          } @else {
            | Web Demo Mode
          }
        </div>
      </div>

      <div class="controls">
        <button
          class="btn btn-primary"
          [disabled]="isRunning()"
          (click)="runSecurityCheck()"
        >
          @if (isRunning()) {
            🔄 Running Check...
          } @else {
            🔍 Run Security Check
          }
        </button>

        <select
          class="profile-select"
          [(ngModel)]="selectedProfile"
          [disabled]="isRunning()"
        >
          <option value="default">Default Profile</option>
          <option value="strict">Strict Profile</option>
          <option value="relaxed">Relaxed Profile</option>
          <option value="developer">Developer Profile</option>
          <option value="eai">EAI Profile</option>
        </select>
      </div>

      @if (isRunning()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>🔍 Running security checks...</p>
        </div>
      }

      @if (report()) {
        <div class="results">
          <div class="summary">
            <h2>📊 Security Check Results</h2>
            <div class="summary-stats">
              <span class="status-pass"
                >✅ {{ report()!.summary.passed }} Passed</span
              >
              <span class="status-fail"
                >❌ {{ report()!.summary.failed }} Failed</span
              >
              <span class="status-warning"
                >⚠️ {{ report()!.summary.warnings }} Warnings</span
              >
            </div>
            <p class="overall-status">
              Overall Status:
              <span [class]="'status-' + report()!.summary.overallStatus">
                {{ getStatusIcon(report()!.summary.overallStatus) }}
                {{ report()!.summary.overallStatus.toUpperCase() }}
              </span>
            </p>
            <div class="report-meta">
              <p>
                Profile: {{ report()!.profile }} | Timestamp:
                {{ formatTimestamp(report()!.timestamp) }}
              </p>
            </div>
          </div>

          <div class="check-results">
            @for (check of report()!.checks; track check.name) {
              <div class="check-item" [class]="'check-' + check.status">
                <div class="check-header">
                  <span class="check-icon">{{
                    getStatusIcon(check.status)
                  }}</span>
                  <span class="check-name">{{ check.name }}</span>
                  <span
                    class="check-status"
                    [class]="'status-' + check.status"
                    >{{ check.status }}</span
                  >
                  @if (check.risk) {
                    <span class="check-risk" [class]="'risk-' + check.risk">{{
                      check.risk
                    }}</span>
                  }
                </div>
                <div class="check-message">{{ check.message }}</div>
                @if (check.details) {
                  <div class="check-details">{{ check.details }}</div>
                }
              </div>
            }
          </div>
        </div>
      } @else if (!isRunning()) {
        <div class="empty-state">
          <div class="icon">🛡️</div>
          <p>Ready to run your first security check!</p>
          <p>
            Click "Run Security Check" to begin auditing your system's security
            settings.
          </p>
        </div>
      }
      
      <!-- Password Dialog -->
      @if (showPasswordDialog()) {
        <app-password-dialog
          (passwordSubmitted)="onPasswordSubmitted($event)"
          (dialogCancelled)="onPasswordCancelled()"
        />
      }
    </div>
  `,
  styleUrls: ['./security-check.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityCheckComponent {
  private readonly electronService = inject(ElectronService);
  private readonly reportService = inject(ReportService);
  private readonly _isRunning = signal(false);
  private readonly _report = signal<SecurityCheckReport | null>(null);
  private readonly _showPasswordDialog = signal(false);
  private _pendingPassword: string | null = null;

  readonly isRunning = this._isRunning.asReadonly();
  readonly report = this._report.asReadonly();
  readonly showPasswordDialog = this._showPasswordDialog.asReadonly();
  readonly isElectron = this.electronService.isElectron;
  readonly platformInfo = this.electronService.platformInfo;
  readonly cliVersion = this.electronService.cliVersion;

  selectedProfile = 'default';

  async runSecurityCheck(): Promise<void> {
    // Check if we need administrator privileges for this profile
    if (this.needsPassword(this.selectedProfile)) {
      this._showPasswordDialog.set(true);
      return;
    }

    await this.executeSecurityCheck();
  }

  private needsPassword(profile: string): boolean {
    // Profiles that require administrator access
    const privilegedProfiles = ['strict', 'eai', 'default'];
    return privilegedProfiles.includes(profile) && this.isElectron();
  }

  private async executeSecurityCheck(password?: string): Promise<void> {
    this._isRunning.set(true);
    try {
      const report = await this.electronService.runSecurityCheck(
        this.selectedProfile,
        undefined,
        password,
      );
      this._report.set(report);
      
      // Save to report service (which automatically updates history)
      this.reportService.setReport(report);
    } catch (error) {
      console.error('Security check failed:', error);
      // Handle error state
    } finally {
      this._isRunning.set(false);
    }
  }

  onPasswordSubmitted(password: string): void {
    this._showPasswordDialog.set(false);
    this._pendingPassword = password;
    this.executeSecurityCheck(password);
  }

  onPasswordCancelled(): void {
    this._showPasswordDialog.set(false);
    this._pendingPassword = null;
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pass':
        return '✅';
      case 'fail':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return '❓';
    }
  }

  formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }
}
