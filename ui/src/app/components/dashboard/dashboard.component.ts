import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  ElectronService,
  SecurityCheckReport,
} from '../../services/electron.service';
import { ReportService, ReportHistory } from '../../services/report.service';

export interface SystemStatus {
  version: string;
  daemonStatus: 'running' | 'stopped' | 'not_configured';
  lastCheck?: ReportHistory;
  recentReports: ReportHistory[];
  configExists: boolean;
  schedulingConfigExists: boolean;
  configDirectory: string;
  reportsDirectory: string;
  reportSource: 'localStorage' | 'fileSystem' | 'mock';
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
            <span class="status-label">Daemon:</span>
            <span class="status-value" [class]="getDaemonStatusClass()">
              {{ getDaemonStatusText() }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Configuration:</span>
            <span
              class="status-value"
              [class]="
                systemStatus().configExists ? 'status-good' : 'status-warning'
              "
            >
              {{ systemStatus().configExists ? '✅ Found' : '⚠️ Missing' }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Config Directory:</span>
            <span class="status-value config-path">{{ systemStatus().configDirectory }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Reports Directory:</span>
            <span class="status-value config-path">{{ systemStatus().reportsDirectory }}</span>
          </div>
        </div>

        <div class="quick-actions">
          <button class="btn btn-primary" routerLink="/security-check">
            🔍 Run Security Check
          </button>
          <button class="btn btn-secondary" routerLink="/management">
            🎛️ System Management
          </button>
        </div>
      </div>

      <!-- Last Security Check -->
      @if (systemStatus().lastCheck) {
        <div class="last-check-card">
          <h2>🔍 Last Security Check</h2>
          <div class="last-check-content">
            <div class="check-summary">
              <div
                class="check-status"
                [class]="'status-' + systemStatus().lastCheck!.status"
              >
                <span class="status-icon">{{
                  getStatusIcon(systemStatus().lastCheck!.status)
                }}</span>
                <span class="status-text">{{
                  systemStatus().lastCheck!.status.toUpperCase()
                }}</span>
              </div>
              <div class="check-stats">
                <span class="stat-item pass"
                  >✅ {{ systemStatus().lastCheck!.passed }}</span
                >
                <span class="stat-item fail"
                  >❌ {{ systemStatus().lastCheck!.failed }}</span
                >
                <span class="stat-item warning"
                  >⚠️ {{ systemStatus().lastCheck!.warnings }}</span
                >
              </div>
              <div class="check-meta">
                <span>Profile: {{ systemStatus().lastCheck!.profile }}</span>
                <span>{{
                  formatTimestamp(systemStatus().lastCheck!.timestamp)
                }}</span>
              </div>
            </div>
            <div class="check-actions">
              <button
                class="btn btn-sm"
                (click)="viewReport(systemStatus().lastCheck!)"
              >
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
          <div class="report-source-status">
            <span class="source-label">Source:</span>
            <span class="source-value">{{ getReportSourceText() }}</span>
          </div>
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
                    <span
                      class="report-status"
                      [class]="'status-' + report.status"
                    >
                      {{ getStatusIcon(report.status) }}
                    </span>
                    <span class="report-profile">{{ report.profile }}</span>
                    <span class="report-timestamp">{{
                      formatTimestamp(report.timestamp)
                    }}</span>
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
            <button class="btn btn-sm" routerLink="/security-check">
              Launch
            </button>
          </div>
          <div class="feature-item">
            <div class="feature-icon">🎛️</div>
            <h3>Management</h3>
            <p>System administration and configuration management</p>
            <button class="btn btn-sm" routerLink="/management">
              Manage System
            </button>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📊</div>
            <h3>Report Viewer</h3>
            <p>View, analyze and export security reports</p>
            <button class="btn btn-sm" routerLink="/report-viewer">
              View Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly router = inject(Router);
  private readonly reportService = inject(ReportService);
  private readonly _systemStatus = signal<SystemStatus>({
    version: '1.0.0',
    daemonStatus: 'not_configured',
    recentReports: [],
    configExists: false,
    schedulingConfigExists: false,
    configDirectory: '~/.config/eai-security-check',
    reportsDirectory: '~/reports',
    reportSource: 'mock',
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
      const { recentReports, reportSource } = await this.loadRecentReports();

      // Mock system status for now - in real implementation this would come from CLI
      const status: SystemStatus = {
        version,
        daemonStatus: await this.checkDaemonStatus(),
        recentReports,
        lastCheck: recentReports[0],
        configExists: true, // Mock for now
        schedulingConfigExists: false, // Mock for now
        configDirectory: await this.getConfigDirectory(),
        reportsDirectory: await this.getReportsDirectory(),
        reportSource,
      };

      this._systemStatus.set(status);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  }

  private async checkDaemonStatus(): Promise<
    'running' | 'stopped' | 'not_configured'
  > {
    try {
      if (!this.electronService.isElectron()) return 'not_configured';
      // In real implementation, this would check daemon via CLI
      return 'not_configured'; // Mock
    } catch {
      return 'not_configured';
    }
  }

  private async loadRecentReports(): Promise<{ recentReports: ReportHistory[]; reportSource: 'localStorage' | 'fileSystem' | 'mock' }> {
    // First try to load from electron service (file system)
    if (this.electronService.isElectron()) {
      try {
        const recentReportFiles = await this.electronService.loadRecentReports();
        if (recentReportFiles.length > 0) {
          const reports: ReportHistory[] = recentReportFiles.slice(0, 10).map(file => ({
            id: file.path,
            timestamp: file.timestamp,
            profile: this.extractProfileFromFileName(file.name),
            status: 'pass' as const, // Default - would need to parse file to get actual status
            passed: 0, // Would need to parse file
            failed: 0,
            warnings: 0,
            reportPath: file.path
          }));
          return { recentReports: reports, reportSource: 'fileSystem' };
        }
      } catch (error) {
        console.error('Failed to load recent reports from file system:', error);
      }
    }

    // Fallback to localStorage
    const reports = this.reportService.getReportHistory();
    if (reports.length > 0) {
      return { recentReports: reports, reportSource: 'localStorage' };
    }

    // Return mock data if no history exists
    return { 
      recentReports: this.getMockReportHistory(), 
      reportSource: 'mock' 
    };
  }

  private extractProfileFromFileName(fileName: string): string {
    // Extract profile from filename like "security-report-eai-2025-01-01.json"
    const match = fileName.match(/security-report-([^-]+)-/);
    return match ? match[1] : 'default';
  }

  private async getConfigDirectory(): Promise<string> {
    try {
      if (this.electronService.isElectron()) {
        // In real implementation, this would come from electron service
        return await this.electronService.getConfigDirectory?.() || '~/.config/eai-security-check';
      }
    } catch (error) {
      console.error('Failed to get config directory:', error);
    }
    return '~/.config/eai-security-check';
  }

  private async getReportsDirectory(): Promise<string> {
    try {
      if (this.electronService.isElectron()) {
        // In real implementation, this would come from electron service
        return await this.electronService.getReportsDirectory?.() || '~/reports';
      }
    } catch (error) {
      console.error('Failed to get reports directory:', error);
    }
    return '~/reports';
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
        warnings: 2,
      },
      {
        id: '2',
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        profile: 'strict',
        status: 'fail',
        passed: 4,
        failed: 3,
        warnings: 2,
      },
      {
        id: '3',
        timestamp: new Date(
          now.getTime() - 3 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 3 days ago
        profile: 'relaxed',
        status: 'pass',
        passed: 8,
        failed: 0,
        warnings: 1,
      },
    ];
  }

  saveReportToHistory(): void {
    // This is now handled automatically by the ReportService
    // Just refresh the dashboard to show the new report
    this.loadSystemStatus();
  }

  async refreshHistory(): Promise<void> {
    await this.loadSystemStatus();
  }

  async viewReport(report: ReportHistory): Promise<void> {
    try {
      // If we have a report path, load the actual report data
      if (report.reportPath) {
        const reportData = await this.electronService.loadReportFromPath(report.reportPath);
        this.reportService.setReport(reportData, report.reportPath);
      } else {
        // Create a mock report from the history data
        const mockReport: SecurityCheckReport = {
          platform: { platform: 'unknown', arch: 'unknown', version: 'unknown' },
          profile: report.profile,
          timestamp: report.timestamp,
          checks: [],
          summary: {
            passed: report.passed,
            failed: report.failed,
            warnings: report.warnings,
            overallStatus: report.status,
          },
        };
        this.reportService.setReport(mockReport);
      }
      
      // Navigate to report viewer
      this.router.navigate(['/report-viewer']);
    } catch (error) {
      console.error('Failed to load report:', error);
      // Still navigate to show error state
      this.router.navigate(['/report-viewer']);
    }
  }

  copyReport(report: ReportHistory): void {
    // In real implementation, this would copy report content to clipboard
    console.log('Copy report:', report);
  }

  getDaemonStatusClass(): string {
    switch (this.systemStatus().daemonStatus) {
      case 'running':
        return 'status-good';
      case 'stopped':
        return 'status-warning';
      case 'not_configured':
        return 'status-error';
      default:
        return '';
    }
  }

  getDaemonStatusText(): string {
    switch (this.systemStatus().daemonStatus) {
      case 'running':
        return '✅ Running';
      case 'stopped':
        return '⏸️ Stopped';
      case 'not_configured':
        return '❌ Not Configured';
      default:
        return 'Unknown';
    }
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

  getReportSourceText(): string {
    switch (this.systemStatus().reportSource) {
      case 'localStorage':
        return '💾 Browser Storage';
      case 'fileSystem':
        return '📁 File System';
      case 'mock':
        return '🧪 Demo Data';
      default:
        return '❓ Unknown';
    }
  }
}
