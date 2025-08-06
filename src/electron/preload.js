const { contextBridge, ipcRenderer } = require("electron");

// Expose secure APIs to renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // Security operations
  security: {
    runFullCheck: (config) =>
      ipcRenderer.invoke("security:runFullCheck", config),
    runQuickCheck: () => ipcRenderer.invoke("security:runQuickCheck"),
    getSystemInfo: () => ipcRenderer.invoke("security:getSystemInfo"),
  },

  // Configuration operations
  config: {
    load: (profileName) => ipcRenderer.invoke("config:load", profileName),
    save: (config, profileName) =>
      ipcRenderer.invoke("config:save", config, profileName),
    validate: (config) => ipcRenderer.invoke("config:validate", config),
    getProfiles: () => ipcRenderer.invoke("config:getProfiles"),
  },

  // Report operations
  reports: {
    list: () => ipcRenderer.invoke("reports:list"),
    load: (reportPath) => ipcRenderer.invoke("reports:load", reportPath),
    save: (report, filename) =>
      ipcRenderer.invoke("reports:save", report, filename),
  },

  // Cryptographic operations
  crypto: {
    verifyReport: (reportPath) =>
      ipcRenderer.invoke("crypto:verifyReport", reportPath),
    signReport: (reportPath) =>
      ipcRenderer.invoke("crypto:signReport", reportPath),
  },

  // Scheduling operations
  scheduling: {
    getStatus: () => ipcRenderer.invoke("scheduling:getStatus"),
    configure: (scheduleConfig) =>
      ipcRenderer.invoke("scheduling:configure", scheduleConfig),
  },

  // Daemon management operations
  daemon: {
    getStatus: () => ipcRenderer.invoke("daemon:getStatus"),
    start: () => ipcRenderer.invoke("daemon:start"),
    stop: () => ipcRenderer.invoke("daemon:stop"),
    restart: () => ipcRenderer.invoke("daemon:restart"),
    setupSystemService: () => ipcRenderer.invoke("daemon:setupSystemService"),
    removeSystemService: () => ipcRenderer.invoke("daemon:removeSystemService"),
    getSystemServiceStatus: () =>
      ipcRenderer.invoke("daemon:getSystemServiceStatus"),
    configure: (daemonConfig) =>
      ipcRenderer.invoke("daemon:configure", daemonConfig),
    getConfig: () => ipcRenderer.invoke("daemon:getConfig"),
    getLogs: (lines) => ipcRenderer.invoke("daemon:getLogs", lines),
    clearLogs: () => ipcRenderer.invoke("daemon:clearLogs"),
  },

  // Legacy daemon management for backward compatibility
  manageDaemon: async (action, config) => {
    switch (action) {
      case "status":
        return ipcRenderer.invoke("daemon:getStatus");
      case "start":
        return ipcRenderer.invoke("daemon:start");
      case "stop":
        return ipcRenderer.invoke("daemon:stop");
      case "configure":
        return ipcRenderer.invoke("daemon:configure", config);
      default:
        throw new Error(`Unknown daemon action: ${action}`);
    }
  },

  // File system operations
  fs: {
    selectDirectory: () => ipcRenderer.invoke("fs:selectDirectory"),
    selectFile: (filters) => ipcRenderer.invoke("fs:selectFile", filters),
    selectMultipleFiles: (filters) =>
      ipcRenderer.invoke("fs:selectMultipleFiles", filters),
    saveFile: (defaultPath, filters) =>
      ipcRenderer.invoke("fs:saveFile", defaultPath, filters),
  },

  // System operations
  system: {
    openExternal: (url) => ipcRenderer.invoke("system:openExternal", url),
    getDataDirectory: () => ipcRenderer.invoke("system:getDataDirectory"),
    getLogsDirectory: () => ipcRenderer.invoke("system:getLogsDirectory"),
    getReportsDirectory: () => ipcRenderer.invoke("system:getReportsDirectory"),
  },

  // Check if running in Electron environment
  isElectron: () => true,
});

contextBridge.exposeInMainWorld("isElectron", true);
