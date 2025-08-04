import { TestBed } from '@angular/core/testing';
import { SecurityCheckComponent } from './security-check.component';
import { ElectronService } from '../../services/electron.service';
import { signal } from '@angular/core';

describe('SecurityCheckComponent', () => {
  let component: SecurityCheckComponent;
  let fixture: any;
  let mockElectronService: jasmine.SpyObj<ElectronService>;

  beforeEach(async () => {
    const electronServiceSpy = jasmine.createSpyObj('ElectronService', [
      'runSecurityCheck'
    ], {
      isElectron: signal(false),
      platformInfo: signal(null),
      cliVersion: signal('1.1.0')
    });

    await TestBed.configureTestingModule({
      imports: [SecurityCheckComponent],
      providers: [
        { provide: ElectronService, useValue: electronServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SecurityCheckComponent);
    component = fixture.componentInstance;
    mockElectronService = TestBed.inject(ElectronService) as jasmine.SpyObj<ElectronService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default profile selected', () => {
    expect(component.selectedProfile).toBe('default');
  });

  it('should show loading state when running security check', async () => {
    const mockReport = {
      platform: { platform: 'darwin', arch: 'x64', version: '14.0.0' },
      profile: 'default',
      timestamp: new Date().toISOString(),
      checks: [],
      summary: { passed: 0, failed: 0, warnings: 0, overallStatus: 'pass' as const }
    };

    mockElectronService.runSecurityCheck.and.returnValue(Promise.resolve(mockReport));

    expect(component.isRunning()).toBeFalse();
    
    const promise = component.runSecurityCheck();
    expect(component.isRunning()).toBeTrue();
    
    await promise;
    expect(component.isRunning()).toBeFalse();
    expect(component.report()).toEqual(mockReport);
  });

  it('should return correct status icons', () => {
    expect(component.getStatusIcon('pass')).toBe('✅');
    expect(component.getStatusIcon('fail')).toBe('❌');
    expect(component.getStatusIcon('warning')).toBe('⚠️');
    expect(component.getStatusIcon('unknown')).toBe('❓');
  });

  it('should format timestamps correctly', () => {
    const testDate = '2023-12-01T12:00:00.000Z';
    const formatted = component.formatTimestamp(testDate);
    expect(formatted).toContain('12/1/2023'); // Basic check that it's formatted as a date
  });
});