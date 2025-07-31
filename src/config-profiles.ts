/**
 * Predefined security configuration profiles
 */

import { SecurityConfig } from './types';

export const VALID_PROFILES = ['default', 'strict', 'relaxed', 'developer', 'eai'] as const;
export type SecurityProfile = typeof VALID_PROFILES[number];

/**
 * Base configuration shared across all profiles
 */
const baseConfig = {
  diskEncryption: { enabled: true },
  packageVerification: { enabled: true },
  systemIntegrityProtection: { enabled: true }
};

/**
 * Get configuration by profile name
 */
export function getConfigByProfile(profile: string): SecurityConfig {
  switch (profile) {
    case 'strict':
      return {
        ...baseConfig,
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        password: {
          required: false,
          minLength: 8,
          requireUppercase: false,
          requireLowercase: false,
          requireNumber: false,
          requireSpecialChar: false,
          maxAgeDays: 180
        },
        autoLock: { maxTimeoutMinutes: 3 },
        firewall: { enabled: true, stealthMode: true },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: {
          enabled: true,
          automaticInstall: true,
          automaticSecurityInstall: true
        },
        sharingServices: {
          fileSharing: false,
          screenSharing: false,
          remoteLogin: false
        },
        osVersion: { targetVersion: 'latest' },
        wifiSecurity: {
          bannedNetworks: ['EAIguest', 'xfinitywifi', 'Guest', 'Public WiFi', 'Free WiFi']
        },
        installedApps: {
          bannedApplications: ['BitTorrent', 'uTorrent', 'Limewire', 'TeamViewer', 'AnyDesk', 'Skype']
        }
      };

    case 'relaxed':
      return {
        ...baseConfig,
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: false
        },
        password: {
          required: false,
          minLength: 8,
          requireUppercase: false,
          requireLowercase: false,
          requireNumber: false,
          requireSpecialChar: false,
          maxAgeDays: 180
        },
        autoLock: { maxTimeoutMinutes: 15 },
        firewall: { enabled: true, stealthMode: false },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: {
          enabled: true,
          downloadOnly: false,
          automaticSecurityInstall: false
        },
        sharingServices: {
          fileSharing: false,
          screenSharing: false,
          remoteLogin: false
        }
      };

    case 'developer':
      return {
        ...baseConfig,
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        password: {
          required: true,
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSpecialChar: true,
          maxAgeDays: 180
        },
        autoLock: { maxTimeoutMinutes: 10 },
        firewall: { enabled: true, stealthMode: false },
        remoteLogin: { enabled: true },
        remoteManagement: { enabled: false },
        automaticUpdates: {
          enabled: true,
          downloadOnly: true,
          automaticSecurityInstall: true
        },
        sharingServices: {
          fileSharing: true,
          screenSharing: true,
          remoteLogin: true
        }
      };

    case 'eai':
      return {
        diskEncryption: { enabled: true },
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        password: {
          required: true,
          minLength: 10,
          requireUppercase: false,
          requireLowercase: false,
          requireNumber: false,
          requireSpecialChar: false,
          maxAgeDays: 180
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: false, stealthMode: false },
        packageVerification: { enabled: true },
        systemIntegrityProtection: { enabled: true },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: {
          enabled: true,
          automaticInstall: true,
          automaticSecurityInstall: true
        },
        sharingServices: {
          fileSharing: false,
          screenSharing: false,
          remoteLogin: false
        },
        osVersion: { targetVersion: 'latest' },
        installedApps: {
          bannedApplications: ['BitTorrent', 'uTorrent', 'Limewire', 'TeamViewer', 'AnyDesk', 'Skype', 'Steam']
        },
        wifiSecurity: {
          bannedNetworks: ['EAIguest', 'xfinitywifi', 'Guest', 'Public WiFi']
        }
      };

    default: // 'default' profile
      return {
        ...baseConfig,
        passwordProtection: {
          enabled: true,
          requirePasswordImmediately: true
        },
        password: {
          required: false,
          minLength: 8,
          requireUppercase: false,
          requireLowercase: false,
          requireNumber: false,
          requireSpecialChar: false,
          maxAgeDays: 180
        },
        autoLock: { maxTimeoutMinutes: 7 },
        firewall: { enabled: true, stealthMode: true },
        remoteLogin: { enabled: false },
        remoteManagement: { enabled: false },
        automaticUpdates: {
          enabled: true,
          automaticInstall: true,
          automaticSecurityInstall: true
        },
        sharingServices: {
          fileSharing: false,
          screenSharing: false,
          remoteLogin: false
        },
        wifiSecurity: {
          bannedNetworks: ['EAIguest', 'xfinitywifi', 'Guest']
        }
      };
  }
}

/**
 * Check if a profile name is valid
 */
export function isValidProfile(profile: string): profile is SecurityProfile {
  return VALID_PROFILES.includes(profile as SecurityProfile);
}