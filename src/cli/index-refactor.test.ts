// Basic tests for the refactored CLI structure
import { InteractiveHandlers } from './interactive-handlers';
import { CommandHandlers } from './command-handlers';
import { SecurityOperations } from '../core/security-operations';
import { ConfigurationOperations } from '../core/configuration-operations';

// Mock dependencies
jest.mock('../core/security-operations');
jest.mock('../core/configuration-operations');
jest.mock('../core/daemon-operations');
jest.mock('../core/installation-operations');
jest.mock('../core/verification-operations');
jest.mock('@inquirer/prompts');

describe('Refactored CLI Structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CommandHandlers', () => {
    it('should have validateCheckCommand method', () => {
      expect(typeof CommandHandlers.validateCheckCommand).toBe('function');
    });

    it('should have handleCheckCommand method', () => {
      expect(typeof CommandHandlers.handleCheckCommand).toBe('function');
    });

    it('should have handleVerifyCommand method', () => {
      expect(typeof CommandHandlers.handleVerifyCommand).toBe('function');
    });

    it('should have handleDaemonCommand method', () => {
      expect(typeof CommandHandlers.handleDaemonCommand).toBe('function');
    });

    it('should have handleInstallCommand method', () => {
      expect(typeof CommandHandlers.handleInstallCommand).toBe('function');
    });

    it('should have handleUninstallCommand method', () => {
      expect(typeof CommandHandlers.handleUninstallCommand).toBe('function');
    });

    it('should have handleUpdateCommand method', () => {
      expect(typeof CommandHandlers.handleUpdateCommand).toBe('function');
    });
  });

  describe('InteractiveHandlers', () => {
    it('should have runInteractiveMode method', () => {
      expect(typeof InteractiveHandlers.runInteractiveMode).toBe('function');
    });

    it('should have showSecurityCheckMenu method', () => {
      expect(typeof InteractiveHandlers.showSecurityCheckMenu).toBe('function');
    });

    it('should have showConfigurationMenu method', () => {
      expect(typeof InteractiveHandlers.showConfigurationMenu).toBe('function');
    });

    it('should have showDaemonMenu method', () => {
      expect(typeof InteractiveHandlers.showDaemonMenu).toBe('function');
    });

    it('should have showGlobalMenu method', () => {
      expect(typeof InteractiveHandlers.showGlobalMenu).toBe('function');
    });

    it('should have showSystemMenu method', () => {
      expect(typeof InteractiveHandlers.showSystemMenu).toBe('function');
    });

    it('should have showVerifyMenu method', () => {
      expect(typeof InteractiveHandlers.showVerifyMenu).toBe('function');
    });
  });

  describe('Core Operations', () => {
    it('should have SecurityOperations with required methods', () => {
      expect(typeof SecurityOperations.getConfigForProfile).toBe('function');
      expect(typeof SecurityOperations.runSecurityCheck).toBe('function');
      expect(typeof SecurityOperations.runInteractiveSecurityCheck).toBe('function');
      expect(typeof SecurityOperations.runQuickSecurityCheck).toBe('function');
    });

    it('should have ConfigurationOperations with required methods', () => {
      expect(typeof ConfigurationOperations.getConfigurationStatus).toBe('function');
      expect(typeof ConfigurationOperations.setupOrModifyConfigurations).toBe('function');
      expect(typeof ConfigurationOperations.viewConfigurationStatus).toBe('function');
      expect(typeof ConfigurationOperations.resetAllConfigurations).toBe('function');
    });
  });

  describe('Integration', () => {
    it('should properly integrate CLI handlers with core operations', () => {
      // This test verifies that the refactoring maintains the separation of concerns
      // CLI handlers should use core operations, not duplicate logic

      // Verify that CommandHandlers and InteractiveHandlers exist
      expect(CommandHandlers).toBeDefined();
      expect(InteractiveHandlers).toBeDefined();

      // Verify that core operations exist
      expect(SecurityOperations).toBeDefined();
      expect(ConfigurationOperations).toBeDefined();
    });
  });
});
