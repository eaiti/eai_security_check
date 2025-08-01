#!/usr/bin/env node

import { Command } from 'commander';
import { CommandHandlers } from './command-handlers';
import { InteractiveHandlers } from './interactive-handlers';

const program = new Command();

program
  .name('eai-security-check')
  .description(
    "🔒 Cross-Platform Security Audit Tool - Check your system's security settings against configurable requirements"
  )
  .version('1.1.0')
  .addHelpText(
    'before',
    `
🔒 EAI Security Check - Cross-Platform Security Audit Tool

This tool audits your macOS, Linux, or Windows system against security best practices and generates
detailed reports with actionable recommendations.

SECURITY CHECKS PERFORMED:
  🔒 Disk Encryption (FileVault/LUKS/BitLocker)    🔥 Firewall (App Firewall/ufw/Windows Defender)
  🔑 Password Protection                         🛡️  Package Verification (Gatekeeper/GPG/SmartScreen)
  ⏰ Auto-lock Timeout                           🔐 System Integrity (SIP/SELinux/Windows Defender)
  🌐 Remote Login/SSH                     📱 Remote Management/VNC
  🔄 Automatic Updates                    📡 Sharing Services (File/Screen/Network)

PLATFORMS SUPPORTED:
  🍎 macOS: Complete support for all security features
  🐧 Linux: Full support (Fedora primary, Ubuntu/Debian limited testing)

RISK LEVELS:
  🚨 HIGH: Critical security vulnerabilities
  ⚠️  MEDIUM: Important security improvements
  📋 LOW: Additional security enhancements
`
  );

program
  .command('check')
  .description('🔍 Run security audit using configuration file')
  .argument('[profile]', 'Security profile: default, strict, relaxed, developer, or eai')
  .option('-c, --config <path>', 'Path to JSON configuration file (overrides profile argument)')
  .option('-o, --output <path>', 'Path to output report file (optional)')
  .option('-q, --quiet', 'Only show summary, suppress detailed output')
  .option(
    '--password <password>',
    'Administrator password for sudo commands (if not provided, will prompt when needed)'
  )
  .option('--clipboard', 'Copy report summary to clipboard')
  .option('--format <type>', 'Output format: console, plain, markdown, json, email', 'console')
  .option('--hash', 'Generate cryptographic hash for tamper detection')
  .option('--summary', 'Generate a summary line for quick sharing')
  .addHelpText(
    'after',
    `
Examples:
  $ eai-security-check check                        # Use default config
  $ eai-security-check check default               # Use default profile
  $ eai-security-check check strict                # Use strict profile
  $ eai-security-check check relaxed               # Use relaxed profile
  $ eai-security-check check developer             # Use developer profile
  $ eai-security-check check eai                   # Use EAI profile (10+ char passwords)
  $ eai-security-check check -c my-config.json     # Use custom config file
  $ eai-security-check check -o ~/Documents/report.txt  # Save report to Documents folder
  $ eai-security-check check -q                    # Quiet mode (summary only)
  $ eai-security-check check --password mypass     # Provide admin password directly
  $ eai-security-check check --clipboard           # Copy summary to clipboard
  $ eai-security-check check --format markdown     # Markdown format output
  $ eai-security-check check --hash -o report.txt  # Generate tamper-evident report file
  $ eai-security-check check --hash --format json  # Generate tamper-evident JSON to console
  $ eai-security-check check --summary             # Just show summary line

Password Input:
  --password    - Provide admin/sudo password directly (avoid interactive prompt)
  Interactive   - Platform-aware prompts: "Enter your macOS password:" or "Enter your sudo password:"
  Platform      - macOS users enter their user password, Linux users enter sudo password

Output Formats (all support --hash for tamper detection):
  console     - Colorized console output (default)
  plain       - Plain text without colors
  markdown    - Markdown format for documentation
  json        - Structured JSON format
  email       - Email-friendly format with headers

Tamper Detection:
  --hash        - Generate cryptographic signature for report integrity
  Available in all formats (console, file, markdown, json, email)
  Verify with:  eai-security-check verify <filename>

Security Profiles:
  default     - Recommended security settings (7-min auto-lock)
  strict      - Maximum security (3-min auto-lock)
  relaxed     - Balanced security (15-min auto-lock)
  developer   - Developer-friendly (remote access enabled)
  eai         - EAI focused security (10+ char passwords, 180-day expiration)
`
  )
  .action(async (profile, options) => {
    // Validate inputs
    CommandHandlers.validateCheckCommand(profile, options);

    // Handle the command
    await CommandHandlers.handleCheckCommand(profile, options);
  });

program
  .command('interactive')
  .alias('manage')
  .description(
    '🎛️  Interactive management mode - manage configurations, global install, and daemon'
  )
  .addHelpText(
    'after',
    `
Examples:
  $ eai-security-check interactive                   # Full interactive management
  $ eai-security-check manage                        # Same as interactive (alias)

Interactive Management:
  The interactive command provides a menu-driven interface for:
  1. Running security checks with different profiles
  2. Managing security configurations and profiles
  3. Setting up and managing daemon automation
  4. Installing/updating/removing global system access
  5. Viewing comprehensive system status
  6. Managing all aspects of the security check system

Features Available:
  🔍 Security Checks      - Run checks with any profile, view results
  🔧 Configuration        - Setup, view, modify security profiles
  🤖 Daemon Management    - Setup, start/stop, configure automated checks
  🌍 Global Installation  - Install/remove system-wide access
  📊 System Status        - View comprehensive system information
  ⚙️  Reset & Cleanup     - Reset configurations, cleanup files

Supported Operations:
  - First-time setup wizard for new installations
  - Configuration management (create, modify, reset)
  - Daemon setup with email and SCP configuration
  - Global installation with platform-specific methods
  - System status monitoring and diagnostics
  - Version management and upgrade detection

Platform Support:
  🍎 macOS: Full support with LaunchAgent integration
  🐧 Linux: Complete support with systemd user services
  🪟 Windows: Basic support with Task Scheduler
`
  )
  .action(async () => {
    try {
      await InteractiveHandlers.runInteractiveMode();
    } catch (error) {
      console.error('❌ Error in interactive mode:', error);
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('🔍 Verify the integrity of tamper-evident security reports')
  .argument('<path>', 'Path to the signed report file or directory containing reports to verify')
  .option('--verbose', 'Show detailed verification information')
  .addHelpText(
    'after',
    `
Examples:
  $ eai-security-check verify security-report.txt     # Verify single report integrity
  $ eai-security-check verify --verbose report.txt    # Show detailed verification info
  $ eai-security-check verify ./reports/              # Verify all reports in directory
  $ eai-security-check verify report.json             # Works with all formats (JSON, markdown, etc.)

This command verifies that reports have not been tampered with by checking
their cryptographic signatures. Reports generated with --hash option include
verification signatures.

When verifying a directory, all files are checked and a summary is provided.
Only files with valid security report signatures are processed.

Supported formats: All output formats support verification (plain, markdown, json, email)
Exit codes: 0 = all verifications passed, 1 = any verification failed or file error
`
  )
  .action(async (inputPath, options) => {
    await CommandHandlers.handleVerifyCommand(inputPath, options);
  });

program
  .command('daemon')
  .description('🔄 Run security checks on a schedule and send email reports')
  .option(
    '-c, --config <path>',
    'Path to scheduling configuration file (default: uses centralized config)'
  )
  .option(
    '--security-config <path>',
    'Path to security configuration file (overrides profile in schedule config)'
  )
  .option('-s, --state <path>', 'Path to daemon state file (default: uses centralized state)')
  .option('--status', 'Show current daemon status and exit')
  .option('--test-email', 'Send a test email and exit')
  .option('--check-now', 'Force an immediate security check and email (regardless of schedule)')
  .option('--stop', 'Stop the running daemon')
  .option('--restart', 'Restart the daemon (stop current instance and start a new one)')
  .option('--uninstall', 'Remove daemon files and configurations')
  .option('--remove-executable', 'Also remove the executable when uninstalling (requires --force)')
  .option('--force', 'Force operations that normally require confirmation')
  .option('--setup', 'Setup daemon automation with auto-configuration')
  .option('--setup-minimal', 'Setup minimal daemon configuration (no email, for testing)')
  .option('--setup-email <config>', 'Setup daemon with email configuration (JSON format)')
  .option('--user-id <id>', 'User identifier for daemon setup (required with --setup options)')
  .option(
    '--security-profile <profile>',
    'Security profile for daemon (default, strict, relaxed, developer, eai)'
  )
  .option('--interval-days <days>', 'Check interval in days (default: 7)', '7')
  .option('--auto-service', 'Automatically setup system service when setting up daemon')
  .addHelpText(
    'after',
    `
Examples:
  $ eai-security-check daemon                              # Start daemon with centralized config
  $ eai-security-check daemon -c my-schedule.json         # Use custom scheduling config
  $ eai-security-check daemon --security-config strict.json # Use specific security config
  $ eai-security-check daemon --status                    # Check daemon status
  $ eai-security-check daemon --test-email                # Send test email
  $ eai-security-check daemon --check-now                 # Force immediate check

🚀 AUTOMATED SETUP:
  $ eai-security-check daemon --setup-minimal --user-id "user@company.com"  # Minimal setup for testing
  $ eai-security-check daemon --setup --user-id "user@company.com"          # Interactive email setup
  $ eai-security-check daemon --setup-email '{"host":"smtp.gmail.com","port":587,"user":"user@gmail.com","pass":"apppass","from":"alerts@company.com","to":["admin@company.com"]}' --user-id "user@company.com"  # Full automated setup
  $ eai-security-check daemon --setup-minimal --user-id "test" --security-profile strict --interval-days 1 --auto-service  # Complete automated setup

🚀 QUICK START:
  1. Set up daemon configuration:
     $ eai-security-check daemon --setup-minimal --user-id "$(whoami)@$(hostname)"    # Quick CLI setup
     $ eai-security-check interactive    # Or use interactive mode
  
  2. Start daemon manually (for testing):
     $ eai-security-check daemon         # Runs until you stop it
  
  3. Set up automatic startup (optional):
     macOS:   Use interactive mode's "Start/Stop/Restart Daemon" option for LaunchAgent setup
     Linux:   $ sudo systemctl --user enable eai-security-check-daemon
     Windows: Use Task Scheduler (see daemon-examples/ directory)

📋 SETUP FLOW:
  ✅ 1. Configuration: Use 'eai-security-check interactive' to setup email/schedule
  ✅ 2. Test manually: Use 'eai-security-check daemon' to test the setup
  ✅ 3. Auto-startup: Use interactive mode to setup system service (optional)

Daemon Control:
  $ eai-security-check daemon --stop                      # Stop running daemon
  $ eai-security-check daemon --restart                   # Restart daemon service
  $ eai-security-check daemon --uninstall                 # Remove daemon files

Configuration:
  The daemon requires two configuration steps:
  
  1. 📧 Email & Schedule Setup (Required):
     - SMTP server settings for sending reports
     - Email recipients and subject
     - Check interval (daily/weekly)
     - Security profile to use
     
  2. 🔧 System Service Setup (Optional but Recommended):
     - Makes daemon start automatically on login/boot
     - Automatically restarts if daemon crashes
     - Platform-specific (LaunchAgent/systemd/Task Scheduler)

💡 For the best experience, use the interactive setup:
   $ eai-security-check interactive
   Then choose "3. Daemon - Automated security monitoring"
`
  )
  .action(async options => {
    await CommandHandlers.handleDaemonCommand(options);
  });

program
  .command('install')
  .description('🚀 Install EAI Security Check globally')
  .action(async () => {
    await CommandHandlers.handleInstallCommand();
  });

program
  .command('uninstall')
  .description('🗑️ Uninstall EAI Security Check globally')
  .option('--cleanup', 'Remove all configuration files and data')
  .action(async options => {
    await CommandHandlers.handleUninstallCommand(options);
  });

program
  .command('update')
  .description('🔄 Update EAI Security Check to the latest version')
  .action(async () => {
    await CommandHandlers.handleUpdateCommand();
  });

program
  .command('help')
  .alias('h')
  .description('📚 Show detailed help information')
  .argument('[command]', 'Show help for specific command')
  .action(command => {
    if (command) {
      const cmd = program.commands.find(c => c.name() === command);
      if (cmd) {
        cmd.help();
      } else {
        console.error(`❌ Unknown command: ${command}`);
        console.log(
          'Available commands: check, interactive, verify, daemon, install, uninstall, update, help'
        );
      }
    } else {
      CommandHandlers.displayCommandHelp();
    }
  });

// Only parse command line arguments if this module is being run directly
if (require.main === module) {
  program.parse(process.argv);
}

// Export the handlers for testing
export { InteractiveHandlers, CommandHandlers };
