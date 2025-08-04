import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../services/electron.service';

interface ManagementAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: () => Promise<void>;
  requiresConfirmation?: boolean;
}

@Component({
  selector: 'app-interactive-mode',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="interactive-mode-container">
      <div class="header">
        <h1>🎛️ Interactive Management</h1>
        <p>Comprehensive system management and administrative functions</p>
      </div>

      <div class="management-grid">
        @for (action of managementActions; track action.id) {
          <div class="action-card" (click)="executeAction(action)">
            <div class="action-icon">{{ action.icon }}</div>
            <div class="action-content">
              <h3>{{ action.title }}</h3>
              <p>{{ action.description }}</p>
            </div>
            <div class="action-indicator">
              @if (isActionRunning(action.id)) {
                <div class="spinner"></div>
              } @else {
                <span class="arrow">→</span>
              }
            </div>
          </div>
        }
      </div>

      <div class="system-info">
        <h2>System Information</h2>
        <div class="info-grid">
          @if (platformInfo()) {
            <div class="info-card">
              <h3>Platform Details</h3>
              <div class="info-content">
                <div class="info-item">
                  <span class="label">Platform:</span>
                  <span class="value">{{ platformInfo()!.platform }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Architecture:</span>
                  <span class="value">{{ platformInfo()!.arch }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Version:</span>
                  <span class="value">{{ platformInfo()!.version }}</span>
                </div>
              </div>
            </div>
          }

          @if (cliVersion()) {
            <div class="info-card">
              <h3>CLI Information</h3>
              <div class="info-content">
                <div class="info-item">
                  <span class="label">CLI Version:</span>
                  <span class="value">{{ cliVersion() }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Runtime:</span>
                  <span class="value">{{ isElectron() ? 'Electron Desktop' : 'Web Browser' }}</span>
                </div>
              </div>
            </div>
          }

          <div class="info-card">
            <h3>Quick Actions</h3>
            <div class="info-content">
              <button class="btn btn-sm" (click)="runQuickCheck()">
                ⚡ Quick Security Check
              </button>
              <button class="btn btn-sm" (click)="openConfigEditor()">
                ⚙️ Open Config Editor
              </button>
              <button class="btn btn-sm" (click)="viewReports()">
                📊 View Reports
              </button>
            </div>
          </div>
        </div>
      </div>

      @if (actionLog().length > 0) {
        <div class="action-log">
          <h2>Recent Actions</h2>
          <div class="log-container">
            @for (log of actionLog(); track $index) {
              <div class="log-entry" [class]="'log-' + log.type">
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
            }
          </div>
        </div>
      }

      @if (confirmationDialog()) {
        <div class="modal-overlay" (click)="cancelConfirmation()">
          <div class="confirmation-dialog" (click)="$event.stopPropagation()">
            <h3>Confirm Action</h3>
            <p>{{ confirmationDialog()!.message }}</p>
            <div class="dialog-actions">
              <button class="btn btn-primary" (click)="confirmAction()">
                Yes, Continue
              </button>
              <button class="btn btn-secondary" (click)="cancelConfirmation()">
                Cancel
              </button>
            </div>
          </div>
        </div>
      }

      @if (message()) {
        <div class="message" [class]="'message-' + messageType()">
          {{ message() }}
        </div>
      }
    </div>
  `,
  styleUrls: ['./interactive-mode.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InteractiveModeComponent {
  private readonly electronService = inject(ElectronService);
  private readonly _runningActions = signal<Set<string>>(new Set());
  private readonly _actionLog = signal<{timestamp: string, message: string, type: 'info' | 'success' | 'error'}[]>([]);
  private readonly _confirmationDialog = signal<{message: string, action: () => Promise<void>} | null>(null);
  private readonly _message = signal<string>('');
  private readonly _messageType = signal<'success' | 'error' | 'info'>('info');

  readonly runningActions = this._runningActions.asReadonly();
  readonly actionLog = this._actionLog.asReadonly();
  readonly confirmationDialog = this._confirmationDialog.asReadonly();
  readonly message = this._message.asReadonly();
  readonly messageType = this._messageType.asReadonly();

  readonly isElectron = this.electronService.isElectron;
  readonly platformInfo = this.electronService.platformInfo;
  readonly cliVersion = this.electronService.cliVersion;

  managementActions: ManagementAction[] = [
    {
      id: 'install-global',
      title: 'Install Globally',
      description: 'Install EAI Security Check as a global system command',
      icon: '🚀',
      action: () => this.installGlobally(),
      requiresConfirmation: true
    },
    {
      id: 'uninstall-global',
      title: 'Uninstall Globally',
      description: 'Remove global installation and optionally clean configuration',
      icon: '🗑️',
      action: () => this.uninstallGlobally(),
      requiresConfirmation: true
    },
    {
      id: 'update-app',
      title: 'Update Application',
      description: 'Check for and install application updates',
      icon: '🔄',
      action: () => this.updateApplication()
    },
    {
      id: 'interactive-cli',
      title: 'CLI Interactive Mode',
      description: 'Launch full CLI interactive management interface',
      icon: '💻',
      action: () => this.launchInteractiveCLI()
    },
    {
      id: 'export-config',
      title: 'Export Configuration',
      description: 'Export current security configuration to file',
      icon: '💾',
      action: () => this.exportConfiguration()
    },
    {
      id: 'import-config',
      title: 'Import Configuration',
      description: 'Import security configuration from file',
      icon: '📁',
      action: () => this.importConfiguration()
    }
  ];

  async executeAction(action: ManagementAction): Promise<void> {
    if (this.isActionRunning(action.id)) return;

    if (action.requiresConfirmation) {
      this._confirmationDialog.set({
        message: `Are you sure you want to ${action.title.toLowerCase()}? This action may affect system-wide settings.`,
        action: action.action
      });
      return;
    }

    await this.runAction(action);
  }

  async confirmAction(): Promise<void> {
    const dialog = this.confirmationDialog();
    if (dialog) {
      this._confirmationDialog.set(null);
      await dialog.action();
    }
  }

  cancelConfirmation(): void {
    this._confirmationDialog.set(null);
  }

  private async runAction(action: ManagementAction): Promise<void> {
    const runningSet = new Set(this._runningActions());
    runningSet.add(action.id);
    this._runningActions.set(runningSet);

    this.addLogEntry(`Starting: ${action.title}`, 'info');

    try {
      await action.action();
      this.addLogEntry(`Completed: ${action.title}`, 'success');
      this.showMessage(`${action.title} completed successfully`, 'success');
    } catch (error) {
      console.error(`Action ${action.id} failed:`, error);
      this.addLogEntry(`Failed: ${action.title} - ${error}`, 'error');
      this.showMessage(`${action.title} failed`, 'error');
    } finally {
      const runningSet = new Set(this._runningActions());
      runningSet.delete(action.id);
      this._runningActions.set(runningSet);
    }
  }

  isActionRunning(actionId: string): boolean {
    return this._runningActions().has(actionId);
  }

  private async installGlobally(): Promise<void> {
    const result = await this.electronService.installGlobally();
    if (!result) {
      throw new Error('Installation failed');
    }
  }

  private async uninstallGlobally(): Promise<void> {
    const result = await this.electronService.uninstallGlobally(true);
    if (!result) {
      throw new Error('Uninstallation failed');
    }
  }

  private async updateApplication(): Promise<void> {
    const result = await this.electronService.updateApp();
    if (!result) {
      throw new Error('Update failed or no updates available');
    }
  }

  private async launchInteractiveCLI(): Promise<void> {
    await this.electronService.runInteractive();
  }

  private async exportConfiguration(): Promise<void> {
    const config = await this.electronService.loadConfig();
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `security-config-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async importConfiguration(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    return new Promise((resolve, reject) => {
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          const content = await this.readFileContent(file);
          const config = JSON.parse(content);
          await this.electronService.saveConfig(config);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      input.click();
    });
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async runQuickCheck(): Promise<void> {
    try {
      this.addLogEntry('Running quick security check...', 'info');
      const report = await this.electronService.runSecurityCheck('default');
      this.addLogEntry(`Quick check completed - ${report.summary.passed} passed, ${report.summary.failed} failed`, 'success');
      this.showMessage('Quick security check completed', 'success');
    } catch (error) {
      this.addLogEntry('Quick check failed', 'error');
      this.showMessage('Quick security check failed', 'error');
    }
  }

  openConfigEditor(): void {
    // In a real app, would navigate to config editor
    this.showMessage('Opening configuration editor...', 'info');
  }

  viewReports(): void {
    // In a real app, would navigate to report viewer
    this.showMessage('Opening report viewer...', 'info');
  }

  private addLogEntry(message: string, type: 'info' | 'success' | 'error'): void {
    const currentLog = this._actionLog();
    const newEntry = {
      timestamp: new Date().toISOString(),
      message,
      type
    };
    
    // Keep only last 20 entries
    const updatedLog = [newEntry, ...currentLog].slice(0, 20);
    this._actionLog.set(updatedLog);
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this._message.set(message);
    this._messageType.set(type);
    
    setTimeout(() => {
      this._message.set('');
    }, 5000);
  }
}