import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../services/electron.service';

interface ConfigSection {
  name: string;
  title: string;
  description: string;
  fields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'select';
  description: string;
  options?: { value: any; label: string }[];
  min?: number;
  max?: number;
}

@Component({
  selector: 'app-config-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="config-editor-container">
      <div class="header">
        <h1>⚙️ Configuration Editor</h1>
        <p>Customize security requirements and settings</p>
      </div>

      <div class="controls">
        <div class="profile-controls">
          <select
            [(ngModel)]="selectedProfile"
            (ngModelChange)="loadProfile($event)"
            class="profile-select"
          >
            <option value="">Select a profile to edit...</option>
            <option value="default">Default Profile</option>
            <option value="strict">Strict Profile</option>
            <option value="relaxed">Relaxed Profile</option>
            <option value="developer">Developer Profile</option>
            <option value="eai">EAI Profile</option>
          </select>

          <button class="btn btn-secondary" (click)="createNewProfile()">
            ➕ New Profile
          </button>
        </div>

        <div class="action-controls">
          <button
            class="btn btn-primary"
            [disabled]="!hasChanges() || isSaving()"
            (click)="saveConfig()"
          >
            @if (isSaving()) {
              💾 Saving...
            } @else {
              💾 Save Configuration
            }
          </button>

          <button
            class="btn btn-secondary"
            [disabled]="!hasChanges()"
            (click)="resetChanges()"
          >
            🔄 Reset Changes
          </button>

          <button class="btn btn-secondary" (click)="loadFromFile()">
            📁 Load from File
          </button>

          <button
            class="btn btn-secondary"
            [disabled]="!config()"
            (click)="exportConfig()"
          >
            💾 Export
          </button>
        </div>
      </div>

      @if (config()) {
        <div class="config-sections">
          @for (section of configSections; track section.name) {
            <div class="config-section">
              <h3>{{ section.title }}</h3>
              <p class="section-description">{{ section.description }}</p>

              <div class="fields">
                @for (field of section.fields; track field.key) {
                  <div class="field">
                    <label class="field-label">
                      {{ field.label }}
                      <span class="field-description">{{
                        field.description
                      }}</span>
                    </label>

                    @switch (field.type) {
                      @case ('boolean') {
                        <div class="field-input">
                          <label class="toggle-switch">
                            <input
                              type="checkbox"
                              [checked]="getFieldValue(field.key)"
                              (change)="setFieldValue(field.key, $event)"
                            />
                            <span class="toggle-slider"></span>
                          </label>
                        </div>
                      }
                      @case ('number') {
                        <div class="field-input">
                          <input
                            type="number"
                            class="number-input"
                            [value]="getFieldValue(field.key)"
                            [min]="field.min"
                            [max]="field.max"
                            (input)="setFieldValue(field.key, $event)"
                          />
                        </div>
                      }
                      @case ('string') {
                        <div class="field-input">
                          <input
                            type="text"
                            class="text-input"
                            [value]="getFieldValue(field.key)"
                            (input)="setFieldValue(field.key, $event)"
                          />
                        </div>
                      }
                      @case ('select') {
                        <div class="field-input">
                          <select
                            class="select-input"
                            [value]="getFieldValue(field.key)"
                            (change)="setFieldValue(field.key, $event)"
                          >
                            @for (option of field.options; track option.value) {
                              <option [value]="option.value">
                                {{ option.label }}
                              </option>
                            }
                          </select>
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-state">
          <div class="icon">⚙️</div>
          <p>Select a profile to start editing configuration settings</p>
          <p>
            You can also create a new profile or load configuration from a file.
          </p>
        </div>
      }

      @if (message()) {
        <div class="message" [class]="'message-' + messageType()">
          {{ message() }}
        </div>
      }
    </div>
  `,
  styleUrls: ['./config-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigEditorComponent {
  private readonly electronService = inject(ElectronService);
  private readonly _config = signal<any>(null);
  private readonly _originalConfig = signal<any>(null);
  private readonly _hasChanges = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _message = signal<string>('');
  private readonly _messageType = signal<'success' | 'error' | 'info'>('info');

  readonly config = this._config.asReadonly();
  readonly hasChanges = this._hasChanges.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly message = this._message.asReadonly();
  readonly messageType = this._messageType.asReadonly();

  selectedProfile = '';

  configSections: ConfigSection[] = [
    {
      name: 'diskEncryption',
      title: '🔒 Disk Encryption',
      description: 'Configure full disk encryption requirements',
      fields: [
        {
          key: 'diskEncryption.enabled',
          label: 'Require Disk Encryption',
          type: 'boolean',
          description:
            'Require FileVault (macOS) or LUKS (Linux) to be enabled',
        },
      ],
    },
    {
      name: 'passwordProtection',
      title: '🔑 Password Protection',
      description: 'Configure screen lock and password requirements',
      fields: [
        {
          key: 'passwordProtection.enabled',
          label: 'Require Password Protection',
          type: 'boolean',
          description: 'Require screen saver password protection',
        },
        {
          key: 'passwordProtection.requirePasswordImmediately',
          label: 'Require Password Immediately',
          type: 'boolean',
          description:
            'Require password immediately when screen saver activates',
        },
      ],
    },
    {
      name: 'autoLock',
      title: '⏰ Auto-lock Timeout',
      description: 'Configure automatic screen lock timeout',
      fields: [
        {
          key: 'autoLock.maxTimeoutMinutes',
          label: 'Maximum Timeout (minutes)',
          type: 'number',
          description: 'Maximum allowed screen lock timeout in minutes',
          min: 1,
          max: 60,
        },
      ],
    },
    {
      name: 'firewall',
      title: '🔥 Firewall',
      description: 'Configure firewall requirements',
      fields: [
        {
          key: 'firewall.enabled',
          label: 'Require Firewall',
          type: 'boolean',
          description: 'Require application firewall to be enabled',
        },
        {
          key: 'firewall.stealthMode',
          label: 'Require Stealth Mode',
          type: 'boolean',
          description: 'Require firewall stealth mode (macOS only)',
        },
      ],
    },
    {
      name: 'packageVerification',
      title: '🛡️ Package Verification',
      description: 'Configure software verification requirements',
      fields: [
        {
          key: 'packageVerification.enabled',
          label: 'Require Package Verification',
          type: 'boolean',
          description: 'Require Gatekeeper (macOS) or GPG verification (Linux)',
        },
      ],
    },
    {
      name: 'systemIntegrityProtection',
      title: '🔐 System Integrity Protection',
      description: 'Configure system integrity requirements',
      fields: [
        {
          key: 'systemIntegrityProtection.enabled',
          label: 'Require SIP/SELinux',
          type: 'boolean',
          description:
            'Require System Integrity Protection (macOS) or SELinux (Linux)',
        },
      ],
    },
    {
      name: 'remoteAccess',
      title: '🌐 Remote Access',
      description: 'Configure remote access security requirements',
      fields: [
        {
          key: 'remoteLogin.enabled',
          label: 'Allow Remote Login',
          type: 'boolean',
          description: 'Allow SSH remote login',
        },
        {
          key: 'remoteManagement.enabled',
          label: 'Allow Remote Management',
          type: 'boolean',
          description: 'Allow remote management/VNC',
        },
      ],
    },
    {
      name: 'automaticUpdates',
      title: '🔄 Automatic Updates',
      description: 'Configure automatic update requirements',
      fields: [
        {
          key: 'automaticUpdates.enabled',
          label: 'Require Automatic Updates',
          type: 'boolean',
          description: 'Require automatic security updates',
        },
        {
          key: 'automaticUpdates.automaticInstall',
          label: 'Automatic Installation',
          type: 'boolean',
          description: 'Require automatic installation of updates',
        },
      ],
    },
  ];

  async loadProfile(profile: string): Promise<void> {
    if (!profile) {
      this._config.set(null);
      this._originalConfig.set(null);
      this._hasChanges.set(false);
      return;
    }

    try {
      const config = await this.electronService.createConfig(profile);
      this._config.set(config);
      this._originalConfig.set(JSON.parse(JSON.stringify(config)));
      this._hasChanges.set(false);
      this.showMessage(`Loaded ${profile} profile configuration`, 'success');
    } catch (error) {
      this.showMessage(`Failed to load profile: ${error}`, 'error');
    }
  }

  async createNewProfile(): Promise<void> {
    const config = await this.electronService.createConfig('default');
    this._config.set(config);
    this._originalConfig.set(JSON.parse(JSON.stringify(config)));
    this._hasChanges.set(false);
    this.selectedProfile = '';
    this.showMessage(
      'Created new configuration based on default profile',
      'info',
    );
  }

  async saveConfig(): Promise<void> {
    if (!this.config()) return;

    this._isSaving.set(true);
    try {
      const saved = await this.electronService.saveConfig(this.config());
      if (saved) {
        this._originalConfig.set(JSON.parse(JSON.stringify(this.config())));
        this._hasChanges.set(false);
        this.showMessage('Configuration saved successfully', 'success');
      } else {
        this.showMessage('Failed to save configuration', 'error');
      }
    } catch (error) {
      this.showMessage(`Save failed: ${error}`, 'error');
    } finally {
      this._isSaving.set(false);
    }
  }

  resetChanges(): void {
    if (this._originalConfig()) {
      this._config.set(JSON.parse(JSON.stringify(this._originalConfig())));
      this._hasChanges.set(false);
      this.showMessage('Changes reset to saved configuration', 'info');
    }
  }

  loadFromFile(): void {
    // TODO: Implement file dialog for loading configuration
    this.showMessage('File loading not yet implemented', 'info');
  }

  exportConfig(): void {
    if (this.config()) {
      const dataStr = JSON.stringify(this.config(), null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `security-config-${this.selectedProfile || 'custom'}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.showMessage('Configuration exported successfully', 'success');
    }
  }

  getFieldValue(fieldPath: string): any {
    if (!this.config()) return null;

    const path = fieldPath.split('.');
    let value = this.config();

    for (const key of path) {
      value = value?.[key];
    }

    return value;
  }

  setFieldValue(fieldPath: string, event: any): void {
    if (!this.config()) return;

    const target = event.target;
    let value: any;

    if (target.type === 'checkbox') {
      value = target.checked;
    } else if (target.type === 'number') {
      value = parseInt(target.value, 10);
    } else {
      value = target.value;
    }

    const config = JSON.parse(JSON.stringify(this.config()));
    const path = fieldPath.split('.');
    let current = config;

    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }

    current[path[path.length - 1]] = value;

    this._config.set(config);
    this._hasChanges.set(
      JSON.stringify(config) !== JSON.stringify(this._originalConfig()),
    );
  }

  private showMessage(
    message: string,
    type: 'success' | 'error' | 'info',
  ): void {
    this._message.set(message);
    this._messageType.set(type);

    setTimeout(() => {
      this._message.set('');
    }, 5000);
  }
}
