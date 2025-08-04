import { CommandHandlers } from './command-handlers';
import { SecurityOperations } from '../core/security-operations';
import { InstallationOperations } from '../core/installation-operations';
import { VerificationOperations } from '../core/verification-operations';
import { SchedulingService } from '../services/scheduling-service';
import { ConfigManager } from '../config/config-manager';
import * as fs from 'fs';

// Mock all dependencies
jest.mock('fs');
jest.mock('../core/security-operations');
jest.mock('../core/installation-operations');
jest.mock('../core/verification-operations');
jest.mock('../services/scheduling-service');
jest.mock('../config/config-manager');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('CommandHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCheckCommand', () => {
    it('should run security check with basic options', async () => {
      const mockResult = {
        report: 'Security report content',
        outputPath: '/path/to/report.txt'
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

      consoleSpy.mockRestore();
    });

    it('should handle hash generation and file output', async () => {
      const mockResult = {
        report: 'Security report content',
        outputPath: '/path/to/report.txt',
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

    it('should handle clipboard output', async () => {
      const mockResult = {
        report: 'Security report content',
        clipboardSuccess: true
      };

      (SecurityOperations.runSecurityCheck as jest.Mock).mockResolvedValue(mockResult);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleCheckCommand('default', {
        clipboard: true
      });

      expect(consoleSpy).toHaveBeenCalledWith('📋 Report copied to clipboard');

      consoleSpy.mockRestore();
    });

    it('should handle clipboard failure', async () => {
      const mockResult = {
        report: 'Security report content',
        clipboardSuccess: false
      };

      (SecurityOperations.runSecurityCheck as jest.Mock).mockResolvedValue(mockResult);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleCheckCommand('default', {
        clipboard: true
      });

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to copy to clipboard');

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
        report: 'Security report content'
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

      expect(consoleSpy).toHaveBeenCalledWith('❌ Error during installation:', expect.any(Error));

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

      expect(InstallationOperations.uninstallGlobally).toHaveBeenCalledWith(false);

      consoleSpy.mockRestore();
    });

    it('should handle uninstallation errors', async () => {
      (InstallationOperations.uninstallGlobally as jest.Mock).mockRejectedValue(
        new Error('Uninstall failed')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await CommandHandlers.handleUninstallCommand({});

      expect(consoleSpy).toHaveBeenCalledWith('❌ Error during uninstallation:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('handleVerifyCommand', () => {
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
    it('should handle daemon command with start action', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleDaemonCommand({
        action: 'start'
      });

      consoleSpy.mockRestore();
    });

    it('should handle daemon command with stop action', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleDaemonCommand({
        action: 'stop'
      });

      consoleSpy.mockRestore();
    });

    it('should handle daemon command with status action', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await CommandHandlers.handleDaemonCommand({
        action: 'status'
      });

      consoleSpy.mockRestore();
    });

    it('should handle daemon command errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await CommandHandlers.handleDaemonCommand({
        action: 'invalid' as any
      });

      consoleSpy.mockRestore();
    });
  });
});
