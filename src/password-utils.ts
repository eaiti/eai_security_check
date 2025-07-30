import * as readline from 'readline';

export interface PasswordValidationResult {
  isValid: boolean;
  message: string;
}

/**
 * Validates password strength according to security requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long'
    };
  }

  // Check for required character types
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const missingRequirements = [];
  if (!hasUppercase) missingRequirements.push('uppercase letter');
  if (!hasLowercase) missingRequirements.push('lowercase letter'); 
  if (!hasNumber) missingRequirements.push('number');
  if (!hasSpecialChar) missingRequirements.push('special character');

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
 * Prompts user for password with hidden input
 */
export function promptForPassword(prompt: string = 'Enter password: '): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
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
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(prompt + '*'.repeat(password.length));
          }
          break;
        }
        default: {
          // Regular character
          if (char.charCodeAt(0) >= 32) { // Printable characters only
            password += char;
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
export async function promptForValidPassword(maxRetries: number = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const password = await promptForPassword(
        attempt === 1 
          ? '🔐 Enter your macOS password (required for some security checks): '
          : `🔐 Enter your macOS password (attempt ${attempt}/${maxRetries}): `
      );

      const validation = validatePassword(password);
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