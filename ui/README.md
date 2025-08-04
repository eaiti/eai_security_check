# EAI Security Check - Desktop UI

A modern Angular-based desktop application for EAI Security Check, providing a comprehensive graphical interface for security auditing with advanced report management capabilities.

## 🎯 Overview

This desktop application is built with Angular 20+ and Electron, providing a native cross-platform experience for managing security audits. It includes all CLI functionality plus advanced UI-specific features like report format conversion, visual configuration management, and comprehensive dashboard views.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- Built CLI (run `npm run build` from project root first)

### Installation and Setup

```bash
# From the project root, build the CLI first
npm run build

# Navigate to UI directory
cd ui

# Install dependencies (first time only)
npm install

# Start the application
npm start              # Development mode
npm run electron:build # Production mode with built CLI
```

### Building Distributables

```bash
# Build for current platform
npm run dist

# Platform-specific builds
npm run dist:mac       # macOS .dmg
npm run dist:win       # Windows .exe installer
npm run dist:linux     # Linux .AppImage
```

## 🛠️ Features

### 🏠 Dashboard
- **System Status Overview**: Version, global install status, daemon configuration
- **Recent Security Checks**: Timeline with pass/fail/warning summaries
- **Quick Actions**: Direct access to run checks, install globally, configure daemon
- **Feature Navigation**: Easy access to all major functionality

### 🔍 Security Check
- **Interactive Security Audits**: Run comprehensive security checks with real-time results
- **Profile Selection**: Choose from default, strict, relaxed, developer, or EAI profiles
- **Detailed Results**: Clear pass/fail/warning indicators with explanations
- **Platform Detection**: Automatic detection and display of system information

### 📊 Report Viewer (Advanced Report Management)
- **Format Conversion**: Convert reports between JSON, HTML, Markdown, CSV, and Plain Text
- **Copy to Clipboard**: One-click copying in any format
- **Download Reports**: Save reports locally with proper file extensions
- **Report Verification**: Verify tamper-evident report integrity
- **File Upload**: Import existing reports for viewing and conversion
- **Recent Reports**: Browse historical reports with metadata

#### Supported Output Formats

1. **JSON**: Structured data format for programmatic use
2. **HTML**: Styled web format with embedded CSS and visual indicators
3. **Markdown**: Documentation-friendly format for wikis and documentation
4. **CSV**: Spreadsheet-compatible format for data analysis
5. **Plain Text**: Human-readable console-style format

#### Report Conversion Example

```bash
# The UI automatically converts between formats
Original JSON → HTML with styling and visual indicators
Original JSON → Markdown with headers and bullet points  
Original JSON → CSV with check names, status, messages, details
Original JSON → Plain text with formatted sections
```

### ⚙️ Configuration Editor
- **Visual Profile Management**: Create and edit security profiles
- **Real-time Validation**: Immediate feedback on configuration changes
- **Import/Export**: Load from files or save custom configurations
- **Template Selection**: Start with predefined profiles and customize

### 🔄 Daemon Manager
- **Automated Monitoring Setup**: Configure scheduled security checks
- **Visual Schedule Editor**: Set up cron-style schedules with presets
- **Email Integration**: Configure SMTP for automated report delivery
- **Status Monitoring**: Real-time daemon status and execution logs
- **Service Management**: Start, stop, and configure daemon services

### 🎛️ Interactive Mode
- **Guided Setup**: Step-by-step wizards for all major features
- **System Information**: Comprehensive platform and configuration details
- **Global Installation**: Manage system-wide installation with visual feedback
- **Contextual Help**: Built-in documentation and assistance

## 🎨 User Interface Design

### Modern Angular Architecture
- **Angular 20+**: Latest features including signals and standalone components
- **OnPush Change Detection**: Optimized performance with minimal change detection cycles
- **Zone.js Disabled**: Manual change detection for better performance
- **Responsive Design**: Works on various screen sizes and resolutions

### Visual Design System
- **Consistent Theming**: CSS custom properties for maintainable styling
- **Status Indicators**: Clear color-coded pass/fail/warning states
- **Interactive Elements**: Hover effects and smooth transitions
- **Accessibility**: Keyboard navigation and screen reader support

## 🔧 Development

### Project Structure

```
ui/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── dashboard/           # Main dashboard
│   │   │   ├── security-check/      # Security audit interface
│   │   │   ├── config-editor/       # Configuration management
│   │   │   ├── daemon-manager/      # Daemon setup and monitoring
│   │   │   ├── report-viewer/       # Advanced report management
│   │   │   └── interactive-mode/    # Guided setup
│   │   ├── services/
│   │   │   └── electron.service.ts  # IPC communication
│   │   └── app.ts                   # Root component
│   └── styles.scss                  # Global styles
├── electron/
│   ├── main.js                      # Electron main process
│   └── preload.js                   # Secure IPC bridge
└── package.json                     # Dependencies and scripts
```

### Development Commands

```bash
# Development server (web only, with mock data)
npm run start

# Development with Electron
npm run electron:dev

# Build for production
npm run build:prod

# Run tests
npm test

# Lint code
npm run lint
```

### CLI Integration

The UI communicates with the existing CLI via secure IPC:

```typescript
// Execute security check
const report = await electronService.runSecurityCheck('default');

// Load configuration
const config = await electronService.loadConfig();

// Manage daemon
await electronService.manageDaemon('start', config);
```

## 🔐 Security

### Electron Security Best Practices
- **Context Isolation**: Enabled to prevent code injection
- **Node Integration**: Disabled in renderer process
- **Controlled API**: Only necessary methods exposed via preload script
- **Input Validation**: All parameters validated before CLI execution

### Report Integrity
- **Verification**: Verify tamper-evident reports using cryptographic signatures
- **Secure Storage**: Local storage with appropriate permissions
- **Safe File Handling**: Controlled file access through Electron APIs

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start development server (web mode with mock data) |
| `npm run electron:dev` | Start Electron development mode |
| `npm run electron:build` | Build and run Electron with production Angular |
| `npm run build` | Build Angular for production |
| `npm run build:prod` | Build Angular with production optimizations |
| `npm test` | Run unit tests |
| `npm run dist` | Build distributables for current platform |
| `npm run dist:mac` | Build macOS .dmg |
| `npm run dist:win` | Build Windows .exe installer |
| `npm run dist:linux` | Build Linux .AppImage |

## 🎯 CLI vs UI - When to Use Which

### Use the Desktop UI When:
- You prefer graphical interfaces
- You need visual report management and format conversion
- You want to browse and compare historical reports
- You need guided setup and configuration
- You want point-and-click daemon management
- You prefer visual status indicators and dashboards

### Use the CLI When:
- You're automating security checks in scripts
- You're running on servers or headless systems
- You need minimal resource usage
- You're integrating with other command-line tools
- You prefer terminal-based workflows

## 🚧 Known Limitations

- Some tests are currently failing due to Angular testing setup (functionality works correctly)
- Electron distributables require proper code signing for production distribution
- Email configuration requires SMTP server access
- Global installation features require appropriate system permissions

## 🎯 Future Enhancements

- Real-time security monitoring dashboard
- Advanced report comparison and trending
- Plugin system for custom security checks
- Cloud integration for report storage
- Multi-language support
- Dark theme option

## 📞 Support

For issues, questions, or contributions related to the UI:

1. Check the main project README for general information
2. Review the UI_IMPLEMENTATION.md for technical details
3. Open issues in the main project repository
4. Follow the existing code patterns when contributing

This desktop application provides a comprehensive, user-friendly interface for EAI Security Check while maintaining full compatibility with the existing CLI functionality.

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
