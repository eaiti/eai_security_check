import { Injectable, signal } from '@angular/core';
import { ElectronService } from './electron.service';

export interface ApplicationConfig {
  userIdentifier: string;
  theme: 'light' | 'dark' | 'auto';
  reportFormat: 'json' | 'html' | 'txt';
  autoSaveReports: boolean;
  reportsDirectory: string;
  configDirectory: string;
  lastProfile: string;
}

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private readonly _config = signal<ApplicationConfig | null>(null);
  private readonly electronService = new ElectronService();

  readonly config = this._config.asReadonly();

  constructor() {
    this.loadConfig();
  }

  private getDefaultConfig(): ApplicationConfig {
    return {
      userIdentifier: '',
      theme: 'auto',
      reportFormat: 'json',
      autoSaveReports: true,
      reportsDirectory: '~/reports',
      configDirectory: '~/.config/eai-security-check',
      lastProfile: 'eai',
    };
  }

  async loadConfig(): Promise<void> {
    try {
      if (this.electronService.isElectron()) {
        const config = await this.electronService.loadApplicationConfig();
        this._config.set(config || this.getDefaultConfig());
      } else {
        // Load from localStorage in browser
        const stored = localStorage.getItem('eai-app-config');
        if (stored) {
          this._config.set(JSON.parse(stored));
        } else {
          this._config.set(this.getDefaultConfig());
        }
      }
    } catch (error) {
      console.error('Failed to load application config:', error);
      this._config.set(this.getDefaultConfig());
    }
  }

  async saveConfig(config: ApplicationConfig): Promise<boolean> {
    try {
      if (this.electronService.isElectron()) {
        const success = await this.electronService.saveApplicationConfig(config);
        if (success) {
          this._config.set(config);
        }
        return success;
      } else {
        // Save to localStorage in browser
        localStorage.setItem('eai-app-config', JSON.stringify(config));
        this._config.set(config);
        return true;
      }
    } catch (error) {
      console.error('Failed to save application config:', error);
      return false;
    }
  }

  getUserIdentifier(): string {
    return this._config()?.userIdentifier || '';
  }

  async setUserIdentifier(userIdentifier: string): Promise<boolean> {
    const currentConfig = this._config() || this.getDefaultConfig();
    const updatedConfig = { ...currentConfig, userIdentifier };
    return await this.saveConfig(updatedConfig);
  }
}