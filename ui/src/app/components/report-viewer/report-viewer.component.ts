import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ElectronService,
  SecurityCheckReport,
} from '../../services/electron.service';

interface ReportFile {
  path: string;
  name: string;
  timestamp: string;
  size: string;
  verified?: boolean;
}

type OutputFormat = 'json' | 'markdown' | 'html' | 'plain' | 'csv';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="report-viewer-container">
      <div class="header">
        <h1>📊 Report Viewer</h1>
        <p>View, convert, and verify tamper-evident security reports</p>
      </div>

      <div class="report-actions">
        <div class="upload-section">
          <button class="btn btn-primary" (click)="openFileDialog()">
            📁 Open Report File
          </button>
          <input
            type="file"
            #fileInput
            accept=".json,.html,.pdf,.md,.txt"
            (change)="onFileSelected($event)"
            style="display: none;"
          />
        </div>

        <div class="verification-section">
          <button
            class="btn btn-secondary"
            [disabled]="!selectedReportPath() || isVerifying()"
            (click)="verifyReport()"
          >
            @if (isVerifying()) {
              🔄 Verifying...
            } @else {
              🔍 Verify Report Integrity
            }
          </button>
        </div>
      </div>

      @if (selectedReportPath()) {
        <div class="current-report">
          <div class="report-header">
            <h2>Current Report</h2>
            <div class="report-controls">
              <div class="format-selector">
                <label for="outputFormat">Output Format:</label>
                <select
                  id="outputFormat"
                  [(ngModel)]="selectedFormat"
                  (change)="onFormatChange()"
                  class="format-select"
                >
                  <option value="json">JSON</option>
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                  <option value="plain">Plain Text</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <button
                class="btn btn-sm"
                (click)="copyToClipboard()"
                [disabled]="!reportContent()"
              >
                📋 Copy to Clipboard
              </button>
              <button
                class="btn btn-sm"
                (click)="downloadReport()"
                [disabled]="!reportContent()"
              >
                💾 Download
              </button>
            </div>
          </div>

          <div class="report-info">
            <div class="info-item">
              <span class="label">File:</span>
              <span class="value">{{
                getFileName(selectedReportPath()!)
              }}</span>
            </div>
            <div class="info-item">
              <span class="label">Format:</span>
              <span class="value">{{ selectedFormat.toUpperCase() }}</span>
            </div>
            @if (verificationResult()) {
              <div class="info-item">
                <span class="label">Verification:</span>
                <span
                  class="value"
                  [class]="
                    'verification-' +
                    (verificationResult()! ? 'valid' : 'invalid')
                  "
                >
                  {{
                    verificationResult()!
                      ? '✅ Valid & Unmodified'
                      : '❌ Invalid or Modified'
                  }}
                </span>
              </div>
            }
          </div>
        </div>
      }

      @if (recentReports().length > 0) {
        <div class="recent-reports">
          <h2>Recent Reports</h2>
          <div class="reports-grid">
            @for (report of recentReports(); track report.path) {
              <div class="report-card" (click)="selectReport(report.path)">
                <div class="report-header">
                  <span class="report-name">{{ report.name }}</span>
                  @if (report.verified !== undefined) {
                    <span
                      class="verification-badge"
                      [class]="
                        'badge-' + (report.verified ? 'valid' : 'invalid')
                      "
                    >
                      {{ report.verified ? '✅' : '❌' }}
                    </span>
                  }
                </div>
                <div class="report-meta">
                  <div class="meta-item">
                    <span class="meta-label">Date:</span>
                    <span class="meta-value">{{
                      formatDate(report.timestamp)
                    }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Size:</span>
                    <span class="meta-value">{{ report.size }}</span>
                  </div>
                </div>
                <div class="report-actions">
                  <button
                    class="btn btn-xs"
                    (click)="selectAndCopy(report.path, $event)"
                  >
                    📋 Copy
                  </button>
                  <button
                    class="btn btn-xs"
                    (click)="quickDownload(report.path, $event)"
                  >
                    💾 Download
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="empty-state">
          <div class="icon">📄</div>
          <p>No security reports found</p>
          <p>Open a report file to view and verify its contents</p>
        </div>
      }

      @if (reportContent()) {
        <div class="report-content">
          <div class="content-header">
            <h2>Report Content ({{ selectedFormat.toUpperCase() }})</h2>
            <div class="content-actions">
              <button class="btn btn-sm" (click)="copyToClipboard()">
                📋 Copy All
              </button>
              <button class="btn btn-sm" (click)="downloadReport()">
                💾 Download
              </button>
            </div>
          </div>
          <div class="content-viewer">
            @switch (selectedFormat) {
              @case ('json') {
                <div class="json-viewer">
                  <pre>{{ formatJson(reportContent()!) }}</pre>
                </div>
              }
              @case ('html') {
                <div class="html-viewer" [innerHTML]="convertedContent()"></div>
              }
              @default {
                <div class="text-viewer">
                  <pre>{{ convertedContent() }}</pre>
                </div>
              }
            }
          </div>
        </div>
      }

      @if (message()) {
        <div class="message" [class]="'message-' + messageType()">
          {{ message() }}
        </div>
      }
    </div>
  `,
  styleUrls: ['./report-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportViewerComponent implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly _selectedReportPath = signal<string | null>(null);
  private readonly _reportContent = signal<string | null>(null);
  private readonly _originalReport = signal<SecurityCheckReport | null>(null);
  private readonly _verificationResult = signal<boolean | null>(null);
  private readonly _isVerifying = signal(false);
  private readonly _recentReports = signal<ReportFile[]>([]);
  private readonly _message = signal<string>('');
  private readonly _messageType = signal<'success' | 'error' | 'info'>('info');
  private readonly _convertedContent = signal<string>('');

  readonly selectedReportPath = this._selectedReportPath.asReadonly();
  readonly reportContent = this._reportContent.asReadonly();
  readonly verificationResult = this._verificationResult.asReadonly();
  readonly isVerifying = this._isVerifying.asReadonly();
  readonly recentReports = this._recentReports.asReadonly();
  readonly message = this._message.asReadonly();
  readonly messageType = this._messageType.asReadonly();
  readonly convertedContent = this._convertedContent.asReadonly();

  selectedFormat: OutputFormat = 'json';

  ngOnInit(): void {
    this.loadRecentReports();
  }

  openFileDialog(): void {
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fileInput?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      const content = await this.readFileContent(file);
      this._selectedReportPath.set(file.name);
      this._reportContent.set(content);

      // Try to parse as security report
      try {
        const parsed = JSON.parse(content);
        if (this.isSecurityReport(parsed)) {
          this._originalReport.set(parsed);
        }
      } catch {
        // Not a JSON security report, that's okay
      }

      this._verificationResult.set(null);
      this.convertContent();
      this.showMessage(`Loaded report: ${file.name}`, 'success');
    } catch (error) {
      console.error('Failed to read file:', error);
      this.showMessage('Failed to read file', 'error');
    }
  }

  async selectReport(path: string): Promise<void> {
    try {
      this._selectedReportPath.set(path);
      // In a real implementation, would load the report content from the file system
      // For now, generate mock content based on the path
      const mockReport = this.generateMockReport(path);
      this._originalReport.set(mockReport);
      this._reportContent.set(JSON.stringify(mockReport, null, 2));
      this._verificationResult.set(null);
      this.convertContent();
      this.showMessage(`Selected report: ${this.getFileName(path)}`, 'info');
    } catch (error) {
      console.error('Failed to load report:', error);
      this.showMessage('Failed to load report', 'error');
    }
  }

  async selectAndCopy(path: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.selectReport(path);
    await this.copyToClipboard();
  }

  async quickDownload(path: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.selectReport(path);
    this.downloadReport();
  }

  async verifyReport(): Promise<void> {
    if (!this.selectedReportPath()) return;

    this._isVerifying.set(true);
    try {
      const result = await this.electronService.verifyReport(
        this.selectedReportPath()!,
      );
      this._verificationResult.set(result);

      if (result) {
        this.showMessage(
          'Report verification successful - integrity confirmed',
          'success',
        );
      } else {
        this.showMessage(
          'Report verification failed - file may be modified or corrupted',
          'error',
        );
      }
    } catch (error) {
      console.error('Verification failed:', error);
      this.showMessage(
        'Verification failed - unable to check report integrity',
        'error',
      );
      this._verificationResult.set(false);
    } finally {
      this._isVerifying.set(false);
    }
  }

  onFormatChange(): void {
    this.convertContent();
  }

  async copyToClipboard(): Promise<void> {
    if (!this.convertedContent()) return;

    try {
      await navigator.clipboard.writeText(this.convertedContent());
      this.showMessage(
        `Report copied to clipboard as ${this.selectedFormat.toUpperCase()}`,
        'success',
      );
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showMessage('Failed to copy to clipboard', 'error');
    }
  }

  downloadReport(): void {
    if (!this.convertedContent() || !this.selectedReportPath()) return;

    const content = this.convertedContent();
    const fileName = this.getDownloadFileName();
    const mimeType = this.getMimeType();

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showMessage(`Downloaded report as ${fileName}`, 'success');
  }

  private convertContent(): void {
    if (!this._originalReport()) {
      this._convertedContent.set(this._reportContent() || '');
      return;
    }

    const report = this._originalReport()!;
    let converted = '';

    switch (this.selectedFormat) {
      case 'json':
        converted = JSON.stringify(report, null, 2);
        break;
      case 'markdown':
        converted = this.convertToMarkdown(report);
        break;
      case 'html':
        converted = this.convertToHtml(report);
        break;
      case 'plain':
        converted = this.convertToPlainText(report);
        break;
      case 'csv':
        converted = this.convertToCsv(report);
        break;
      default:
        converted = JSON.stringify(report, null, 2);
    }

    this._convertedContent.set(converted);
  }

  private convertToMarkdown(report: SecurityCheckReport): string {
    let md = `# Security Check Report\n\n`;
    md += `**Profile:** ${report.profile}\n`;
    md += `**Platform:** ${report.platform.platform} ${report.platform.arch}\n`;
    md += `**Timestamp:** ${new Date(report.timestamp).toLocaleString()}\n\n`;

    md += `## Summary\n\n`;
    md += `- ✅ **Passed:** ${report.summary.passed}\n`;
    md += `- ❌ **Failed:** ${report.summary.failed}\n`;
    md += `- ⚠️ **Warnings:** ${report.summary.warnings}\n`;
    md += `- **Overall Status:** ${report.summary.overallStatus.toUpperCase()}\n\n`;

    md += `## Security Checks\n\n`;
    report.checks.forEach((check) => {
      const icon =
        check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      md += `### ${icon} ${check.name}\n\n`;
      md += `**Status:** ${check.status.toUpperCase()}\n`;
      md += `**Message:** ${check.message}\n`;
      if (check.details) {
        md += `**Details:** ${check.details}\n`;
      }
      if (check.risk) {
        md += `**Risk Level:** ${check.risk.toUpperCase()}\n`;
      }
      md += '\n';
    });

    return md;
  }

  private convertToHtml(report: SecurityCheckReport): string {
    let html = `
      <div class="security-report">
        <h1>🔒 Security Check Report</h1>
        <div class="report-meta">
          <p><strong>Profile:</strong> ${report.profile}</p>
          <p><strong>Platform:</strong> ${report.platform.platform} ${report.platform.arch}</p>
          <p><strong>Timestamp:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="summary">
          <h2>📊 Summary</h2>
          <div class="summary-stats">
            <span class="stat pass">✅ ${report.summary.passed} Passed</span>
            <span class="stat fail">❌ ${report.summary.failed} Failed</span>
            <span class="stat warning">⚠️ ${report.summary.warnings} Warnings</span>
          </div>
          <p class="overall-status status-${report.summary.overallStatus}">
            Overall Status: ${report.summary.overallStatus.toUpperCase()}
          </p>
        </div>
        
        <div class="checks">
          <h2>🔍 Security Checks</h2>
    `;

    report.checks.forEach((check) => {
      const icon =
        check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      html += `
        <div class="check-item status-${check.status}">
          <h3>${icon} ${check.name}</h3>
          <p class="check-message">${check.message}</p>
          ${check.details ? `<p class="check-details">${check.details}</p>` : ''}
          ${check.risk ? `<p class="check-risk">Risk Level: <span class="risk-${check.risk}">${check.risk.toUpperCase()}</span></p>` : ''}
        </div>
      `;
    });

    html += `
        </div>
      </div>
      <style>
        .security-report { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; }
        .report-meta { background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
        .summary-stats { display: flex; gap: 1rem; margin: 1rem 0; }
        .stat { padding: 0.5rem 1rem; border-radius: 4px; }
        .stat.pass { background: #d4edda; color: #155724; }
        .stat.fail { background: #f8d7da; color: #721c24; }
        .stat.warning { background: #fff3cd; color: #856404; }
        .check-item { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
        .check-item.status-pass { border-left: 4px solid #28a745; }
        .check-item.status-fail { border-left: 4px solid #dc3545; }
        .check-item.status-warning { border-left: 4px solid #ffc107; }
        .risk-high { color: #dc3545; font-weight: bold; }
        .risk-medium { color: #ffc107; font-weight: bold; }
        .risk-low { color: #28a745; font-weight: bold; }
      </style>
    `;

    return html;
  }

  private convertToPlainText(report: SecurityCheckReport): string {
    let text = `SECURITY CHECK REPORT\n`;
    text += `=====================\n\n`;
    text += `Profile: ${report.profile}\n`;
    text += `Platform: ${report.platform.platform} ${report.platform.arch}\n`;
    text += `Timestamp: ${new Date(report.timestamp).toLocaleString()}\n\n`;

    text += `SUMMARY\n`;
    text += `-------\n`;
    text += `Passed: ${report.summary.passed}\n`;
    text += `Failed: ${report.summary.failed}\n`;
    text += `Warnings: ${report.summary.warnings}\n`;
    text += `Overall Status: ${report.summary.overallStatus.toUpperCase()}\n\n`;

    text += `SECURITY CHECKS\n`;
    text += `---------------\n\n`;

    report.checks.forEach((check, index) => {
      const status =
        check.status === 'pass'
          ? 'PASS'
          : check.status === 'fail'
            ? 'FAIL'
            : 'WARNING';
      text += `${index + 1}. ${check.name} - ${status}\n`;
      text += `   Message: ${check.message}\n`;
      if (check.details) {
        text += `   Details: ${check.details}\n`;
      }
      if (check.risk) {
        text += `   Risk Level: ${check.risk.toUpperCase()}\n`;
      }
      text += '\n';
    });

    return text;
  }

  private convertToCsv(report: SecurityCheckReport): string {
    let csv = 'Check Name,Status,Message,Details,Risk Level\n';

    report.checks.forEach((check) => {
      const name = this.escapeCsv(check.name);
      const status = check.status;
      const message = this.escapeCsv(check.message);
      const details = this.escapeCsv(check.details || '');
      const risk = check.risk || '';

      csv += `${name},${status},${message},${details},${risk}\n`;
    });

    return csv;
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private getDownloadFileName(): string {
    const baseName = this.getFileName(this.selectedReportPath()!).replace(
      /\.[^/.]+$/,
      '',
    );
    const extension = this.getFileExtension();
    return `${baseName}.${extension}`;
  }

  private getFileExtension(): string {
    switch (this.selectedFormat) {
      case 'json':
        return 'json';
      case 'markdown':
        return 'md';
      case 'html':
        return 'html';
      case 'plain':
        return 'txt';
      case 'csv':
        return 'csv';
      default:
        return 'txt';
    }
  }

  private getMimeType(): string {
    switch (this.selectedFormat) {
      case 'json':
        return 'application/json';
      case 'markdown':
        return 'text/markdown';
      case 'html':
        return 'text/html';
      case 'plain':
        return 'text/plain';
      case 'csv':
        return 'text/csv';
      default:
        return 'text/plain';
    }
  }

  private generateMockReport(path: string): SecurityCheckReport {
    const profile = path.includes('strict')
      ? 'strict'
      : path.includes('relaxed')
        ? 'relaxed'
        : 'default';

    return {
      platform: { platform: 'darwin', arch: 'x64', version: '14.0.0' },
      profile,
      timestamp: new Date().toISOString(),
      checks: [
        {
          name: 'Disk Encryption',
          status: 'pass',
          message: 'FileVault is enabled',
          details: 'Full disk encryption is active and protecting your data',
          risk: 'high',
        },
        {
          name: 'Password Protection',
          status: 'pass',
          message: 'Screen saver requires password immediately',
          details: 'Screen lock is configured correctly',
          risk: 'high',
        },
        {
          name: 'Auto-lock Timeout',
          status: profile === 'strict' ? 'fail' : 'warning',
          message: 'Auto-lock timeout is 10 minutes',
          details: 'Consider reducing to 5 minutes for better security',
          risk: 'medium',
        },
      ],
      summary: {
        passed: 2,
        failed: profile === 'strict' ? 1 : 0,
        warnings: profile === 'strict' ? 0 : 1,
        overallStatus: profile === 'strict' ? 'fail' : 'warning',
      },
    };
  }

  private isSecurityReport(obj: any): obj is SecurityCheckReport {
    return (
      obj &&
      obj.platform &&
      obj.profile &&
      obj.timestamp &&
      obj.checks &&
      Array.isArray(obj.checks) &&
      obj.summary
    );
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private loadRecentReports(): void {
    // In a real implementation, would load from file system or database
    // For demo purposes, show mock recent reports
    const mockReports: ReportFile[] = [
      {
        path: '/reports/security-check-2023-12-01.json',
        name: 'security-check-2023-12-01.json',
        timestamp: '2023-12-01T10:00:00Z',
        size: '45.2 KB',
        verified: true,
      },
      {
        path: '/reports/security-check-2023-11-30.json',
        name: 'security-check-2023-11-30.json',
        timestamp: '2023-11-30T10:00:00Z',
        size: '43.8 KB',
        verified: true,
      },
      {
        path: '/reports/security-check-2023-11-29.json',
        name: 'security-check-2023-11-29.json',
        timestamp: '2023-11-29T10:00:00Z',
        size: '44.1 KB',
        verified: false,
      },
    ];

    this._recentReports.set(mockReports);
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatJson(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
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
