import { ChangeDetectionStrategy, Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../services/electron.service';

interface ReportFile {
  path: string;
  name: string;
  timestamp: string;
  size: string;
  verified?: boolean;
}

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="report-viewer-container">
      <div class="header">
        <h1>📊 Report Viewer</h1>
        <p>View and verify tamper-evident security reports</p>
      </div>

      <div class="report-actions">
        <div class="upload-section">
          <button class="btn btn-primary" (click)="openFileDialog()">
            📁 Open Report File
          </button>
          <input 
            type="file" 
            #fileInput 
            accept=".json,.html,.pdf" 
            (change)="onFileSelected($event)"
            style="display: none;"
          />
        </div>

        <div class="verification-section">
          <button 
            class="btn btn-secondary" 
            [disabled]="!selectedReportPath() || isVerifying()"
            (click)="verifyReport()">
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
          <h2>Current Report</h2>
          <div class="report-info">
            <div class="info-item">
              <span class="label">File:</span>
              <span class="value">{{ getFileName(selectedReportPath()!) }}</span>
            </div>
            @if (verificationResult()) {
              <div class="info-item">
                <span class="label">Verification:</span>
                <span class="value" [class]="'verification-' + (verificationResult()! ? 'valid' : 'invalid')">
                  {{ verificationResult()! ? '✅ Valid & Unmodified' : '❌ Invalid or Modified' }}
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
                    <span class="verification-badge" [class]="'badge-' + (report.verified ? 'valid' : 'invalid')">
                      {{ report.verified ? '✅' : '❌' }}
                    </span>
                  }
                </div>
                <div class="report-meta">
                  <div class="meta-item">
                    <span class="meta-label">Date:</span>
                    <span class="meta-value">{{ formatDate(report.timestamp) }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Size:</span>
                    <span class="meta-value">{{ report.size }}</span>
                  </div>
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
          <h2>Report Content</h2>
          <div class="content-viewer">
            @if (isJsonReport()) {
              <div class="json-viewer">
                <pre>{{ formatJson(reportContent()!) }}</pre>
              </div>
            } @else {
              <div class="text-viewer">
                <pre>{{ reportContent() }}</pre>
              </div>
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportViewerComponent implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly _selectedReportPath = signal<string | null>(null);
  private readonly _reportContent = signal<string | null>(null);
  private readonly _verificationResult = signal<boolean | null>(null);
  private readonly _isVerifying = signal(false);
  private readonly _recentReports = signal<ReportFile[]>([]);
  private readonly _message = signal<string>('');
  private readonly _messageType = signal<'success' | 'error' | 'info'>('info');

  readonly selectedReportPath = this._selectedReportPath.asReadonly();
  readonly reportContent = this._reportContent.asReadonly();
  readonly verificationResult = this._verificationResult.asReadonly();
  readonly isVerifying = this._isVerifying.asReadonly();
  readonly recentReports = this._recentReports.asReadonly();
  readonly message = this._message.asReadonly();
  readonly messageType = this._messageType.asReadonly();

  ngOnInit(): void {
    this.loadRecentReports();
  }

  openFileDialog(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
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
      this._verificationResult.set(null);
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
      // For now, simulate loading
      this._reportContent.set('Report content would be loaded here...');
      this._verificationResult.set(null);
      this.showMessage(`Selected report: ${this.getFileName(path)}`, 'info');
    } catch (error) {
      console.error('Failed to load report:', error);
      this.showMessage('Failed to load report', 'error');
    }
  }

  async verifyReport(): Promise<void> {
    if (!this.selectedReportPath()) return;

    this._isVerifying.set(true);
    try {
      const result = await this.electronService.verifyReport(this.selectedReportPath()!);
      this._verificationResult.set(result);
      
      if (result) {
        this.showMessage('Report verification successful - integrity confirmed', 'success');
      } else {
        this.showMessage('Report verification failed - file may be modified or corrupted', 'error');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      this.showMessage('Verification failed - unable to check report integrity', 'error');
      this._verificationResult.set(false);
    } finally {
      this._isVerifying.set(false);
    }
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
        verified: true
      },
      {
        path: '/reports/security-check-2023-11-30.json',
        name: 'security-check-2023-11-30.json',
        timestamp: '2023-11-30T10:00:00Z',
        size: '43.8 KB',
        verified: true
      },
      {
        path: '/reports/security-check-2023-11-29.json',
        name: 'security-check-2023-11-29.json',
        timestamp: '2023-11-29T10:00:00Z',
        size: '44.1 KB',
        verified: false
      }
    ];
    
    this._recentReports.set(mockReports);
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  isJsonReport(): boolean {
    if (!this.reportContent()) return false;
    
    try {
      JSON.parse(this.reportContent()!);
      return true;
    } catch {
      return false;
    }
  }

  formatJson(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this._message.set(message);
    this._messageType.set(type);
    
    setTimeout(() => {
      this._message.set('');
    }, 5000);
  }
}