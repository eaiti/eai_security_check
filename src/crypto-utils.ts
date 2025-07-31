import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface HashedReport {
  content: string;
  hash: string;
  algorithm: string;
  timestamp: string;
  salt?: string;
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
  private static readonly SIGNATURE_SEPARATOR = '\n--- SECURITY SIGNATURE ---\n';
  private static readonly HMAC_ALGORITHM = 'sha256';
  
  /**
   * Get the current build secret (required)
   */
  private static getBuildSecret(): string {
    const secret = process.env.EAI_BUILD_SECRET;
    if (!secret) {
      throw new Error('EAI_BUILD_SECRET environment variable is required for tamper detection');
    }
    return secret;
  }

  /**
   * Generate a cryptographically secure random salt
   */
  private static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Derive a key from the build secret using PBKDF2
   */
  private static deriveKey(salt: string): Buffer {
    return crypto.pbkdf2Sync(this.getBuildSecret(), salt, 10000, 32, 'sha256');
  }

  /**
   * Generate HMAC for tamper detection
   */
  static generateSecureHash(content: string, salt: string): string {
    const derivedKey = this.deriveKey(salt);
    const hmac = crypto.createHmac(this.HMAC_ALGORITHM, derivedKey);
    hmac.update(content);
    return hmac.digest('hex');
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
    
    // Generate salt for security
    const salt = this.generateSalt();
    
    // Create hash input with additional entropy
    const hashInput = cleanContent + JSON.stringify(reportMetadata) + timestamp + salt;
    
    // Use HMAC for secure tamper detection
    const hash = this.generateSecureHash(hashInput, salt);

    return {
      content: cleanContent,
      hash,
      algorithm: 'hmac-sha256',
      timestamp,
      salt,
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
      salt: hashedReport.salt,
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
      if (!signature.hash || !signature.algorithm || !signature.timestamp || !signature.metadata || !signature.salt) {
        return {
          isValid: false,
          originalHash: signature.hash || '',
          calculatedHash: '',
          message: 'Invalid signature structure: missing required fields',
          tampered: true
        };
      }

      // Only support HMAC-SHA256
      if (signature.algorithm !== 'hmac-sha256') {
        return {
          isValid: false,
          originalHash: signature.hash,
          calculatedHash: '',
          message: `Unsupported algorithm: ${signature.algorithm}. Only HMAC-SHA256 is supported.`,
          tampered: true
        };
      }

      // Recalculate hash using HMAC
      const hashInput = content + JSON.stringify(signature.metadata) + signature.timestamp + signature.salt;
      const calculatedHash = this.generateSecureHash(hashInput, signature.salt);

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
   * Create a tamper-evident report
   */
  static createTamperEvidentReport(content: string, metadata?: any): { signedContent: string; hashedReport: HashedReport } {
    const hashedReport = this.createHashedReport(content, metadata);
    const signedContent = this.signReport(hashedReport);
    
    // Return both the signed content and the hashed report info
    return { signedContent, hashedReport };
  }

  /**
   * Validate hash algorithm
   */
  static isValidHashAlgorithm(algorithm: string): boolean {
    return algorithm.toLowerCase() === 'hmac-sha256';
  }

  /**
   * Get available hash algorithms
   */
  static getAvailableHashAlgorithms(): string[] {
    return ['hmac-sha256'];
  }
}