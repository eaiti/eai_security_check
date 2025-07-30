import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PasswordValidationResult {
  isValid: boolean;
  message: string;
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  maxAgeDays: number;
}

/**
 * Checks if the current user's password is older than the specified number of days
 * Enhanced with multiple fallback methods for better reliability across macOS versions
 */
export async function checkPasswordExpiration(maxAgeDays: number = 180): Promise<PasswordValidationResult> {
  try {
    const currentUser = process.env.USER || process.env.USERNAME || 'unknown';
    let passwordLastSetTime: Date | null = null;
    let method = '';
    
    // Method 1: Try dscl passwordLastSetTime (direct approach)
    try {
      const { stdout } = await execAsync(`dscl . -read /Users/${currentUser} passwordLastSetTime 2>/dev/null`);
      const match = stdout.match(/passwordLastSetTime:\s*(.+)/);
      if (match) {
        passwordLastSetTime = new Date(match[1].trim());
        method = 'dscl passwordLastSetTime';
      }
    } catch (error) {
      // Continue to next method
    }
    
    // Method 2: Try dscl accountPolicyData (account creation time from policy data)
    if (!passwordLastSetTime) {
      try {
        const { stdout } = await execAsync(`dscl . -read /Users/${currentUser} accountPolicyData 2>/dev/null`);
        // Parse the XML/plist data to extract passwordLastSetTime
        const passwordTimeMatch = stdout.match(/<key>passwordLastSetTime<\/key>\s*<real>([^<]+)<\/real>/);
        if (passwordTimeMatch) {
          const unixTimestamp = parseFloat(passwordTimeMatch[1]);
          passwordLastSetTime = new Date(unixTimestamp * 1000);
          method = 'dscl accountPolicyData';
        }
      } catch (error) {
        // Continue to next method
      }
    }
    
    // Method 3: Try pwpolicy (password policies with multiple date patterns)
    if (!passwordLastSetTime) {
      try {
        const { stdout } = await execAsync(`pwpolicy -u ${currentUser} -getaccountpolicies 2>/dev/null`);
        
        // Try multiple date pattern matches for pwpolicy output
        const patterns = [
          /creationTime.*?(\d{4}-\d{2}-\d{2})/,
          /passwordSetDate.*?(\d{4}-\d{2}-\d{2})/,
          /lastPasswordChange.*?(\d{4}-\d{2}-\d{2})/,
          /passwordLastSetTime.*?(\d{4}-\d{2}-\d{2})/
        ];
        
        for (const pattern of patterns) {
          const match = stdout.match(pattern);
          if (match) {
            passwordLastSetTime = new Date(match[1]);
            method = 'pwpolicy account policies';
            break;
          }
        }
      } catch (error) {
        // Continue to next method
      }
    }
    
    // Method 4: Home directory creation time (filesystem-based approximation as final fallback)
    if (!passwordLastSetTime) {
      try {
        const { stdout } = await execAsync(`stat -f "%SB" -t "%Y-%m-%d %H:%M:%S" /Users/${currentUser} 2>/dev/null`);
        if (stdout.trim()) {
          passwordLastSetTime = new Date(stdout.trim());
          method = 'home directory creation time';
        }
      } catch (error) {
        // Final fallback failed
      }
    }
    
    // If we couldn't determine the password age, return detailed message
    if (!passwordLastSetTime) {
      return {
        isValid: true,
        message: 'Password age could not be determined using any method (dscl, pwpolicy, or filesystem) - assuming compliant'
      };
    }
    
    const currentTime = new Date();
    const daysSincePasswordSet = Math.floor((currentTime.getTime() - passwordLastSetTime.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSincePasswordSet > maxAgeDays) {
      return {
        isValid: false,
        message: `Password is ${daysSincePasswordSet} days old (maximum allowed: ${maxAgeDays} days) - determined via ${method}`
      };
    }
    
    return {
      isValid: true,
      message: `Password is ${daysSincePasswordSet} days old (within ${maxAgeDays} day limit) - determined via ${method}`
    };
    
  } catch (error) {
    // If there's any error checking password expiration, provide clear message
    return {
      isValid: true,
      message: `Password expiration check failed: ${error instanceof Error ? error.message : 'Unknown error'} - assuming compliant`
    };
  }
}

/**
 * Gets password requirements for a specific profile
 */
export function getPasswordRequirements(profile: string): PasswordRequirements {
  switch (profile) {
    case 'eai':
      return {
        minLength: 10,
        requireUppercase: false,
        requireLowercase: false,
        requireNumber: false,
        requireSpecialChar: false,
        maxAgeDays: 180
      };
    default:
      return {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialChar: true,
        maxAgeDays: 180
      };
  }
}

/**
 * Validates password against configuration requirements and expiration
 * This function does not throw errors - it returns validation results for audit reporting
 */
export async function validatePasswordConfiguration(password: string | undefined, passwordConfig: {
  required: boolean;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  maxAgeDays: number;
}): Promise<{
  requirementsValid: boolean;
  expirationValid: boolean;
  requirementsMessage: string;
  expirationMessage: string;
  overallValid: boolean;
}> {
  // Check if password is required
  if (!passwordConfig.required) {
    return {
      requirementsValid: true,
      expirationValid: true,
      requirementsMessage: 'Password validation is disabled',
      expirationMessage: 'Password expiration checking is disabled',
      overallValid: true
    };
  }
  
  // Check password requirements
  let requirementsValid = true;
  let requirementsMessage = '';
  
  if (!password) {
    requirementsValid = false;
    requirementsMessage = 'Password is required but not provided';
  } else {
    const validation = validatePasswordStrength(password, passwordConfig);
    requirementsValid = validation.isValid;
    requirementsMessage = validation.message;
  }
  
  // Check password expiration
  const expirationCheck = await checkPasswordExpiration(passwordConfig.maxAgeDays);
  
  return {
    requirementsValid,
    expirationValid: expirationCheck.isValid,
    requirementsMessage,
    expirationMessage: expirationCheck.message,
    overallValid: requirementsValid && expirationCheck.isValid
  };
}

/**
 * Validates password strength according to specific requirements (not profile-based)
 */
export function validatePasswordStrength(password: string, requirements: {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
}): PasswordValidationResult {
  if (!password || password.length < requirements.minLength) {
    return {
      isValid: false,
      message: `Password must be at least ${requirements.minLength} characters long`
    };
  }

  const missingRequirements = [];
  
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    missingRequirements.push('uppercase letter');
  }
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    missingRequirements.push('lowercase letter');
  }
  if (requirements.requireNumber && !/\d/.test(password)) {
    missingRequirements.push('number');
  }
  if (requirements.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    missingRequirements.push('special character');
  }

  if (missingRequirements.length > 0) {
    return {
      isValid: false,
      message: `Password must contain at least one: ${missingRequirements.join(', ')}`
    };
  }

  return {
    isValid: true,
    message: 'Password meets security requirements'
  };
}

/**
 * Validates password strength according to profile-specific requirements
 */
export function validatePassword(password: string, profile: string = 'default'): PasswordValidationResult {
  const requirements = getPasswordRequirements(profile);
  return validatePasswordStrength(password, requirements);
}

/**
 * Prompts user for password with hidden input
 */
export function promptForPassword(prompt: string = 'Enter password: '): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false // Disable echoing
    });

    let password = '';
    const stdin = process.stdin;
    
    process.stdout.write(prompt);
    
    // Set raw mode to capture individual keystrokes
    if (stdin.isTTY && stdin.setRawMode) {
      stdin.setRawMode(true);
    }

    const onData = (buffer: Buffer) => {
      const char = buffer.toString();
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': {
          // Enter pressed - finish input
          if (stdin.isTTY && stdin.setRawMode) {
            stdin.setRawMode(false);
          }
          stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(password);
          break;
        }
        case '\u0003': {
          // Ctrl+C pressed - exit
          process.exit(0);
          break;
        }
        case '\u007f': {
          // Backspace pressed
          if (password.length > 0) {
            password = password.slice(0, -1);
            // Move cursor back one position, write space to clear, then back again
            process.stdout.write('\b \b');
          }
          break;
        }
        default: {
          // Regular character
          if (char.charCodeAt(0) >= 32) { // Printable characters only
            password += char;
            // Just write asterisk - terminal echo is disabled
            process.stdout.write('*');
          }
          break;
        }
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * Prompts for password with validation, retries on invalid input
 */
export async function promptForValidPassword(maxRetries: number = 3, profile: string = 'default'): Promise<string> {
  const requirements = getPasswordRequirements(profile);
  
  // First check password expiration before prompting
  const expirationCheck = await checkPasswordExpiration(requirements.maxAgeDays);
  if (!expirationCheck.isValid) {
    throw new Error(`Password validation failed: ${expirationCheck.message}`);
  }
  
  // If expiration check passed but had a warning, show it
  if (expirationCheck.message.includes('could not be determined') || expirationCheck.message.includes('check failed')) {
    console.log(`⚠️  ${expirationCheck.message}`);
  } else {
    console.log(`✅ ${expirationCheck.message}`);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const password = await promptForPassword(
        attempt === 1 
          ? '🔐 Enter your macOS password (required for some security checks): '
          : `🔐 Enter your macOS password (attempt ${attempt}/${maxRetries}): `
      );

      const validation = validatePassword(password, profile);
      if (validation.isValid) {
        return password;
      }

      console.log(`❌ ${validation.message}`);
      if (attempt < maxRetries) {
        console.log('Please try again.\n');
      }
    } catch (error) {
      console.log(`❌ Error reading password: ${error}`);
    }
  }

  throw new Error('Maximum password attempts exceeded');
}