const { contextBridge, ipcRenderer } = require('electron')

// Bridge for the Star Citizen killfeed settings window.
contextBridge.exposeInMainWorld('killfeed', {
  get: () => ipcRenderer.invoke('killfeed-get'),
  set: patch => ipcRenderer.invoke('killfeed-set', patch),
  pickLog: () => ipcRenderer.invoke('killfeed-pick-log'),
  detect: () => ipcRenderer.invoke('killfeed-detect'),
  test: () => ipcRenderer.invoke('killfeed-test'),
})
