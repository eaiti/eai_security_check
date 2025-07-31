import { ConfigManager } from '../config-manager';
import * as fs from 'fs';
import * as os from 'os';

// Mock fs module
jest.mock('fs');
const mockedFs = jest.mocked(fs);

// Mock os module
jest.mock('os');
const mockedOs = jest.mocked(os);

// Mock readline for interactive input
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn(),
    close: jest.fn()
  }))
}));

describe('ConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedOs.homedir.mockReturnValue('/home/testuser');
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.APPDATA;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfigDirectory', () => {
    it('should return macOS config directory', () => {
      mockedOs.platform.mockReturnValue('darwin');
      const result = ConfigManager.getConfigDirectory();
      expect(result).toBe('/home/testuser/Library/Application Support/eai-security-check');
    });

    it('should return Linux config directory', () => {
      mockedOs.platform.mockReturnValue('linux');
      delete process.env.XDG_CONFIG_HOME;
      const result = ConfigManager.getConfigDirectory();
      expect(result).toBe('/home/testuser/.config/eai-security-check');
    });

    it('should return Linux config directory with XDG_CONFIG_HOME', () => {
      mockedOs.platform.mockReturnValue('linux');
      process.env.XDG_CONFIG_HOME = '/custom/config';
      const result = ConfigManager.getConfigDirectory();
      expect(result).toBe('/custom/config/eai-security-check');
    });

    it('should return Windows config directory', () => {
      mockedOs.platform.mockReturnValue('win32');
      process.env.APPDATA = '/Users/testuser/AppData/Roaming';
      const result = ConfigManager.getConfigDirectory();
      expect(result).toBe('/Users/testuser/AppData/Roaming/eai-security-check');
    });

    it('should return fallback directory for unsupported platforms', () => {
      mockedOs.platform.mockReturnValue('freebsd');
      const result = ConfigManager.getConfigDirectory();
      expect(result).toBe('/home/testuser/.eai-security-check');
    });
  });

  describe('ensureConfigDirectory', () => {
    it('should create directory if it does not exist', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);

      const result = ConfigManager.ensureConfigDirectory();

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/home/testuser/.config/eai-security-check', {
        recursive: true
      });
      expect(result).toBe('/home/testuser/.config/eai-security-check');
    });

    it('should not create directory if it already exists', () => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockReturnValue(true);

      const result = ConfigManager.ensureConfigDirectory();

      expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
      expect(result).toBe('/home/testuser/.config/eai-security-check');
    });
  });

  describe('configuration file paths', () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue('linux');
    });

    it('should return correct security config path', () => {
      const result = ConfigManager.getSecurityConfigPath();
      expect(result).toBe('/home/testuser/.config/eai-security-check/security-config.json');
    });

    it('should return correct scheduling config path', () => {
      const result = ConfigManager.getSchedulingConfigPath();
      expect(result).toBe('/home/testuser/.config/eai-security-check/scheduling-config.json');
    });

    it('should return correct daemon state path', () => {
      const result = ConfigManager.getDaemonStatePath();
      expect(result).toBe('/home/testuser/.config/eai-security-check/daemon-state.json');
    });
  });

  describe('createSecurityConfig', () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockImplementation(path => {
        // Config directory exists, config file doesn't
        if (path === '/home/testuser/.config/eai-security-check') return true;
        if (path === '/home/testuser/.config/eai-security-check/security-config.json') return false;
        return false;
      });
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => {});
    });

    it('should create security config with default profile', () => {
      ConfigManager.createSecurityConfig();

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/security-config.json',
        expect.stringContaining('"diskEncryption"')
      );
    });

    it('should create security config with specified profile', () => {
      ConfigManager.createSecurityConfig('strict');

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/security-config.json',
        expect.stringContaining('"diskEncryption"')
      );
    });

    it('should throw error if config already exists', () => {
      mockedFs.existsSync.mockImplementation(path => {
        if (path === '/home/testuser/.config/eai-security-check') return true;
        if (path === '/home/testuser/.config/eai-security-check/security-config.json') return true;
        return false;
      });

      expect(() => ConfigManager.createSecurityConfig()).toThrow(
        'Security configuration already exists'
      );
    });
  });

  describe('createAllSecurityConfigs', () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue('linux');
      mockedFs.existsSync.mockImplementation(path => {
        // Config directory exists, config files don't
        if (path === '/home/testuser/.config/eai-security-check') return true;
        return false;
      });
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Mock console.log to avoid test output
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create all security profile configs', () => {
      ConfigManager.createAllSecurityConfigs();

      // Should create main config file (default profile)
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/security-config.json',
        expect.stringContaining('"diskEncryption"')
      );

      // Should create profile-specific config files
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/strict-config.json',
        expect.stringContaining('"diskEncryption"')
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/relaxed-config.json',
        expect.stringContaining('"diskEncryption"')
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/developer-config.json',
        expect.stringContaining('"diskEncryption"')
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/eai-config.json',
        expect.stringContaining('"diskEncryption"')
      );

      // Should create 5 files total (main + 4 profiles)
      expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(5);
    });

    it('should skip existing configs when force is false', () => {
      mockedFs.existsSync.mockImplementation(path => {
        if (path === '/home/testuser/.config/eai-security-check') return true;
        if (path === '/home/testuser/.config/eai-security-check/security-config.json') return true;
        if (path === '/home/testuser/.config/eai-security-check/strict-config.json') return true;
        return false;
      });

      ConfigManager.createAllSecurityConfigs(false);

      // Should skip existing files
      expect(mockedFs.writeFileSync).not.toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/security-config.json',
        expect.anything()
      );
      expect(mockedFs.writeFileSync).not.toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/strict-config.json',
        expect.anything()
      );

      // Should still create non-existing files
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/relaxed-config.json',
        expect.stringContaining('"diskEncryption"')
      );
    });

    it('should overwrite existing configs when force is true', () => {
      mockedFs.existsSync.mockImplementation(path => {
        if (path === '/home/testuser/.config/eai-security-check') return true;
        if (path === '/home/testuser/.config/eai-security-check/security-config.json') return true;
        return false;
      });

      ConfigManager.createAllSecurityConfigs(true);

      // Should overwrite existing file
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/security-config.json',
        expect.stringContaining('"diskEncryption"')
      );

      // Should create all files
      expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(5);
    });
  });

  describe('hasSecurityConfig', () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue('linux');
      delete process.env.XDG_CONFIG_HOME;
    });

    it('should return true if security config exists', () => {
      mockedFs.existsSync.mockReturnValue(true);

      const result = ConfigManager.hasSecurityConfig();

      expect(result).toBe(true);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/security-config.json'
      );
    });

    it('should return false if security config does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = ConfigManager.hasSecurityConfig();

      expect(result).toBe(false);
    });
  });

  describe('loadSecurityConfig', () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue('linux');
      delete process.env.XDG_CONFIG_HOME;
    });

    it('should load security config if it exists', () => {
      const mockConfig = { diskEncryption: { enabled: true } };
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = ConfigManager.loadSecurityConfig();

      expect(result).toEqual(mockConfig);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        '/home/testuser/.config/eai-security-check/security-config.json',
        'utf-8'
      );
    });

    it('should return null if config does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = ConfigManager.loadSecurityConfig();

      expect(result).toBeNull();
    });

    it('should throw error if config is invalid JSON', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('invalid json');

      expect(() => ConfigManager.loadSecurityConfig()).toThrow(
        'Failed to load security configuration'
      );
    });
  });

  describe('getConfigStatus', () => {
    beforeEach(() => {
      mockedOs.platform.mockReturnValue('linux');
      delete process.env.XDG_CONFIG_HOME;
    });

    it('should return complete config status', () => {
      mockedFs.existsSync.mockImplementation(path => {
        if (path === '/home/testuser/.config/eai-security-check/security-config.json') return true;
        if (path === '/home/testuser/.config/eai-security-check/scheduling-config.json')
          return false;
        return false;
      });

      const result = ConfigManager.getConfigStatus();

      expect(result).toEqual({
        configDirectory: '/home/testuser/.config/eai-security-check',
        securityConfigExists: true,
        schedulingConfigExists: false,
        securityConfigPath: '/home/testuser/.config/eai-security-check/security-config.json',
        schedulingConfigPath: '/home/testuser/.config/eai-security-check/scheduling-config.json'
      });
    });
  });
});
