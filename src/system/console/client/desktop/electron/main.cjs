const path = require('node:path')
const { app, BrowserWindow, ipcMain, screen } = require('electron')

const WIDTH = Number(process.env.FLYPC_WIDTH || 390)
const HEIGHT = Number(process.env.FLYPC_HEIGHT || 732)

const isDev = process.env.NODE_ENV === 'development'

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    icon: iconPath,
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

  // Manual drag support — needed on Linux because -webkit-app-region: drag
  // is broken with transparent + GPU-disabled frameless windows.
  ipcMain.on('flypc:drag-move', (_event, { dx, dy }) => {
    const [x, y] = win.getPosition()
    win.setPosition(Math.round(x + dx), Math.round(y + dy))
  })

  // Forward a quick click to whatever is at (x, y) — reaches cross-origin iframe
  // content because sendInputEvent injects at the webContents level.
  ipcMain.handle('flypc:click-at', (event, { x, y }) => {
    const wc = event.sender
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
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
