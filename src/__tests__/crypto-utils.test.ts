import { CryptoUtils } from '../crypto-utils';
import * as fs from 'fs';

// Mock fs and os
jest.mock('fs');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('CryptoUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = 'test content';
      const hash1 = CryptoUtils.generateHash(content);
      const hash2 = CryptoUtils.generateHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should generate different hashes for different content', () => {
      const hash1 = CryptoUtils.generateHash('content1');
      const hash2 = CryptoUtils.generateHash('content2');

      expect(hash1).not.toBe(hash2);
    });

    it('should support different algorithms', () => {
      const content = 'test content';
      const sha256Hash = CryptoUtils.generateHash(content, 'sha256');
      const sha512Hash = CryptoUtils.generateHash(content, 'sha512');

      expect(sha256Hash).toMatch(/^[a-f0-9]{64}$/);
      expect(sha512Hash).toMatch(/^[a-f0-9]{128}$/);
      expect(sha256Hash).not.toBe(sha512Hash);
    });
  });

  describe('createHashedReport', () => {
    it('should create hashed report with metadata', () => {
      const content = 'Security report content';
      const metadata = { platform: 'linux', version: '1.0.0' };

      const hashedReport = CryptoUtils.createHashedReport(content, metadata);

      expect(hashedReport.content).toBe(content);
      expect(hashedReport.hash).toBeDefined();
      expect(hashedReport.algorithm).toBe('sha256');
      expect(hashedReport.timestamp).toBeDefined();
      expect(hashedReport.metadata).toMatchObject(metadata);
      expect(hashedReport.metadata.platform).toBeDefined();
      expect(hashedReport.metadata.hostname).toBeDefined();
    });

    it('should strip existing signatures from content', () => {
      const content = `Report content
--- SECURITY SIGNATURE ---
{"hash": "old", "timestamp": "old"}
--- SECURITY SIGNATURE ---`;

      const hashedReport = CryptoUtils.createHashedReport(content);

      expect(hashedReport.content).toBe('Report content\n');
      expect(hashedReport.content).not.toContain('SECURITY SIGNATURE');
    });
  });

  describe('signReport', () => {
    it('should create signed content with signature', () => {
      const hashedReport = {
        content: 'test content',
        hash: 'testhash',
        algorithm: 'sha256',
        timestamp: '2024-01-01T00:00:00.000Z',
        metadata: { platform: 'linux', hostname: 'test', version: '1.0.0' }
      };

      const signedContent = CryptoUtils.signReport(hashedReport);

      expect(signedContent).toContain('test content');
      expect(signedContent).toContain('--- SECURITY SIGNATURE ---');
      expect(signedContent).toContain('"hash": "testhash"');
      expect(signedContent).toContain('"algorithm": "sha256"');
    });
  });

  describe('verifyReport', () => {
    it('should verify valid signed report', () => {
      const content = 'test report content';
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      const verification = CryptoUtils.verifyReport(signedContent);

      expect(verification.isValid).toBe(true);
      expect(verification.tampered).toBe(false);
      expect(verification.originalHash).toBe(hashedReport.hash);
      expect(verification.calculatedHash).toBe(hashedReport.hash);
      expect(verification.message).toContain('verified successfully');
    });

    it('should detect tampered content', () => {
      const content = 'test report content';
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      // Tamper with the content
      const tamperedContent = signedContent.replace('test report content', 'tampered content');

      const verification = CryptoUtils.verifyReport(tamperedContent);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain('tampered');
    });

    it('should handle invalid format', () => {
      const invalidContent = 'just plain text without signature';

      const verification = CryptoUtils.verifyReport(invalidContent);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain('signature not found');
    });

    it('should handle malformed signature JSON', () => {
      const content = `content
--- SECURITY SIGNATURE ---
invalid json
--- SECURITY SIGNATURE ---`;

      const verification = CryptoUtils.verifyReport(content);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain('unable to parse JSON');
    });

    it('should handle incomplete signature', () => {
      const content = `content
--- SECURITY SIGNATURE ---
{"hash": "testhash"}
--- SECURITY SIGNATURE ---`;

      const verification = CryptoUtils.verifyReport(content);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain('missing required fields');
    });
  });

  describe('extractSignature', () => {
    it('should extract signature from signed content', () => {
      const content = 'test content';
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      const signature = CryptoUtils.extractSignature(signedContent);

      expect(signature).toBeDefined();
      expect(signature.hash).toBe(hashedReport.hash);
      expect(signature.algorithm).toBe(hashedReport.algorithm);
      expect(signature.timestamp).toBe(hashedReport.timestamp);
    });

    it('should return null for unsigned content', () => {
      const signature = CryptoUtils.extractSignature('plain content');
      expect(signature).toBeNull();
    });
  });

  describe('stripExistingSignature', () => {
    it('should remove signature from signed content', () => {
      const content = `Report content
--- SECURITY SIGNATURE ---
{"hash": "test"}
--- SECURITY SIGNATURE ---`;

      const stripped = CryptoUtils.stripExistingSignature(content);

      expect(stripped).toBe('Report content\n');
      expect(stripped).not.toContain('SECURITY SIGNATURE');
    });

    it('should return content unchanged if no signature', () => {
      const content = 'Plain report content';
      const stripped = CryptoUtils.stripExistingSignature(content);

      expect(stripped).toBe(content);
    });
  });

  describe('createShortHash', () => {
    it('should create 8-character uppercase hash', () => {
      const hash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const shortHash = CryptoUtils.createShortHash(hash);

      expect(shortHash).toBe('ABCDEF12');
      expect(shortHash).toHaveLength(8);
    });
  });

  describe('generateVerificationCommand', () => {
    it('should generate proper verification command', () => {
      const command = CryptoUtils.generateVerificationCommand('report.txt');

      expect(command).toBe('eai-security-check verify "report.txt"');
    });
  });

  describe('createTamperEvidentReport', () => {
    it('should create tamper-evident report with header', () => {
      const content = 'test report';
      const tamperEvident = CryptoUtils.createTamperEvidentReport(content);

      expect(tamperEvident).toContain('TAMPER-EVIDENT SECURITY REPORT');
      expect(tamperEvident).toContain('Hash:');
      expect(tamperEvident).toContain('Generated:');
      expect(tamperEvident).toContain('Verify with:');
      expect(tamperEvident).toContain(content);
      expect(tamperEvident).toContain('--- SECURITY SIGNATURE ---');
    });
  });

  describe('createVerificationSummary', () => {
    it('should create verification summary for valid report', () => {
      const verification = {
        isValid: true,
        originalHash: 'abcdef1234567890',
        calculatedHash: 'abcdef1234567890',
        message: 'Report integrity verified successfully',
        tampered: false
      };

      const signature = {
        timestamp: '2024-01-01T00:00:00.000Z',
        metadata: { platform: 'linux', hostname: 'test', version: '1.0.0' }
      };

      const summary = CryptoUtils.createVerificationSummary(verification, signature);

      expect(summary).toContain('Report Verification');
      expect(summary).toContain('VERIFIED');
      expect(summary).toContain('ABCDEF12');
      expect(summary).toContain('Platform: linux');
      expect(summary).toContain('Hostname: test');
    });

    it('should create verification summary for invalid report', () => {
      const verification = {
        isValid: false,
        originalHash: 'hash1',
        calculatedHash: 'hash2',
        message: 'Report has been tampered with',
        tampered: true
      };

      const summary = CryptoUtils.createVerificationSummary(verification);

      expect(summary).toContain('FAILED');
      expect(summary).toContain('tampered with');
      expect(summary).toContain('Original hash');
      expect(summary).toContain('Calculated hash');
    });
  });

  describe('file operations', () => {
    it('should save and load hashed report', () => {
      const content = 'test report';
      const hashedReport = CryptoUtils.createHashedReport(content);
      const filepath = '/tmp/test-report.txt';

      // Mock file operations
      let savedContent = '';
      mockFs.writeFileSync.mockImplementation((path, data) => {
        savedContent = data as string;
      });
      mockFs.readFileSync.mockReturnValue(savedContent);
      mockFs.existsSync.mockReturnValue(true);

      // Save report
      CryptoUtils.saveHashedReport(hashedReport, filepath);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(filepath, expect.stringContaining(content));

      // Load and verify
      const { verification } = CryptoUtils.loadAndVerifyReport(filepath);
      expect(verification.isValid).toBe(true);
    });

    it('should handle missing file', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        CryptoUtils.loadAndVerifyReport('/nonexistent/file.txt');
      }).toThrow('File not found');
    });
  });

  describe('isValidHashAlgorithm', () => {
    it('should validate supported algorithms', () => {
      expect(CryptoUtils.isValidHashAlgorithm('sha256')).toBe(true);
      expect(CryptoUtils.isValidHashAlgorithm('sha512')).toBe(true);
      expect(CryptoUtils.isValidHashAlgorithm('sha1')).toBe(true);
      expect(CryptoUtils.isValidHashAlgorithm('md5')).toBe(true);
    });

    it('should reject unsupported algorithms', () => {
      expect(CryptoUtils.isValidHashAlgorithm('invalid')).toBe(false);
      expect(CryptoUtils.isValidHashAlgorithm('sha3-256')).toBe(false);
    });
  });
});
