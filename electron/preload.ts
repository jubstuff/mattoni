import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  exportData: () => ipcRenderer.invoke('export-data'),
  revealDataFolder: () => ipcRenderer.invoke('reveal-data-folder'),
  getVersion: () => ipcRenderer.invoke('get-version'),
});
