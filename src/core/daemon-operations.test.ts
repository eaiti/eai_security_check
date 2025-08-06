import { SchedulingService } from "../services/scheduling-service";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("Daemon Operations", () => {
  const tmpDir = os.tmpdir();
  const testLockFile = path.join(tmpDir, "test-daemon.lock");
  const testStateFile = path.join(tmpDir, "test-daemon-state.json");
  const testConfigFile = path.join(tmpDir, "test-scheduling-config.json");

  beforeEach(() => {
    // Ensure temporary directory exists
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Clean up any existing test files
    [testLockFile, testStateFile, testConfigFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  afterEach(() => {
    // Clean up test files
    [testLockFile, testStateFile, testConfigFile].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe("stopDaemon", () => {
    it("should handle case when no daemon is running", async () => {
      const result = await SchedulingService.stopDaemon(testLockFile);

      expect(result.success).toBe(false);
      expect(result.message).toContain("No daemon lock file found");
    });

    it("should clean up stale lock file when process does not exist", async () => {
      // Create a lock file with a non-existent PID
      const staleLockInfo = {
        pid: 999999, // This PID should not exist
        version: "1.0.0",
        started: new Date().toISOString(),
        executable: "test-executable",
      };

      fs.writeFileSync(testLockFile, JSON.stringify(staleLockInfo, null, 2));

      const result = await SchedulingService.stopDaemon(testLockFile);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
      expect(fs.existsSync(testLockFile)).toBe(false);
    });
  });

  describe("uninstallDaemon", () => {
    it("should remove daemon files when they exist", async () => {
      // Create test files
      const testState = {
        lastReportSent: "2025-01-01T00:00:00Z",
        totalReportsGenerated: 5,
        daemonStarted: "2025-01-01T00:00:00Z",
        currentVersion: "1.0.0",
        lastVersionCheck: "2025-01-01T00:00:00Z",
      };

      const testConfig = {
        enabled: true,
        intervalDays: 7,
        email: {
          smtp: {
            host: "smtp.example.com",
            port: 587,
            secure: false,
            auth: { user: "test", pass: "test" },
          },
          from: "test@example.com",
          to: ["admin@example.com"],
          subject: "Test",
        },
        reportFormat: "email",
        securityProfile: "default",
      };

      fs.writeFileSync(testStateFile, JSON.stringify(testState, null, 2));
      fs.writeFileSync(testConfigFile, JSON.stringify(testConfig, null, 2));

      const result = await SchedulingService.uninstallDaemon({
        stateFilePath: testStateFile,
        configPath: testConfigFile,
        force: true,
        removeExecutable: false,
      });

      expect(result.success).toBe(true);
      expect(result.removedFiles).toContain(testStateFile);
      expect(result.removedFiles).toContain(testConfigFile);
      expect(fs.existsSync(testStateFile)).toBe(false);
      expect(fs.existsSync(testConfigFile)).toBe(false);
    });

    it("should preserve config file without force flag", async () => {
      const testConfig = {
        enabled: true,
        intervalDays: 7,
        email: {
          smtp: {
            host: "smtp.example.com",
            port: 587,
            secure: false,
            auth: { user: "test", pass: "test" },
          },
          from: "test@example.com",
          to: ["admin@example.com"],
          subject: "Test",
        },
        reportFormat: "email",
        securityProfile: "default",
      };

      fs.writeFileSync(testConfigFile, JSON.stringify(testConfig, null, 2));

      const result = await SchedulingService.uninstallDaemon({
        configPath: testConfigFile,
        force: false,
      });

      expect(result.success).toBe(true);
      expect(result.removedFiles).not.toContain(testConfigFile);
      expect(fs.existsSync(testConfigFile)).toBe(true);
      expect(result.message).toContain("preserved");
    });
  });

  describe("daemon control integration", () => {
    it("should handle control operations when no daemon is running", async () => {
      // Test stop when no daemon
      const stopResult = await SchedulingService.stopDaemon(testLockFile);
      expect(stopResult.success).toBe(false);

      // Test uninstall when no daemon
      const uninstallResult = await SchedulingService.uninstallDaemon({
        force: true,
      });
      expect(uninstallResult.success).toBe(true);
    });
  });
});
