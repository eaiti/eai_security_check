import { ConfigManager } from './config-manager';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockedFs = jest.mocked(fs);

// Mock os module
jest.mock('os');
const mockedOs = jest.mocked(os);

// Mock path module to use POSIX paths when platform is mocked as linux
jest.mock('path');
const mockedPath = jest.mocked(path);

// Mock readline for interactive input
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn(),
    close: jest.fn()
  }))
}));

describe('ConfigManager', () => {
  const originalEnv = process.env;
  const originalExecPath = process.execPath;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.execPath to use a test executable path
    Object.defineProperty(process, 'execPath', {
      value: '/test/app/eai-security-check',
      writable: true
    });

    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.APPDATA;

    // Setup path mocking to use POSIX paths when platform is linux
    mockedPath.join.mockImplementation((...segments: string[]) => {
      return segments.join('/');
    });
    mockedPath.dirname.mockImplementation((filePath: string) => {
      const parts = filePath.split('/');
      parts.pop();
      return parts.join('/') || '/';
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'execPath', {
      value: originalExecPath,
      writable: true
    });
  });

  describe('configuration file paths', () => {
    it('should return correct security config path', () => {
      const result = ConfigManager.getSecurityConfigPath();
      expect(result).toBe('/test/app/config/security-config.json');
    });

    it('should return correct scheduling config path', () => {
      const result = ConfigManager.getSchedulingConfigPath();
      expect(result).toBe('/test/app/config/scheduling-config.json');
    });

    it('should return correct daemon state path', () => {
      const result = ConfigManager.getDaemonStatePath();
      expect(result).toBe('/test/app/config/daemon-state.json');
    });
  });

  describe('createSecurityConfig', () => {
    beforeEach(() => {
      mockedFs.existsSync.mockImplementation(path => {
        // Config directory exists, config file doesn't
        if (path === '/test/app/config') return true;
        if (path === '/test/app/config/security-config.json') return false;
        return false;
      });
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => {});
    });

    it('should create security config with default profile', () => {
      ConfigManager.createSecurityConfig();

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/test/app/config/security-config.json',
        expect.stringContaining('"diskEncryption"')
      );
    });

    it('should create security config with specified profile', () => {
      ConfigManager.createSecurityConfig('strict');

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/test/app/config/security-config.json',
        expect.stringContaining('"diskEncryption"')
      );
    });

    it('should throw error if config already exists', () => {
      mockedFs.existsSync.mockImplementation(path => {
        if (path === '/test/app/config') return true;
        if (path === '/test/app/config/security-config.json') return true;
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
        if (path === '/test/app/config') return true;
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
        '/test/app/config/security-config.json',
        expect.stringContaining('"diskEncryption"')
      );

      // Should create profile-specific config files
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/test/app/config/strict-config.json',
        expect.stringContaining('"diskEncryption"')
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/test/app/config/relaxed-config.json',
        expect.stringContaining('"diskEncryption"')
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/test/app/config/developer-config.json',
        expect.stringContaining('"diskEncryption"')
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/test/app/config/eai-config.json',
        expect.stringContaining('"diskEncryption"')
      );

      // Should create 5 files total (main + 4 profiles)
      expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(5);
    });

    it('should skip existing configs when force is false', () => {
      mockedFs.existsSync.mockImplementation(path => {
        if (path === '/test/app/config') return true;
        if (path === '/test/app/config/security-config.json') return true;
        if (path === '/test/app/config/strict-config.json') return true;
        return false;
      });

      ConfigManager.createAllSecurityConfigs(false);

      // Should skip existing files
      expect(mockedFs.writeFileSync).not.toHaveBeenCalledWith(
        '/test/app/config/security-config.json',
        expect.anything()
      );
      expect(mockedFs.writeFileSync).not.toHaveBeenCalledWith(
        '/test/app/config/strict-config.json',
        expect.anything()
      );

      // Should still create non-existing files
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/test/app/config/relaxed-config.json',
        expect.stringContaining('"diskEncryption"')
      );
    });

    it('should overwrite existing configs when force is true', () => {
      mockedFs.existsSync.mockImplementation(path => {
        if (path === '/test/app/config') return true;
        if (path === '/test/app/config/security-config.json') return true;
        return false;
      });

      ConfigManager.createAllSecurityConfigs(true);

      // Should overwrite existing file
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        '/test/app/config/security-config.json',
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
      expect(mockedFs.existsSync).toHaveBeenCalledWith('/test/app/config/security-config.json');
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
        '/test/app/config/security-config.json',
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
        if (path === '/test/app/config/security-config.json') return true;
        if (path === '/test/app/config/scheduling-config.json') return false;
        return false;
      });

      const result = ConfigManager.getConfigStatus();

      expect(result).toEqual({
        configDirectory: '/test/app/config',
        reportsDirectory: '/test/app/reports',
        securityConfigExists: true,
        schedulingConfigExists: false,
        securityConfigPath: '/test/app/config/security-config.json',
        schedulingConfigPath: '/test/app/config/scheduling-config.json'
      });
    });
  });
});
