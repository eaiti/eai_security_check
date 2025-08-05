import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import {
  DashboardComponent,
  SystemStatus,
} from './dashboard.component';
import { ElectronService } from '../../services/electron.service';
import { ReportService, ReportHistory } from '../../services/report.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockElectronService: jasmine.SpyObj<ElectronService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockReportService: jasmine.SpyObj<ReportService>;

  const mockReportHistory: ReportHistory[] = [
    {
      id: '1',
      timestamp: '2024-01-01T12:00:00Z',
      profile: 'default',
      status: 'pass',
      passed: 8,
      failed: 0,
      warnings: 2,
      reportPath: '/path/to/report1.json',
    },
    {
      id: '2',
      timestamp: '2024-01-02T12:00:00Z',
      profile: 'strict',
      status: 'fail',
      passed: 5,
      failed: 3,
      warnings: 2,
      reportPath: '/path/to/report2.json',
    },
  ];

  const mockSystemStatus: SystemStatus = {
    version: '1.1.0',
    daemonStatus: 'running',
    lastCheck: mockReportHistory[0],
    recentReports: mockReportHistory,
    configExists: true,
    schedulingConfigExists: true,
    configDirectory: '~/.config/eai-security-check',
    reportsDirectory: '~/reports',
    reportSource: 'localStorage',
  };

  beforeEach(async () => {
    mockElectronService = jasmine.createSpyObj('ElectronService', [
      'manageDaemon',
      'loadReportFromPath',
    ]);
    // Add signal properties
    Object.defineProperty(mockElectronService, 'isElectron', {
      value: jasmine.createSpy('isElectron').and.returnValue(true),
      writable: true,
    });
    Object.defineProperty(mockElectronService, 'cliVersion', {
      value: jasmine.createSpy('cliVersion').and.returnValue('1.0.0'),
      writable: true,
    });
    Object.defineProperty(mockElectronService, 'platformInfo', {
      value: jasmine.createSpy('platformInfo').and.returnValue({
        platform: 'darwin',
        arch: 'x64',
        version: '14.0.0',
      }),
      writable: true,
    });
    
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockReportService = jasmine.createSpyObj('ReportService', ['setReport', 'getReportHistory']);
    mockReportService.getReportHistory.and.returnValue(mockReportHistory);

    mockElectronService.manageDaemon.and.returnValue(Promise.resolve('stopped'));
    mockElectronService.loadReportFromPath.and.returnValue(Promise.resolve({
      platform: { platform: 'darwin', arch: 'x64', version: '14.0.0' },
      profile: 'default',
      timestamp: '2025-08-05T15:25:10.146Z',
      checks: [],
      summary: { passed: 0, failed: 0, warnings: 0, overallStatus: 'pass' }
    }));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ElectronService, useValue: mockElectronService },
        { provide: Router, useValue: mockRouter },
        { provide: ReportService, useValue: mockReportService },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
            snapshot: { params: {}, queryParams: {} },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load system status on init', async () => {
    await component.ngOnInit();
    expect(component.systemStatus().version).toBeDefined();
    expect(typeof component.systemStatus().daemonStatus).toBe('string');
  });

  it('should refresh history', async () => {
    await component.refreshHistory();
    // Should reload system status
    expect(component.systemStatus()).toBeDefined();
  });

  it('should view report', async () => {
    const report = mockReportHistory[0];
    
    await component.viewReport(report);
    
    expect(mockElectronService.loadReportFromPath).toHaveBeenCalledWith(report.reportPath!);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/report-viewer']);
  });

  it('should copy report', () => {
    const report = mockReportHistory[0];
    spyOn(console, 'log');
    component.copyReport(report);
    expect(console.log).toHaveBeenCalledWith('Copy report:', report);
  });

  it('should get daemon status class', () => {
    const component2 = fixture.componentInstance;
    component2['_systemStatus'].set({
      ...mockSystemStatus,
      daemonStatus: 'running',
    });
    expect(component2.getDaemonStatusClass()).toBe('status-good');

    component2['_systemStatus'].set({
      ...mockSystemStatus,
      daemonStatus: 'stopped',
    });
    expect(component2.getDaemonStatusClass()).toBe('status-warning');
  });

  it('should get daemon status text', () => {
    const component2 = fixture.componentInstance;
    component2['_systemStatus'].set({
      ...mockSystemStatus,
      daemonStatus: 'running',
    });
    expect(component2.getDaemonStatusText()).toBe('✅ Running');
  });

  it('should get status icon', () => {
    expect(component.getStatusIcon('pass')).toBe('✅');
    expect(component.getStatusIcon('fail')).toBe('❌');
    expect(component.getStatusIcon('warning')).toBe('⚠️');
  });

  it('should format timestamp', () => {
    const timestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const formatted = component.formatTimestamp(timestamp);
    expect(formatted).toContain('hour');
  });

  it('should render system status correctly', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.status-card')).toBeTruthy();
  });

  it('should render feature cards', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.features-card')).toBeTruthy();
  });
});
