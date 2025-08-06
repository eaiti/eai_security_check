import { CryptoUtils } from "./crypto-utils";
import * as fs from "fs";
import * as os from "os";

// Mock fs and os
jest.mock("fs");
jest.mock("os");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe("CryptoUtils", () => {
  const originalSecret = process.env.EAI_BUILD_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.hostname.mockReturnValue("test-host");
  });

  afterEach(() => {
    // Restore original secret
    if (originalSecret) {
      process.env.EAI_BUILD_SECRET = originalSecret;
    } else {
      delete process.env.EAI_BUILD_SECRET;
    }
  });

  describe("generateSecureHash", () => {
    it("should generate consistent HMAC hash for same content and salt", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "test content";
      const salt = "test-salt";
      const hash1 = CryptoUtils.generateSecureHash(content, salt);
      const hash2 = CryptoUtils.generateSecureHash(content, salt);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 hex format
    });

    it("should generate different hashes for different salts", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "test content";
      const hash1 = CryptoUtils.generateSecureHash(content, "salt1");
      const hash2 = CryptoUtils.generateSecureHash(content, "salt2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("createHashedReport", () => {
    it("should create hashed report with metadata", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "Security report content";
      const metadata = { platform: "linux", version: "1.0.0" };

      const hashedReport = CryptoUtils.createHashedReport(content, metadata);

      expect(hashedReport.content).toBe(content);
      expect(hashedReport.hash).toBeDefined();
      expect(hashedReport.algorithm).toBe("hmac-sha256");
      expect(hashedReport.timestamp).toBeDefined();
      expect(hashedReport.salt).toBeDefined();
      expect(hashedReport.metadata).toMatchObject(metadata);
      expect(hashedReport.metadata.platform).toBeDefined();
      expect(hashedReport.metadata.hostname).toBeDefined();
    });

    it("should strip existing signatures from content", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = `Report content
--- SECURITY SIGNATURE ---
{"hash": "old", "timestamp": "old"}
--- SECURITY SIGNATURE ---`;

      const hashedReport = CryptoUtils.createHashedReport(content);

      expect(hashedReport.content).toBe("Report content");
      expect(hashedReport.content).not.toContain("SECURITY SIGNATURE");
    });

    it("should require EAI_BUILD_SECRET", () => {
      delete process.env.EAI_BUILD_SECRET;
      const content = "Security report content";

      expect(() => {
        CryptoUtils.createHashedReport(content);
      }).toThrow(
        "EAI_BUILD_SECRET environment variable is required for tamper detection",
      );
    });
  });

  describe("signReport", () => {
    it("should create signed content with signature", () => {
      const hashedReport = {
        content: "test content",
        hash: "testhash",
        algorithm: "hmac-sha256",
        timestamp: "2024-01-01T00:00:00.000Z",
        salt: "testsalt",
        metadata: { platform: "linux", hostname: "test", version: "1.0.0" },
      };

      const signedContent = CryptoUtils.signReport(hashedReport);

      expect(signedContent).toContain("test content");
      expect(signedContent).toContain("--- SECURITY SIGNATURE ---");
      expect(signedContent).toContain('"hash": "testhash"');
      expect(signedContent).toContain('"algorithm": "hmac-sha256"');
      expect(signedContent).toContain('"salt": "testsalt"');
    });
  });

  describe("verifyReport", () => {
    it("should verify valid signed report", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "test report content";
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      const verification = CryptoUtils.verifyReport(signedContent);

      expect(verification.isValid).toBe(true);
      expect(verification.tampered).toBe(false);
      expect(verification.originalHash).toBe(hashedReport.hash);
      expect(verification.calculatedHash).toBe(hashedReport.hash);
      expect(verification.message).toContain("verified successfully");
    });

    it("should detect tampered content", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "test report content";
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      // Tamper with the content
      const tamperedContent = signedContent.replace(
        "test report content",
        "tampered content",
      );

      const verification = CryptoUtils.verifyReport(tamperedContent);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain("tampered");
    });

    it("should handle invalid format", () => {
      const invalidContent = "just plain text without signature";

      const verification = CryptoUtils.verifyReport(invalidContent);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain("signature not found");
    });

    it("should handle malformed signature JSON", () => {
      // This matches the exact format that signReport produces
      const content =
        "content\n--- SECURITY SIGNATURE ---\ninvalid json\n\n--- SECURITY SIGNATURE ---\n";

      const verification = CryptoUtils.verifyReport(content);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain(
        "Invalid signature format: unable to parse JSON",
      );
    });

    it("should handle incomplete signature", () => {
      // This matches the exact format that signReport produces
      const content =
        'content\n--- SECURITY SIGNATURE ---\n{"hash": "testhash"}\n\n--- SECURITY SIGNATURE ---\n';

      const verification = CryptoUtils.verifyReport(content);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain(
        "Invalid signature structure: missing required fields",
      );
    });

    it("should reject unsupported algorithms", () => {
      const content =
        'content\n--- SECURITY SIGNATURE ---\n{"hash": "testhash", "algorithm": "sha256", "timestamp": "2024-01-01T00:00:00.000Z", "salt": "testsalt", "metadata": {"test": "value"}}\n\n--- SECURITY SIGNATURE ---\n';

      const verification = CryptoUtils.verifyReport(content);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain("Unsupported algorithm: sha256");
    });

    it("should require EAI_BUILD_SECRET for verification", () => {
      // Create a report with secret
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "test report content";
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      // Remove secret
      delete process.env.EAI_BUILD_SECRET;

      const verification = CryptoUtils.verifyReport(signedContent);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.message).toContain(
        "EAI_BUILD_SECRET environment variable is required",
      );
    });
  });

  describe("extractSignature", () => {
    it("should extract signature from signed content", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "test content";
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      const signature = CryptoUtils.extractSignature(signedContent);

      expect(signature).toBeDefined();
      expect(signature).not.toBeNull();
      expect(signature?.hash).toBe(hashedReport.hash);
      expect(signature?.algorithm).toBe(hashedReport.algorithm);
      expect(signature?.timestamp).toBe(hashedReport.timestamp);
    });

    it("should return null for unsigned content", () => {
      const signature = CryptoUtils.extractSignature("plain content");
      expect(signature).toBeNull();
    });
  });

  describe("stripExistingSignature", () => {
    it("should remove signature from signed content", () => {
      const content = `Report content
--- SECURITY SIGNATURE ---
{"hash": "test"}
--- SECURITY SIGNATURE ---`;

      const stripped = CryptoUtils.stripExistingSignature(content);

      expect(stripped).toBe("Report content");
      expect(stripped).not.toContain("SECURITY SIGNATURE");
    });

    it("should return content unchanged if no signature", () => {
      const content = "Plain report content";
      const stripped = CryptoUtils.stripExistingSignature(content);

      expect(stripped).toBe(content);
    });
  });

  describe("createShortHash", () => {
    it("should create 8-character uppercase hash", () => {
      const hash =
        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const shortHash = CryptoUtils.createShortHash(hash);

      expect(shortHash).toBe("ABCDEF12");
      expect(shortHash).toHaveLength(8);
    });
  });

  describe("generateVerificationCommand", () => {
    it("should generate proper verification command", () => {
      const command = CryptoUtils.generateVerificationCommand("report.txt");

      expect(command).toBe('eai-security-check verify "report.txt"');
    });
  });

  describe("createTamperEvidentReport", () => {
    it("should create tamper-evident report with header", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "test report";
      const tamperEvident = CryptoUtils.createTamperEvidentReport(content);

      expect(tamperEvident.signedContent).toContain(
        "--- SECURITY SIGNATURE ---",
      );
      expect(tamperEvident.hashedReport).toBeDefined();
      expect(tamperEvident.hashedReport.hash).toBeDefined();
      expect(tamperEvident.hashedReport.content).toBe(content);
    });
  });

  describe("createVerificationSummary", () => {
    it("should create verification summary for valid report", () => {
      const verification = {
        isValid: true,
        originalHash: "abcdef1234567890",
        calculatedHash: "abcdef1234567890",
        message: "Report integrity verified successfully",
        tampered: false,
      };

      const signature = {
        timestamp: "2024-01-01T00:00:00.000Z",
        metadata: { platform: "linux", hostname: "test", version: "1.0.0" },
      };

      const summary = CryptoUtils.createVerificationSummary(
        verification,
        signature,
      );

      expect(summary).toContain("Report Verification");
      expect(summary).toContain("VERIFIED");
      expect(summary).toContain("ABCDEF12");
      expect(summary).toContain("Platform: linux");
      expect(summary).toContain("Hostname: test");
    });

    it("should create verification summary for invalid report", () => {
      const verification = {
        isValid: false,
        originalHash: "hash1",
        calculatedHash: "hash2",
        message: "Report has been tampered with",
        tampered: true,
      };

      const summary = CryptoUtils.createVerificationSummary(verification);

      expect(summary).toContain("FAILED");
      expect(summary).toContain("tampered with");
      expect(summary).toContain("Original hash");
      expect(summary).toContain("Calculated hash");
    });
  });

  describe("file operations", () => {
    it("should save and load hashed report", () => {
      process.env.EAI_BUILD_SECRET = "test-secret-key";
      const content = "test report";
      const hashedReport = CryptoUtils.createHashedReport(content);
      const filepath = "/tmp/test-report.txt";

      // Mock file operations
      let savedContent = "";
      mockFs.writeFileSync.mockImplementation((path, data) => {
        savedContent = data as string;
      });
      mockFs.readFileSync.mockImplementation(() => savedContent);
      mockFs.existsSync.mockReturnValue(true);

      // Save report
      CryptoUtils.saveHashedReport(hashedReport, filepath);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining(content),
      );

      // Load and verify
      const { verification } = CryptoUtils.loadAndVerifyReport(filepath);
      expect(verification.isValid).toBe(true);
    });

    it("should handle missing file", () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        CryptoUtils.loadAndVerifyReport("/nonexistent/file.txt");
      }).toThrow("File not found");
    });
  });

  describe("isValidHashAlgorithm", () => {
    it("should validate only HMAC-SHA256", () => {
      expect(CryptoUtils.isValidHashAlgorithm("hmac-sha256")).toBe(true);
      expect(CryptoUtils.isValidHashAlgorithm("HMAC-SHA256")).toBe(true);
    });

    it("should reject all other algorithms", () => {
      expect(CryptoUtils.isValidHashAlgorithm("sha256")).toBe(false);
      expect(CryptoUtils.isValidHashAlgorithm("sha512")).toBe(false);
      expect(CryptoUtils.isValidHashAlgorithm("sha1")).toBe(false);
      expect(CryptoUtils.isValidHashAlgorithm("md5")).toBe(false);
      expect(CryptoUtils.isValidHashAlgorithm("invalid")).toBe(false);
    });
  });

  describe("HMAC security features", () => {
    it("should always use HMAC-SHA256 when build secret is set", () => {
      // Set a test build secret
      process.env.EAI_BUILD_SECRET = "test-secret-key-123";

      const content = "test content for HMAC security";
      const hashedReport = CryptoUtils.createHashedReport(content);

      expect(hashedReport.algorithm).toBe("hmac-sha256");
      expect(hashedReport.salt).toBeDefined();
      expect(hashedReport.salt).toHaveLength(32); // 16 bytes hex = 32 chars
    });

    it("should verify HMAC reports correctly", () => {
      // Set a test build secret
      process.env.EAI_BUILD_SECRET = "test-secret-key-456";

      const content = "test content for HMAC verification";
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      const verification = CryptoUtils.verifyReport(signedContent);

      expect(verification.isValid).toBe(true);
      expect(verification.tampered).toBe(false);
    });

    it("should fail to verify reports with wrong secret", () => {
      // Set a build secret for creation
      process.env.EAI_BUILD_SECRET = "creation-secret";

      const content = "test content";
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      // Change secret for verification
      process.env.EAI_BUILD_SECRET = "different-secret";

      const verification = CryptoUtils.verifyReport(signedContent);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
    });

    it("should detect tampering in HMAC mode", () => {
      // Set a test build secret
      process.env.EAI_BUILD_SECRET = "tamper-test-secret";

      const content = "original content";
      const hashedReport = CryptoUtils.createHashedReport(content);
      const signedContent = CryptoUtils.signReport(hashedReport);

      // Tamper with content
      const tamperedContent = signedContent.replace(
        "original content",
        "tampered content",
      );

      const verification = CryptoUtils.verifyReport(tamperedContent);

      expect(verification.isValid).toBe(false);
      expect(verification.tampered).toBe(true);
    });
  });
});
