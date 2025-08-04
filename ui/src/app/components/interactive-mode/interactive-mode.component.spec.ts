import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InteractiveModeComponent } from './interactive-mode.component';
import { ElectronService } from '../../services/electron.service';

describe('InteractiveModeComponent', () => {
  let component: InteractiveModeComponent;
  let fixture: ComponentFixture<InteractiveModeComponent>;
  let mockElectronService: jasmine.SpyObj<ElectronService>;

  const mockPlatformInfo = {
    platform: 'darwin',
    version: '14.0.0',
    arch: 'x64',
    hostname: 'test-machine',
  };

  const mockVersionInfo = {
    cli: '1.1.0',
    ui: '1.1.0',
    electron: '37.2.5',
    node: '18.0.0',
  };

  beforeEach(async () => {
    mockElectronService = jasmine.createSpyObj('ElectronService', [
      'runSecurityCheck',
      'installGlobally',
      'uninstallGlobally',
      'runInteractive',
      'saveConfig',
      'isElectron',
    ]);

    mockElectronService.runSecurityCheck.and.returnValue(
      Promise.resolve({
        platform: mockPlatformInfo,
        profile: 'default',
        timestamp: new Date().toISOString(),
        checks: [],
        summary: {
          passed: 8,
          failed: 0,
          warnings: 2,
          overallStatus: 'warning' as const,
        },
      }),
    );
    mockElectronService.isElectron.and.returnValue(true);
    mockElectronService.installGlobally.and.returnValue(Promise.resolve(true));
    mockElectronService.uninstallGlobally.and.returnValue(
      Promise.resolve(true),
    );
    mockElectronService.runInteractive.and.returnValue(Promise.resolve());
    mockElectronService.saveConfig.and.returnValue(Promise.resolve(true));

    await TestBed.configureTestingModule({
      imports: [InteractiveModeComponent],
      providers: [{ provide: ElectronService, useValue: mockElectronService }],
    }).compileComponents();

    fixture = TestBed.createComponent(InteractiveModeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should execute install globally action', async () => {
    const installAction = component.managementActions.find(
      (a) => a.id === 'install-global',
    );
    expect(installAction).toBeDefined();

    await component.executeAction(installAction!);
    expect(mockElectronService.installGlobally).toHaveBeenCalled();
  });

  it('should execute uninstall globally action', async () => {
    const uninstallAction = component.managementActions.find(
      (a) => a.id === 'uninstall-global',
    );
    expect(uninstallAction).toBeDefined();

    await component.executeAction(uninstallAction!);
    expect(mockElectronService.uninstallGlobally).toHaveBeenCalled();
  });

  it('should run quick check', async () => {
    await component.runQuickCheck();
    expect(mockElectronService.runSecurityCheck).toHaveBeenCalledWith(
      'default',
    );
  });

  it('should open config editor', () => {
    spyOn(component as any, 'showMessage');
    component.openConfigEditor();
    expect((component as any).showMessage).toHaveBeenCalledWith(
      'Opening configuration editor...',
      'info',
    );
  });

  it('should view reports', () => {
    spyOn(component as any, 'showMessage');
    component.viewReports();
    expect((component as any).showMessage).toHaveBeenCalledWith(
      'Opening report viewer...',
      'info',
    );
  });

  it('should handle action execution gracefully', async () => {
    const mockAction = {
      id: 'test-action',
      title: 'Test Action',
      description: 'Test Description',
      icon: '🧪',
      action: jasmine.createSpy('action').and.returnValue(Promise.resolve()),
    };

    await component.executeAction(mockAction);
    expect(mockAction.action).toHaveBeenCalled();
  });

  it('should handle errors during action execution', async () => {
    mockElectronService.installGlobally.and.returnValue(
      Promise.reject(new Error('Installation failed')),
    );

    const installAction = component.managementActions.find(
      (a) => a.id === 'install-global',
    );
    expect(installAction).toBeDefined();

    await component.executeAction(installAction!);
    // Should handle error gracefully
    expect(mockElectronService.installGlobally).toHaveBeenCalled();
  });

  it('should format time correctly', () => {
    const timestamp = new Date().toISOString();
    const formatted = component.formatTime(timestamp);
    expect(typeof formatted).toBe('string');
    expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('should render management actions', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const actionCards = compiled.querySelectorAll('.action-card');
    expect(actionCards.length).toBe(component.managementActions.length);
  });

  it('should render action log', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.action-log')).toBeTruthy();
  });
});
