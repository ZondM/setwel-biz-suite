const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gate', {
  status: () => ipcRenderer.invoke('licence:status'),
  activate: (key) => ipcRenderer.invoke('licence:activate', key),
  continueTrial: () => ipcRenderer.invoke('licence:continue'),
  pricing: () => ipcRenderer.invoke('open:pricing'),
  whatsapp: () => ipcRenderer.invoke('open:whatsapp'),
});
