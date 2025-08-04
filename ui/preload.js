const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    runSecurityCheck: (profile) => ipcRenderer.invoke('run-security-check', profile),
    getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
    getSecurityProfiles: () => ipcRenderer.invoke('get-security-profiles'),
    getCliVersion: () => ipcRenderer.invoke('get-cli-version')
});

// Also expose a flag for identifying this is an Electron app
contextBridge.exposeInMainWorld('isElectron', true);