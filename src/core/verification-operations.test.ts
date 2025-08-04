import { VerificationOperations } from './verification-operations';
import { CryptoUtils } from '../utils/crypto-utils';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../utils/crypto-utils');
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('VerificationOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyReport', () => {
    it('should verify a valid report', async () => {
      const mockReportContent = 'Security Report\n---SIGNATURE---\nabc123';
      mockFs.readFileSync.mockReturnValue(mockReportContent);
      (CryptoUtils.verifyReportIntegrity as jest.Mock).mockReturnValue({
        valid: true,
        shortHash: 'abc123'
      });

      const result = await VerificationOperations.verifyReport({
        reportPath: '/path/to/report.txt',
        interactive: false
      });

      expect(result.valid).toBe(true);
      expect(result.shortHash).toBe('abc123');
    });

    it('should handle invalid report', async () => {
      const mockReportContent = 'Invalid report content';
      mockFs.readFileSync.mockReturnValue(mockReportContent);
      (CryptoUtils.verifyReportIntegrity as jest.Mock).mockReturnValue({
        valid: false,
        shortHash: null
      });

      const result = await VerificationOperations.verifyReport({
        reportPath: '/path/to/report.txt',
        interactive: false
      });

      expect(result.valid).toBe(false);
    });

    it('should handle file read errors', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      try {
        await VerificationOperations.verifyReport({
          reportPath: '/path/to/nonexistent.txt',
          interactive: false
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle interactive mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await VerificationOperations.verifyReport({
        interactive: true
      });

      consoleSpy.mockRestore();
    });
  });

  describe('runInteractiveVerification', () => {
    it('should run interactive verification', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await VerificationOperations.runInteractiveVerification();

      consoleSpy.mockRestore();
    });
  });
});
