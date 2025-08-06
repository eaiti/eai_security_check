import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, ActivatedRoute } from "@angular/router";
import { DashboardComponent } from "./dashboard.component";
import {
  ElectronService,
  RecentReportData,
} from "../../services/electron.service";
import { ReportService, ReportHistory } from "../../services/report.service";

describe("DashboardComponent", () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockElectronService: jasmine.SpyObj<ElectronService>;
  // let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const electronSpy = jasmine.createSpyObj("ElectronService", [
      "isElectron",
      "cliVersion",
      "platformInfo",
      "loadRecentReports",
      "getConfigDirectory",
      "getReportsDirectory",
      "loadReportFromPath",
    ]);
    const reportSpy = jasmine.createSpyObj("ReportService", [
      "getReportHistory",
      "loadReport",
      "getLastReport",
      "setReport",
    ]);
    const routerSpy = jasmine.createSpyObj("Router", ["navigate"]);

    // Set up default return values
    electronSpy.isElectron.and.returnValue(false);
    electronSpy.cliVersion.and.returnValue("1.1.0");
    electronSpy.platformInfo.and.returnValue({
      platform: "darwin",
      arch: "x64",
      version: "14.0.0",
    });
    electronSpy.loadRecentReports.and.returnValue(Promise.resolve([]));
    electronSpy.getConfigDirectory.and.returnValue(
      Promise.resolve("/test/config"),
    );
    electronSpy.getReportsDirectory.and.returnValue(
      Promise.resolve("/test/reports"),
    );

    reportSpy.getReportHistory.and.returnValue([]);
    reportSpy.getLastReport.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ElectronService, useValue: electronSpy },
        { provide: ReportService, useValue: reportSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: {} },
            params: { subscribe: () => ({}) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    mockElectronService = TestBed.inject(
      ElectronService,
    ) as jasmine.SpyObj<ElectronService>;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize system status on ngOnInit", async () => {
    await component.ngOnInit();

    expect(component.systemStatus()).toBeDefined();
    expect(component.systemStatus().version).toBe("1.1.0");
  });

  it("should load recent reports", async () => {
    const mockRecentData: RecentReportData[] = [
      {
        path: "/path/to/report.json",
        name: "report.json",
        timestamp: new Date().toISOString(),
        size: "1.2KB",
      },
    ];

    mockElectronService.loadRecentReports.and.returnValue(
      Promise.resolve(mockRecentData),
    );

    await component.ngOnInit();

    // The component should have loaded system status
    expect(component.systemStatus().reportSource).toBe("mock");
  });

  it("should copy report data to clipboard", () => {
    const mockReport: ReportHistory = {
      id: "1",
      timestamp: new Date().toISOString(),
      profile: "default",
      status: "pass",
      passed: 5,
      failed: 2,
      warnings: 1,
      source: "localStorage",
    };

    spyOn(console, "log");

    component.copyReport(mockReport);

    expect(console.log).toHaveBeenCalledWith("Copy report:", mockReport);
  });

  it("should return correct status icon", () => {
    expect(component.getStatusIcon("pass")).toBe("✅");
    expect(component.getStatusIcon("fail")).toBe("❌");
    expect(component.getStatusIcon("warning")).toBe("⚠️");
    expect(component.getStatusIcon("unknown")).toBe("❓");
  });

  it("should format timestamp correctly", () => {
    const timestamp = "2023-01-01T10:00:00.000Z";
    const formatted = component.formatTimestamp(timestamp);

    // The method returns relative time like "X days ago"
    expect(formatted).toContain("days ago");
    expect(formatted).toMatch(/\d+ days? ago/);
  });

  it("should get daemon status text", () => {
    const statusText = component.getDaemonStatusText();
    expect(typeof statusText).toBe("string");
    expect(statusText.length).toBeGreaterThan(0);
  });

  it("should get daemon status class", () => {
    const statusClass = component.getDaemonStatusClass();
    expect(typeof statusClass).toBe("string");
    expect(statusClass.length).toBeGreaterThan(0);
  });

  it("should get report source text", () => {
    const sourceText = component.getReportSourceText();
    expect(typeof sourceText).toBe("string");
    expect(sourceText.length).toBeGreaterThan(0);
  });

  it("should handle initialization errors gracefully", async () => {
    mockElectronService.getConfigDirectory.and.returnValue(
      Promise.reject(new Error("Config failed")),
    );

    await component.ngOnInit();

    // Should still create basic system status
    expect(component.systemStatus()).toBeDefined();
    expect(component.systemStatus().daemonStatus).toBe("not_configured");
  });
});
