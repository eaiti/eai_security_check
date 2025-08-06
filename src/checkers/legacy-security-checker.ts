import { MacOSSecurityChecker } from "./security-checker";

/**
 * Legacy macOS Security Checker for versions below 15.0
 * All security checks return failure with appropriate messages indicating
 * that the checks are not supported on legacy macOS versions.
 */
export class LegacyMacOSSecurityChecker extends MacOSSecurityChecker {
  async checkFileVault(): Promise<boolean> {
    return false;
  }

  async checkPasswordProtection(): Promise<{
    enabled: boolean;
    requirePasswordImmediately: boolean;
    passwordRequiredAfterLock: boolean;
  }> {
    return {
      enabled: false,
      requirePasswordImmediately: false,
      passwordRequiredAfterLock: false,
    };
  }

  async checkAutoLockTimeout(): Promise<number> {
    return 0;
  }

  async checkFirewall(): Promise<{ enabled: boolean; stealthMode: boolean }> {
    return { enabled: false, stealthMode: false };
  }

  async checkGatekeeper(): Promise<boolean> {
    return false;
  }

  async checkSystemIntegrityProtection(): Promise<boolean> {
    return false;
  }

  async checkRemoteLogin(): Promise<boolean> {
    return false;
  }

  async checkRemoteManagement(): Promise<boolean> {
    return false;
  }

  async checkAutomaticUpdates(): Promise<{
    enabled: boolean;
    securityUpdatesOnly: boolean;
    automaticDownload: boolean;
    automaticInstall: boolean;
    automaticSecurityInstall: boolean;
    configDataInstall: boolean;
    updateMode: "disabled" | "check-only" | "download-only" | "fully-automatic";
  }> {
    return {
      enabled: false,
      securityUpdatesOnly: false,
      automaticDownload: false,
      automaticInstall: false,
      automaticSecurityInstall: false,
      configDataInstall: false,
      updateMode: "disabled",
    };
  }

  async checkSharingServices(): Promise<{
    fileSharing: boolean;
    screenSharing: boolean;
    remoteLogin: boolean;
    mediaSharing: boolean;
  }> {
    return {
      fileSharing: false,
      screenSharing: false,
      remoteLogin: false,
      mediaSharing: false,
    };
  }

  async checkCurrentWifiNetwork(): Promise<{
    networkName: string | null;
    connected: boolean;
  }> {
    return { networkName: null, connected: false };
  }

  async checkInstalledApplications(): Promise<{
    installedApps: string[];
    bannedAppsFound: string[];
    sources: { applications: string[]; homebrew: string[]; npm: string[] };
  }> {
    return {
      installedApps: [],
      bannedAppsFound: [],
      sources: { applications: [], homebrew: [], npm: [] },
    };
  }

  getSecurityExplanations(): Record<
    string,
    {
      description: string;
      recommendation: string;
      riskLevel: "High" | "Medium" | "Low";
    }
  > {
    const baseExplanations = super.getSecurityExplanations();

    // Override explanations to indicate legacy macOS limitations
    const legacyExplanations: Record<
      string,
      {
        description: string;
        recommendation: string;
        riskLevel: "High" | "Medium" | "Low";
      }
    > = {};

    for (const [key, value] of Object.entries(baseExplanations)) {
      legacyExplanations[key] = {
        ...value,
        description: `${value.description} Note: This security check is not fully supported on macOS versions below 15.0.`,
        recommendation: `${value.recommendation} However, automated checking is not available on your macOS version - please verify settings manually.`,
      };
    }

    return legacyExplanations;
  }
}
