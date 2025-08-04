import { TestBed } from '@angular/core/testing';
import { ElectronService } from './electron.service';

describe('ElectronService', () => {
  let service: ElectronService;

  beforeEach(() => {
    // Mock window.electronAPI
    (window as any).electronAPI = {
      runSecurityCheck: jasmine.createSpy('runSecurityCheck'),
      getPlatformInfo: jasmine.createSpy('getPlatformInfo'),
      getCliVersion: jasmine.createSpy('getCliVersion')
    };
    (window as any).isElectron = true;

    TestBed.configureTestingModule({});
    service = TestBed.inject(ElectronService);
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should detect Electron environment', () => {
    expect(service.isElectron()).toBeTrue();
  });

  it('should return mock data when not in Electron', async () => {
    // Remove Electron API to simulate web environment
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();
    expect(newService.isElectron()).toBeFalse();

    const report = await newService.runSecurityCheck('default');
    expect(report).toBeDefined();
    expect(report.checks).toBeDefined();
    expect(report.summary).toBeDefined();
  });

  it('should generate different mock data for different profiles', async () => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();
    
    const defaultReport = await newService.runSecurityCheck('default');
    const strictReport = await newService.runSecurityCheck('strict');
    const relaxedReport = await newService.runSecurityCheck('relaxed');

    // Strict should have more failures than default
    expect(strictReport.summary.failed).toBeGreaterThanOrEqual(defaultReport.summary.failed);
    
    // Relaxed should have fewer failures than default
    expect(relaxedReport.summary.failed).toBeLessThanOrEqual(defaultReport.summary.failed);
  });

  it('should handle Electron API failures gracefully', async () => {
    (window as any).electronAPI.runSecurityCheck.and.rejectWith(new Error('API Error'));

    const report = await service.runSecurityCheck('default');
    expect(report).toBeDefined();
    expect(report.checks).toBeDefined();
    // Should fallback to mock data
  });

  it('should throw errors for Electron-only operations when not in Electron', async () => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();

    await expectAsync(newService.runInteractive()).toBeRejectedWithError('Interactive mode requires Electron');
    await expectAsync(newService.verifyReport('test.json')).toBeRejectedWithError('Report verification requires Electron');
    await expectAsync(newService.installGlobally()).toBeRejectedWithError('Global installation requires Electron');
  });

  it('should provide mock configuration data', async () => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();
    
    const config = await newService.loadConfig();
    expect(config).toBeDefined();
    expect(config.diskEncryption).toBeDefined();
    expect(config.passwordProtection).toBeDefined();

    const configs = await newService.listConfigs();
    expect(configs).toContain('default');
    expect(configs).toContain('strict');
    expect(configs).toContain('relaxed');
  });
});