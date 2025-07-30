import { validatePassword, PasswordValidationResult } from '../password-utils';

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should pass with valid password containing all required characters', () => {
      const result: PasswordValidationResult = validatePassword('MyP@ssw0rd123');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });

    it('should fail with password shorter than 8 characters', () => {
      const result: PasswordValidationResult = validatePassword('Test123');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must be at least 8 characters long');
    });

    it('should fail with empty password', () => {
      const result: PasswordValidationResult = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must be at least 8 characters long');
    });

    it('should fail with password missing uppercase letter', () => {
      const result: PasswordValidationResult = validatePassword('myp@ssw0rd');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: uppercase letter');
    });

    it('should fail with password missing lowercase letter', () => {
      const result: PasswordValidationResult = validatePassword('MYP@SSW0RD');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: lowercase letter');
    });

    it('should fail with password missing number', () => {
      const result: PasswordValidationResult = validatePassword('MyP@ssword');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: number');
    });

    it('should fail with password missing special character', () => {
      const result: PasswordValidationResult = validatePassword('MyPassword123');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: special character');
    });

    it('should fail with password missing multiple requirements', () => {
      const result: PasswordValidationResult = validatePassword('password');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Password must contain at least one: uppercase letter, number, special character');
    });

    it('should pass with different special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '-', '=', '[', ']', '{', '}', ';', "'", ':', '"', '\\', '|', ',', '.', '<', '>', '/', '?'];
      
      specialChars.forEach(char => {
        const password = `MyPassword123${char}`;
        const result: PasswordValidationResult = validatePassword(password);
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle exactly 8 characters with all requirements', () => {
      const result: PasswordValidationResult = validatePassword('MyP@ss1d');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });

    it('should handle long passwords with all requirements', () => {
      const longPassword = 'MyVeryLongP@ssw0rdWith123Numbers!@#$%^&*()';
      const result: PasswordValidationResult = validatePassword(longPassword);
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password meets security requirements');
    });
  });
});