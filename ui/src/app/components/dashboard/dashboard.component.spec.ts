import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import {
  DashboardComponent,
  ReportHistory,
  SystemStatus,
} from './dashboard.component';
import { ElectronService } from '../../services/electron.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockElectronService: jasmine.SpyObj<ElectronService>;
  let mockRouter: jasmine.SpyObj<Router>;

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
    globalInstall: true,
    daemonStatus: 'running',
    lastCheck: mockReportHistory[0],
    recentReports: mockReportHistory,
    configExists: true,
    schedulingConfigExists: true,
  };

  beforeEach(async () => {
    mockElectronService = jasmine.createSpyObj('ElectronService', [
      'installGlobally',
      'isElectron',
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockElectronService.installGlobally.and.returnValue(Promise.resolve(true));
    mockElectronService.isElectron.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ElectronService, useValue: mockElectronService },
        { provide: Router, useValue: mockRouter },
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
    expect(typeof component.systemStatus().globalInstall).toBe('boolean');
  });

  it('should install globally', async () => {
    await component.installGlobally();
    expect(mockElectronService.installGlobally).toHaveBeenCalled();
  });

  it('should refresh history', async () => {
    await component.refreshHistory();
    // Should reload system status
    expect(component.systemStatus()).toBeDefined();
  });

  it('should view report', () => {
    const report = mockReportHistory[0];
    spyOn(console, 'log');
    component.viewReport(report);
    expect(console.log).toHaveBeenCalledWith('View report:', report);
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
