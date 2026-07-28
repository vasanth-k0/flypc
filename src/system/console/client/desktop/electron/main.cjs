const path = require('node:path')
const { app, BrowserWindow, ipcMain } = require('electron')

const WIDTH = Number(process.env.FLYPC_WIDTH || 390)
const HEIGHT = Number(process.env.FLYPC_HEIGHT || 732)

const isDev = process.env.NODE_ENV === 'development'

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')

function createWindow() {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5174')
  } else {
    win.loadFile(path.resolve(__dirname, '..', 'dist', 'index.html'))
  }

  ipcMain.handle('flypc:close-window', () => {
    win.close()
  })

  ipcMain.handle('flypc:set-orientation', (_event, orientation) => {
    if (orientation === 'landscape') {
      win.setSize(HEIGHT * 2, WIDTH * 2)
      return
    }

    win.setSize(WIDTH, HEIGHT)
  })

  ipcMain.handle('flypc:toggle-full-screen', () => {
    const nextValue = !win.isFullScreen()
    win.setFullScreen(nextValue)
    return nextValue
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
