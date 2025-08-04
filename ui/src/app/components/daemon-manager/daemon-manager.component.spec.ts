import { TestBed } from '@angular/core/testing';
import { DaemonManagerComponent } from './daemon-manager.component';
import { ElectronService } from '../../services/electron.service';

describe('DaemonManagerComponent', () => {
  let component: DaemonManagerComponent;
  let fixture: any;
  let mockElectronService: jasmine.SpyObj<ElectronService>;

  beforeEach(async () => {
    const electronServiceSpy = jasmine.createSpyObj('ElectronService', [
      'manageDaemon'
    ]);

    await TestBed.configureTestingModule({
      imports: [DaemonManagerComponent],
      providers: [
        { provide: ElectronService, useValue: electronServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DaemonManagerComponent);
    component = fixture.componentInstance;
    mockElectronService = TestBed.inject(ElectronService) as jasmine.SpyObj<ElectronService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default schedule input', () => {
    expect(component.scheduleInput).toBe('0 */6 * * *');
  });

  it('should start daemon with configuration', async () => {
    mockElectronService.manageDaemon.and.returnValue(Promise.resolve({ success: true }));

    await component.startDaemon();

    expect(mockElectronService.manageDaemon).toHaveBeenCalledWith('start', jasmine.any(Object));
  });

  it('should validate cron expression', () => {
    const validConfig = { schedule: '0 */6 * * *' };
    const invalidConfig = { schedule: 'invalid' };

    expect(component['validateConfig'](validConfig)).toBeTrue();
    expect(component['validateConfig'](invalidConfig)).toBeFalse();
  });

  it('should format dates correctly', () => {
    const testDate = '2023-12-01T12:00:00.000Z';
    const formatted = component.formatDate(testDate);
    expect(formatted).toContain('12/1/2023'); // Basic check that it's formatted
  });
});