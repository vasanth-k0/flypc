const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('flypcDesktop', {
  closeWindow: () => ipcRenderer.invoke('flypc:close-window'),
  setOrientation: (orientation) => ipcRenderer.invoke('flypc:set-orientation', orientation),
  toggleFullScreen: () => ipcRenderer.invoke('flypc:toggle-full-screen')
})
