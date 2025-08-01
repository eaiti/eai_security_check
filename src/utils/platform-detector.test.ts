import { PlatformDetector, Platform } from './platform-detector';

// Mock os and exec
jest.mock('os');
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

import * as os from 'os';
import { exec, ChildProcess } from 'child_process';

const mockOs = os as jest.Mocked<typeof os>;
const mockExec = exec as jest.MockedFunction<typeof exec>;

// Mock callback type for exec
type MockExecCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void;

describe('PlatformDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPlatform', () => {
    it('should detect macOS platform', async () => {
      mockOs.platform.mockReturnValue('darwin');

      // Mock sw_vers command
      mockExec.mockImplementation((command, callback) => {
        if (command === 'sw_vers -productVersion') {
          (callback as unknown as MockExecCallback)(null, {
            stdout: '15.5',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.MACOS);
      expect(platformInfo.version).toBe('15.5');
      expect(platformInfo.isSupported).toBe(true);
      expect(platformInfo.isApproved).toBe(true);
    });

    it('should detect Linux platform', async () => {
      mockOs.platform.mockReturnValue('linux');

      // Mock /etc/os-release
      mockExec.mockImplementation((command, callback) => {
        if (command === 'cat /etc/os-release') {
          if (callback) {
            (callback as unknown as MockExecCallback)(null, {
              stdout: 'ID=fedora\nVERSION_ID=38',
              stderr: ''
            });
          }
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.LINUX);
      expect(platformInfo.version).toBe('38');
      expect(platformInfo.distribution).toBe('fedora');
      expect(platformInfo.isSupported).toBe(true);
    });

    it('should detect Windows platform', async () => {
      mockOs.platform.mockReturnValue('win32');

      // Mock wmic command
      mockExec.mockImplementation((command, callback) => {
        if (command === 'wmic os get Version /format:list') {
          (callback as unknown as MockExecCallback)(null, {
            stdout: 'Version=10.0.19041\n',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.WINDOWS);
      expect(platformInfo.version).toBe('10.0.19041');
      expect(platformInfo.isSupported).toBe(true);
    });

    it('should detect Windows 11 as approved', async () => {
      mockOs.platform.mockReturnValue('win32');

      mockExec.mockImplementation((command, callback) => {
        if (command === 'wmic os get Version /format:list') {
          (callback as unknown as MockExecCallback)(null, {
            stdout: 'Version=10.0.22000\n',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.WINDOWS);
      expect(platformInfo.version).toBe('10.0.22000');
      expect(platformInfo.isSupported).toBe(true);
      expect(platformInfo.isApproved).toBe(true);
    });

    it('should handle Windows version detection failure', async () => {
      mockOs.platform.mockReturnValue('win32');

      mockExec.mockImplementation((command, callback) => {
        (callback as unknown as MockExecCallback)(new Error('Command failed'));
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.WINDOWS);
      expect(platformInfo.version).toBe('unknown');
      expect(platformInfo.isSupported).toBe(false);
      expect(platformInfo.warningMessage).toContain('Unable to detect Windows version');
    });

    it('should fallback to PowerShell when wmic fails', async () => {
      mockOs.platform.mockReturnValue('win32');

      mockExec.mockImplementation((command, callback) => {
        if (command === 'wmic os get Version /format:list') {
          (callback as unknown as MockExecCallback)(null, {
            stdout: '',
            stderr: ''
          });
        } else if (
          command === 'powershell -Command "[System.Environment]::OSVersion.Version.ToString()"'
        ) {
          (callback as unknown as MockExecCallback)(null, {
            stdout: '10.0.19042.0',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.WINDOWS);
      expect(platformInfo.version).toBe('10.0.19042.0');
      expect(platformInfo.isSupported).toBe(true);
    });

    it('should detect unsupported Windows version', async () => {
      mockOs.platform.mockReturnValue('win32');

      mockExec.mockImplementation((command, callback) => {
        if (command === 'wmic os get Version /format:list') {
          (callback as unknown as MockExecCallback)(null, {
            stdout: 'Version=10.0.17763\n', // Windows 10 1809, below minimum
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.WINDOWS);
      expect(platformInfo.version).toBe('10.0.17763');
      expect(platformInfo.isSupported).toBe(false);
      expect(platformInfo.warningMessage).toContain('may not be fully supported');
    });

    it('should detect unsupported platform', async () => {
      mockOs.platform.mockReturnValue('freebsd');

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.UNSUPPORTED);
      expect(platformInfo.version).toBe('unknown');
      expect(platformInfo.isSupported).toBe(false);
      expect(platformInfo.warningMessage).toContain('freebsd is not supported');
      expect(platformInfo.warningMessage).toContain('macOS, Linux, and Windows only');
    });

    it('should handle macOS version warnings', async () => {
      mockOs.platform.mockReturnValue('darwin');

      // Mock older macOS version
      mockExec.mockImplementation((command, callback) => {
        if (command === 'sw_vers -productVersion') {
          if (callback) {
            (callback as unknown as MockExecCallback)(null, {
              stdout: '14.5',
              stderr: ''
            });
          }
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.MACOS);
      expect(platformInfo.isSupported).toBe(false);
      expect(platformInfo.warningMessage).toContain('below version 15.0');
    });

    it('should handle untested macOS versions', async () => {
      mockOs.platform.mockReturnValue('darwin');

      // Mock newer macOS version
      mockExec.mockImplementation((command, callback) => {
        if (command === 'sw_vers -productVersion') {
          if (callback) {
            (callback as unknown as MockExecCallback)(null, {
              stdout: '16.0',
              stderr: ''
            });
          }
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.MACOS);
      expect(platformInfo.isSupported).toBe(true);
      expect(platformInfo.isApproved).toBe(false);
      expect(platformInfo.warningMessage).toContain('not been fully tested');
    });

    it('should handle Linux distribution warnings', async () => {
      mockOs.platform.mockReturnValue('linux');

      // Mock unsupported distribution
      mockExec.mockImplementation((command, callback) => {
        if (command === 'cat /etc/os-release') {
          if (callback) {
            (callback as unknown as MockExecCallback)(null, {
              stdout: 'ID=arch\nVERSION_ID=rolling',
              stderr: ''
            });
          }
        }
        return {} as unknown as ChildProcess;
      });

      const platformInfo = await PlatformDetector.detectPlatform();

      expect(platformInfo.platform).toBe(Platform.LINUX);
      expect(platformInfo.isSupported).toBe(false);
      expect(platformInfo.warningMessage).toContain('not officially supported');
    });
  });

  describe('utility methods', () => {
    it('should detect macOS correctly', async () => {
      mockOs.platform.mockReturnValue('darwin');
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as unknown as MockExecCallback)(null, {
            stdout: '15.5',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const isMacOS = await PlatformDetector.isMacOS();
      expect(isMacOS).toBe(true);
    });

    it('should detect Linux correctly', async () => {
      mockOs.platform.mockReturnValue('linux');
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as unknown as MockExecCallback)(null, {
            stdout: 'ID=fedora\nVERSION_ID=38',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const isLinux = await PlatformDetector.isLinux();
      expect(isLinux).toBe(true);
    });

    it('should detect supported platform correctly', async () => {
      mockOs.platform.mockReturnValue('darwin');
      mockExec.mockImplementation((command, callback) => {
        if (callback) {
          (callback as unknown as MockExecCallback)(null, {
            stdout: '15.5',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const isSupported = await PlatformDetector.isSupported();
      expect(isSupported).toBe(true);
    });
  });

  describe('isWindows', () => {
    it('should return true for Windows platform', async () => {
      mockOs.platform.mockReturnValue('win32');

      mockExec.mockImplementation((command, callback) => {
        if (command === 'wmic os get Version /format:list') {
          (callback as unknown as MockExecCallback)(null, {
            stdout: 'Version=10.0.19041\n',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const isWindows = await PlatformDetector.isWindows();
      expect(isWindows).toBe(true);
    });

    it('should return false for non-Windows platform', async () => {
      mockOs.platform.mockReturnValue('darwin');

      mockExec.mockImplementation((command, callback) => {
        if (command === 'sw_vers -productVersion') {
          (callback as unknown as MockExecCallback)(null, {
            stdout: '15.5',
            stderr: ''
          });
        }
        return {} as unknown as ChildProcess;
      });

      const isWindows = await PlatformDetector.isWindows();
      expect(isWindows).toBe(false);
    });
  });
});
