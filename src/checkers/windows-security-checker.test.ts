// Mock execAsync function
const mockExecAsync = jest.fn();

// Mock the child_process module
jest.mock("child_process");

// Mock promisify to return our mock
jest.mock("util", () => ({
  ...jest.requireActual("util"),
  promisify: () => mockExecAsync,
}));

import { WindowsSecurityChecker } from "./windows-security-checker";

describe("WindowsSecurityChecker", () => {
  let checker: WindowsSecurityChecker;

  beforeEach(() => {
    checker = new WindowsSecurityChecker();
    jest.clearAllMocks();
  });

  describe("checkDiskEncryption", () => {
    it("should return true when BitLocker is enabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "Volume C: []\nProtection Status: Protection On\n",
        stderr: "",
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(true);
    });

    it("should return false when BitLocker is disabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "Volume C: []\nProtection Status: Protection Off\n",
        stderr: "",
      });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(false);
    });

    it("should fallback to PowerShell when manage-bde fails", async () => {
      (mockExecAsync as jest.Mock)
        .mockRejectedValueOnce(new Error("manage-bde not found"))
        .mockResolvedValueOnce({
          stdout: "1",
          stderr: "",
        });

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(true);
    });

    it("should return false when all methods fail", async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(
        new Error("Command failed"),
      );

      const result = await checker.checkDiskEncryption();
      expect(result).toBe(false);
    });
  });

  describe("checkPasswordProtection", () => {
    it("should return correct password protection status", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "ScreenSaverActive: 1\nScreenSaverIsSecure: 1\n",
        stderr: "",
      });

      const result = await checker.checkPasswordProtection();
      expect(result).toEqual({
        enabled: true,
        requirePasswordImmediately: true,
        passwordRequiredAfterLock: true,
      });
    });

    it("should return false when screen saver is disabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "ScreenSaverActive: 0\nScreenSaverIsSecure: 0\n",
        stderr: "",
      });

      const result = await checker.checkPasswordProtection();
      expect(result).toEqual({
        enabled: false,
        requirePasswordImmediately: false,
        passwordRequiredAfterLock: false,
      });
    });

    it("should handle errors gracefully", async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(
        new Error("Registry access denied"),
      );

      const result = await checker.checkPasswordProtection();
      expect(result).toEqual({
        enabled: false,
        requirePasswordImmediately: false,
        passwordRequiredAfterLock: false,
      });
    });
  });

  describe("checkAutoLockTimeout", () => {
    it("should return timeout in minutes", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "900", // 15 minutes in seconds
        stderr: "",
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(15);
    });

    it("should return 0 when no timeout is set", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "0",
        stderr: "",
      });

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(0);
    });

    it("should handle errors by returning 0", async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(
        new Error("Registry error"),
      );

      const result = await checker.checkAutoLockTimeout();
      expect(result).toBe(0);
    });
  });

  describe("checkFirewall", () => {
    it("should return true when firewall is enabled", async () => {
      (mockExecAsync as jest.Mock)
        .mockResolvedValueOnce({
          stdout: "Domain: True\nPrivate: True\nPublic: True\n",
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "False",
          stderr: "",
        });

      const result = await checker.checkFirewall();
      expect(result).toEqual({ enabled: true, stealthMode: true });
    });

    it("should return false when firewall is disabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "Domain: False\nPrivate: False\nPublic: False\n",
        stderr: "",
      });

      const result = await checker.checkFirewall();
      expect(result).toEqual({ enabled: false, stealthMode: false });
    });

    it("should handle stealth mode detection errors", async () => {
      (mockExecAsync as jest.Mock)
        .mockResolvedValueOnce({
          stdout: "Public: True\n",
          stderr: "",
        })
        .mockRejectedValueOnce(new Error("Stealth mode query failed"));

      const result = await checker.checkFirewall();
      expect(result).toEqual({ enabled: true, stealthMode: false });
    });
  });

  describe("checkPackageVerification", () => {
    it("should return true when SmartScreen is enabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "RequireAdmin",
        stderr: "",
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(true);
    });

    it("should return true when SmartScreen is in prompt mode", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "Prompt",
        stderr: "",
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(true);
    });

    it("should return false when SmartScreen is disabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "Off",
        stderr: "",
      });

      const result = await checker.checkPackageVerification();
      expect(result).toBe(false);
    });
  });

  describe("checkSystemIntegrityProtection", () => {
    it("should return true when Windows Defender is enabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout:
          "RealTimeProtectionEnabled: True\nTamperProtectionEnabled: True\n",
        stderr: "",
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(true);
    });

    it("should return false when Windows Defender is disabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout:
          "RealTimeProtectionEnabled: False\nTamperProtectionEnabled: False\n",
        stderr: "",
      });

      const result = await checker.checkSystemIntegrityProtection();
      expect(result).toBe(false);
    });
  });

  describe("checkRemoteLogin", () => {
    it("should return true when SSH service is running", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "Running",
        stderr: "",
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(true);
    });

    it("should return false when SSH service is not running", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "Stopped",
        stderr: "",
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(false);
    });

    it("should return false when SSH service is not found", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "NotFound",
        stderr: "",
      });

      const result = await checker.checkRemoteLogin();
      expect(result).toBe(false);
    });
  });

  describe("checkRemoteManagement", () => {
    it("should return true when RDP is enabled and running", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "RDPService: Running\nRDPEnabled: 0\n",
        stderr: "",
      });

      const result = await checker.checkRemoteManagement();
      expect(result).toBe(true);
    });

    it("should return false when RDP is disabled", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "RDPService: Running\nRDPEnabled: 1\n",
        stderr: "",
      });

      const result = await checker.checkRemoteManagement();
      expect(result).toBe(false);
    });
  });

  describe("checkAutomaticUpdates", () => {
    it("should return correct update settings for fully automatic", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "AUOptions: 4\nWUService: Running\n",
        stderr: "",
      });

      const result = await checker.checkAutomaticUpdates();
      expect(result).toEqual({
        enabled: true,
        securityUpdatesOnly: false,
        automaticDownload: true,
        automaticInstall: true,
        automaticSecurityInstall: true,
        downloadOnly: false,
        updateMode: "fully-automatic",
      });
    });

    it("should return correct settings for download-only", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "AUOptions: 3\nWUService: Running\n",
        stderr: "",
      });

      const result = await checker.checkAutomaticUpdates();
      expect(result).toEqual({
        enabled: true,
        securityUpdatesOnly: false,
        automaticDownload: true,
        automaticInstall: false,
        automaticSecurityInstall: false,
        downloadOnly: true,
        updateMode: "download-only",
      });
    });

    it("should return disabled when service is not running", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "AUOptions: 4\nWUService: Stopped\n",
        stderr: "",
      });

      const result = await checker.checkAutomaticUpdates();
      expect(result.enabled).toBe(false);
    });
  });

  describe("checkSharingServices", () => {
    it("should detect all sharing services when running", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout:
          "FileSharing: Running\nRDP: Running\nSSH: Running\nMediaSharing: Running\n",
        stderr: "",
      });

      const result = await checker.checkSharingServices();
      expect(result).toEqual({
        fileSharing: true,
        screenSharing: true,
        remoteLogin: true,
        mediaSharing: true,
      });
    });

    it("should return false for all services when none are running", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout:
          "FileSharing: Stopped\nRDP: Stopped\nSSH: Stopped\nMediaSharing: Stopped\n",
        stderr: "",
      });

      const result = await checker.checkSharingServices();
      expect(result).toEqual({
        fileSharing: false,
        screenSharing: false,
        remoteLogin: false,
        mediaSharing: false,
      });
    });
  });

  describe("getCurrentWindowsVersion", () => {
    it("should return Windows version", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "10.0.19041.0",
        stderr: "",
      });

      const result = await checker.getCurrentWindowsVersion();
      expect(result).toBe("10.0.19041.0");
    });

    it("should return unknown on error", async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(
        new Error("Command failed"),
      );

      const result = await checker.getCurrentWindowsVersion();
      expect(result).toBe("unknown");
    });
  });

  describe("getSystemInfo", () => {
    it("should return system information", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "Microsoft Windows 11 Pro 10.0.22000 on Dell OptiPlex 7090",
        stderr: "",
      });

      const result = await checker.getSystemInfo();
      expect(result).toBe(
        "Microsoft Windows 11 Pro 10.0.22000 on Dell OptiPlex 7090",
      );
    });

    it("should return fallback on error", async () => {
      (mockExecAsync as jest.Mock).mockRejectedValue(new Error("WMI error"));

      const result = await checker.getSystemInfo();
      expect(result).toBe("Windows (unknown version)");
    });
  });

  describe("checkOSVersion", () => {
    it("should check version against latest", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "10.0.22000.0",
        stderr: "",
      });

      const result = await checker.checkOSVersion("latest");
      expect(result).toEqual({
        current: "10.0.22000.0",
        target: "latest",
        isLatest: true,
        passed: true,
      });
    });

    it("should check version against specific target", async () => {
      (mockExecAsync as jest.Mock).mockResolvedValue({
        stdout: "10.0.19041.0",
        stderr: "",
      });

      const result = await checker.checkOSVersion("10.0.19041");
      expect(result).toEqual({
        current: "10.0.19041.0",
        target: "10.0.19041",
        isLatest: false,
        passed: true,
      });
    });
  });

  describe("getSecurityExplanations", () => {
    it("should return security explanations", () => {
      const explanations = checker.getSecurityExplanations();
      expect(explanations).toHaveProperty("diskEncryption");
      expect(explanations).toHaveProperty("passwordProtection");
      expect(explanations).toHaveProperty("firewall");
      expect(explanations.diskEncryption.riskLevel).toBe("High");
    });
  });

  describe("getPassword", () => {
    it("should return stored password", () => {
      const checkerWithPassword = new WindowsSecurityChecker("test-password");
      expect(checkerWithPassword.getPassword()).toBe("test-password");
    });

    it("should return undefined when no password set", () => {
      expect(checker.getPassword()).toBeUndefined();
    });
  });
});
