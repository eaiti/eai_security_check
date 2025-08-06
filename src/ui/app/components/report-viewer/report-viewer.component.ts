import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import {
  ElectronService,
  SecurityCheckReport,
} from "../../services/electron.service";
import { ReportService } from "../../services/report.service";

interface ReportFile {
  path: string;
  name: string;
  timestamp: string;
  size: string;
  verified?: boolean;
  verificationStatus?: "pending" | "verifying" | "valid" | "invalid" | "error";
}

interface BulkVerificationResult {
  path: string;
  userId: string | null;
  status: "valid" | "invalid" | "error";
  reason: string;
}

interface BulkProgress {
  current: number;
  total: number;
}

type OutputFormat = "json" | "markdown" | "html" | "plain" | "csv";

@Component({
  selector: "app-report-viewer",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="report-viewer-container">
      <div class="header">
        <h1>📊 Report Viewer</h1>
        <p>View, convert, and verify tamper-evident security reports</p>
      </div>

      <!-- Main Report Section -->
      <div class="main-report-section">
        <div class="report-file-section">
          <div class="file-actions">
            <h2>📁 Open Report File</h2>
            <button class="btn btn-primary" (click)="openFileDialog()">
              📁 Select Report File
            </button>
            <input
              type="file"
              #fileInput
              accept=".json,.html,.pdf,.md,.txt"
              (change)="onFileSelected($event)"
              style="display: none;"
            />
          </div>

          @if (selectedReportPath()) {
            <div class="current-file-info">
              <h3>Current Report</h3>
              <div class="file-details">
                <div class="detail-item">
                  <span class="label">File:</span>
                  <span class="value">{{
                    getFileName(selectedReportPath()!)
                  }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Path:</span>
                  <span class="value path">{{ selectedReportPath() }}</span>
                </div>
                @if (currentReportData()) {
                  <div class="detail-item">
                    <span class="label">Profile:</span>
                    <span class="value">{{
                      currentReportData()!.profile
                    }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Timestamp:</span>
                    <span class="value">{{
                      formatTimestamp(currentReportData()!.timestamp)
                    }}</span>
                  </div>
                  @if (currentReportData()!.userId) {
                    <div class="detail-item">
                      <span class="label">User ID:</span>
                      <span class="value user-id">{{
                        currentReportData()!.userId
                      }}</span>
                    </div>
                  }
                  @if (currentReportData()?.hash) {
                    <div class="detail-item">
                      <span class="label">Tamper Hash:</span>
                      <span class="value hash"
                        >{{
                          currentReportData()!.hash!.substring(0, 32)
                        }}...</span
                      >
                    </div>
                  }
                }
              </div>

              <div class="verification-section">
                <button
                  class="btn btn-secondary"
                  [disabled]="isVerifying()"
                  (click)="verifyReport()"
                >
                  @if (isVerifying()) {
                    🔄 Verifying...
                  } @else {
                    🔍 Verify Report Integrity
                  }
                </button>
                @if (verificationResult() !== null) {
                  <div
                    class="verification-result"
                    [class]="getVerificationClass()"
                  >
                    {{ getVerificationText() }}
                  </div>
                }
              </div>
            </div>
          }
        </div>

        @if (reportContent()) {
          <div class="report-content-section">
            <div class="content-header">
              <h2>Report Content</h2>
              <div class="content-controls">
                <div class="format-selector">
                  <label for="outputFormat">Format:</label>
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
                <button class="btn btn-sm" (click)="copyToClipboard()">
                  📋 Copy
                </button>
                <button class="btn btn-sm" (click)="downloadReport()">
                  💾 Download
                </button>
              </div>
            </div>
            <div class="content-viewer">
              @switch (selectedFormat) {
                @case ("json") {
                  <div class="json-viewer">
                    <pre>{{ formatJson(reportContent()!) }}</pre>
                  </div>
                }
                @case ("html") {
                  <div
                    class="html-viewer"
                    [innerHTML]="convertedContent()"
                  ></div>
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
      </div>

      <!-- Report History Section -->
      <div class="report-history-section">
        <div class="section-header">
          <h2>📋 Report History</h2>
          <div class="section-actions">
            <button class="btn btn-sm" (click)="loadReportHistory()">
              � Refresh
            </button>
            <button
              class="btn btn-sm"
              (click)="clearAllHistory()"
              [disabled]="unifiedReports().length === 0"
            >
              🗑️ Clear All
            </button>
          </div>
        </div>

        @if (unifiedReports().length > 0) {
          <div class="reports-grid">
            @for (report of unifiedReports(); track report.id) {
              <div
                class="report-card"
                [class.current-report]="
                  selectedReportPath() === report.reportPath
                "
                [class.report-pass]="report.status === 'pass'"
                [class.report-fail]="report.status === 'fail'"
                [class.report-warning]="report.status === 'warning'"
                (click)="selectReportFromHistory(report)"
              >
                <div class="report-header">
                  <div class="report-title">
                    <span class="report-profile">{{ report.profile }}</span>
                    <span
                      class="report-status"
                      [class]="'status-' + report.status"
                    >
                      {{ getStatusIcon(report.status) }}
                    </span>
                  </div>
                  @if (selectedReportPath() === report.reportPath) {
                    <span class="current-badge">📍 Current</span>
                  }
                  <div class="report-source">
                    <span
                      class="source-badge"
                      [class]="'source-' + report.source"
                    >
                      {{
                        report.source === "fileSystem" ? "📁 File" : "💾 Memory"
                      }}
                    </span>
                  </div>
                </div>

                <div class="report-meta">
                  <div class="meta-item">
                    <span class="meta-label">Date:</span>
                    <span class="meta-value">{{
                      formatTimestamp(report.timestamp)
                    }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Results:</span>
                    <div class="meta-value results">
                      <span class="stat pass">✅ {{ report.passed }}</span>
                      <span class="stat fail">❌ {{ report.failed }}</span>
                      <span class="stat warning">⚠️ {{ report.warnings }}</span>
                    </div>
                  </div>
                  @if (report.reportPath) {
                    <div class="meta-item">
                      <span class="meta-label">Path:</span>
                      <span class="meta-value path">{{
                        getFileName(report.reportPath)
                      }}</span>
                    </div>
                  }
                </div>

                <div class="report-actions">
                  @if (report.reportPath) {
                    <button
                      class="btn btn-xs"
                      (click)="copyReportPath(report.reportPath!, $event)"
                    >
                      📋 Copy Path
                    </button>
                  }
                  <button
                    class="btn btn-xs btn-danger"
                    (click)="deleteReport(report, $event)"
                  >
                    �️ Delete
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <div class="icon">📄</div>
            <p>No security reports found</p>
            <p>Run a security check or open a report file to see history</p>
            <button class="btn btn-primary" routerLink="/security-check">
              🔍 Run Security Check
            </button>
          </div>
        }
      </div>

      <!-- Bulk Verification Section -->
      <div class="bulk-verification-section">
        <h2>🔍 Bulk Report Verification</h2>
        <p>Verify multiple reports at once and generate a summary CSV</p>

        <div class="bulk-actions">
          <button class="btn btn-primary" (click)="selectMultipleFiles()">
            📁 Select Files
          </button>
          <button class="btn btn-primary" (click)="selectDirectory()">
            📂 Select Directory
          </button>

          @if (bulkFiles().length > 0) {
            <button
              class="btn btn-success"
              [disabled]="isBulkVerifying()"
              (click)="verifyBulkReports()"
            >
              @if (isBulkVerifying()) {
                🔄 Verifying {{ bulkProgress().current }}/{{
                  bulkProgress().total
                }}...
              } @else {
                ✅ Verify {{ bulkFiles().length }} Reports
              }
            </button>
          }
        </div>

        @if (bulkFiles().length > 0) {
          <div class="bulk-files-list">
            <h3>Selected Files ({{ bulkFiles().length }})</h3>
            <div class="files-grid">
              @for (file of bulkFiles(); track file.path) {
                <div class="file-item" [class]="getFileStatusClass(file)">
                  <div class="file-info">
                    <span class="file-name">{{ getFileName(file.path) }}</span>
                    <span class="file-path">{{ file.path }}</span>
                  </div>
                  <div class="file-status">
                    @if (file.verificationStatus === "pending") {
                      ⏳ Pending
                    } @else if (file.verificationStatus === "verifying") {
                      🔄 Verifying...
                    } @else if (file.verificationStatus === "valid") {
                      ✅ Valid
                    } @else if (file.verificationStatus === "invalid") {
                      ❌ Invalid
                    } @else if (file.verificationStatus === "error") {
                      ⚠️ Error
                    }
                  </div>
                  <button
                    class="btn btn-xs btn-remove"
                    (click)="removeFile(file.path)"
                  >
                    ✕
                  </button>
                </div>
              }
            </div>
          </div>
        }

        @if (bulkResults().length > 0) {
          <div class="bulk-results">
            <div class="results-header">
              <h3>Verification Results</h3>
              <button
                class="btn btn-secondary"
                (click)="downloadBulkResultsCSV()"
              >
                📊 Download CSV
              </button>
            </div>
            <div class="results-summary">
              <div class="summary-item valid">
                <span class="count">{{ getBulkSummary().valid }}</span>
                <span class="label">Valid</span>
              </div>
              <div class="summary-item invalid">
                <span class="count">{{ getBulkSummary().invalid }}</span>
                <span class="label">Invalid</span>
              </div>
              <div class="summary-item error">
                <span class="count">{{ getBulkSummary().error }}</span>
                <span class="label">Errors</span>
              </div>
            </div>
            <div class="results-table">
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>User ID</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  @for (result of bulkResults(); track result.path) {
                    <tr [class]="'row-' + result.status">
                      <td>{{ getFileName(result.path) }}</td>
                      <td>{{ result.userId || "N/A" }}</td>
                      <td>
                        @if (result.status === "valid") {
                          <span class="status-badge valid">✅ Pass</span>
                        } @else if (result.status === "invalid") {
                          <span class="status-badge invalid">❌ Fail</span>
                        } @else {
                          <span class="status-badge error">⚠️ Error</span>
                        }
                      </td>
                      <td>{{ result.reason }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>

      @if (selectedReportPath()) {
        <div class="empty-state">
          <div class="icon">📄</div>
          <p>No security reports found</p>
          <p>Open a report file to view and verify its contents</p>
        </div>
      }

      @if (message()) {
        <div class="message" [class]="'message-' + messageType()">
          {{ message() }}
        </div>
      }
    </div>
  `,
  styleUrls: ["./report-viewer.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportViewerComponent implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly reportService = inject(ReportService);
  private readonly _selectedReportPath = signal<string | null>(null);
  private readonly _reportContent = signal<string | null>(null);
  private readonly _originalReport = signal<SecurityCheckReport | null>(null);
  private readonly _currentReportData = signal<SecurityCheckReport | null>(
    null,
  );
  private readonly _verificationResult = signal<boolean | null>(null);
  private readonly _isVerifying = signal(false);
  private readonly _recentReports = signal<ReportFile[]>([]);
  private readonly _unifiedReports = signal<
    import("../../services/report.service").ReportHistory[]
  >([]);
  private readonly _message = signal<string>("");
  private readonly _messageType = signal<"success" | "error" | "info">("info");
  private readonly _convertedContent = signal<string>("");

  // Bulk verification signals
  private readonly _bulkFiles = signal<ReportFile[]>([]);
  private readonly _isBulkVerifying = signal(false);
  private readonly _bulkProgress = signal<BulkProgress>({
    current: 0,
    total: 0,
  });
  private readonly _bulkResults = signal<BulkVerificationResult[]>([]);

  readonly selectedReportPath = this._selectedReportPath.asReadonly();
  readonly reportContent = this._reportContent.asReadonly();
  readonly currentReportData = this._currentReportData.asReadonly();
  readonly verificationResult = this._verificationResult.asReadonly();
  readonly isVerifying = this._isVerifying.asReadonly();
  readonly recentReports = this._recentReports.asReadonly();
  readonly unifiedReports = this._unifiedReports.asReadonly();
  readonly message = this._message.asReadonly();
  readonly messageType = this._messageType.asReadonly();
  readonly convertedContent = this._convertedContent.asReadonly();

  // Bulk verification readonly signals
  readonly bulkFiles = this._bulkFiles.asReadonly();
  readonly isBulkVerifying = this._isBulkVerifying.asReadonly();
  readonly bulkProgress = this._bulkProgress.asReadonly();
  readonly bulkResults = this._bulkResults.asReadonly();

  selectedFormat: OutputFormat = "json";

  ngOnInit(): void {
    this.loadRecentReports();
    this.loadReportHistory(); // Load unified reports

    // Check if there's a shared report from another component
    const sharedReport = this.reportService.currentReport();
    const sharedPath = this.reportService.currentReportPath();

    if (sharedReport) {
      this._originalReport.set(sharedReport);
      this._currentReportData.set(sharedReport);
      this._selectedReportPath.set(sharedPath);
      this._reportContent.set(JSON.stringify(sharedReport, null, 2));
      this.convertContent();

      // Clear the shared report to prevent stale data
      this.reportService.clearReport();
    }
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
          this._currentReportData.set(parsed);
        }
      } catch {
        // Not a JSON security report, that's okay
      }

      this._verificationResult.set(null);
      this.convertContent();
      this.showMessage(`Loaded report: ${file.name}`, "success");
    } catch (error) {
      console.error("Failed to read file:", error);
      this.showMessage("Failed to read file", "error");
    }
  }

  async selectReport(path: string): Promise<void> {
    try {
      this._selectedReportPath.set(path);

      // Load the actual report content from the file system
      const reportData = await this.electronService.loadReportFromPath(path);
      this._originalReport.set(reportData);
      this._currentReportData.set(reportData);
      this._reportContent.set(JSON.stringify(reportData, null, 2));
      this._verificationResult.set(null);
      this.convertContent();
      this.showMessage(`Selected report: ${this.getFileName(path)}`, "info");
    } catch (error) {
      console.error("Failed to load report:", error);
      this.showMessage("Failed to load report", "error");
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
          "Report verification successful - integrity confirmed",
          "success",
        );
      } else {
        this.showMessage(
          "Report verification failed - file may be modified or corrupted",
          "error",
        );
      }
    } catch (error) {
      console.error("Verification failed:", error);
      this.showMessage(
        "Verification failed - unable to check report integrity",
        "error",
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
        "success",
      );
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      this.showMessage("Failed to copy to clipboard", "error");
    }
  }

  downloadReport(): void {
    if (!this.convertedContent() || !this.selectedReportPath()) return;

    const content = this.convertedContent();
    const fileName = this.getDownloadFileName();
    const mimeType = this.getMimeType();

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showMessage(`Downloaded report as ${fileName}`, "success");
  }

  private convertContent(): void {
    if (!this._originalReport()) {
      this._convertedContent.set(this._reportContent() || "");
      return;
    }

    const report = this._originalReport()!;
    let converted = "";

    switch (this.selectedFormat) {
      case "json":
        converted = JSON.stringify(report, null, 2);
        break;
      case "markdown":
        converted = this.convertToMarkdown(report);
        break;
      case "html":
        converted = this.convertToHtml(report);
        break;
      case "plain":
        converted = this.convertToPlainText(report);
        break;
      case "csv":
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
        check.status === "pass" ? "✅" : check.status === "fail" ? "❌" : "⚠️";
      md += `### ${icon} ${check.name}\n\n`;
      md += `**Status:** ${check.status.toUpperCase()}\n`;
      md += `**Message:** ${check.message}\n`;
      if (check.details) {
        md += `**Details:** ${check.details}\n`;
      }
      if (check.risk) {
        md += `**Risk Level:** ${check.risk.toUpperCase()}\n`;
      }
      md += "\n";
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
        check.status === "pass" ? "✅" : check.status === "fail" ? "❌" : "⚠️";
      html += `
        <div class="check-item status-${check.status}">
          <h3>${icon} ${check.name}</h3>
          <p class="check-message">${check.message}</p>
          ${check.details ? `<p class="check-details">${check.details}</p>` : ""}
          ${check.risk ? `<p class="check-risk">Risk Level: <span class="risk-${check.risk}">${check.risk.toUpperCase()}</span></p>` : ""}
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
        check.status === "pass"
          ? "PASS"
          : check.status === "fail"
            ? "FAIL"
            : "WARNING";
      text += `${index + 1}. ${check.name} - ${status}\n`;
      text += `   Message: ${check.message}\n`;
      if (check.details) {
        text += `   Details: ${check.details}\n`;
      }
      if (check.risk) {
        text += `   Risk Level: ${check.risk.toUpperCase()}\n`;
      }
      text += "\n";
    });

    return text;
  }

  private convertToCsv(report: SecurityCheckReport): string {
    let csv = "Check Name,Status,Message,Details,Risk Level\n";

    report.checks.forEach((check) => {
      const name = this.escapeCsv(check.name);
      const status = check.status;
      const message = this.escapeCsv(check.message);
      const details = this.escapeCsv(check.details || "");
      const risk = check.risk || "";

      csv += `${name},${status},${message},${details},${risk}\n`;
    });

    return csv;
  }

  private escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private getDownloadFileName(): string {
    const baseName = this.getFileName(this.selectedReportPath()!).replace(
      /\.[^/.]+$/,
      "",
    );
    const extension = this.getFileExtension();
    return `${baseName}.${extension}`;
  }

  private getFileExtension(): string {
    switch (this.selectedFormat) {
      case "json":
        return "json";
      case "markdown":
        return "md";
      case "html":
        return "html";
      case "plain":
        return "txt";
      case "csv":
        return "csv";
      default:
        return "txt";
    }
  }

  private getMimeType(): string {
    switch (this.selectedFormat) {
      case "json":
        return "application/json";
      case "markdown":
        return "text/markdown";
      case "html":
        return "text/html";
      case "plain":
        return "text/plain";
      case "csv":
        return "text/csv";
      default:
        return "text/plain";
    }
  }

  private async extractUserIdFromFile(path: string): Promise<string | null> {
    try {
      const reportData = await this.electronService.loadReportFromPath(path);
      return reportData.userId || null;
    } catch {
      return null;
    }
  }

  getBulkSummary(): { valid: number; invalid: number; error: number } {
    const results = this._bulkResults();
    return {
      valid: results.filter((r) => r.status === "valid").length,
      invalid: results.filter((r) => r.status === "invalid").length,
      error: results.filter((r) => r.status === "error").length,
    };
  }

  getFileStatusClass(file: ReportFile): string {
    return `file-status-${file.verificationStatus || "pending"}`;
  }

  downloadBulkResultsCSV(): void {
    const results = this._bulkResults();
    if (results.length === 0) return;

    const csvHeader = "File,User ID,Status,Reason\n";
    const csvContent = results
      .map(
        (result) =>
          `"${this.getFileName(result.path)}","${result.userId || "N/A"}","${result.status}","${result.reason}"`,
      )
      .join("\n");

    const csvData = csvHeader + csvContent;
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `bulk-verification-results-${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    this.showMessage("CSV file downloaded successfully", "success");
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  getVerificationClass(): string {
    const result = this.verificationResult();
    if (result === null) return "";
    return result ? "verification-valid" : "verification-invalid";
  }

  getVerificationText(): string {
    const result = this.verificationResult();
    if (result === null) return "";
    return result ? "✅ Valid & Unmodified" : "❌ Invalid or Modified";
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  getFileName(path: string): string {
    return path.split("/").pop() || path.split("\\").pop() || path;
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

  private async loadRecentReports(): Promise<void> {
    try {
      const reports = await this.electronService.loadRecentReports();
      this._recentReports.set(reports);
    } catch (error) {
      console.error("Failed to load recent reports:", error);
      this._recentReports.set([]);
    }
  }

  private showMessage(
    message: string,
    type: "success" | "error" | "info",
  ): void {
    this._message.set(message);
    this._messageType.set(type);

    setTimeout(() => {
      this._message.set("");
    }, 5000);
  }

  async selectMultipleFiles(): Promise<void> {
    try {
      const files = await this.electronService.selectFiles(
        [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
        true,
      );

      if (files && files.length > 0) {
        const reportFiles: ReportFile[] = files.map((filePath: string) => ({
          path: filePath,
          name: filePath.split("/").pop() || filePath,
          timestamp: new Date().toISOString(),
          size: "Unknown",
          verificationStatus: "pending" as const,
        }));

        this._bulkFiles.set([...this._bulkFiles(), ...reportFiles]);
        this.showMessage(
          `Added ${files.length} files for bulk verification`,
          "success",
        );
      }
    } catch (error) {
      console.error("Failed to select files:", error);
      this.showMessage("Failed to select files", "error");
    }
  }

  async selectDirectory(): Promise<void> {
    try {
      const directory = await this.electronService.selectDirectory();

      if (directory) {
        // Get all JSON files from the directory
        const files = await this.electronService.getFilesFromDirectory(
          directory,
          ".json",
        );

        if (files && files.length > 0) {
          const reportFiles: ReportFile[] = files.map((filePath: string) => ({
            path: filePath,
            name: filePath.split("/").pop() || filePath,
            timestamp: new Date().toISOString(),
            size: "Unknown",
            verificationStatus: "pending" as const,
          }));

          this._bulkFiles.set([...this._bulkFiles(), ...reportFiles]);
          this.showMessage(
            `Added ${files.length} files from directory for bulk verification`,
            "success",
          );
        } else {
          this.showMessage("No JSON files found in selected directory", "info");
        }
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
      this.showMessage("Failed to select directory", "error");
    }
  }

  async verifyBulkReports(): Promise<void> {
    const files = this._bulkFiles();
    if (files.length === 0) {
      this.showMessage("No files selected for verification", "error");
      return;
    }

    this._isBulkVerifying.set(true);
    this._bulkProgress.set({ current: 0, total: files.length });
    this._bulkResults.set([]);

    const results: BulkVerificationResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this._bulkProgress.set({ current: i + 1, total: files.length });

      // Update file status
      const updatedFiles = [...files];
      updatedFiles[i] = { ...file, verificationStatus: "verifying" };
      this._bulkFiles.set(updatedFiles);

      try {
        const isVerified = await this.electronService.verifyReport(file.path);
        const report = await this.electronService.loadReport(file.path);

        const bulkResult: BulkVerificationResult = {
          path: file.path,
          userId: report?.metadata?.userId || report?.userId || null,
          status: isVerified ? "valid" : "invalid",
          reason: isVerified ? "Signature valid" : "Invalid signature",
        };

        results.push(bulkResult);

        // Update file status
        updatedFiles[i] = {
          ...file,
          verificationStatus: isVerified ? "valid" : "invalid",
          verified: isVerified,
        };
        this._bulkFiles.set([...updatedFiles]);
      } catch (error) {
        const bulkResult: BulkVerificationResult = {
          path: file.path,
          userId: null,
          status: "error",
          reason: error instanceof Error ? error.message : "Unknown error",
        };

        results.push(bulkResult);

        // Update file status
        updatedFiles[i] = { ...file, verificationStatus: "error" };
        this._bulkFiles.set([...updatedFiles]);
      }
    }

    this._bulkResults.set(results);
    this._isBulkVerifying.set(false);

    const validCount = results.filter((r) => r.status === "valid").length;
    const invalidCount = results.filter((r) => r.status === "invalid").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    this.showMessage(
      `Bulk verification completed: ${validCount} valid, ${invalidCount} invalid, ${errorCount} errors`,
      validCount === results.length ? "success" : "info",
    );
  }

  removeFile(filePath: string): void {
    const currentFiles = this._bulkFiles();
    const updatedFiles = currentFiles.filter((file) => file.path !== filePath);
    this._bulkFiles.set(updatedFiles);
    this.showMessage("File removed from bulk verification list", "info");
  }

  // New methods for enhanced report management
  loadReportHistory(): void {
    this._unifiedReports.set(this.reportService.getUnifiedReports());
    this.showMessage("Report history refreshed", "info");
  }

  async clearAllHistory(): Promise<void> {
    try {
      // Clear localStorage reports
      localStorage.removeItem("eai-security-reports");
      this._unifiedReports.set([]);
      this.showMessage("All report history cleared", "success");
    } catch (error) {
      console.error("Failed to clear history:", error);
      this.showMessage("Failed to clear report history", "error");
    }
  }

  selectReportFromHistory(
    report: import("../../services/report.service").ReportHistory,
  ): void {
    if (report.reportPath) {
      this.selectReport(report.reportPath);
    } else {
      // Handle localStorage-only reports
      this.showMessage(
        `Report ${report.profile} (${new Date(report.timestamp).toLocaleDateString()}) - no file path available`,
        "info",
      );
    }
  }

  async deleteReport(
    report: import("../../services/report.service").ReportHistory,
    event: Event,
  ): Promise<void> {
    event.stopPropagation();

    if (
      !confirm(
        `Are you sure you want to delete the ${report.profile} report from ${new Date(report.timestamp).toLocaleDateString()}?`,
      )
    ) {
      return;
    }

    try {
      const success = await this.reportService.deleteReport(report.id);
      if (success) {
        this.loadReportHistory(); // Refresh the list
        this.showMessage("Report deleted successfully", "success");

        // If this was the currently selected report, clear it
        if (this.selectedReportPath() === report.reportPath) {
          this._selectedReportPath.set(null);
          this._reportContent.set(null);
          this._currentReportData.set(null);
        }
      } else {
        this.showMessage("Failed to delete report", "error");
      }
    } catch (error) {
      console.error("Failed to delete report:", error);
      this.showMessage("Failed to delete report", "error");
    }
  }

  copyReportPath(path: string, event: Event): void {
    event.stopPropagation();
    navigator.clipboard
      .writeText(path)
      .then(() => {
        this.showMessage("Report path copied to clipboard", "success");
      })
      .catch(() => {
        this.showMessage("Failed to copy path to clipboard", "error");
      });
  }

  getStatusIcon(status: "pass" | "fail" | "warning"): string {
    switch (status) {
      case "pass":
        return "✅";
      case "fail":
        return "❌";
      case "warning":
        return "⚠️";
      default:
        return "❓";
    }
  }
}
