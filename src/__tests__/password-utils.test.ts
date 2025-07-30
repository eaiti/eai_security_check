import { validatePassword, PasswordValidationResult, getPasswordRequirements } from '../password-utils';

describe('Password Validation', () => {
  describe('getPasswordRequirements', () => {
    it('should return EAI requirements for EAI profile', () => {
      const requirements = getPasswordRequirements('eai');
      expect(requirements.minLength).toBe(10);
      expect(requirements.requireUppercase).toBe(false);
      expect(requirements.requireLowercase).toBe(false);
      expect(requirements.requireNumber).toBe(false);
      expect(requirements.requireSpecialChar).toBe(false);
      expect(requirements.maxAgeDays).toBe(180);
    });

    it('should return default requirements for other profiles', () => {
      const requirements = getPasswordRequirements('default');
      expect(requirements.minLength).toBe(8);
      expect(requirements.requireUppercase).toBe(true);
      expect(requirements.requireLowercase).toBe(true);
      expect(requirements.requireNumber).toBe(true);
      expect(requirements.requireSpecialChar).toBe(true);
      expect(requirements.maxAgeDays).toBe(180);
    });
  });

  describe('validatePassword with default profile', () => {
    it('should pass with valid password containing all required characters', () => {
      const result: PasswordValidationResult = validatePassword('MyP@ssw0rd123', 'default');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });

    it('should fail with password shorter than 8 characters', () => {
      const result: PasswordValidationResult = validatePassword('Test123', 'default');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must be at least 8 characters long');
    });

    it('should fail with empty password', () => {
      const result: PasswordValidationResult = validatePassword('', 'default');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must be at least 8 characters long');
    });

    it('should fail with password missing uppercase letter', () => {
      const result: PasswordValidationResult = validatePassword('myp@ssw0rd', 'default');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: uppercase letter');
    });

    it('should fail with password missing lowercase letter', () => {
      const result: PasswordValidationResult = validatePassword('MYP@SSW0RD', 'default');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: lowercase letter');
    });

    it('should fail with password missing number', () => {
      const result: PasswordValidationResult = validatePassword('MyP@ssword', 'default');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: number');
    });

    it('should fail with password missing special character', () => {
      const result: PasswordValidationResult = validatePassword('MyPassword123', 'default');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: special character');
    });

    it('should fail with password missing multiple requirements', () => {
      const result: PasswordValidationResult = validatePassword('password', 'default');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: uppercase letter, number, special character');
    });

    it('should pass with different special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '-', '=', '[', ']', '{', '}', ';', "'", ':', '"', '\\', '|', ',', '.', '<', '>', '/', '?'];
      
      specialChars.forEach(char => {
        const password = `MyPassword123${char}`;
        const result: PasswordValidationResult = validatePassword(password, 'default');
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle exactly 8 characters with all requirements', () => {
      const result: PasswordValidationResult = validatePassword('MyP@ss1d', 'default');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });

    it('should handle long passwords with all requirements', () => {
      const longPassword = 'MyVeryLongP@ssw0rdWith123Numbers!@#$%^&*()';
      const result: PasswordValidationResult = validatePassword(longPassword, 'default');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });
  });

  describe('validatePassword with EAI profile', () => {
    it('should pass with 10+ character password for EAI profile', () => {
      const result: PasswordValidationResult = validatePassword('simplepassword', 'eai');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });

    it('should pass with exactly 10 characters for EAI profile', () => {
      const result: PasswordValidationResult = validatePassword('1234567890', 'eai');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });

    it('should fail with less than 10 characters for EAI profile', () => {
      const result: PasswordValidationResult = validatePassword('short', 'eai');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must be at least 10 characters long');
    });

    it('should pass with only lowercase letters for EAI profile', () => {
      const result: PasswordValidationResult = validatePassword('alllowercase', 'eai');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });

    it('should pass with only numbers for EAI profile', () => {
      const result: PasswordValidationResult = validatePassword('1234567890', 'eai');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });

    it('should pass with mixed simple characters for EAI profile', () => {
      const result: PasswordValidationResult = validatePassword('password123', 'eai');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });
  });

  // Note: Password expiration tests are not included here as they require
  // system-level access and would fail in the CI environment.
  // The checkPasswordExpiration function includes proper error handling
  // and will gracefully handle cases where system commands are not available.
});