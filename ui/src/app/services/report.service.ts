import { Injectable, signal } from '@angular/core';
import { SecurityCheckReport } from './electron.service';

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

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly _currentReport = signal<SecurityCheckReport | null>(null);
  private readonly _currentReportPath = signal<string | null>(null);
  private readonly _reportHistory = signal<ReportHistory[]>([]);

  readonly currentReport = this._currentReport.asReadonly();
  readonly currentReportPath = this._currentReportPath.asReadonly();
  readonly reportHistory = this._reportHistory.asReadonly();

  constructor() {
    this.loadReportHistory();
  }

  setReport(report: SecurityCheckReport, path?: string): void {
    this._currentReport.set(report);
    this._currentReportPath.set(path || null);
    
    // Save this report to history
    this.saveReportToHistory(report);
  }

  clearReport(): void {
    this._currentReport.set(null);
    this._currentReportPath.set(null);
  }

  hasReport(): boolean {
    return this._currentReport() !== null;
  }

  private loadReportHistory(): void {
    try {
      const stored = localStorage.getItem('eai-security-reports');
      if (stored) {
        const reports = JSON.parse(stored);
        this._reportHistory.set(reports);
      }
    } catch (error) {
      console.error('Failed to load report history:', error);
    }
  }

  private saveReportToHistory(report: SecurityCheckReport): void {
    const historyItem: ReportHistory = {
      id: Date.now().toString(),
      timestamp: report.timestamp,
      profile: report.profile,
      status: report.summary.overallStatus,
      passed: report.summary.passed,
      failed: report.summary.failed,
      warnings: report.summary.warnings,
    };

    const current = this._reportHistory();
    const updated = [historyItem, ...current].slice(0, 10); // Keep last 10

    try {
      localStorage.setItem('eai-security-reports', JSON.stringify(updated));
      this._reportHistory.set(updated);
    } catch (error) {
      console.error('Failed to save report history:', error);
    }
  }

  getReportHistory(): ReportHistory[] {
    return this._reportHistory();
  }
}