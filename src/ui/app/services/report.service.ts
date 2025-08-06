import { Injectable, signal, inject } from "@angular/core";
import { SecurityCheckReport } from "./electron.service";
import { ElectronService } from "./electron.service";

export interface ReportHistory {
  id: string;
  timestamp: string;
  profile: string;
  status: "pass" | "fail" | "warning";
  passed: number;
  failed: number;
  warnings: number;
  reportPath?: string;
  source: "localStorage" | "fileSystem";
}

export interface ReportFile {
  path: string;
  name: string;
  timestamp: string;
  size: string;
  profile?: string;
  status?: "pass" | "fail" | "warning";
}

@Injectable({
  providedIn: "root",
})
export class ReportService {
  private readonly electronService = inject(ElectronService);
  private readonly _currentReport = signal<SecurityCheckReport | null>(null);
  private readonly _currentReportPath = signal<string | null>(null);
  private readonly _reportHistory = signal<ReportHistory[]>([]);
  private readonly _fileSystemReports = signal<ReportFile[]>([]);
  private readonly _isLoadingReports = signal(false);

  readonly currentReport = this._currentReport.asReadonly();
  readonly currentReportPath = this._currentReportPath.asReadonly();
  readonly reportHistory = this._reportHistory.asReadonly();
  readonly fileSystemReports = this._fileSystemReports.asReadonly();
  readonly isLoadingReports = this._isLoadingReports.asReadonly();

  constructor() {
    this.loadReportHistory();
    this.loadFileSystemReports();
  }

  setReport(report: SecurityCheckReport, path?: string): void {
    this._currentReport.set(report);
    this._currentReportPath.set(path || null);

    // Save this report to history
    this.saveReportToHistory(report, path);
  }

  clearReport(): void {
    this._currentReport.set(null);
    this._currentReportPath.set(null);
  }

  hasReport(): boolean {
    return this._currentReport() !== null;
  }

  async loadFileSystemReports(): Promise<void> {
    try {
      this._isLoadingReports.set(true);
      // For now, return empty array until we implement getReportFiles in ElectronService
      this._fileSystemReports.set([]);
    } catch (error) {
      console.error("Failed to load file system reports:", error);
    } finally {
      this._isLoadingReports.set(false);
    }
  }

  async deleteReport(reportId: string): Promise<boolean> {
    try {
      // Remove from localStorage history
      const current = this._reportHistory();
      const updated = current.filter((report) => report.id !== reportId);

      localStorage.setItem("eai-security-reports", JSON.stringify(updated));
      this._reportHistory.set(updated);

      // If it's a file system report, also delete the file
      const historyItem = current.find((report) => report.id === reportId);
      if (historyItem?.reportPath && historyItem.source === "fileSystem") {
        // For now, skip file deletion until we implement deleteReportFile
        await this.loadFileSystemReports(); // Refresh file system reports
      }

      return true;
    } catch (error) {
      console.error("Failed to delete report:", error);
      return false;
    }
  }

  getUnifiedReports(): ReportHistory[] {
    const localStorageReports = this._reportHistory();
    const fileSystemMapped = this._fileSystemReports().map((file) => ({
      id: file.path,
      timestamp: file.timestamp,
      profile: file.profile || "unknown",
      status: file.status || ("warning" as "pass" | "fail" | "warning"),
      passed: 0, // Will be loaded when opened
      failed: 0,
      warnings: 0,
      reportPath: file.path,
      source: "fileSystem" as const,
    }));

    // Combine and deduplicate by path
    const pathMap = new Map<string, ReportHistory>();

    // Add localStorage reports first
    localStorageReports.forEach((report) => {
      if (report.reportPath) {
        pathMap.set(report.reportPath, { ...report, source: "localStorage" });
      }
    });

    // Add file system reports, but don't overwrite if already exists in localStorage
    fileSystemMapped.forEach((report) => {
      if (!pathMap.has(report.reportPath!)) {
        pathMap.set(report.reportPath!, report);
      }
    });

    // Convert back to array and sort by timestamp
    return Array.from(pathMap.values()).sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  private loadReportHistory(): void {
    try {
      const stored = localStorage.getItem("eai-security-reports");
      if (stored) {
        const reports = JSON.parse(stored).map((report: any) => ({
          ...report,
          source: report.source || "localStorage",
        }));
        this._reportHistory.set(reports);
      }
    } catch (error) {
      console.error("Failed to load report history:", error);
    }
  }

  private saveReportToHistory(
    report: SecurityCheckReport,
    path?: string,
  ): void {
    const historyItem: ReportHistory = {
      id: Date.now().toString(),
      timestamp: report.timestamp,
      profile: report.profile,
      status: report.summary.overallStatus,
      passed: report.summary.passed,
      failed: report.summary.failed,
      warnings: report.summary.warnings,
      reportPath: path,
      source: path ? "fileSystem" : "localStorage",
    };

    const current = this._reportHistory();
    const updated = [historyItem, ...current].slice(0, 20); // Keep last 20

    try {
      localStorage.setItem("eai-security-reports", JSON.stringify(updated));
      this._reportHistory.set(updated);
    } catch (error) {
      console.error("Failed to save report history:", error);
    }
  }

  getReportHistory(): ReportHistory[] {
    return this._reportHistory();
  }
}
