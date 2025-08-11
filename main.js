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
  console.log('Validating Maestro project at:', dirPath)
  const fs = require('fs')
  const path = require('path')
  
  try {
    const maestroDir = path.join(dirPath, '.maestro')
    const flowsDir = path.join(maestroDir, 'flows') 
    const coreDir = path.join(flowsDir, 'core')
    
    // Check if .maestro/flows/core directory exists
    if (!fs.existsSync(coreDir)) {
      return { valid: false, message: 'No .maestro/flows/core directory found' }
    }
    
    return { valid: true, message: 'Valid Maestro project with .maestro/flows/core directory' }
  } catch (error) {
    return { valid: false, message: `Error validating project: ${error.message}` }
  }
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

ipcMain.handle('scan-maestro-tests', async (_, dirPath) => {
  console.log('Scanning for Maestro tests in:', dirPath)
  const fs = require('fs')
  const path = require('path')
  
  try {
    const coreDir = path.join(dirPath, '.maestro', 'flows', 'core')
    
    if (!fs.existsSync(coreDir)) {
      return { tests: [], message: 'No .maestro/flows/core directory found' }
    }
    
    // Read all files in the core directory
    const files = fs.readdirSync(coreDir)
    const testFiles = files
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
      .map(file => {
        const filePath = path.join(coreDir, file)
        const stats = fs.statSync(filePath)
        
        return {
          name: file,
          path: filePath,
          relativePath: path.join('.maestro', 'flows', 'core', file),
          lastModified: stats.mtime.toISOString(),
          size: stats.size
        }
      })
    
    return { 
      tests: testFiles, 
      message: `Found ${testFiles.length} test files in .maestro/flows/core` 
    }
  } catch (error) {
    return { tests: [], message: `Error scanning tests: ${error.message}` }
  }
})

ipcMain.handle('emulator-restart', async (event) => {
  console.log('Executing nuclear-restart.sh script...')
  const { spawn } = require('child_process')
  const path = require('path')
  
  try {
    const scriptPath = path.join(__dirname, 'scripts', 'nuclear-restart.sh')
    
    return new Promise((resolve) => {
      const process = spawn('bash', [scriptPath], {
        stdio: ['inherit', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        console.log(`[nuclear-restart]: ${output.trim()}`)
        // Send real-time output to renderer
        event.sender.send('emulator-restart-output', output)
      })
      
      process.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        console.error(`[nuclear-restart ERROR]: ${output.trim()}`)
        // Send error output to renderer
        event.sender.send('emulator-restart-output', output)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          event.sender.send('emulator-restart-complete', { success: true })
          resolve({ 
            success: true, 
            message: 'Nuclear restart completed successfully',
            output: stdout
          })
        } else {
          event.sender.send('emulator-restart-complete', { success: false, error: `Script exited with code ${code}` })
          resolve({ 
            success: false, 
            error: `Script exited with code ${code}`,
            output: stderr || stdout
          })
        }
      })
      
      process.on('error', (error) => {
        event.sender.send('emulator-restart-complete', { success: false, error: `Failed to execute script: ${error.message}` })
        resolve({ 
          success: false, 
          error: `Failed to execute script: ${error.message}` 
        })
      })
    })
  } catch (error) {
    return { 
      success: false, 
      error: `Error executing nuclear-restart: ${error.message}` 
    }
  }
})

