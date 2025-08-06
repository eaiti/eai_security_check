#!/usr/bin/env node

/**
 * Signature Verification Script
 *
 * This script helps users verify the signatures and checksums of downloaded executables.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

function log(message) {
  console.log(`[Verify] ${message}`);
}

function error(message) {
  console.error(`[Verify] ERROR: ${message}`);
}

function success(message) {
  console.log(`[Verify] ✅ ${message}`);
}

function warning(message) {
  console.log(`[Verify] ⚠️  ${message}`);
}

function verifyMacOSSignature(executablePath) {
  log("Verifying macOS code signature...");

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Executable not found: ${executablePath}`);
  }

  try {
    // Check if codesign is available
    execSync("which codesign", { stdio: "ignore" });
  } catch {
    warning("codesign not available, skipping macOS signature verification");
    return;
  }

  try {
    execSync(`codesign --verify --verbose "${executablePath}"`, {
      encoding: "utf8",
      stdio: "pipe",
    });

    // Get signature details
    const infoOutput = execSync(`codesign -dv "${executablePath}"`, {
      encoding: "utf8",
      stdio: "pipe",
    });

    success("macOS signature verified");
    log(`Signature details: ${infoOutput}`);
  } catch (e) {
    if (e.stderr && e.stderr.includes("not signed")) {
      warning("Executable is not code signed");
    } else {
      throw new Error(`Signature verification failed: ${e.message}`);
    }
  }
}

function verifyLinuxSignature(executablePath, signaturePath) {
  log("Verifying Linux GPG signature...");

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Executable not found: ${executablePath}`);
  }

  if (!fs.existsSync(signaturePath)) {
    warning(`Signature file not found: ${signaturePath}`);
    return;
  }

  try {
    // Check if gpg is available
    execSync("which gpg", { stdio: "ignore" });
  } catch {
    warning("gpg not available, skipping GPG signature verification");
    return;
  }

  try {
    const output = execSync(
      `gpg --verify "${signaturePath}" "${executablePath}"`,
      {
        encoding: "utf8",
        stdio: "pipe",
      },
    );
    success("GPG signature verified");
    log(`Verification output: ${output}`);
  } catch (e) {
    // GPG verification output goes to stderr even on success
    if (
      e.stderr &&
      (e.stderr.includes("Good signature") ||
        e.stderr.includes("valid signature"))
    ) {
      success("GPG signature verified");
      log(`Verification output: ${e.stderr}`);
    } else {
      throw new Error(`GPG signature verification failed: ${e.message}`);
    }
  }
}

function verifyWindowsSignature(executablePath) {
  log("Verifying Windows code signature...");

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Executable not found: ${executablePath}`);
  }

  // Try different verification methods
  let verified = false;

  // Try signtool if on Windows
  if (os.platform() === "win32") {
    try {
      const output = execSync(`signtool verify /pa "${executablePath}"`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      success("Windows signature verified (signtool)");
      log(`Verification output: ${output}`);
      verified = true;
    } catch {
      // Try PowerShell method
      try {
        const psOutput = execSync(
          `powershell -Command "Get-AuthenticodeSignature '${executablePath}' | Select-Object Status, StatusMessage"`,
          {
            encoding: "utf8",
            stdio: "pipe",
          },
        );
        if (psOutput.includes("Valid")) {
          success("Windows signature verified (PowerShell)");
          log(`Verification output: ${psOutput}`);
          verified = true;
        } else {
          warning(`Signature status: ${psOutput}`);
        }
      } catch {
        warning("Unable to verify Windows signature");
      }
    }
  } else {
    // Try osslsigncode for cross-platform verification
    try {
      execSync("which osslsigncode", { stdio: "ignore" });
      const output = execSync(`osslsigncode verify "${executablePath}"`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      success("Windows signature verified (osslsigncode)");
      log(`Verification output: ${output}`);
      verified = true;
    } catch {
      warning(
        "osslsigncode not available, cannot verify Windows signature on this platform",
      );
    }
  }

  if (!verified) {
    warning("Could not verify Windows signature (no suitable tools available)");
  }
}

function verifyChecksum(executablePath, checksumPath) {
  log("Verifying checksum...");

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Executable not found: ${executablePath}`);
  }

  if (!fs.existsSync(checksumPath)) {
    warning(`Checksum file not found: ${checksumPath}`);
    return;
  }

  try {
    const checksumContent = fs.readFileSync(checksumPath, "utf8").trim();
    const [expectedHash] = checksumContent.split("  ");

    let actualHash;

    if (os.platform() === "win32") {
      // Use PowerShell on Windows
      const output = execSync(
        `powershell -Command "Get-FileHash '${executablePath}' -Algorithm SHA256 | Select-Object -ExpandProperty Hash"`,
        {
          encoding: "utf8",
        },
      );
      actualHash = output.trim().toLowerCase();
    } else {
      // Use sha256sum on Unix-like systems
      const output = execSync(`sha256sum "${executablePath}"`, {
        encoding: "utf8",
      });
      actualHash = output.split(" ")[0];
    }

    if (actualHash === expectedHash.toLowerCase()) {
      success("Checksum verified");
      log(`SHA256: ${actualHash}`);
    } else {
      throw new Error(
        `Checksum mismatch! Expected: ${expectedHash}, Actual: ${actualHash}`,
      );
    }
  } catch (e) {
    if (e.message.includes("Checksum mismatch")) {
      throw e;
    } else {
      throw new Error(`Checksum verification failed: ${e.message}`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node verify-signatures.js <executable-path> [options]

Examples:
  node verify-signatures.js eai-security-check-macos-v1.0.0
  node verify-signatures.js eai-security-check-linux-v1.0.0
  node verify-signatures.js eai-security-check-windows-v1.0.0.exe

Options:
  --skip-signature    Skip signature verification
  --skip-checksum     Skip checksum verification
    `);
    return;
  }

  const executablePath = args[0];
  const skipSignature = args.includes("--skip-signature");
  const skipChecksum = args.includes("--skip-checksum");

  try {
    log(`Verifying: ${executablePath}`);

    // Determine platform based on executable name
    const basename = path.basename(executablePath);

    if (!skipSignature) {
      if (basename.includes("macos")) {
        verifyMacOSSignature(executablePath);
      } else if (basename.includes("linux")) {
        const signaturePath = executablePath + ".sig";
        verifyLinuxSignature(executablePath, signaturePath);
      } else if (basename.includes("windows") || basename.endsWith(".exe")) {
        verifyWindowsSignature(executablePath);
      } else {
        warning(
          "Cannot determine platform from filename, skipping signature verification",
        );
      }
    }

    if (!skipChecksum) {
      const checksumPath = executablePath + ".sha256";
      verifyChecksum(executablePath, checksumPath);
    }

    success("Verification completed successfully!");
  } catch (e) {
    error(e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  verifyMacOSSignature,
  verifyLinuxSignature,
  verifyWindowsSignature,
  verifyChecksum,
};
