import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

export enum OutputFormat {
  CONSOLE = 'console',
  PLAIN = 'plain',
  MARKDOWN = 'markdown',
  JSON = 'json',
  EMAIL = 'email'
}

export interface FormattedOutput {
  content: string;
  format: OutputFormat;
  filename?: string;
}

export class OutputUtils {
  /**
   * Format report content for different output types
   */
  static formatReport(report: string, format: OutputFormat, metadata?: any): FormattedOutput {
    switch (format) {
      case OutputFormat.PLAIN:
        return {
          content: this.stripAnsiCodes(report),
          format,
          filename: 'security-report.txt'
        };

      case OutputFormat.MARKDOWN:
        return {
          content: this.convertToMarkdown(report),
          format,
          filename: 'security-report.md'
        };

      case OutputFormat.JSON:
        return {
          content: this.convertToJson(report, metadata),
          format,
          filename: 'security-report.json'
        };

      case OutputFormat.EMAIL:
        return {
          content: this.formatForEmail(report),
          format,
          filename: 'security-report-email.txt'
        };

      default: // CONSOLE
        return {
          content: report,
          format: OutputFormat.CONSOLE
        };
    }
  }

  /**
   * Copy content to clipboard
   */
  static async copyToClipboard(content: string): Promise<boolean> {
    try {
      const platform = os.platform();

      if (platform === 'darwin') {
        // macOS
        await execAsync(`echo "${content.replace(/"/g, '\\"')}" | pbcopy`);
      } else if (platform === 'linux') {
        // Linux - try different clipboard utilities
        try {
          await execAsync(`echo "${content.replace(/"/g, '\\"')}" | xclip -selection clipboard`);
        } catch {
          try {
            await execAsync(`echo "${content.replace(/"/g, '\\"')}" | xsel --clipboard --input`);
          } catch {
            // Try wl-clipboard for Wayland
            await execAsync(`echo "${content.replace(/"/g, '\\"')}" | wl-copy`);
          }
        }
      } else if (platform === 'win32') {
        // Windows
        await execAsync(`echo "${content.replace(/"/g, '\\"')}" | clip`);
      } else {
        throw new Error(`Clipboard not supported on platform: ${platform}`);
      }

      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }

  /**
   * Remove ANSI color codes from text
   */
  static stripAnsiCodes(text: string): string {
    // Remove ANSI escape sequences
    // eslint-disable-next-line no-control-regex
    return text.replace(/\u001b\[[0-9;]*m/g, '');
  }

  /**
   * Convert console output to Markdown format
   */
  private static convertToMarkdown(report: string): string {
    let markdown = '# Security Audit Report\n\n';
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;

    // Strip ANSI codes first
    const cleanReport = this.stripAnsiCodes(report);

    // Convert sections
    const lines = cleanReport.split('\n');
    let inResults = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Convert headers
      if (line.includes('Security Audit Report') || line.includes('EAI Security Check')) {
        continue; // Skip, we already have a header
      } else if (line.includes('==') || line.includes('--')) {
        continue; // Skip separator lines
      } else if (line.includes('SECURITY CHECKS:') || line.includes('SUMMARY:')) {
        markdown += `## ${line.replace(':', '')}\n\n`;
        inResults = true;
      } else if (
        line.trim().startsWith('✅') ||
        line.trim().startsWith('❌') ||
        line.trim().startsWith('⚠️')
      ) {
        // Security check results
        markdown += `- ${line.trim()}\n`;
      } else if (line.trim().length > 0) {
        // Regular content
        if (inResults && (line.includes('passed') || line.includes('failed'))) {
          markdown += `**${line.trim()}**\n\n`;
        } else {
          markdown += `${line}\n`;
        }
      } else {
        markdown += '\n';
      }
    }

    return markdown;
  }

  /**
   * Convert report to JSON format
   */
  private static convertToJson(report: string, metadata?: any): string {
    const cleanReport = this.stripAnsiCodes(report);
    const lines = cleanReport.split('\n');

    const results: any[] = [];
    let summary = '';
    let overallPassed = false;

    for (const line of lines) {
      if (line.trim().startsWith('✅')) {
        results.push({
          status: 'passed',
          message: line.trim().substring(2).trim(),
          icon: '✅'
        });
      } else if (line.trim().startsWith('❌')) {
        results.push({
          status: 'failed',
          message: line.trim().substring(2).trim(),
          icon: '❌'
        });
      } else if (line.trim().startsWith('⚠️')) {
        results.push({
          status: 'warning',
          message: line.trim().substring(2).trim(),
          icon: '⚠️'
        });
      } else if (line.includes('passed') && line.includes('failed')) {
        summary = line.trim();
        overallPassed = line.includes('0 failed');
      }
    }

    const jsonReport = {
      timestamp: new Date().toISOString(),
      summary,
      overallPassed,
      totalChecks: results.length,
      passedChecks: results.filter(r => r.status === 'passed').length,
      failedChecks: results.filter(r => r.status === 'failed').length,
      warningChecks: results.filter(r => r.status === 'warning').length,
      results,
      metadata: metadata || {}
    };

    return JSON.stringify(jsonReport, null, 2);
  }

  /**
   * Format report for email
   */
  private static formatForEmail(report: string): string {
    const cleanReport = this.stripAnsiCodes(report);

    let emailBody = 'Subject: Security Audit Report\n\n';
    emailBody += 'Dear Recipient,\n\n';
    emailBody += 'Please find the security audit report below:\n\n';
    emailBody += '='.repeat(60) + '\n';
    emailBody += cleanReport;
    emailBody += '\n' + '='.repeat(60) + '\n\n';
    emailBody += 'This report was generated automatically by the EAI Security Check tool.\n';
    emailBody += `Generated on: ${new Date().toLocaleString()}\n\n`;
    emailBody +=
      'Please review the findings and take appropriate action for any failed checks.\n\n';
    emailBody += 'Best regards,\n';
    emailBody += 'Security Audit System\n';

    return emailBody;
  }

  /**
   * Get available clipboard utilities on the system
   */
  static async getAvailableClipboardUtilities(): Promise<string[]> {
    const utilities = [];
    const platform = os.platform();

    if (platform === 'darwin') {
      utilities.push('pbcopy');
    } else if (platform === 'linux') {
      const linuxUtils = ['xclip', 'xsel', 'wl-copy'];

      for (const util of linuxUtils) {
        try {
          await execAsync(`which ${util}`);
          utilities.push(util);
        } catch {
          // Utility not available
        }
      }
    } else if (platform === 'win32') {
      utilities.push('clip');
    }

    return utilities;
  }

  /**
   * Install clipboard utilities suggestion
   */
  static getClipboardInstallSuggestion(): string {
    const platform = os.platform();

    if (platform === 'linux') {
      return `
To enable clipboard functionality, install one of these packages:
  • Ubuntu/Debian: sudo apt install xclip
  • Fedora: sudo dnf install xclip
  • Arch: sudo pacman -S xclip
  • Or for Wayland: sudo apt install wl-clipboard (Ubuntu/Debian)`;
    } else if (platform === 'darwin') {
      return 'Clipboard functionality is built into macOS (pbcopy)';
    } else if (platform === 'win32') {
      return 'Clipboard functionality is built into Windows (clip)';
    } else {
      return 'Clipboard functionality is not available on this platform';
    }
  }

  /**
   * Check if clipboard functionality is available
   */
  static async isClipboardAvailable(): Promise<boolean> {
    const utilities = await this.getAvailableClipboardUtilities();
    return utilities.length > 0;
  }

  /**
   * Create a summary line for quick sharing
   */
  static createSummaryLine(report: string): string {
    const cleanReport = this.stripAnsiCodes(report);
    const lines = cleanReport.split('\n');

    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const line of lines) {
      if (line.trim().startsWith('✅')) passed++;
      else if (line.trim().startsWith('❌')) failed++;
      else if (line.trim().startsWith('⚠️')) warnings++;
    }

    const total = passed + failed + warnings;
    const timestamp = new Date().toLocaleString();

    return `Security Audit: ${passed}/${total} passed, ${failed} failed, ${warnings} warnings (${timestamp})`;
  }
}
