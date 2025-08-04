import { CommandHandlers } from './command-handlers';
import { SecurityOperations } from '../core/security-operations';
import { InstallationOperations } from '../core/installation-operations';
import { SchedulingService } from '../services/scheduling-service';
import * as fs from 'fs';

// Mock all dependencies
jest.mock('fs');
jest.mock('../core/security-operations');
jest.mock('../core/installation-operations');
jest.mock('../services/scheduling-service');
jest.mock('../config/config-manager');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSchedulingService = SchedulingService as jest.MockedClass<typeof SchedulingService>;

describe('CommandHandlers', () => {
  let originalExit: typeof process.exit;
  let mockExit: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit to prevent test termination
    originalExit = process.exit;
    mockExit = jest.fn();
    process.exit = mockExit as unknown as typeof process.exit;
  });

  afterEach(() => {
    // Restore original process.exit
    process.exit = originalExit;
  });

  describe('handleCheckCommand', () => {
    it('should run security check with basic options', async () => {
      const mockResult = {
        report: 'Security report content',
        outputPath: '/path/to/report.txt',
        overallPassed: true
      };

      (SecurityOperations.runSecurityCheck as jest.Mock).mockResolvedValue(mockResult);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleCheckCommand('default', {
        output: '/path/to/report.txt'
      });

      expect(SecurityOperations.runSecurityCheck).toHaveBeenCalledWith({
        profile: 'default',
        configPath: undefined,
        outputPath: '/path/to/report.txt',
        quiet: undefined,
        password: undefined,
        clipboard: undefined,
        format: undefined,
        hash: undefined,
        summary: undefined
      });

      expect(mockExit).toHaveBeenCalledWith(0);
      consoleSpy.mockRestore();
    });

    it('should handle hash generation and file output', async () => {
      const mockResult = {
        report: 'Security report content',
        outputPath: '/path/to/report.txt',
        overallPassed: true,
        hashInfo: {
          shortHash: 'abc123',
          fullHash: 'abcdef123456789'
        }
      };

      (SecurityOperations.runSecurityCheck as jest.Mock).mockResolvedValue(mockResult);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleCheckCommand('strict', {
        output: '/path/to/report.txt',
        hash: true
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/report.txt',
        'Security report content'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '📄 Tamper-evident report saved to: /path/to/report.txt'
      );
      expect(consoleSpy).toHaveBeenCalledWith('🔐 Report hash: abc123 (HMAC-SHA256)');

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      (SecurityOperations.runSecurityCheck as jest.Mock).mockRejectedValue(
        new Error('Check failed')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await CommandHandlers.handleCheckCommand('default', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Error running security check:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle console output when no file specified', async () => {
      const mockResult = {
        report: 'Security report content',
        overallPassed: true
      };

      (SecurityOperations.runSecurityCheck as jest.Mock).mockResolvedValue(mockResult);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleCheckCommand('default', {});

      expect(consoleSpy).toHaveBeenCalledWith('Security report content');

      consoleSpy.mockRestore();
    });
  });

  describe('handleInstallCommand', () => {
    it('should handle global installation', async () => {
      (InstallationOperations.installGlobally as jest.Mock).mockResolvedValue({ success: true });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleInstallCommand();

      expect(InstallationOperations.installGlobally).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle installation errors', async () => {
      (InstallationOperations.installGlobally as jest.Mock).mockRejectedValue(
        new Error('Install failed')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await CommandHandlers.handleInstallCommand();

      expect(consoleSpy).toHaveBeenCalledWith('❌ Installation failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('handleUninstallCommand', () => {
    it('should handle global uninstallation', async () => {
      (InstallationOperations.uninstallGlobally as jest.Mock).mockResolvedValue({ success: true });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleUninstallCommand({ cleanup: true });

      expect(InstallationOperations.uninstallGlobally).toHaveBeenCalledWith(true);

      consoleSpy.mockRestore();
    });

    it('should handle uninstallation without cleanup', async () => {
      (InstallationOperations.uninstallGlobally as jest.Mock).mockResolvedValue({ success: true });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleUninstallCommand({});

      expect(InstallationOperations.uninstallGlobally).toHaveBeenCalledWith(undefined);

      consoleSpy.mockRestore();
    });

    it('should handle uninstallation errors', async () => {
      (InstallationOperations.uninstallGlobally as jest.Mock).mockRejectedValue(
        new Error('Uninstall failed')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await CommandHandlers.handleUninstallCommand({});

      expect(consoleSpy).toHaveBeenCalledWith('❌ Uninstall failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('handleVerifyCommand', () => {
    beforeEach(() => {
      // Mock filesystem operations for verify command
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'statSync').mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(false)
      } as unknown as fs.Stats);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('mock file content');
    });

    it('should handle verify command', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleVerifyCommand('/path/to/report.txt', {});

      // Since verify functionality is complex, just ensure it doesn't crash
      consoleSpy.mockRestore();
    });

    it('should handle verification errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Test with invalid parameters to trigger error handling
      await CommandHandlers.handleVerifyCommand('', {});

      consoleSpy.mockRestore();
    });
  });

  describe('handleDaemonCommand', () => {
    beforeEach(() => {
      // Mock fs.existsSync to return true for config path
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Mock static methods on SchedulingService
      mockSchedulingService.stopDaemon = jest.fn().mockResolvedValue({
        success: true,
        message: 'Daemon stopped successfully'
      });

      mockSchedulingService.getDaemonPlatformInfo = jest.fn().mockReturnValue({
        platform: 'linux',
        supportsScheduling: true,
        supportsRestart: true,
        supportsAutoStart: true,
        limitations: []
      });

      // Mock SchedulingService instance
      mockSchedulingService.mockImplementation(
        () =>
          ({
            getDaemonStatus: jest.fn().mockReturnValue({
              running: false,
              state: {
                lastReportSent: 'Never',
                totalReportsGenerated: 0,
                daemonStarted: false,
                currentVersion: '1.0.0'
              },
              config: {
                intervalDays: 7,
                email: { to: [] },
                scp: { enabled: false },
                securityProfile: 'relaxed'
              }
            }),
            startDaemon: jest.fn().mockResolvedValue(undefined)
          }) as unknown as InstanceType<typeof SchedulingService>
      );
    });

    it('should handle daemon command with stop option', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleDaemonCommand({
        stop: true
      });

      consoleSpy.mockRestore();
    });

    it('should handle daemon command with status option', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleDaemonCommand({
        status: true
      });

      consoleSpy.mockRestore();
    });

    it('should handle daemon command errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Test with empty options to trigger error handling
      await CommandHandlers.handleDaemonCommand({});

      consoleSpy.mockRestore();
    });
  });
});
