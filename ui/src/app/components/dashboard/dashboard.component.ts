import { ChangeDetectionStrategy, Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ElectronService, SecurityCheckReport } from '../../services/electron.service';

export interface ReportHistory {
  id: string;
  timestamp: string;
  profile: string;
  status: 'pass' | 'fail' | 'warning';
  passed: number;
  failed: number;
  warnings: number;
  reportPath?: string;
}

export interface SystemStatus {
  version: string;
  globalInstall: boolean;
  daemonStatus: 'running' | 'stopped' | 'not_configured';
  lastCheck?: ReportHistory;
  recentReports: ReportHistory[];
  configExists: boolean;
  schedulingConfigExists: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h1>🏠 Dashboard</h1>
        <p>System overview and recent security audit history</p>
      </div>

      <!-- System Status Card -->
      <div class="status-card">
        <h2>🌟 System Status</h2>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">Version:</span>
            <span class="status-value">{{ systemStatus().version }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Global Install:</span>
            <span class="status-value" [class]="systemStatus().globalInstall ? 'status-good' : 'status-warning'">
              {{ systemStatus().globalInstall ? '✅ Installed' : '⚠️ Not Installed' }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Daemon:</span>
            <span class="status-value" [class]="getDaemonStatusClass()">
              {{ getDaemonStatusText() }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Configuration:</span>
            <span class="status-value" [class]="systemStatus().configExists ? 'status-good' : 'status-warning'">
              {{ systemStatus().configExists ? '✅ Found' : '⚠️ Missing' }}
            </span>
          </div>
        </div>
        
        <div class="quick-actions">
          <button class="btn btn-primary" routerLink="/security-check">
            🔍 Run Security Check
          </button>
          @if (!systemStatus().globalInstall) {
            <button class="btn btn-secondary" (click)="installGlobally()">
              📦 Install Globally
            </button>
          }
          @if (systemStatus().daemonStatus === 'not_configured') {
            <button class="btn btn-secondary" routerLink="/daemon-manager">
              ⚙️ Configure Daemon
            </button>
          }
        </div>
      </div>

      <!-- Last Security Check -->
      @if (systemStatus().lastCheck) {
        <div class="last-check-card">
          <h2>🔍 Last Security Check</h2>
          <div class="last-check-content">
            <div class="check-summary">
              <div class="check-status" [class]="'status-' + systemStatus().lastCheck!.status">
                <span class="status-icon">{{ getStatusIcon(systemStatus().lastCheck!.status) }}</span>
                <span class="status-text">{{ systemStatus().lastCheck!.status.toUpperCase() }}</span>
              </div>
              <div class="check-stats">
                <span class="stat-item pass">✅ {{ systemStatus().lastCheck!.passed }}</span>
                <span class="stat-item fail">❌ {{ systemStatus().lastCheck!.failed }}</span>
                <span class="stat-item warning">⚠️ {{ systemStatus().lastCheck!.warnings }}</span>
              </div>
              <div class="check-meta">
                <span>Profile: {{ systemStatus().lastCheck!.profile }}</span>
                <span>{{ formatTimestamp(systemStatus().lastCheck!.timestamp) }}</span>
              </div>
            </div>
            <div class="check-actions">
              <button class="btn btn-sm" (click)="viewReport(systemStatus().lastCheck!)">
                📊 View Report
              </button>
              <button class="btn btn-sm" routerLink="/security-check">
                🔄 Run Again
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Report History -->
      <div class="history-card">
        <div class="history-header">
          <h2>📋 Recent Reports</h2>
          <div class="history-controls">
            <button class="btn btn-sm" (click)="refreshHistory()">
              🔄 Refresh
            </button>
            <button class="btn btn-sm" routerLink="/report-viewer">
              📊 View All
            </button>
          </div>
        </div>
        
        @if (systemStatus().recentReports.length > 0) {
          <div class="reports-list">
            @for (report of systemStatus().recentReports; track report.id) {
              <div class="report-item" [class]="'report-' + report.status">
                <div class="report-info">
                  <div class="report-header">
                    <span class="report-status" [class]="'status-' + report.status">
                      {{ getStatusIcon(report.status) }}
                    </span>
                    <span class="report-profile">{{ report.profile }}</span>
                    <span class="report-timestamp">{{ formatTimestamp(report.timestamp) }}</span>
                  </div>
                  <div class="report-stats">
                    <span class="stat pass">✅ {{ report.passed }}</span>
                    <span class="stat fail">❌ {{ report.failed }}</span>
                    <span class="stat warning">⚠️ {{ report.warnings }}</span>
                  </div>
                </div>
                <div class="report-actions">
                  <button class="btn btn-xs" (click)="viewReport(report)">
                    👁️ View
                  </button>
                  @if (report.reportPath) {
                    <button class="btn btn-xs" (click)="copyReport(report)">
                      📋 Copy
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>No security reports found</p>
            <p>Run your first security check to see history here</p>
            <button class="btn btn-primary" routerLink="/security-check">
              🔍 Run Security Check
            </button>
          </div>
        }
      </div>

      <!-- Feature Overview -->
      <div class="features-card">
        <h2>🛠️ Available Features</h2>
        <div class="features-grid">
          <div class="feature-item">
            <div class="feature-icon">🔍</div>
            <h3>Security Check</h3>
            <p>Run comprehensive security audits with multiple profiles</p>
            <button class="btn btn-sm" routerLink="/security-check">Launch</button>
          </div>
          <div class="feature-item">
            <div class="feature-icon">⚙️</div>
            <h3>Configuration</h3>
            <p>Manage security profiles and custom configurations</p>
            <button class="btn btn-sm" routerLink="/config-editor">Configure</button>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🔄</div>
            <h3>Daemon Manager</h3>
            <p>Setup automated security monitoring and alerts</p>
            <button class="btn btn-sm" routerLink="/daemon-manager">Manage</button>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📊</div>
            <h3>Report Viewer</h3>
            <p>View, analyze and export security reports</p>
            <button class="btn btn-sm" routerLink="/report-viewer">View Reports</button>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🎛️</div>
            <h3>Interactive Mode</h3>
            <p>Step-by-step guided security management</p>
            <button class="btn btn-sm" routerLink="/interactive-mode">Start</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly _systemStatus = signal<SystemStatus>({
    version: '1.0.0',
    globalInstall: false,
    daemonStatus: 'not_configured',
    recentReports: [],
    configExists: false,
    schedulingConfigExists: false
  });

  readonly systemStatus = this._systemStatus.asReadonly();

  async ngOnInit(): Promise<void> {
    await this.loadSystemStatus();
  }

  private async loadSystemStatus(): Promise<void> {
    try {
      // Load version and platform info
      const version = this.electronService.cliVersion() || '1.0.0';
      
      // Load recent reports from local storage or electron service
      const recentReports = this.loadRecentReports();
      
      // Mock system status for now - in real implementation this would come from CLI
      const status: SystemStatus = {
        version,
        globalInstall: await this.checkGlobalInstall(),
        daemonStatus: await this.checkDaemonStatus(),
        recentReports,
        lastCheck: recentReports[0],
        configExists: true, // Mock for now
        schedulingConfigExists: false // Mock for now
      };

      this._systemStatus.set(status);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  }

  private async checkGlobalInstall(): Promise<boolean> {
    try {
      if (!this.electronService.isElectron()) return false;
      // In real implementation, this would check via CLI
      return false; // Mock
    } catch {
      return false;
    }
  }

  private async checkDaemonStatus(): Promise<'running' | 'stopped' | 'not_configured'> {
    try {
      if (!this.electronService.isElectron()) return 'not_configured';
      // In real implementation, this would check daemon via CLI
      return 'not_configured'; // Mock
    } catch {
      return 'not_configured';
    }
  }

  private loadRecentReports(): ReportHistory[] {
    try {
      const stored = localStorage.getItem('eai-security-reports');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load report history:', error);
    }
    
    // Return mock data if no history exists
    return this.getMockReportHistory();
  }

  private getMockReportHistory(): ReportHistory[] {
    const now = new Date();
    return [
      {
        id: '1',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        profile: 'default',
        status: 'warning',
        passed: 6,
        failed: 1,
        warnings: 2
      },
      {
        id: '2',
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        profile: 'strict',
        status: 'fail',
        passed: 4,
        failed: 3,
        warnings: 2
      },
      {
        id: '3',
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        profile: 'relaxed',
        status: 'pass',
        passed: 8,
        failed: 0,
        warnings: 1
      }
    ];
  }

  saveReportToHistory(report: SecurityCheckReport): void {
    const historyItem: ReportHistory = {
      id: Date.now().toString(),
      timestamp: report.timestamp,
      profile: report.profile,
      status: report.summary.overallStatus,
      passed: report.summary.passed,
      failed: report.summary.failed,
      warnings: report.summary.warnings
    };

    const current = this.systemStatus();
    const updated = [historyItem, ...current.recentReports].slice(0, 10); // Keep last 10
    
    try {
      localStorage.setItem('eai-security-reports', JSON.stringify(updated));
      this._systemStatus.set({
        ...current,
        recentReports: updated,
        lastCheck: historyItem
      });
    } catch (error) {
      console.error('Failed to save report history:', error);
    }
  }

  async installGlobally(): Promise<void> {
    try {
      const success = await this.electronService.installGlobally();
      if (success) {
        const current = this.systemStatus();
        this._systemStatus.set({
          ...current,
          globalInstall: true
        });
      }
    } catch (error) {
      console.error('Failed to install globally:', error);
    }
  }

  async refreshHistory(): Promise<void> {
    await this.loadSystemStatus();
  }

  viewReport(report: ReportHistory): void {
    // In real implementation, this would navigate to report viewer with specific report
    console.log('View report:', report);
  }

  copyReport(report: ReportHistory): void {
    // In real implementation, this would copy report content to clipboard
    console.log('Copy report:', report);
  }

  getDaemonStatusClass(): string {
    switch (this.systemStatus().daemonStatus) {
      case 'running': return 'status-good';
      case 'stopped': return 'status-warning';
      case 'not_configured': return 'status-error';
      default: return '';
    }
  }

  getDaemonStatusText(): string {
    switch (this.systemStatus().daemonStatus) {
      case 'running': return '✅ Running';
      case 'stopped': return '⏸️ Stopped';
      case 'not_configured': return '❌ Not Configured';
      default: return 'Unknown';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'warning': return '⚠️';
      default: return '❓';
    }
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
}