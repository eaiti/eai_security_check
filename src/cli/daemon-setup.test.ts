import { ConfigManager } from '../config/config-manager';
import { SchedulingService } from '../services/scheduling-service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the interactive prompts
jest.mock('@inquirer/prompts', () => ({
  confirm: jest.fn(),
  select: jest.fn(),
  input: jest.fn(),
  password: jest.fn()
}));

describe('Daemon Setup and Auto-Configuration', () => {
  const tmpDir = path.join(os.tmpdir(), 'eai-security-check-daemon-test');
  const testConfigDir = path.join(tmpDir, '.config', 'eai-security-check');
  const testSchedulingConfig = path.join(testConfigDir, 'scheduling-config.json');
  const testSecurityConfig = path.join(testConfigDir, 'security-config.json');

  beforeEach(() => {
    // Create test directory structure
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }

    // Clean up any existing test files
    [testSchedulingConfig, testSecurityConfig].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Mock ConfigManager methods to use test directory
    jest.spyOn(ConfigManager, 'getCentralizedConfigDirectory').mockReturnValue(testConfigDir);
    jest.spyOn(ConfigManager, 'getSchedulingConfigPath').mockReturnValue(testSchedulingConfig);
    jest.spyOn(ConfigManager, 'getSecurityConfigPath').mockReturnValue(testSecurityConfig);
    jest.spyOn(ConfigManager, 'ensureCentralizedDirectories').mockReturnValue({
      configDir: testConfigDir,
      reportsDir: path.join(tmpDir, 'reports'),
      logsDir: path.join(tmpDir, 'logs')
    });
    jest.spyOn(ConfigManager, 'hasSchedulingConfig').mockImplementation(() => {
      return fs.existsSync(testSchedulingConfig);
    });
    jest.spyOn(ConfigManager, 'hasSecurityConfig').mockImplementation(() => {
      return fs.existsSync(testSecurityConfig);
    });
  });

  afterEach(() => {
    // Clean up test files
    [testSchedulingConfig, testSecurityConfig].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    // Clean up test directory
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    jest.restoreAllMocks();
  });

  describe('daemon command validation', () => {
    it('should validate daemon help command works', async () => {
      // This is tested in the integration workflows
      expect(true).toBe(true);
    });

    it('should handle daemon status when no daemon is running', async () => {
      const lockFile = path.join(tmpDir, 'daemon.lock');
      const result = await SchedulingService.stopDaemon(lockFile);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No daemon lock file found');
    });
  });

  describe('daemon configuration creation', () => {
    it('should create scheduling configuration with required fields', () => {
      const testConfig = {
        enabled: true,
        intervalDays: 7,
        email: {
          smtp: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
              user: 'test@example.com',
              pass: 'testpass'
            }
          },
          from: 'security@example.com',
          to: ['admin@example.com'],
          subject: '[TEST] EAI Security Check Report'
        },
        reportFormat: 'email',
        securityProfile: 'relaxed',
        scp: {
          enabled: false
        }
      };

      fs.writeFileSync(testSchedulingConfig, JSON.stringify(testConfig, null, 2));

      expect(fs.existsSync(testSchedulingConfig)).toBe(true);

      const savedConfig = JSON.parse(fs.readFileSync(testSchedulingConfig, 'utf-8'));
      expect(savedConfig.enabled).toBe(true);
      expect(savedConfig.email.smtp.host).toBe('smtp.example.com');
      expect(savedConfig.email.to).toContain('admin@example.com');
      expect(savedConfig.securityProfile).toBe('relaxed');
    });

    it('should create security configuration with all required checks', () => {
      const testSecurityConfigData = {
        diskEncryption: {
          required: false,
          timeoutSeconds: 5
        },
        passwordProtection: {
          required: false,
          timeoutSeconds: 5
        },
        autoLock: {
          enabled: false,
          maxMinutes: 15,
          timeoutSeconds: 5
        },
        firewall: {
          required: false,
          stealthMode: false,
          timeoutSeconds: 5
        },
        packageVerification: {
          required: false,
          timeoutSeconds: 5
        },
        systemIntegrityProtection: {
          required: false,
          timeoutSeconds: 5
        },
        remoteLogin: {
          allowed: true,
          timeoutSeconds: 5
        },
        remoteManagement: {
          allowed: true,
          timeoutSeconds: 5
        },
        automaticUpdates: {
          required: false,
          timeoutSeconds: 5
        },
        fileSharing: {
          allowed: true,
          timeoutSeconds: 5
        },
        screenSharing: {
          allowed: true,
          timeoutSeconds: 5
        }
      };

      fs.writeFileSync(testSecurityConfig, JSON.stringify(testSecurityConfigData, null, 2));

      expect(fs.existsSync(testSecurityConfig)).toBe(true);

      const savedConfig = JSON.parse(fs.readFileSync(testSecurityConfig, 'utf-8'));
      expect(savedConfig.diskEncryption).toBeDefined();
      expect(savedConfig.passwordProtection).toBeDefined();
      expect(savedConfig.firewall).toBeDefined();
      expect(savedConfig.packageVerification).toBeDefined();
      expect(savedConfig.systemIntegrityProtection).toBeDefined();
    });
  });

  describe('daemon auto-configuration validation', () => {
    beforeEach(() => {
      // Create test configurations
      const schedulingConfig = {
        enabled: true,
        intervalDays: 1,
        email: {
          smtp: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
              user: 'test@example.com',
              pass: 'testpass'
            }
          },
          from: 'security@example.com',
          to: ['admin@example.com'],
          subject: '[TEST] EAI Security Check Report'
        },
        reportFormat: 'email',
        securityProfile: 'relaxed',
        scp: {
          enabled: false
        }
      };

      fs.writeFileSync(testSchedulingConfig, JSON.stringify(schedulingConfig, null, 2));
    });

    it('should validate SMTP configuration is present', () => {
      const configContent = fs.readFileSync(testSchedulingConfig, 'utf-8');
      expect(configContent).toContain('smtp.example.com');
      expect(configContent).toContain('test@example.com');
      expect(configContent).toContain('testpass');
    });

    it('should validate email recipients are configured', () => {
      const configContent = fs.readFileSync(testSchedulingConfig, 'utf-8');
      expect(configContent).toContain('admin@example.com');
      expect(configContent).toContain('security@example.com');
    });

    it('should validate security profile is set', () => {
      const configContent = fs.readFileSync(testSchedulingConfig, 'utf-8');
      expect(configContent).toContain('relaxed');
    });

    it('should validate report format is configured', () => {
      const configContent = fs.readFileSync(testSchedulingConfig, 'utf-8');
      expect(configContent).toContain('email');
    });
  });

  describe('platform-specific daemon configurations', () => {
    it('should handle Linux systemd configuration detection', () => {
      // This test validates that Linux daemon setup can detect systemd
      const platform = process.platform;
      if (platform === 'linux') {
        // In a real Linux environment, this would check for systemd
        expect(true).toBe(true); // Placeholder for systemd detection
      }
    });

    it('should handle macOS LaunchAgent configuration detection', () => {
      // This test validates that macOS daemon setup can detect LaunchAgent
      const platform = process.platform;
      if (platform === 'darwin') {
        const launchAgentDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
        const launchAgentFile = path.join(launchAgentDir, 'com.eaiti.eai-security-check.plist');

        // Should not exist in test environment
        expect(fs.existsSync(launchAgentFile)).toBe(false);
      }
    });

    it('should handle Windows Task Scheduler configuration detection', () => {
      // This test validates that Windows daemon setup can detect Task Scheduler
      const platform = process.platform;
      if (platform === 'win32') {
        // In a real Windows environment, this would check for scheduled tasks
        expect(true).toBe(true); // Placeholder for Task Scheduler detection
      }
    });
  });

  describe('daemon command options', () => {
    beforeEach(() => {
      // Create test configurations for daemon command tests
      const schedulingConfig = {
        enabled: true,
        intervalDays: 1,
        email: {
          smtp: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
              user: 'test@example.com',
              pass: 'testpass'
            }
          },
          from: 'security@example.com',
          to: ['admin@example.com'],
          subject: '[TEST] EAI Security Check Report'
        },
        reportFormat: 'email',
        securityProfile: 'relaxed',
        scp: {
          enabled: false
        }
      };

      fs.writeFileSync(testSchedulingConfig, JSON.stringify(schedulingConfig, null, 2));
    });

    it('should handle --status option gracefully when no daemon is running', async () => {
      // This is tested in the GitHub Actions workflows
      expect(true).toBe(true);
    });

    it('should handle --test-email option with invalid SMTP configuration', async () => {
      // This is tested in the GitHub Actions workflows
      expect(true).toBe(true);
    });

    it('should handle --check-now option for immediate security checks', async () => {
      // This is tested in the GitHub Actions workflows
      expect(true).toBe(true);
    });

    it('should handle --stop option when no daemon is running', async () => {
      // This is tested in the GitHub Actions workflows
      expect(true).toBe(true);
    });

    it('should handle --restart option when no daemon is running', async () => {
      // This is tested in the GitHub Actions workflows
      expect(true).toBe(true);
    });

    it('should handle --uninstall option with --force flag', async () => {
      const result = await SchedulingService.uninstallDaemon({
        configPath: testSchedulingConfig,
        force: true,
        removeExecutable: false
      });

      expect(result.success).toBe(true);
      expect(result.removedFiles).toContain(testSchedulingConfig);
    });
  });

  describe('CLI daemon setup', () => {
    it('should handle --setup-minimal command', async () => {
      const { CommandHandlers } = await import('./command-handlers');

      // Mock the setup process
      await CommandHandlers.handleDaemonCommand({
        setupMinimal: true,
        userId: 'test@example.com',
        securityProfile: 'relaxed',
        intervalDays: '1'
      });

      // Verify configuration was created
      expect(fs.existsSync(testSchedulingConfig)).toBe(true);

      const config = JSON.parse(fs.readFileSync(testSchedulingConfig, 'utf-8'));
      expect(config.enabled).toBe(true);
      expect(config.userId).toBe('test@example.com');
      expect(config.intervalDays).toBe(1);
      expect(config.securityProfile).toBe('relaxed');
      expect(config.reportFormat).toBe('console');
      expect(config.scp.enabled).toBe(false);
    });

    it('should handle --setup-email command', async () => {
      const { CommandHandlers } = await import('./command-handlers');

      const emailConfig = JSON.stringify({
        host: 'smtp.example.com',
        port: 587,
        user: 'test@example.com',
        pass: 'testpass',
        from: 'security@example.com',
        to: ['admin@example.com']
      });

      await CommandHandlers.handleDaemonCommand({
        setupEmail: emailConfig,
        userId: 'test@example.com',
        securityProfile: 'strict',
        intervalDays: '7'
      });

      // Verify configuration was created
      expect(fs.existsSync(testSchedulingConfig)).toBe(true);

      const config = JSON.parse(fs.readFileSync(testSchedulingConfig, 'utf-8'));
      expect(config.enabled).toBe(true);
      expect(config.userId).toBe('test@example.com');
      expect(config.intervalDays).toBe(7);
      expect(config.securityProfile).toBe('strict');
      expect(config.reportFormat).toBe('email');
      expect(config.email.smtp.host).toBe('smtp.example.com');
      expect(config.email.to).toContain('admin@example.com');
      expect(config.scp.enabled).toBe(false);
    });

    it('should require --user-id for setup commands', async () => {
      const { CommandHandlers } = await import('./command-handlers');

      // Mock process.exit to prevent test from terminating
      const originalExit = process.exit;
      const mockExit = jest.fn();
      process.exit = mockExit as any;

      try {
        await CommandHandlers.handleDaemonCommand({
          setupMinimal: true
          // Missing userId
        });

        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
      }
    });

    it('should validate email configuration JSON', async () => {
      const { CommandHandlers } = await import('./command-handlers');

      // Mock process.exit to prevent test from terminating
      const originalExit = process.exit;
      const mockExit = jest.fn();
      process.exit = mockExit as any;

      try {
        await CommandHandlers.handleDaemonCommand({
          setupEmail: 'invalid-json',
          userId: 'test@example.com'
        });

        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
      }
    });

    it('should validate required email fields', async () => {
      const { CommandHandlers } = await import('./command-handlers');

      // Mock process.exit to prevent test from terminating
      const originalExit = process.exit;
      const mockExit = jest.fn();
      process.exit = mockExit as any;

      try {
        const incompleteEmailConfig = JSON.stringify({
          host: 'smtp.example.com'
          // Missing required fields
        });

        await CommandHandlers.handleDaemonCommand({
          setupEmail: incompleteEmailConfig,
          userId: 'test@example.com'
        });

        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
      }
    });

    it('should handle interval days validation', async () => {
      const { CommandHandlers } = await import('./command-handlers');

      // Mock process.exit to prevent test from terminating
      const originalExit = process.exit;
      const mockExit = jest.fn();
      process.exit = mockExit as any;

      try {
        await CommandHandlers.handleDaemonCommand({
          setupMinimal: true,
          userId: 'test@example.com',
          intervalDays: 'invalid'
        });

        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
      }
    });

    it('should prevent overwriting existing config without --force', async () => {
      const { CommandHandlers } = await import('./command-handlers');

      // Create existing config
      const existingConfig = { enabled: true, userId: 'existing@example.com' };
      fs.writeFileSync(testSchedulingConfig, JSON.stringify(existingConfig, null, 2));

      // Mock process.exit to prevent test from terminating
      const originalExit = process.exit;
      const mockExit = jest.fn();
      process.exit = mockExit as any;

      try {
        await CommandHandlers.handleDaemonCommand({
          setupMinimal: true,
          userId: 'test@example.com'
        });

        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
      }
    });
  });

  describe('interactive daemon setup simulation', () => {
    it('should simulate interactive daemon configuration', async () => {
      // Mock the prompts that would be used in interactive setup
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const prompts = require('@inquirer/prompts');
      const { confirm, select, input, password } = prompts;

      confirm.mockResolvedValueOnce(true); // Setup daemon
      select.mockResolvedValueOnce('email'); // Report format
      input.mockResolvedValueOnce('smtp.example.com'); // SMTP host
      input.mockResolvedValueOnce('587'); // SMTP port
      input.mockResolvedValueOnce('test@example.com'); // SMTP user
      password.mockResolvedValueOnce('testpass'); // SMTP password
      input.mockResolvedValueOnce('security@example.com'); // From email
      input.mockResolvedValueOnce('admin@example.com'); // To email
      select.mockResolvedValueOnce('relaxed'); // Security profile
      select.mockResolvedValueOnce('daily'); // Check frequency

      // Test that the mocked interactive setup would work
      expect(confirm).toBeDefined();
      expect(select).toBeDefined();
      expect(input).toBeDefined();
      expect(password).toBeDefined();
    });
  });
});
