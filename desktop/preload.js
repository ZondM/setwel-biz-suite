// Bridge the app already expects (window.setwelDesktop): load/save the data file and save exports.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setwelDesktop', {
  isElectron: true,
  loadDatabase: async () => {
    const bytes = await ipcRenderer.invoke('db:load');
    return bytes ? new Uint8Array(bytes) : null;
  },
  saveDatabase: (bytes) => ipcRenderer.invoke('db:save', bytes),
  saveFile: (name, data, isString) => ipcRenderer.invoke('file:save', name, data, isString),
});
