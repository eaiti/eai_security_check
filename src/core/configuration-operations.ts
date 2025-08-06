import * as fs from "fs";
import * as path from "path";
import { select } from "@inquirer/prompts";
import { ConfigManager } from "../config/config-manager";
import { VALID_PROFILES } from "../config/config-profiles";

export interface ConfigurationStatus {
  configDirectory: string;
  securityConfigExists: boolean;
  securityConfigPath: string;
  schedulingConfigExists: boolean;
  schedulingConfigPath: string;
  availableProfiles: { [profile: string]: boolean };
}

/**
 * Core configuration operations shared between CLI and interactive modes
 */
export class ConfigurationOperations {
  /**
   * Get comprehensive configuration status
   */
  static getConfigurationStatus(): ConfigurationStatus {
    const status = ConfigManager.getConfigStatus();

    // Check available profiles
    const availableProfiles: { [profile: string]: boolean } = {};
    const profiles = ["default", "strict", "relaxed", "developer", "eai"];

    for (const profile of profiles) {
      const profilePath =
        profile === "default"
          ? status.securityConfigPath
          : path.join(status.configDirectory, `${profile}-config.json`);
      availableProfiles[profile] = fs.existsSync(profilePath);
    }

    return {
      configDirectory: status.configDirectory,
      securityConfigExists: status.securityConfigExists,
      securityConfigPath: status.securityConfigPath,
      schedulingConfigExists: status.schedulingConfigExists,
      schedulingConfigPath: status.schedulingConfigPath,
      availableProfiles,
    };
  }

  /**
   * Setup or modify security configurations
   */
  static async setupOrModifyConfigurations(): Promise<void> {
    console.log("🔧 Security Configuration Management\n");

    if (!ConfigManager.hasSecurityConfig()) {
      console.log(
        "📝 No security configuration found. Setting up for first time...\n",
      );

      const profile = await ConfigManager.promptForSecurityProfile();
      ConfigManager.createAllSecurityConfigs(false, profile);

      console.log("✅ Security configurations created successfully!");
    } else {
      console.log(
        "🔧 Security configuration exists. What would you like to do?\n",
      );

      const choice = await select({
        message: "Choose an option:",
        choices: [
          { name: "View current configuration", value: "1" },
          { name: "Change default profile", value: "2" },
          { name: "Recreate all configurations", value: "3" },
          { name: "Go back", value: "4" },
        ],
      });

      switch (choice) {
        case "1": {
          const config = ConfigManager.loadSecurityConfig();
          console.log("\n📋 Current Security Configuration:");
          console.log(JSON.stringify(config, null, 2));
          break;
        }
        case "2": {
          const profile = await ConfigManager.promptForSecurityProfile();
          const force = await ConfigManager.promptForForceOverwrite();
          ConfigManager.createAllSecurityConfigs(force, profile);
          console.log(
            `✅ Security configurations updated to '${profile}' profile!`,
          );
          break;
        }
        case "3": {
          const profile = await ConfigManager.promptForSecurityProfile();
          ConfigManager.createAllSecurityConfigs(true, profile);
          console.log("✅ All security configurations recreated!");
          break;
        }
        case "4":
          return;
        default:
          console.log("❌ Invalid choice.");
      }
    }
  }

  /**
   * View configuration status with detailed information
   */
  static async viewConfigurationStatus(): Promise<void> {
    console.log("📊 Configuration Status Report\n");

    const status = this.getConfigurationStatus();

    console.log(`📁 Configuration Directory: ${status.configDirectory}`);
    console.log(
      `🔒 Security Config: ${status.securityConfigExists ? "✅ Found" : "❌ Missing"}`,
    );
    if (status.securityConfigExists) {
      console.log(`   Location: ${status.securityConfigPath}`);
    }

    console.log(
      `🤖 Daemon Config: ${status.schedulingConfigExists ? "✅ Found" : "❌ Missing"}`,
    );
    if (status.schedulingConfigExists) {
      console.log(`   Location: ${status.schedulingConfigPath}`);
    }

    // Show available profiles
    console.log("\n📋 Available Security Profiles:");
    for (const [profile, exists] of Object.entries(status.availableProfiles)) {
      console.log(`   ${profile}: ${exists ? "✅" : "❌"}`);
    }

    console.log("");
  }

  /**
   * Reset all configurations with confirmation
   */
  static async resetAllConfigurations(): Promise<void> {
    console.log("🔄 Reset All Configurations\n");

    if (await ConfigManager.promptForConfigReset()) {
      ConfigManager.resetAllConfigurations();
      console.log("✅ All configurations have been reset!");
      console.log("💡 You can now set up fresh configurations if needed.");
    } else {
      console.log("❌ Reset cancelled.");
    }
  }

  /**
   * Create configurations for a specific profile
   */
  static createConfigurationsForProfile(
    profile: string,
    force: boolean = false,
  ): boolean {
    try {
      if (
        !VALID_PROFILES.includes(
          profile as "default" | "strict" | "relaxed" | "developer" | "eai",
        )
      ) {
        throw new Error(
          `Invalid profile: ${profile}. Valid profiles: ${VALID_PROFILES.join(", ")}`,
        );
      }

      ConfigManager.createAllSecurityConfigs(force, profile);
      return true;
    } catch (error) {
      console.error(
        `Failed to create configurations for profile '${profile}':`,
        error,
      );
      return false;
    }
  }

  /**
   * Load configuration for a specific profile
   */
  static loadConfigurationForProfile(profile: string) {
    try {
      if (profile === "default") {
        return ConfigManager.loadSecurityConfig();
      } else {
        const { configDir } = ConfigManager.ensureCentralizedDirectories();
        const configPath = path.join(configDir, `${profile}-config.json`);

        if (!fs.existsSync(configPath)) {
          throw new Error(
            `Configuration file not found for profile '${profile}': ${configPath}`,
          );
        }

        const content = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(
        `Failed to load configuration for profile '${profile}':`,
        error,
      );
      return null;
    }
  }

  /**
   * Get list of available profiles with their status
   */
  static getAvailableProfiles(): {
    profile: string;
    exists: boolean;
    path: string;
  }[] {
    const status = this.getConfigurationStatus();
    const profiles = ["default", "strict", "relaxed", "developer", "eai"];

    return profiles.map((profile) => ({
      profile,
      exists: status.availableProfiles[profile],
      path:
        profile === "default"
          ? status.securityConfigPath
          : path.join(status.configDirectory, `${profile}-config.json`),
    }));
  }

  /**
   * Ensure all default configurations exist
   */
  static ensureDefaultConfigurations(): void {
    try {
      if (!ConfigManager.hasSecurityConfig()) {
        console.log("📝 Creating default security configuration...");
        ConfigManager.createAllSecurityConfigs(false, "default");
        console.log("✅ Default security configuration created.");
      }
    } catch (error) {
      console.error("❌ Failed to create default configurations:", error);
      throw error;
    }
  }

  /**
   * Validate configuration directory and files
   */
  static validateConfigurations(): {
    valid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const status = this.getConfigurationStatus();

    // Check if config directory exists and is accessible
    try {
      if (!fs.existsSync(status.configDirectory)) {
        issues.push(
          `Configuration directory does not exist: ${status.configDirectory}`,
        );
      } else {
        const dirStats = fs.statSync(status.configDirectory);
        if (!dirStats.isDirectory()) {
          issues.push(
            `Configuration path is not a directory: ${status.configDirectory}`,
          );
        }
      }
    } catch (error) {
      issues.push(`Cannot access configuration directory: ${error}`);
    }

    // Check security configuration
    if (!status.securityConfigExists) {
      issues.push("Security configuration file is missing");
      recommendations.push(
        "Run: eai-security-check interactive → Configuration → Setup/Modify Security Configurations",
      );
    } else {
      try {
        const config = ConfigManager.loadSecurityConfig();
        if (!config || typeof config !== "object") {
          issues.push("Security configuration exists but is invalid");
        }
      } catch (error) {
        issues.push(`Security configuration file is corrupted: ${error}`);
      }
    }

    // Check profile availability
    const missingProfiles = Object.entries(status.availableProfiles)
      .filter(([, exists]) => !exists)
      .map(([profile]) => profile);

    if (missingProfiles.length > 0) {
      recommendations.push(
        `Missing security profiles: ${missingProfiles.join(", ")}`,
      );
      recommendations.push(
        "These profiles will be created automatically when first used",
      );
    }

    // Check daemon configuration if it should exist
    if (status.schedulingConfigExists) {
      try {
        const schedulingConfig = JSON.parse(
          fs.readFileSync(status.schedulingConfigPath, "utf-8"),
        );
        if (!schedulingConfig.email || !schedulingConfig.email.smtp) {
          recommendations.push(
            "Daemon configuration exists but email settings may be incomplete",
          );
        }
      } catch (error) {
        issues.push(`Daemon configuration file is corrupted: ${error}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
    };
  }
}
