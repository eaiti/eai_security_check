import { Injectable, signal } from '@angular/core';
import { SecurityCheckReport } from './electron.service';

@Injectable({
  providedIn: 'root',
})
export class ReportService {
  private readonly _currentReport = signal<SecurityCheckReport | null>(null);
  private readonly _currentReportPath = signal<string | null>(null);

  readonly currentReport = this._currentReport.asReadonly();
  readonly currentReportPath = this._currentReportPath.asReadonly();

  setReport(report: SecurityCheckReport, path?: string): void {
    this._currentReport.set(report);
    this._currentReportPath.set(path || null);
  }

  clearReport(): void {
    this._currentReport.set(null);
    this._currentReportPath.set(null);
  }

  hasReport(): boolean {
    return this._currentReport() !== null;
  }
}