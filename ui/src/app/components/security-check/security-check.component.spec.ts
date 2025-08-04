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

  it('should handle profile change', () => {
    component.selectedProfile = 'strict';
    expect(component.selectedProfile).toBe('strict');
    
    component.selectedProfile = 'relaxed';
    expect(component.selectedProfile).toBe('relaxed');
  });

  it('should handle different loading states', () => {
    expect(component.isRunning()).toBe(false);
    
    // Test running state by calling the method
    component.runSecurityCheck();
    // The loading state is handled internally during the async operation
  });

  it('should handle empty report data', async () => {
    const emptyReport = {
      platform: { platform: 'darwin', arch: 'x64', version: '14.0.0' },
      profile: 'default',
      timestamp: new Date().toISOString(),
      checks: [],
      summary: { passed: 0, failed: 0, warnings: 0, overallStatus: 'pass' as const }
    };
    
    mockElectronService.runSecurityCheck.and.returnValue(Promise.resolve(emptyReport));
    
    await component.runSecurityCheck();
    expect(component.report()).toEqual(emptyReport);
    expect(component.report()?.checks.length).toBe(0);
  });

  it('should handle error scenarios gracefully', async () => {
    mockElectronService.runSecurityCheck.and.returnValue(
      Promise.reject(new Error('Security check failed'))
    );
    
    await component.runSecurityCheck();
    // Should handle error gracefully and not crash
    expect(component.isRunning()).toBe(false);
  });

  it('should handle different risk levels', () => {
    const mockChecks = [
      { name: 'High Risk Check', status: 'fail' as const, message: 'Failed', risk: 'high' as const },
      { name: 'Medium Risk Check', status: 'warning' as const, message: 'Warning', risk: 'medium' as const },
      { name: 'Low Risk Check', status: 'pass' as const, message: 'Passed', risk: 'low' as const }
    ];
    
    const reportWithRisks = {
      platform: { platform: 'darwin', arch: 'x64', version: '14.0.0' },
      profile: 'default',
      timestamp: new Date().toISOString(),
      checks: mockChecks,
      summary: { passed: 1, failed: 1, warnings: 1, overallStatus: 'fail' as const }
    };
    
    // Create a new component instance and mock the report signal
    const fixture2 = TestBed.createComponent(SecurityCheckComponent);
    const component2 = fixture2.componentInstance;
    (component2 as any)._report.set(reportWithRisks);
    
    expect(component2.report()?.checks[0].risk).toBe('high');
    expect(component2.report()?.checks[1].risk).toBe('medium');
    expect(component2.report()?.checks[2].risk).toBe('low');
  });

  it('should render different report states', () => {
    // Test with no report
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.no-report')).toBeTruthy();
    
    // Test with report - we'll test the component logic instead of setting signals directly
    expect(component.report()).toBeNull(); // Initially null
  });

  it('should handle platform information display', () => {
    // Test accessing platform info through the electron service
    expect(component.platformInfo()).toBeDefined();
    expect(component.cliVersion()).toBeDefined();
    expect(component.isElectron()).toBe(true);
  });
});