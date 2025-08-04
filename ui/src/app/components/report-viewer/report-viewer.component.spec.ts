import { TestBed } from '@angular/core/testing';
import { ReportViewerComponent } from './report-viewer.component';
import { ElectronService } from '../../services/electron.service';

describe('ReportViewerComponent', () => {
  let component: ReportViewerComponent;
  let fixture: any;
  let mockElectronService: jasmine.SpyObj<ElectronService>;

  beforeEach(async () => {
    const electronServiceSpy = jasmine.createSpyObj('ElectronService', [
      'verifyReport'
    ]);

    await TestBed.configureTestingModule({
      imports: [ReportViewerComponent],
      providers: [
        { provide: ElectronService, useValue: electronServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportViewerComponent);
    component = fixture.componentInstance;
    mockElectronService = TestBed.inject(ElectronService) as jasmine.SpyObj<ElectronService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load recent reports on init', () => {
    component.ngOnInit();
    expect(component.recentReports().length).toBeGreaterThan(0);
  });

  it('should verify report successfully', async () => {
    component['_selectedReportPath'].set('test-report.json');
    mockElectronService.verifyReport.and.returnValue(Promise.resolve(true));

    await component.verifyReport();

    expect(mockElectronService.verifyReport).toHaveBeenCalledWith('test-report.json');
    expect(component.verificationResult()).toBeTrue();
  });

  it('should handle verification failure', async () => {
    component['_selectedReportPath'].set('test-report.json');
    mockElectronService.verifyReport.and.returnValue(Promise.resolve(false));

    await component.verifyReport();

    expect(component.verificationResult()).toBeFalse();
  });

  it('should detect file name correctly', () => {
    expect(component.getFileName('/path/to/file.json')).toBe('file.json');
    expect(component.getFileName('file.json')).toBe('file.json');
  });

  it('should format JSON correctly', () => {
    const jsonString = '{"test":"data"}';
    const formatted = component.formatJson(jsonString);
    expect(formatted).toContain('"test": "data"');
  });
});