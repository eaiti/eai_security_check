import * as fs from "fs";
import * as path from "path";
import { input } from "@inquirer/prompts";
import { CryptoUtils } from "../utils/crypto-utils";
import { ConfigManager } from "../config/config-manager";

export interface VerificationResult {
  isValid: boolean;
  message: string;
  originalHash?: string;
  calculatedHash?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  tampered: boolean;
}

export interface FileVerificationResult {
  file: string;
  status: "passed" | "failed" | "skipped";
  message?: string;
  result?: VerificationResult;
}

export interface DirectoryVerificationSummary {
  totalFiles: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  results: FileVerificationResult[];
}

/**
 * Core verification operations shared between CLI and interactive modes
 */
export class VerificationOperations {
  /**
   * Verify a single file
   */
  static verifyFile(
    filePath: string,
    _verbose: boolean = false,
  ): VerificationResult {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        return {
          isValid: false,
          message: `File not found: ${resolvedPath}`,
          tampered: true,
        };
      }

      const { content, verification } =
        CryptoUtils.loadAndVerifyReport(resolvedPath);
      const signature = CryptoUtils.extractSignature(content);

      const result: VerificationResult = {
        isValid: verification.isValid,
        message: verification.message,
        originalHash: verification.originalHash,
        calculatedHash: verification.calculatedHash,
        tampered: !verification.isValid,
      };

      if (signature) {
        result.timestamp = signature.timestamp as string;
        result.metadata = signature.metadata as Record<string, unknown>;
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        message: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
        tampered: true,
      };
    }
  }

  /**
   * Verify all files in a directory
   */
  static verifyDirectory(
    dirPath: string,
    verbose: boolean = false,
  ): DirectoryVerificationSummary {
    const resolvedPath = path.resolve(dirPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory not found: ${resolvedPath}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    const files = fs.readdirSync(resolvedPath);
    const reportFiles = files.filter((file) => {
      const filePath = path.join(resolvedPath, file);
      return fs.statSync(filePath).isFile();
    });

    if (reportFiles.length === 0) {
      throw new Error(`No files found in directory: ${resolvedPath}`);
    }

    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results: FileVerificationResult[] = [];

    for (const file of reportFiles) {
      const filePath = path.join(resolvedPath, file);

      try {
        // Check if file contains a security report signature
        const fileContent = fs.readFileSync(filePath, "utf-8");
        if (!CryptoUtils.extractSignature(fileContent)) {
          skippedCount++;
          results.push({
            file,
            status: "skipped",
            message: "No security signature found",
          });
          continue;
        }

        const verificationResult = this.verifyFile(filePath, verbose);

        if (verificationResult.isValid) {
          passedCount++;
          results.push({
            file,
            status: "passed",
            result: verificationResult,
          });
        } else {
          failedCount++;
          results.push({
            file,
            status: "failed",
            message: verificationResult.message,
            result: verificationResult,
          });
        }
      } catch (error) {
        failedCount++;
        results.push({
          file,
          status: "failed",
          message: `Error: ${error}`,
        });
      }
    }

    return {
      totalFiles: reportFiles.length,
      passedCount,
      failedCount,
      skippedCount,
      results,
    };
  }

  /**
   * Verify locally saved security reports
   */
  static async verifyLocalReports(): Promise<void> {
    console.log("🔍 Verify Local Reports\n");

    const { reportsDir } = ConfigManager.ensureCentralizedDirectories();

    if (!fs.existsSync(reportsDir)) {
      console.log("❌ Reports directory not found:");
      console.log(`   ${reportsDir}`);
      console.log(
        "💡 Reports will be created here when the daemon runs or when you save reports manually.",
      );
      console.log("");
      return;
    }

    console.log(`📂 Scanning reports directory: ${reportsDir}\n`);

    try {
      const files = fs
        .readdirSync(reportsDir)
        .filter(
          (file) => file.includes("security-report-") && file.endsWith(".txt"),
        )
        .sort((a, b) => {
          // Sort by modification time, newest first
          const statA = fs.statSync(path.join(reportsDir, a));
          const statB = fs.statSync(path.join(reportsDir, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
        });

      if (files.length === 0) {
        console.log("ℹ️  No security reports found in the reports directory.");
        console.log(
          "💡 Reports are automatically saved when the daemon runs or when you manually save reports.",
        );
        console.log("");
        return;
      }

      console.log(
        `📋 Found ${files.length} report file${files.length === 1 ? "" : "s"}:\n`,
      );

      let verifiedCount = 0;
      let failedCount = 0;

      for (const file of files) {
        const filePath = path.join(reportsDir, file);
        const stats = fs.statSync(filePath);

        console.log(`📄 ${file}`);
        console.log(`   📅 Created: ${stats.mtime.toLocaleString()}`);
        console.log(`   📏 Size: ${(stats.size / 1024).toFixed(1)} KB`);

        // Basic integrity checks
        try {
          const content = fs.readFileSync(filePath, "utf8");

          // Check if file has expected structure
          const hasHeader =
            content.includes("EAI Security Check Report") ||
            content.includes("Security Audit Report");
          const hasTimestamp = /\d{4}-\d{2}-\d{2}/.test(content);
          const hasResults =
            content.includes("PASSED") || content.includes("FAILED");

          if (hasHeader && hasTimestamp && hasResults) {
            console.log("   ✅ Basic integrity: PASSED");
            verifiedCount++;
          } else {
            console.log(
              "   ❌ Basic integrity: FAILED (missing expected content)",
            );
            failedCount++;
          }
        } catch (error) {
          console.log(`   ❌ Read error: ${error}`);
          failedCount++;
        }

        console.log("");
      }

      // Summary
      console.log("📊 Verification Summary:");
      console.log(`   ✅ Verified: ${verifiedCount}`);
      console.log(`   ❌ Failed: ${failedCount}`);
      console.log(`   📁 Total: ${files.length}`);

      if (failedCount === 0) {
        console.log("\n🎉 All reports passed basic integrity checks!");
      } else {
        console.log(
          "\n⚠️  Some reports failed verification. Consider re-running security checks.",
        );
      }
    } catch (error) {
      console.error("❌ Error accessing reports directory:", error);
    }

    console.log("");
  }

  /**
   * Verify a specific file with user interaction
   */
  static async verifySpecificFile(): Promise<void> {
    console.log("🔍 Verify Specific File\n");

    try {
      const filePath = await input({
        message: "Enter the path to the file you want to verify:",
        validate: (value: string) => {
          if (!value.trim()) {
            return "File path cannot be empty";
          }
          if (!fs.existsSync(value.trim())) {
            return "File does not exist";
          }
          return true;
        },
      });

      const trimmedPath = filePath.trim();
      console.log(`\n📄 Verifying file: ${trimmedPath}`);

      const result = this.verifyFile(trimmedPath, true);

      if (result.isValid) {
        console.log("✅ File verification PASSED");
        if (result.originalHash) {
          console.log(
            `🔐 Hash: ${CryptoUtils.createShortHash(result.originalHash)}`,
          );
        }
        if (result.timestamp) {
          console.log(
            `📅 Generated: ${new Date(result.timestamp).toLocaleString()}`,
          );
        }
        if (result.metadata) {
          console.log(`💻 Platform: ${result.metadata.platform}`);
          console.log(`🖥️  Hostname: ${result.metadata.hostname}`);
        }
      } else {
        console.error("❌ File verification FAILED");
        console.error(`⚠️  ${result.message}`);

        if (result.originalHash && result.calculatedHash) {
          console.error(
            `🔐 Expected: ${CryptoUtils.createShortHash(result.originalHash)}`,
          );
          console.error(
            `🔐 Actual: ${CryptoUtils.createShortHash(result.calculatedHash)}`,
          );
        }
      }

      // Additional file checks
      try {
        const content = fs.readFileSync(trimmedPath, "utf-8");

        // Check if it's a JSON file
        if (trimmedPath.endsWith(".json")) {
          JSON.parse(content); // Verify it's valid JSON
          console.log("✅ File is valid JSON");
        } else {
          console.log("✅ File is readable");
        }

        // Get file stats
        const stats = fs.statSync(trimmedPath);
        console.log(`📊 File size: ${stats.size} bytes`);
        console.log(`📅 Last modified: ${stats.mtime.toISOString()}`);
      } catch (error) {
        console.log(
          `❌ Additional file checks failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ExitPromptError"
      ) {
        return; // User cancelled
      }
      console.error(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Verify all files in a directory with user interaction
   */
  static async verifyDirectoryInteractive(): Promise<void> {
    console.log("🔍 Verify Directory\n");

    try {
      const dirPath = await input({
        message: "Enter the path to the directory you want to verify:",
        validate: (value: string) => {
          if (!value.trim()) {
            return "Directory path cannot be empty";
          }
          if (!fs.existsSync(value.trim())) {
            return "Directory does not exist";
          }
          if (!fs.statSync(value.trim()).isDirectory()) {
            return "Path is not a directory";
          }
          return true;
        },
      });

      const trimmedPath = dirPath.trim();
      console.log(`\n📁 Verifying directory: ${trimmedPath}`);

      const files = fs.readdirSync(trimmedPath);

      if (files.length === 0) {
        console.log("📂 Directory is empty");
        return;
      }

      console.log(`📊 Found ${files.length} file(s):`);
      let validFiles = 0;
      let invalidFiles = 0;
      let directories = 0;

      for (const file of files) {
        const filePath = path.join(trimmedPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          console.log(`  📁 ${file} - Directory`);
          directories++;
          continue;
        }

        try {
          const content = fs.readFileSync(filePath, "utf-8");

          // Check if it's a JSON file
          if (file.endsWith(".json")) {
            JSON.parse(content); // Verify it's valid JSON
            console.log(`  ✅ ${file} - Valid JSON (${stats.size} bytes)`);
          } else {
            console.log(`  ✅ ${file} - Readable (${stats.size} bytes)`);
          }
          validFiles++;
        } catch (error) {
          console.log(
            `  ❌ ${file} - Error: ${error instanceof Error ? error.message : String(error)}`,
          );
          invalidFiles++;
        }
      }

      console.log(
        `\n📈 Summary: ${validFiles} valid files, ${invalidFiles} invalid files, ${directories} directories`,
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ExitPromptError"
      ) {
        return; // User cancelled
      }
      console.error(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Display verification result in a formatted way
   */
  static displayVerificationResult(
    result: VerificationResult,
    filePath: string,
    verbose: boolean = false,
  ): void {
    if (result.isValid) {
      console.log(`✅ ${path.basename(filePath)}: PASSED`);
      if (verbose && result.originalHash) {
        console.log(
          `   🔐 Hash: ${CryptoUtils.createShortHash(result.originalHash)}`,
        );
        if (result.timestamp) {
          console.log(
            `   📅 Generated: ${new Date(result.timestamp).toLocaleString()}`,
          );
        }
        if (result.metadata) {
          console.log(`   💻 Platform: ${result.metadata.platform}`);
        }
      }
    } else {
      console.error(`❌ ${path.basename(filePath)}: FAILED`);
      console.error(`   ⚠️  ${result.message}`);
      if (verbose && result.originalHash && result.calculatedHash) {
        console.error(
          `   🔐 Expected: ${CryptoUtils.createShortHash(result.originalHash)}`,
        );
        console.error(
          `   🔐 Actual: ${CryptoUtils.createShortHash(result.calculatedHash)}`,
        );
      }
    }
  }

  /**
   * Display directory verification summary
   */
  static displayDirectoryVerificationSummary(
    summary: DirectoryVerificationSummary,
    verbose: boolean = false,
  ): void {
    console.log(`📊 Verification Summary:`);
    console.log(`   ✅ Passed: ${summary.passedCount}`);
    console.log(`   ❌ Failed: ${summary.failedCount}`);
    console.log(
      `   ⏭️  Skipped: ${summary.skippedCount} (no security signature)`,
    );
    console.log(`   📄 Total: ${summary.totalFiles}`);

    if (verbose || summary.failedCount > 0) {
      console.log("\n📋 Detailed Results:");
      for (const result of summary.results) {
        const icon =
          result.status === "passed"
            ? "✅"
            : result.status === "failed"
              ? "❌"
              : "⏭️";
        console.log(
          `   ${icon} ${result.file}: ${result.status.toUpperCase()}`,
        );
        if (result.message) {
          console.log(`      ${result.message}`);
        }
        if (verbose && result.result?.originalHash) {
          console.log(
            `      Hash: ${CryptoUtils.createShortHash(result.result.originalHash)}`,
          );
        }
      }
    }

    if (!verbose && summary.passedCount > 0) {
      console.log(
        `\n✅ Files passed: ${summary.results
          .filter((r) => r.status === "passed")
          .map((r) => r.file)
          .join(", ")}`,
      );
    }

    if (summary.failedCount > 0) {
      console.log(
        `\n❌ Files failed: ${summary.results
          .filter((r) => r.status === "failed")
          .map((r) => r.file)
          .join(", ")}`,
      );
    }
  }
}
