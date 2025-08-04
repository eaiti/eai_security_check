const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  runSecurityCheck: (profile, config) => ipcRenderer.invoke('run-security-check', profile, config),
  runInteractive: () => ipcRenderer.invoke('run-interactive'),
  verifyReport: (path) => ipcRenderer.invoke('verify-report', path),
  manageDaemon: (action, config) => ipcRenderer.invoke('manage-daemon', action, config),
  installGlobally: () => ipcRenderer.invoke('install-globally'),
  uninstallGlobally: (removeConfig) => ipcRenderer.invoke('uninstall-globally', removeConfig),
  updateApp: () => ipcRenderer.invoke('update-app'),
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
  getCliVersion: () => ipcRenderer.invoke('get-cli-version'),
  loadConfig: (path) => ipcRenderer.invoke('load-config', path),
  saveConfig: (config, path) => ipcRenderer.invoke('save-config', config, path),
  createConfig: (profile) => ipcRenderer.invoke('create-config', profile),
  listConfigs: () => ipcRenderer.invoke('list-configs')
});

contextBridge.exposeInMainWorld('isElectron', true);