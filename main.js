const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Maestro Test Manager'
  })

  mainWindow.loadFile('index.html')
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC handlers - all placeholders for now
ipcMain.handle('select-test-directory', async () => {
  console.log('TODO(wire-cli): Implement directory selection')
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Maestro Test Directory'
  })
  return result
})

ipcMain.handle('validate-maestro-project', async (event, dirPath) => {
  console.log('TODO(wire-cli): Validate Maestro project at:', dirPath)
  // Mock validation after delay
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ valid: true, message: 'Valid Maestro project' })
    }, 200)
  })
})

ipcMain.handle('run-headed', async (event, scriptPath, options) => {
  console.log('TODO(wire-cli): Run headed test:', scriptPath, options)
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ success: true, message: 'Test run completed (placeholder)' })
    }, 300)
  })
})

ipcMain.handle('open-maestro-studio', async () => {
  console.log('TODO(wire-cli): Open Maestro Studio')
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ success: true, message: 'Maestro Studio opened (placeholder)' })
    }, 300)
  })
})

