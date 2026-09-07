const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tabbar', {
  switchTab: name => ipcRenderer.send('tab-switch', name === 'ops' ? 'ops' : 'chat'),
  opsNav: action => ipcRenderer.send('ops-nav', action),
  openUpdate: () => ipcRenderer.send('open-update'),
  win: action => {
    if (action === 'min') ipcRenderer.send('window-minimize')
    else if (action === 'max') ipcRenderer.send('window-maximize')
    else if (action === 'close') ipcRenderer.send('window-close')
  },
  onState: cb => {
    const h = (_e, state) => { try { cb(state) } catch {} }
    ipcRenderer.on('tab-state', h)
    return () => ipcRenderer.removeListener('tab-state', h)
  },
})
