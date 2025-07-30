import { SchedulingService } from '../scheduling-service';
import { SchedulingConfig, DaemonState } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('node-cron');
jest.mock('nodemailer');
jest.mock('fs');
jest.mock('../auditor');
jest.mock('../platform-detector');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('SchedulingService', () => {
  const mockConfig: SchedulingConfig = {
    enabled: true,
    intervalDays: 7,
    email: {
      smtp: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@test.com',
          pass: 'password'
        }
      },
      from: 'Test <test@test.com>',
      to: ['admin@test.com'],
      subject: 'Test Report'
    },
    reportFormat: 'email',
    securityProfile: 'default'
  };

  const mockState: DaemonState = {
    lastReportSent: '',
    totalReportsGenerated: 0,
    daemonStarted: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation(path => {
      if (path.toString().includes('scheduling-config.json')) {
        return JSON.stringify(mockConfig);
      }
      if (path.toString().includes('daemon-state.json')) {
        return JSON.stringify(mockState);
      }
      return '{}';
    });
  });

  describe('constructor', () => {
    it('should load scheduling configuration successfully', () => {
      expect(() => new SchedulingService()).not.toThrow();
    });

    it('should throw error if config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(() => new SchedulingService()).toThrow('Scheduling configuration not found');
    });

    it('should throw error for invalid configuration', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({}));
      expect(() => new SchedulingService()).toThrow('Invalid scheduling configuration');
    });
  });

  describe('getDaemonStatus', () => {
    it('should return current daemon status', () => {
      const service = new SchedulingService();
      const status = service.getDaemonStatus();

      expect(status.running).toBe(true);
      expect(status.config).toEqual(mockConfig);
      expect(status.state).toEqual(mockState);
    });
  });

  describe('shouldSendReport', () => {
    it('should return true if no report has been sent', () => {
      const service = new SchedulingService();
      const stateWithNoReport = { ...mockState, lastReportSent: '' };
      mockFs.readFileSync.mockReturnValue(JSON.stringify(stateWithNoReport));

      // Access private method through any type casting
      const shouldSend = (service as any).shouldSendReport(stateWithNoReport);
      expect(shouldSend).toBe(true);
    });

    it('should return true if last report was sent more than intervalDays ago', () => {
      const service = new SchedulingService();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 days ago

      const stateWithOldReport = {
        ...mockState,
        lastReportSent: oldDate.toISOString()
      };

      const shouldSend = (service as any).shouldSendReport(stateWithOldReport);
      expect(shouldSend).toBe(true);
    });

    it('should return false if last report was sent recently', () => {
      const service = new SchedulingService();
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // 3 days ago

      const stateWithRecentReport = {
        ...mockState,
        lastReportSent: recentDate.toISOString()
      };

      const shouldSend = (service as any).shouldSendReport(stateWithRecentReport);
      expect(shouldSend).toBe(false);
    });
  });
});
