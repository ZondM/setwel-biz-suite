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
  // Trial / licence status, server calls and opening website links (see app-src/src/core/licence.ts and api.ts)
  licence: () => ipcRenderer.invoke('licence:status'),
  apiPost: (path, body) => ipcRenderer.invoke('api:post', path, body),
  setTeamToken: (token) => ipcRenderer.invoke('licence:setTeamToken', token),
  showLicence: () => ipcRenderer.invoke('licence:show'),
  onLicenceChanged: (callback) => ipcRenderer.on('licence:changed', () => callback()),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
});
