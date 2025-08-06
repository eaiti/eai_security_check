import { VersionUtils } from "./version-utils";
import * as fs from "fs";
import * as path from "path";

describe("VersionUtils", () => {
  const testLockPath = path.join(__dirname, "test-daemon.lock");

  beforeEach(() => {
    // Mock console.warn to prevent output during tests
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up test lock file
    if (fs.existsSync(testLockPath)) {
      fs.unlinkSync(testLockPath);
    }
    // Restore console.warn
    jest.restoreAllMocks();
  });

  describe("getCurrentVersion", () => {
    it("should return current version", () => {
      const version = VersionUtils.getCurrentVersion();
      expect(version).toBeDefined();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("compareVersions", () => {
    it("should compare versions correctly", () => {
      expect(VersionUtils.compareVersions("1.0.0", "1.0.1")).toBe(-1);
      expect(VersionUtils.compareVersions("1.0.1", "1.0.0")).toBe(1);
      expect(VersionUtils.compareVersions("1.0.0", "1.0.0")).toBe(0);
      expect(VersionUtils.compareVersions("2.0.0", "1.9.9")).toBe(1);
      expect(VersionUtils.compareVersions("1.9.9", "2.0.0")).toBe(-1);
    });

    it("should handle versions with different number of parts", () => {
      expect(VersionUtils.compareVersions("1.0", "1.0.0")).toBe(0);
      expect(VersionUtils.compareVersions("1.0.1", "1.0")).toBe(1);
      expect(VersionUtils.compareVersions("1.0", "1.0.1")).toBe(-1);
    });
  });

  describe("daemon lock management", () => {
    it("should create daemon lock successfully", () => {
      const result = VersionUtils.createDaemonLock(testLockPath);
      expect(result).toBe(true);
      expect(fs.existsSync(testLockPath)).toBe(true);

      // Verify lock file content
      const lockContent = fs.readFileSync(testLockPath, "utf-8");
      const lockInfo = JSON.parse(lockContent);
      expect(lockInfo.pid).toBe(process.pid);
      expect(lockInfo.version).toBeDefined();
      expect(lockInfo.started).toBeDefined();
      expect(lockInfo.executable).toBeDefined();
    });

    it("should prevent creating lock when one already exists", () => {
      // Create first lock
      const firstResult = VersionUtils.createDaemonLock(testLockPath);
      expect(firstResult).toBe(true);

      // Try to create second lock
      const secondResult = VersionUtils.createDaemonLock(testLockPath);
      expect(secondResult).toBe(false);
    });

    it("should remove daemon lock", () => {
      // Create lock
      VersionUtils.createDaemonLock(testLockPath);
      expect(fs.existsSync(testLockPath)).toBe(true);

      // Remove lock
      VersionUtils.removeDaemonLock(testLockPath);
      expect(fs.existsSync(testLockPath)).toBe(false);
    });

    it("should handle removing non-existent lock gracefully", () => {
      expect(() => {
        VersionUtils.removeDaemonLock(testLockPath);
      }).not.toThrow();
    });
  });

  describe("checkForNewerVersion", () => {
    it("should handle version check without error", async () => {
      const result = await VersionUtils.checkForNewerVersion();
      expect(result).toBeDefined();
      expect(result.hasNewer).toBeDefined();
      expect(typeof result.hasNewer).toBe("boolean");
    });
  });

  describe("shouldYieldToNewerVersion", () => {
    it("should return shouldYield decision", async () => {
      const result = await VersionUtils.shouldYieldToNewerVersion();
      expect(result).toBeDefined();
      expect(result.shouldYield).toBeDefined();
      expect(typeof result.shouldYield).toBe("boolean");
    });
  });
});
