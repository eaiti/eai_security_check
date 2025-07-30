import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface HashedReport {
  content: string;
  hash: string;
  algorithm: string;
  timestamp: string;
  metadata: {
    platform: string;
    hostname: string;
    version: string;
  };
}

export interface VerificationResult {
  isValid: boolean;
  originalHash: string;
  calculatedHash: string;
  message: string;
  tampered: boolean;
}

export class CryptoUtils {
  private static readonly HASH_ALGORITHM = 'sha256';
  private static readonly SIGNATURE_SEPARATOR = '\n--- SECURITY SIGNATURE ---\n';

  /**
   * Generate a hash for the report content
   */
  static generateHash(content: string, algorithm: string = this.HASH_ALGORITHM): string {
    const hash = crypto.createHash(algorithm);
    hash.update(content);
    return hash.digest('hex');
  }

  /**
   * Create a hashed report with verification signature
   */
  static createHashedReport(content: string, metadata?: any): HashedReport {
    const timestamp = new Date().toISOString();
    const platform = process.platform;
    const hostname = require('os').hostname();
    const version = '1.0.0'; // Should match package.json version
    
    const reportMetadata = {
      platform,
      hostname,
      version,
      ...metadata
    };

    // Create content without signature for hashing
    const cleanContent = this.stripExistingSignature(content);
    
    // Generate hash of the clean content + metadata
    const hashInput = cleanContent + JSON.stringify(reportMetadata) + timestamp;
    const hash = this.generateHash(hashInput);

    return {
      content: cleanContent,
      hash,
      algorithm: this.HASH_ALGORITHM,
      timestamp,
      metadata: reportMetadata
    };
  }

  /**
   * Add signature to report content
   */
  static signReport(hashedReport: HashedReport): string {
    const signature = {
      hash: hashedReport.hash,
      algorithm: hashedReport.algorithm,
      timestamp: hashedReport.timestamp,
      metadata: hashedReport.metadata
    };

    return hashedReport.content + 
           this.SIGNATURE_SEPARATOR + 
           JSON.stringify(signature, null, 2) + 
           '\n' + this.SIGNATURE_SEPARATOR;
  }

  /**
   * Verify the integrity of a signed report
   */
  static verifyReport(signedContent: string): VerificationResult {
    try {
      // Split content and signature
      const parts = signedContent.split(this.SIGNATURE_SEPARATOR);
      
      if (parts.length !== 3) {
        return {
          isValid: false,
          originalHash: '',
          calculatedHash: '',
          message: 'Invalid report format: signature not found or malformed',
          tampered: true
        };
      }

      const content = parts[0];
      const signatureJson = parts[1].trim();
      
      let signature;
      try {
        signature = JSON.parse(signatureJson);
      } catch (parseError) {
        return {
          isValid: false,
          originalHash: '',
          calculatedHash: '',
          message: 'Invalid signature format: unable to parse JSON',
          tampered: true
        };
      }

      // Validate signature structure
      if (!signature.hash || !signature.algorithm || !signature.timestamp || !signature.metadata) {
        return {
          isValid: false,
          originalHash: signature.hash || '',
          calculatedHash: '',
          message: 'Invalid signature structure: missing required fields',
          tampered: true
        };
      }

      // Recalculate hash
      const hashInput = content + JSON.stringify(signature.metadata) + signature.timestamp;
      const calculatedHash = this.generateHash(hashInput, signature.algorithm);

      const isValid = calculatedHash === signature.hash;
      
      return {
        isValid,
        originalHash: signature.hash,
        calculatedHash,
        message: isValid ? 
          'Report integrity verified successfully' : 
          'Report has been tampered with or corrupted',
        tampered: !isValid
      };
    } catch (error) {
      return {
        isValid: false,
        originalHash: '',
        calculatedHash: '',
        message: `Verification failed: ${error}`,
        tampered: true
      };
    }
  }

  /**
   * Extract signature information from signed content
   */
  static extractSignature(signedContent: string): any | null {
    try {
      const parts = signedContent.split(this.SIGNATURE_SEPARATOR);
      if (parts.length !== 3) {
        return null;
      }

      const signatureJson = parts[1].trim();
      return JSON.parse(signatureJson);
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove existing signature from content
   */
  static stripExistingSignature(content: string): string {
    const signatureIndex = content.indexOf(this.SIGNATURE_SEPARATOR);
    if (signatureIndex === -1) {
      return content;
    }
    return content.substring(0, signatureIndex);
  }

  /**
   * Create a short hash for display (first 8 characters)
   */
  static createShortHash(hash: string): string {
    return hash.substring(0, 8).toUpperCase();
  }

  /**
   * Generate a verification command for the report
   */
  static generateVerificationCommand(filename: string): string {
    return `eai-security-check verify "${filename}"`;
  }

  /**
   * Save hashed report to file
   */
  static saveHashedReport(hashedReport: HashedReport, filepath: string): void {
    const signedContent = this.signReport(hashedReport);
    fs.writeFileSync(filepath, signedContent);
  }

  /**
   * Load and verify report from file
   */
  static loadAndVerifyReport(filepath: string): { content: string; verification: VerificationResult } {
    if (!fs.existsSync(filepath)) {
      throw new Error(`File not found: ${filepath}`);
    }

    const signedContent = fs.readFileSync(filepath, 'utf-8');
    const verification = this.verifyReport(signedContent);
    
    return {
      content: signedContent,
      verification
    };
  }

  /**
   * Create a verification summary for display
   */
  static createVerificationSummary(verification: VerificationResult, signature?: any): string {
    let summary = '\n🔒 Report Verification\n';
    summary += '='.repeat(50) + '\n';
    
    if (verification.isValid) {
      summary += '✅ Report integrity: VERIFIED\n';
      summary += `🔐 Hash: ${this.createShortHash(verification.originalHash)}\n`;
    } else {
      summary += '❌ Report integrity: FAILED\n';
      summary += `⚠️  ${verification.message}\n`;
      if (verification.originalHash) {
        summary += `🔐 Original hash: ${this.createShortHash(verification.originalHash)}\n`;
        summary += `🔐 Calculated hash: ${this.createShortHash(verification.calculatedHash)}\n`;
      }
    }
    
    if (signature) {
      summary += `📅 Generated: ${new Date(signature.timestamp).toLocaleString()}\n`;
      summary += `💻 Platform: ${signature.metadata.platform}\n`;
      summary += `🖥️  Hostname: ${signature.metadata.hostname}\n`;
      summary += `📦 Version: ${signature.metadata.version}\n`;
    }
    
    summary += '='.repeat(50) + '\n';
    
    return summary;
  }

  /**
   * Create a tamper-evident report with multiple verification methods
   */
  static createTamperEvidentReport(content: string, metadata?: any): string {
    const hashedReport = this.createHashedReport(content, metadata);
    const signedContent = this.signReport(hashedReport);
    
    // Add human-readable verification info at the top
    const shortHash = this.createShortHash(hashedReport.hash);
    const verificationHeader = `
🔒 TAMPER-EVIDENT SECURITY REPORT
Hash: ${shortHash} | Generated: ${new Date(hashedReport.timestamp).toLocaleString()}
Verify with: eai-security-check verify <filename>
${'='.repeat(80)}

`;
    
    return verificationHeader + signedContent;
  }

  /**
   * Validate hash algorithm
   */
  static isValidHashAlgorithm(algorithm: string): boolean {
    const validAlgorithms = ['sha256', 'sha512', 'sha1', 'md5'];
    return validAlgorithms.includes(algorithm.toLowerCase());
  }

  /**
   * Get available hash algorithms
   */
  static getAvailableHashAlgorithms(): string[] {
    return crypto.getHashes().filter(this.isValidHashAlgorithm);
  }
}