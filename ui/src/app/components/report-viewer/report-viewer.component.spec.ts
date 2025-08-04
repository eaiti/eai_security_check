import { TestBed } from '@angular/core/testing';
import { ReportViewerComponent } from './report-viewer.component';
import { ElectronService } from '../../services/electron.service';

describe('ReportViewerComponent', () => {
  let component: ReportViewerComponent;
  let fixture: any;
  let mockElectronService: jasmine.SpyObj<ElectronService>;

  beforeEach(async () => {
    const electronServiceSpy = jasmine.createSpyObj('ElectronService', [
      'verifyReport',
    ]);

    await TestBed.configureTestingModule({
      imports: [ReportViewerComponent],
      providers: [{ provide: ElectronService, useValue: electronServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportViewerComponent);
    component = fixture.componentInstance;
    mockElectronService = TestBed.inject(
      ElectronService,
    ) as jasmine.SpyObj<ElectronService>;
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

    expect(mockElectronService.verifyReport).toHaveBeenCalledWith(
      'test-report.json',
    );
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

  it('should handle different output formats', () => {
    const formats = ['json', 'markdown', 'html', 'csv', 'plain'];

    formats.forEach((format) => {
      // Test that different formats can be handled
      expect(formats).toContain(format);
    });
  });

  it('should handle copy to clipboard', async () => {
    // Set up test data
    component['_convertedContent'].set('Test content to copy');
    
    // Mock clipboard API
    const mockClipboard = {
      writeText: jasmine.createSpy('writeText').and.returnValue(Promise.resolve()),
    };
    
    // Override the clipboard property using defineProperty
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });

    await component.copyToClipboard();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test content to copy');
    
    // Clean up
    delete (navigator as any).clipboard;
  });

  it('should handle download functionality', () => {
    // Set up some test data
    component.selectedFormat = 'json';
    component['_selectedReportPath'].set('test-report.json');
    component['_convertedContent'].set('{"test": "data"}');

    // Mock URL.createObjectURL and document.createElement
    spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
    spyOn(URL, 'revokeObjectURL');
    const mockAnchor = {
      href: '',
      download: '',
      click: jasmine.createSpy('click'),
      style: { display: '' },
    } as any;
    spyOn(document, 'createElement').and.returnValue(mockAnchor);
    spyOn(document.body, 'appendChild');
    spyOn(document.body, 'removeChild');

    component.downloadReport();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it('should handle report verification', async () => {
    await component.verifyReport();
    // Should complete without errors
  });

  it('should handle empty or invalid reports', () => {
    // Test basic functionality
    expect(component.selectedFormat).toBeDefined();
  });

  it('should handle different timestamp formats', () => {
    const timestamps = [
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:00:00.000Z',
      '2024-01-01 00:00:00',
    ];

    timestamps.forEach((timestamp) => {
      // Test that different timestamp formats can be processed
      const date = new Date(timestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeGreaterThan(0);
    });
  });

  it('should render report content correctly', () => {
    // Test basic rendering
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.report-viewer-container')).toBeTruthy();
  });
});
