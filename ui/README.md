# EAI Security Check UI

A lightweight Electron-based UI for the EAI Security Check CLI tool.

## Overview

This UI provides a modern, cross-platform graphical interface for the existing EAI Security Check CLI functionality. It demonstrates how the command-line tool can be wrapped with an Electron application to provide an intuitive user experience.

## Features

- **Cross-platform**: Runs on Windows, macOS, and Linux
- **Lightweight**: Simple HTML/CSS/JavaScript with Electron wrapper
- **Integrated**: Uses the existing CLI logic via IPC calls
- **Real-time**: Shows actual security check results from the system
- **Profile Support**: Supports all security profiles (default, strict, relaxed, developer, eai)

## Architecture

- **main.js**: Electron main process that manages the application window and integrates with CLI
- **preload.js**: Secure bridge between renderer and main process
- **index.html**: The UI interface with embedded CSS and JavaScript
- **package.json**: Electron application configuration and build settings

## Usage

### Development Mode

```bash
# From the root directory, build the CLI first
npm run build

# Then start the UI
npm run start:ui
```

### Standalone Mode

```bash
# Navigate to UI directory
cd ui

# Install dependencies (first time only)
npm install

# Run the application
npm start
```

### Building Distributables

```bash
# Build for current platform
cd ui
npm run dist

# Build for specific platforms
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## How It Works

1. **UI Layer**: HTML/CSS/JavaScript provides the user interface
2. **IPC Bridge**: Electron IPC handles secure communication between UI and CLI
3. **CLI Integration**: Main process executes the actual CLI commands and returns results
4. **Data Transformation**: Results are transformed from CLI JSON format to UI-friendly format

## Integration with CLI

The UI integrates with the existing CLI in several ways:

- **Security Checks**: Calls `eai-security-check check <profile> --format json --quiet`
- **Platform Info**: Uses Node.js process information
- **Version Info**: Reads from the main package.json
- **Profile Support**: Passes profile selection to CLI commands

## Fallback Behavior

- If the CLI is not built or available, the UI falls back to mock data
- This allows the UI to be demonstrated even without a fully built CLI
- Error handling provides user-friendly messages for troubleshooting

## Future Enhancements

This proof of concept could be extended with:

- Configuration management UI
- Daemon/scheduling setup interface
- Real-time monitoring dashboard
- Report generation and export
- System tray integration
- Auto-update functionality
- Dark/light theme support

## Security Considerations

- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Preload Script**: Provides controlled access to Node.js APIs
- **IPC Validation**: All communications are validated and sanitized