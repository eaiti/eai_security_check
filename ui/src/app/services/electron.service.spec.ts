import { TestBed } from '@angular/core/testing';
import { ElectronService } from './electron.service';

describe('ElectronService', () => {
  let service: ElectronService;

  beforeEach(() => {
    // Mock window.electronAPI
    (window as any).electronAPI = {
      runSecurityCheck: jasmine.createSpy('runSecurityCheck'),
      getPlatformInfo: jasmine.createSpy('getPlatformInfo'),
      getCliVersion: jasmine.createSpy('getCliVersion'),
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
    expect(strictReport.summary.failed).toBeGreaterThanOrEqual(
      defaultReport.summary.failed,
    );

    // Relaxed should have fewer failures than default
    expect(relaxedReport.summary.failed).toBeLessThanOrEqual(
      defaultReport.summary.failed,
    );
  });

  it('should handle Electron API failures gracefully', async () => {
    (window as any).electronAPI.runSecurityCheck.and.rejectWith(
      new Error('API Error'),
    );

    try {
      const report = await service.runSecurityCheck('default');
      // This should not happen as we now throw errors instead of falling back
      fail('Should have thrown an error');
    } catch (error) {
      // Now we expect errors to be thrown instead of falling back to mock data
      expect(error).toBeDefined();
    }
  });

  it('should throw errors for Electron-only operations when not in Electron', async () => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();

    await expectAsync(newService.runInteractive()).toBeRejectedWithError(
      'Interactive mode requires Electron',
    );
    await expectAsync(
      newService.verifyReport('test.json'),
    ).toBeRejectedWithError('Report verification requires Electron');
    await expectAsync(newService.installGlobally()).toBeRejectedWithError(
      'Global installation requires Electron',
    );
  });

  it('should provide mock configuration data', async () => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();

    const config = await newService.loadConfig();
    expect(config).toBeDefined();
    expect(config['diskEncryption']).toBeDefined();
    expect(config['passwordProtection']).toBeDefined();

    const configs = await newService.listConfigs();
    expect(configs).toContain('default');
    expect(configs).toContain('strict');
    expect(configs).toContain('relaxed');
  });

  it('should handle different security check profiles consistently', async () => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();

    const profiles = ['default', 'strict', 'relaxed', 'developer', 'eai'];
    const reports = await Promise.all(
      profiles.map((profile) => newService.runSecurityCheck(profile)),
    );

    reports.forEach((report, index) => {
      expect(report.profile).toBe(profiles[index]);
      expect(report.checks).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });
  });

  it('should provide consistent mock platform info', async () => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();
    expect(newService.platformInfo()).toBeNull(); // Initially null when not in Electron
  });

  it('should handle configuration operations when not in Electron', async () => {
    delete (window as any).electronAPI;
    delete (window as any).isElectron;

    const newService = new ElectronService();

    const config = await newService.loadConfig();
    expect(config).toBeDefined();

    const saved = await newService.saveConfig(config);
    expect(saved).toBe(true); // Mock always succeeds

    const newConfig = await newService.createConfig('custom');
    expect(newConfig).toBeDefined();
  });

  it('should handle initialization errors gracefully', async () => {
    // Mock failed initialization
    const originalConsoleError = console.error;
    console.error = jasmine.createSpy('console.error');

    (window as any).electronAPI = {
      getPlatformInfo: jasmine
        .createSpy('getPlatformInfo')
        .and.returnValue(Promise.reject(new Error('Init failed'))),
      getCliVersion: jasmine
        .createSpy('getCliVersion')
        .and.returnValue(Promise.reject(new Error('Init failed'))),
    };
    (window as any).isElectron = true;

    const newService = new ElectronService();

    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Should handle errors gracefully
    expect(newService).toBeDefined();
    
    console.error = originalConsoleError;
  });

  it('should handle various daemon management operations', async () => {
    (window as any).electronAPI.manageDaemon = jasmine
      .createSpy('manageDaemon')
      .and.returnValue(Promise.resolve(true));

    await service.manageDaemon('start');
    expect((window as any).electronAPI.manageDaemon).toHaveBeenCalledWith(
      'start',
      undefined,
    );

    await service.manageDaemon('stop');
    expect((window as any).electronAPI.manageDaemon).toHaveBeenCalledWith(
      'stop',
      undefined,
    );

    await service.manageDaemon('status');
    expect((window as any).electronAPI.manageDaemon).toHaveBeenCalledWith(
      'status',
      undefined,
    );

    const config = { 
      enabled: true,
      intervalDays: 1,
      securityProfile: 'strict',
      reportFormat: 'email'
    };
    await service.manageDaemon('configure', config);
    expect((window as any).electronAPI.manageDaemon).toHaveBeenCalledWith(
      'configure',
      config,
    );
  });
});
