import { OutputUtils, OutputFormat } from './output-utils';

// Mock os and exec
jest.mock('os');
jest.mock('child_process');

import * as os from 'os';
import { exec, ChildProcess } from 'child_process';

const mockOs = os as jest.Mocked<typeof os>;
const mockExec = exec as jest.MockedFunction<typeof exec>;

// Mock callback type for exec
type MockExecCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void;

describe('OutputUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatReport', () => {
    const sampleReport = `
🔒 macOS Security Audit Report
📅 Generated: 12/22/2024, 2:00:00 PM
✅ Overall Status: PASSED

📋 Security Check Results:
=============================================================

✅ PASS FileVault
   Expected: true
   Actual: true
   Status: FileVault is enabled - disk encryption is active

❌ FAIL Firewall
   Expected: true
   Actual: false
   Status: Firewall is disabled - system is vulnerable to network attacks
`;

    it('should format report as plain text', () => {
      const formatted = OutputUtils.formatReport(sampleReport, OutputFormat.PLAIN);

      expect(formatted.format).toBe(OutputFormat.PLAIN);
      expect(formatted.filename).toBe('security-report.txt');
      expect(formatted.content).not.toContain('\x1b'); // No ANSI codes
      expect(formatted.content).toContain('Security Audit Report');
    });

    it('should format report as markdown', () => {
      const formatted = OutputUtils.formatReport(sampleReport, OutputFormat.MARKDOWN);

      expect(formatted.format).toBe(OutputFormat.MARKDOWN);
      expect(formatted.filename).toBe('security-report.md');
      expect(formatted.content).toContain('# Security Audit Report');
      expect(formatted.content).toContain('**Generated:**');
    });

    it('should format report as JSON', () => {
      const formatted = OutputUtils.formatReport(sampleReport, OutputFormat.JSON);

      expect(formatted.format).toBe(OutputFormat.JSON);
      expect(formatted.filename).toBe('security-report.json');

      const jsonData = JSON.parse(formatted.content);
      expect(jsonData).toHaveProperty('timestamp');
      expect(jsonData).toHaveProperty('results');
      expect(jsonData.results).toHaveLength(3);
      expect(jsonData.passedChecks).toBe(2);
      expect(jsonData.failedChecks).toBe(1);
    });

    it('should format report for email', () => {
      const formatted = OutputUtils.formatReport(sampleReport, OutputFormat.EMAIL);

      expect(formatted.format).toBe(OutputFormat.EMAIL);
      expect(formatted.filename).toBe('security-report-email.txt');
      expect(formatted.content).toContain('Subject: Security Audit Report');
      expect(formatted.content).toContain('Dear Recipient,');
      expect(formatted.content).toContain('Best regards,');
    });

    it('should return console format unchanged', () => {
      const formatted = OutputUtils.formatReport(sampleReport, OutputFormat.CONSOLE);

      expect(formatted.format).toBe(OutputFormat.CONSOLE);
      expect(formatted.filename).toBeUndefined();
      expect(formatted.content).toBe(sampleReport);
    });
  });

  describe('copyToClipboard', () => {
    it('should copy to clipboard on macOS', async () => {
      mockOs.platform.mockReturnValue('darwin');
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as unknown as MockExecCallback)(null, {
            stdout: '',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const success = await OutputUtils.copyToClipboard('test content');
      expect(success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('pbcopy'),
        expect.any(Function)
      );
    });

    it('should copy to clipboard on Linux with xclip', async () => {
      mockOs.platform.mockReturnValue('linux');
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          if (command.includes('xclip')) {
            (callback as unknown as MockExecCallback)(null, {
              stdout: '',
              stderr: ''
            } as { stdout: string; stderr: string });
          } else {
            (callback as unknown as MockExecCallback)(new Error('Command not found'), {
              stdout: '',
              stderr: ''
            } as { stdout: string; stderr: string });
          }
        }
        return {} as unknown as ChildProcess;
      });

      const success = await OutputUtils.copyToClipboard('test content');
      expect(success).toBe(true);
    });

    it('should handle clipboard errors gracefully', async () => {
      mockOs.platform.mockReturnValue('linux');
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as unknown as MockExecCallback)(new Error('Command not found'), {
            stdout: '',
            stderr: ''
          } as { stdout: string; stderr: string });
        }
        return {} as unknown as ChildProcess;
      });

      const success = await OutputUtils.copyToClipboard('test content');
      expect(success).toBe(false);
    });

    it('should reject unsupported platforms', async () => {
      mockOs.platform.mockReturnValue('freebsd');

      const success = await OutputUtils.copyToClipboard('test content');
      expect(success).toBe(false);
    });
  });

  describe('stripAnsiCodes', () => {
    it('should remove ANSI color codes', () => {
      const input = '\x1b[32m✅ PASS\x1b[0m Test';
      const output = OutputUtils.stripAnsiCodes(input);

      expect(output).toBe('✅ PASS Test');
      expect(output).not.toContain('\x1b');
    });

    it('should handle text without ANSI codes', () => {
      const input = '✅ PASS Test';
      const output = OutputUtils.stripAnsiCodes(input);

      expect(output).toBe(input);
    });

    it('should handle multiple ANSI sequences', () => {
      const input = '\x1b[31m❌ FAIL\x1b[0m \x1b[33mWarning\x1b[0m Test';
      const output = OutputUtils.stripAnsiCodes(input);

      expect(output).toBe('❌ FAIL Warning Test');
    });
  });

  describe('createSummaryLine', () => {
    it('should create summary from report', () => {
      const report = `
✅ PASS FileVault
❌ FAIL Firewall
⚠️ WARNING Auto-lock
`;

      const summary = OutputUtils.createSummaryLine(report);

      expect(summary).toContain('Security Audit:');
      expect(summary).toContain('1/3 passed');
      expect(summary).toContain('1 failed');
      expect(summary).toContain('1 warnings');
      expect(summary).toMatch(/\d+\/\d+\/\d+/); // Date format
    });

    it('should handle empty report', () => {
      const report = '';
      const summary = OutputUtils.createSummaryLine(report);

      expect(summary).toContain('Security Audit:');
      expect(summary).toContain('0/0 passed');
    });
  });

  describe('getAvailableClipboardUtilities', () => {
    it('should return pbcopy for macOS', async () => {
      mockOs.platform.mockReturnValue('darwin');

      const utilities = await OutputUtils.getAvailableClipboardUtilities();
      expect(utilities).toContain('pbcopy');
    });

    it('should return clip for Windows', async () => {
      mockOs.platform.mockReturnValue('win32');

      const utilities = await OutputUtils.getAvailableClipboardUtilities();
      expect(utilities).toContain('clip');
    });

    it('should check for Linux utilities', async () => {
      mockOs.platform.mockReturnValue('linux');
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          if (command === 'which xclip') {
            (callback as unknown as MockExecCallback)(null, {
              stdout: '/usr/bin/xclip',
              stderr: ''
            });
          } else if (command === 'which xsel') {
            (callback as unknown as MockExecCallback)(new Error('not found'), {
              stdout: '',
              stderr: ''
            });
          } else if (command === 'which wl-copy') {
            (callback as unknown as MockExecCallback)(null, {
              stdout: '/usr/bin/wl-copy',
              stderr: ''
            });
          }
        }
        return {} as unknown as ChildProcess;
      });

      const utilities = await OutputUtils.getAvailableClipboardUtilities();
      expect(utilities).toContain('xclip');
      expect(utilities).toContain('wl-copy');
      expect(utilities).not.toContain('xsel');
    });
  });

  describe('isClipboardAvailable', () => {
    it('should return true when utilities are available', async () => {
      mockOs.platform.mockReturnValue('darwin');

      const available = await OutputUtils.isClipboardAvailable();
      expect(available).toBe(true);
    });

    it('should return false when no utilities are available', async () => {
      mockOs.platform.mockReturnValue('linux');
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as unknown as MockExecCallback)(new Error('not found'), {
            stdout: '',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const available = await OutputUtils.isClipboardAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getClipboardInstallSuggestion', () => {
    it('should provide macOS suggestion', () => {
      mockOs.platform.mockReturnValue('darwin');

      const suggestion = OutputUtils.getClipboardInstallSuggestion();
      expect(suggestion).toContain('built into macOS');
    });

    it('should provide Linux suggestions', () => {
      mockOs.platform.mockReturnValue('linux');

      const suggestion = OutputUtils.getClipboardInstallSuggestion();
      expect(suggestion).toContain('apt install xclip');
      expect(suggestion).toContain('dnf install xclip');
    });

    it('should handle unsupported platforms', () => {
      mockOs.platform.mockReturnValue('freebsd');

      const suggestion = OutputUtils.getClipboardInstallSuggestion();
      expect(suggestion).toContain('not available');
    });
  });
});
