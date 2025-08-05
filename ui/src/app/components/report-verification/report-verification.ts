import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../services/electron.service';
import { ReportService } from '../../services/report.service';

interface ReportFile {
  path: string;
  name: string;
  timestamp: string;
  size: string;
  verified?: boolean;
  verificationStatus?: 'pending' | 'verifying' | 'valid' | 'invalid' | 'error';
}

interface BulkVerificationResult {
  path: string;
  userId: string | null;
  status: 'valid' | 'invalid' | 'error';
  reason: string;
}

interface BulkProgress {
  current: number;
  total: number;
}

@Component({
  selector: 'app-report-verification',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="report-verification-container">
      <div class="header">
        <h1>🔍 Report Verification</h1>
        <p>Verify the integrity and authenticity of security reports</p>
      </div>

      <!-- Single File Verification -->
      <div class="single-verification-section">
        <h2>📄 Single File Verification</h2>
        <div class="verification-actions">
          <button class="btn btn-primary" (click)="selectSingleFile()">
            📁 Select Report File
          </button>
          <input
            type="file"
            #fileInput
            accept=".json,.html,.pdf,.md,.txt"
            (change)="onSingleFileSelected($event)"
            style="display: none;"
          />
        </div>

        @if (selectedFile()) {
          <div class="selected-file-info">
            <h3>Selected File</h3>
            <div class="file-details">
              <div class="detail-item">
                <span class="label">File:</span>
                <span class="value">{{ selectedFile()!.name }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Path:</span>
                <span class="value path">{{ selectedFile()!.path }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Size:</span>
                <span class="value">{{ selectedFile()!.size }}</span>
              </div>
            </div>

            <div class="verification-section">
              <button
                class="btn btn-secondary"
                [disabled]="isSingleVerifying()"
                (click)="verifySingleFile()"
              >
                @if (isSingleVerifying()) {
                  🔄 Verifying...
                } @else {
                  🔍 Verify File Integrity
                }
              </button>
              
              @if (singleVerificationResult() !== null) {
                <div class="verification-result" [class]="getSingleVerificationClass()">
                  {{ getSingleVerificationText() }}
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Bulk Verification Section -->
      <div class="bulk-verification-section">
        <h2>📁 Bulk Report Verification</h2>
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
                🔄 Verifying {{ bulkProgress().current }}/{{ bulkProgress().total }}...
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
                    @if (file.verificationStatus === 'pending') {
                      ⏳ Pending
                    } @else if (file.verificationStatus === 'verifying') {
                      🔄 Verifying...
                    } @else if (file.verificationStatus === 'valid') {
                      ✅ Valid
                    } @else if (file.verificationStatus === 'invalid') {
                      ❌ Invalid
                    } @else if (file.verificationStatus === 'error') {
                      ⚠️ Error
                    }
                  </div>
                  <button class="btn btn-xs btn-remove" (click)="removeFile(file.path)">
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
              <button class="btn btn-secondary" (click)="downloadBulkResultsCSV()">
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
                      <td>{{ result.userId || 'N/A' }}</td>
                      <td>
                        @if (result.status === 'valid') {
                          <span class="status-badge valid">✅ Pass</span>
                        } @else if (result.status === 'invalid') {
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

      @if (message()) {
        <div class="message" [class]="'message-' + messageType()">
          {{ message() }}
        </div>
      }
    </div>
  `,
  styleUrl: './report-verification.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportVerification implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly reportService = inject(ReportService);
  
  // Single file verification
  private readonly _selectedFile = signal<ReportFile | null>(null);
  private readonly _isSingleVerifying = signal(false);
  private readonly _singleVerificationResult = signal<boolean | null>(null);
  
  // Bulk verification signals
  private readonly _bulkFiles = signal<ReportFile[]>([]);
  private readonly _isBulkVerifying = signal(false);
  private readonly _bulkProgress = signal<BulkProgress>({ current: 0, total: 0 });
  private readonly _bulkResults = signal<BulkVerificationResult[]>([]);
  
  // Common signals
  private readonly _message = signal<string>('');
  private readonly _messageType = signal<'success' | 'error' | 'info'>('info');

  readonly selectedFile = this._selectedFile.asReadonly();
  readonly isSingleVerifying = this._isSingleVerifying.asReadonly();
  readonly singleVerificationResult = this._singleVerificationResult.asReadonly();
  readonly bulkFiles = this._bulkFiles.asReadonly();
  readonly isBulkVerifying = this._isBulkVerifying.asReadonly();
  readonly bulkProgress = this._bulkProgress.asReadonly();
  readonly bulkResults = this._bulkResults.asReadonly();
  readonly message = this._message.asReadonly();
  readonly messageType = this._messageType.asReadonly();

  ngOnInit(): void {
    // Component initialization
  }

  selectSingleFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.html,.pdf,.md,.txt';
    input.addEventListener('change', (event) => {
      this.onSingleFileSelected(event);
    });
    input.click();
  }

  onSingleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reportFile: ReportFile = {
      path: file.name,
      name: file.name,
      timestamp: new Date(file.lastModified).toISOString(),
      size: this.formatFileSize(file.size),
    };

    this._selectedFile.set(reportFile);
    this._singleVerificationResult.set(null);
    this.showMessage(`Selected file: ${file.name}`, 'info');
  }

  async verifySingleFile(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this._isSingleVerifying.set(true);
    try {
      const result = await this.electronService.verifyReport(file.path);
      this._singleVerificationResult.set(result);

      if (result) {
        this.showMessage('Report verification successful - integrity confirmed', 'success');
      } else {
        this.showMessage('Report verification failed - file may be modified or corrupted', 'error');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      this.showMessage('Verification failed - unable to check report integrity', 'error');
      this._singleVerificationResult.set(false);
    } finally {
      this._isSingleVerifying.set(false);
    }
  }

  selectMultipleFiles(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.json,.html,.pdf,.md,.txt';
    input.addEventListener('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files) {
        this.addFilesToBulkList(Array.from(files));
      }
    });
    input.click();
  }

  selectDirectory(): void {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    input.addEventListener('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files) {
        const reportFiles = Array.from(files).filter(file => 
          file.name.endsWith('.json') || 
          file.name.endsWith('.html') ||
          file.name.endsWith('.md') ||
          file.name.endsWith('.txt')
        );
        this.addFilesToBulkList(reportFiles);
      }
    });
    input.click();
  }

  private addFilesToBulkList(files: File[]): void {
    const newFiles: ReportFile[] = files.map(file => ({
      path: file.name,
      name: file.name,
      timestamp: new Date(file.lastModified).toISOString(),
      size: this.formatFileSize(file.size),
      verificationStatus: 'pending'
    }));
    
    const currentFiles = this._bulkFiles();
    const uniqueFiles = newFiles.filter(newFile => 
      !currentFiles.some(existing => existing.path === newFile.path)
    );
    
    this._bulkFiles.set([...currentFiles, ...uniqueFiles]);
    this.showMessage(`Added ${uniqueFiles.length} files for bulk verification`, 'success');
  }

  removeFile(path: string): void {
    const currentFiles = this._bulkFiles();
    this._bulkFiles.set(currentFiles.filter(file => file.path !== path));
  }

  async verifyBulkReports(): Promise<void> {
    const files = this._bulkFiles();
    if (files.length === 0) return;

    this._isBulkVerifying.set(true);
    this._bulkProgress.set({ current: 0, total: files.length });
    this._bulkResults.set([]);

    const results: BulkVerificationResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this._bulkProgress.set({ current: i + 1, total: files.length });
      
      // Update file status
      const updatedFiles = [...files];
      updatedFiles[i] = { ...file, verificationStatus: 'verifying' };
      this._bulkFiles.set(updatedFiles);

      try {
        const isValid = await this.electronService.verifyReport(file.path);
        
        updatedFiles[i] = { 
          ...file, 
          verificationStatus: isValid ? 'valid' : 'invalid' 
        };
        this._bulkFiles.set(updatedFiles);

        results.push({
          path: file.path,
          userId: await this.extractUserIdFromFile(file.path),
          status: isValid ? 'valid' : 'invalid',
          reason: isValid ? 'Signature verified successfully' : 'Invalid or missing signature'
        });
      } catch (error) {
        updatedFiles[i] = { ...file, verificationStatus: 'error' };
        this._bulkFiles.set(updatedFiles);

        results.push({
          path: file.path,
          userId: null,
          status: 'error',
          reason: `Verification failed: ${error}`
        });
      }
    }

    this._bulkResults.set(results);
    this._isBulkVerifying.set(false);
    this.showMessage(`Bulk verification completed: ${results.length} files processed`, 'success');
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
      valid: results.filter(r => r.status === 'valid').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      error: results.filter(r => r.status === 'error').length
    };
  }

  getFileStatusClass(file: ReportFile): string {
    return `file-status-${file.verificationStatus || 'pending'}`;
  }

  downloadBulkResultsCSV(): void {
    const results = this._bulkResults();
    if (results.length === 0) return;

    const csvHeader = 'File,User ID,Status,Reason\n';
    const csvContent = results.map(result => 
      `"${this.getFileName(result.path)}","${result.userId || 'N/A'}","${result.status}","${result.reason}"`
    ).join('\n');
    
    const csvData = csvHeader + csvContent;
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `bulk-verification-results-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    this.showMessage('CSV file downloaded successfully', 'success');
  }

  getSingleVerificationClass(): string {
    const result = this.singleVerificationResult();
    if (result === null) return '';
    return result ? 'verification-valid' : 'verification-invalid';
  }

  getSingleVerificationText(): string {
    const result = this.singleVerificationResult();
    if (result === null) return '';
    return result ? '✅ Valid & Unmodified' : '❌ Invalid or Modified';
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path.split('\\').pop() || path;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this._message.set(message);
    this._messageType.set(type);

    setTimeout(() => {
      this._message.set('');
    }, 5000);
  }
}
