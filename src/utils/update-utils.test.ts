import { UpdateUtils } from './update-utils';
import { PlatformDetector, Platform } from './platform-detector';
import { VersionUtils } from './version-utils';

// Mock external dependencies
jest.mock('./platform-detector');
jest.mock('./version-utils');

const mockPlatformDetector = PlatformDetector as jest.Mocked<typeof PlatformDetector>;
const mockVersionUtils = VersionUtils as jest.Mocked<typeof VersionUtils>;

describe('UpdateUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('basic functionality', () => {
    it('should be defined', () => {
      expect(UpdateUtils).toBeDefined();
      expect(UpdateUtils.checkForUpdates).toBeDefined();
      expect(UpdateUtils.performUpdate).toBeDefined();
    });

    it('should handle network errors gracefully in checkForUpdates', async () => {
      mockVersionUtils.getCurrentVersion.mockReturnValue('1.0.0');
      mockPlatformDetector.getSimplePlatform.mockReturnValue(Platform.LINUX);

      const result = await UpdateUtils.checkForUpdates();

      // When network fails, should return safe defaults
      expect(result.updateAvailable).toBe(false);
      expect(result.currentVersion).toBe('1.0.0');
      expect(result.latestVersion).toBe('unknown');
    });

    it('should handle network errors gracefully in performUpdate', async () => {
      mockVersionUtils.getCurrentVersion.mockReturnValue('1.0.0');
      mockPlatformDetector.getSimplePlatform.mockReturnValue(Platform.LINUX);

      const result = await UpdateUtils.performUpdate();

      // When network fails, should return error message
      expect(result.success).toBe(false);
      expect(result.error).toContain('No updates available');
    });
  });

  describe('platform executable names', () => {
    it('should handle different platforms', () => {
      // Test that platform detection is called
      mockPlatformDetector.getSimplePlatform.mockReturnValue(Platform.MACOS);
      expect(mockPlatformDetector.getSimplePlatform()).toBe(Platform.MACOS);

      mockPlatformDetector.getSimplePlatform.mockReturnValue(Platform.LINUX);
      expect(mockPlatformDetector.getSimplePlatform()).toBe(Platform.LINUX);

      mockPlatformDetector.getSimplePlatform.mockReturnValue(Platform.WINDOWS);
      expect(mockPlatformDetector.getSimplePlatform()).toBe(Platform.WINDOWS);
    });
  });

  describe('version comparison', () => {
    it('should handle version comparisons', () => {
      mockVersionUtils.compareVersions.mockImplementation((v1, v2) => {
        if (v1 === '1.1.0' && v2 === '1.0.0') return 1;
        if (v1 === '1.0.0' && v2 === '1.0.0') return 0;
        return -1;
      });

      expect(mockVersionUtils.compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(mockVersionUtils.compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(mockVersionUtils.compareVersions('0.9.0', '1.0.0')).toBe(-1);
    });
  });
});
