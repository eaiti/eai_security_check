import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  ElectronService,
} from '../../services/electron.service';

interface ManagementCard {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

@Component({
  selector: 'app-management',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="management-container">
      <div class="management-header">
        <h1>🎛️ Management</h1>
        <p>Configure security settings, manage daemon services, and edit configuration files</p>
      </div>

      <div class="management-grid">
        @for (card of managementCards(); track card.route) {
          <div 
            class="management-card" 
            [class]="'card-' + card.color"
            (click)="navigateToCard(card.route)"
            (keyup.enter)="navigateToCard(card.route)"
            (keyup.space)="navigateToCard(card.route)"
            tabindex="0"
            role="button"
            [attr.aria-label]="'Navigate to ' + card.title"
          >
            <div class="card-icon">{{ card.icon }}</div>
            <div class="card-content">
              <h3>{{ card.title }}</h3>
              <p>{{ card.description }}</p>
            </div>
            <div class="card-arrow">→</div>
          </div>
        }
      </div>

      <!-- Platform-specific daemon setup instructions -->
      <div class="setup-instructions">
        <h2>📋 Platform Setup Instructions</h2>
        <div class="instructions-tabs">
          <button 
            class="tab-button"
            [class.active]="selectedPlatform() === 'linux'"
            (click)="selectPlatform('linux')"
          >
            🐧 Linux
          </button>
          <button 
            class="tab-button"
            [class.active]="selectedPlatform() === 'macos'"
            (click)="selectPlatform('macos')"
          >
            🍎 macOS
          </button>
          <button 
            class="tab-button"
            [class.active]="selectedPlatform() === 'windows'"
            (click)="selectPlatform('windows')"
          >
            🪟 Windows
          </button>
        </div>

        <div class="instructions-content">
          @switch (selectedPlatform()) {
            @case ('linux') {
              <div class="platform-instructions">
                <h3>Linux Daemon Setup</h3>
                <div class="instruction-section">
                  <h4>Systemd Service Installation:</h4>
                  <pre class="code-block">
# Create systemd service file
sudo tee /etc/systemd/system/eai-security-check.service << EOF
[Unit]
Description=EAI Security Check Daemon
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=root
ExecStart=/usr/local/bin/eai-security-check daemon start

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable eai-security-check
sudo systemctl start eai-security-check
                  </pre>
                </div>
                <div class="instruction-section">
                  <h4>Manual Cron Setup (Alternative):</h4>
                  <pre class="code-block">
# Edit root crontab
sudo crontab -e

# Add entry for daily security checks
0 9 * * * /usr/local/bin/eai-security-check check --profile eai --format email
                  </pre>
                </div>
              </div>
            }
            @case ('macos') {
              <div class="platform-instructions">
                <h3>macOS Daemon Setup</h3>
                <div class="instruction-section">
                  <h4>LaunchDaemon Installation:</h4>
                  <pre class="code-block">
# Create launch daemon plist
sudo tee /Library/LaunchDaemons/com.eaiti.security-check.plist &lt;&lt; EOF
&lt;?xml version="1.0" encoding="UTF-8"?&gt;
&lt;!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"&gt;
&lt;plist version="1.0"&gt;
&lt;dict&gt;
    &lt;key&gt;Label&lt;/key&gt;
    &lt;string&gt;com.eaiti.security-check&lt;/string&gt;
    &lt;key&gt;ProgramArguments&lt;/key&gt;
    &lt;array&gt;
        &lt;string&gt;/usr/local/bin/eai-security-check&lt;/string&gt;
        &lt;string&gt;daemon&lt;/string&gt;
        &lt;string&gt;start&lt;/string&gt;
    &lt;/array&gt;
    &lt;key&gt;RunAtLoad&lt;/key&gt;
    &lt;true/&gt;
    &lt;key&gt;KeepAlive&lt;/key&gt;
    &lt;true/&gt;
&lt;/dict&gt;
&lt;/plist&gt;
EOF

# Load and start the daemon
sudo launchctl load /Library/LaunchDaemons/com.eaiti.security-check.plist
sudo launchctl start com.eaiti.security-check
                  </pre>
                </div>
                <div class="instruction-section">
                  <h4>Manual Cron Setup (Alternative):</h4>
                  <pre class="code-block">
# Edit root crontab
sudo crontab -e

# Add entry for daily security checks
0 9 * * * /usr/local/bin/eai-security-check check --profile eai --format email
                  </pre>
                </div>
              </div>
            }
            @case ('windows') {
              <div class="platform-instructions">
                <h3>Windows Daemon Setup</h3>
                <div class="instruction-section">
                  <h4>Windows Service Installation:</h4>
                  <pre class="code-block">
# Install using NSSM (Non-Sucking Service Manager)
# Download NSSM from https://nssm.cc/

# Install the service
nssm install "EAI Security Check" "C:\\Program Files\\nodejs\\eai-security-check.exe" "daemon start"

# Configure service parameters
nssm set "EAI Security Check" DisplayName "EAI Security Check Daemon"
nssm set "EAI Security Check" Description "Automated security auditing service"
nssm set "EAI Security Check" Start SERVICE_AUTO_START

# Start the service
net start "EAI Security Check"
                  </pre>
                </div>
                <div class="instruction-section">
                  <h4>Task Scheduler Setup (Alternative):</h4>
                  <pre class="code-block">
# Create scheduled task using PowerShell
$Action = New-ScheduledTaskAction -Execute "eai-security-check.exe" -Argument "check --profile eai --format email"
$Trigger = New-ScheduledTaskTrigger -Daily -At 9am
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "EAI Security Check" -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal
                  </pre>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagementComponent implements OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly router = inject(Router);

  protected readonly selectedPlatform = signal<'linux' | 'macos' | 'windows'>('linux');
  protected readonly managementCards = signal<ManagementCard[]>([
    {
      title: 'Configuration Editor',
      description: 'Edit security profiles and configuration settings',
      icon: '⚙️',
      route: '/config-editor',
      color: 'blue'
    },
    {
      title: 'Daemon Manager',
      description: 'Configure and manage automated security monitoring',
      icon: '🤖',
      route: '/daemon-manager',
      color: 'green'
    }
  ]);

  ngOnInit() {
    // Detect current platform and set as default
    const info = this.electronService.platformInfo();
    if (info?.platform) {
      this.selectedPlatform.set(info.platform as 'linux' | 'macos' | 'windows');
    }
  }

  protected navigateToCard(route: string) {
    this.router.navigate([route]);
  }

  protected selectPlatform(platform: 'linux' | 'macos' | 'windows') {
    this.selectedPlatform.set(platform);
  }
}