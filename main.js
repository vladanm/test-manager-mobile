const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

// Storage utility functions
function getStoragePath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'settings.json')
}

function loadSettings() {
  try {
    const settingsPath = getStoragePath()
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.log('Error loading settings:', error)
  }
  return {}
}

function saveSettings(settings) {
  try {
    const settingsPath = getStoragePath()
    const userDataPath = path.dirname(settingsPath)
    
    // Ensure userData directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    console.log('Settings saved:', settings)
  } catch (error) {
    console.error('Error saving settings:', error)
  }
}

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

// Function to check if Maestro Studio is already running
async function checkMaestroStudioRunning() {
  const http = require('http')
  
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 9999,
      path: '/interact',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(true) // Server is running
    })
    
    req.on('error', () => {
      resolve(false) // Server is not running
    })
    
    req.on('timeout', () => {
      resolve(false) // Server is not responding
    })
    
    req.end()
  })
}

ipcMain.handle('open-maestro-studio', async (event, workingDir) => {
  console.log('Opening Maestro Studio...')
  const { spawn } = require('child_process')
  const { shell } = require('electron')
  
  try {
    // First check if studio is already running
    const isRunning = await checkMaestroStudioRunning()
    
    if (isRunning) {
      console.log('Maestro Studio is already running')
      // Just open the browser
      shell.openExternal('http://localhost:9999/interact')
      return {
        success: true,
        message: 'Maestro Studio is already running',
        alreadyRunning: true
      }
    }
    
    console.log(`Running: maestro studio in ${workingDir}`)
    
    return new Promise((resolve) => {
      const process = spawn('maestro', ['studio'], {
        cwd: workingDir,
        stdio: ['inherit', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        console.log(`[maestro-studio]: ${output.trim()}`)
        // Send real-time output to renderer
        event.sender.send('maestro-studio-output', output)
      })
      
      process.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        console.error(`[maestro-studio ERROR]: ${output.trim()}`)
        // Send error output to renderer
        event.sender.send('maestro-studio-output', output)
      })
      
      process.on('close', (code) => {
        console.log(`Maestro Studio process exited with code: ${code}`)
        resolve({ 
          success: code === 0, 
          message: code === 0 ? 'Maestro Studio started successfully' : `Maestro Studio failed with exit code ${code}`,
          output: stdout
        })
      })
      
      process.on('error', (error) => {
        console.error(`Maestro Studio process error: ${error.message}`)
        resolve({ 
          success: false, 
          error: `Failed to execute maestro studio: ${error.message}` 
        })
      })
      
      // Open browser after a short delay to let studio start
      setTimeout(() => {
        console.log('Opening Maestro Studio in browser...')
        shell.openExternal('http://localhost:9999/interact')
      }, 3000)
    })
  } catch (error) {
    return { 
      success: false, 
      error: `Error executing maestro studio: ${error.message}` 
    }
  }
})

ipcMain.handle('scan-maestro-tests', async (_, dirPath) => {
  console.log('Scanning for Maestro tests in:', dirPath)
  const fs = require('fs')
  const path = require('path')
  
  try {
    const coreDir = path.join(dirPath, '.maestro', 'flows', 'core')
    
    if (!fs.existsSync(coreDir)) {
      return { tests: [], apkFiles: [], message: 'No .maestro/flows/core directory found' }
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
    
    // Scan for APK files in the workspace root
    const workspaceFiles = fs.readdirSync(dirPath)
    const apkFiles = workspaceFiles
      .filter(file => file.endsWith('.apk'))
      .map(file => {
        const filePath = path.join(dirPath, file)
        const stats = fs.statSync(filePath)
        
        return {
          name: file,
          path: filePath,
          relativePath: file,
          lastModified: stats.mtime.toISOString(),
          size: stats.size
        }
      })
    
    return { 
      tests: testFiles, 
      apkFiles: apkFiles,
      message: `Found ${testFiles.length} test files and ${apkFiles.length} APK files` 
    }
  } catch (error) {
    return { tests: [], apkFiles: [], message: `Error scanning tests: ${error.message}` }
  }
})

ipcMain.handle('emulator-restart', async (event) => {
  console.log('Executing nuclear-restart.sh script...')
  const { spawn } = require('child_process')
  const path = require('path')
  
  try {
    const scriptPath = path.join(__dirname, 'scripts', 'nuclear-restart.sh')
    
    // Check if there's a current workspace with APK files
    let scriptArgs = [scriptPath]
    const settings = loadSettings()
    
    if (settings.workingDirectory && settings.lastApkInstalled) {
      const apkPath = path.join(settings.workingDirectory, settings.lastApkInstalled)
      if (fs.existsSync(apkPath)) {
        console.log(`Found APK for nuclear restart: ${apkPath}`)
        scriptArgs.push(apkPath)
      }
    }
    
    console.log(`Starting nuclear restart with args: ${scriptArgs.join(' ')}`)
    
    return new Promise((resolve) => {
      const process = spawn('bash', scriptArgs, {
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

ipcMain.handle('run-test-e2e', async (event, testName, workingDir) => {
  console.log(`Running test: npm run test:e2e .maestro/flows/core/${testName}`)
  console.log(`Working directory: ${workingDir}`)
  const { spawn } = require('child_process')
  
  try {
    return new Promise((resolve) => {
      const process = spawn('npm', ['run', 'test:e2e', `.maestro/flows/core/${testName}`], {
        cwd: workingDir,
        stdio: ['inherit', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        console.log(`[test-e2e]: ${output.trim()}`)
        // Send real-time output to renderer
        event.sender.send('test-e2e-output', output)
      })
      
      process.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        console.error(`[test-e2e ERROR]: ${output.trim()}`)
        // Send error output to renderer
        event.sender.send('test-e2e-output', output)
      })
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ 
            success: true, 
            message: 'Test completed successfully',
            output: stdout
          })
        } else {
          resolve({ 
            success: false, 
            error: `Test failed with exit code ${code}`,
            output: stderr || stdout
          })
        }
      })
      
      process.on('error', (error) => {
        resolve({ 
          success: false, 
          error: `Failed to execute test: ${error.message}` 
        })
      })
    })
  } catch (error) {
    return { 
      success: false, 
      error: `Error executing test: ${error.message}` 
    }
  }
})

// APK Installation functions
async function checkEmulatorStatus() {
  const { spawn } = require('child_process')
  
  return new Promise((resolve) => {
    const adb = spawn('adb', ['devices'], {
      stdio: ['inherit', 'pipe', 'pipe']
    })
    
    let output = ''
    
    adb.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    adb.on('close', (code) => {
      console.log('ADB devices output:', output)
      // Check if there are any devices connected (more than just the header line)
      const lines = output.split('\n').filter(line => line.trim().length > 0)
      const hasDevices = lines.length > 1 && lines.some(line => line.includes('\tdevice'))
      
      resolve({
        success: code === 0,
        hasDevices: hasDevices,
        output: output
      })
    })
    
    adb.on('error', (error) => {
      console.error('ADB error:', error)
      resolve({
        success: false,
        hasDevices: false,
        output: `ADB error: ${error.message}`
      })
    })
  })
}

async function installApk(apkPath, event) {
  const { spawn } = require('child_process')
  
  console.log(`Installing APK: ${apkPath}`)
  
  return new Promise((resolve) => {
    const adb = spawn('adb', ['install', apkPath], {
      stdio: ['inherit', 'pipe', 'pipe']
    })
    
    let stdout = ''
    let stderr = ''
    
    adb.stdout.on('data', (data) => {
      const output = data.toString()
      stdout += output
      console.log(`[APK Install]: ${output.trim()}`)
      // Send real-time output to renderer
      if (event) {
        event.sender.send('apk-install-output', output)
      }
    })
    
    adb.stderr.on('data', (data) => {
      const output = data.toString()
      stderr += output
      console.error(`[APK Install ERROR]: ${output.trim()}`)
      // Send error output to renderer
      if (event) {
        event.sender.send('apk-install-output', output)
      }
    })
    
    adb.on('close', (code) => {
      const success = code === 0 && stdout.includes('Success')
      
      resolve({
        success: success,
        output: stdout,
        error: stderr,
        exitCode: code
      })
    })
    
    adb.on('error', (error) => {
      resolve({
        success: false,
        output: '',
        error: `Failed to execute adb install: ${error.message}`,
        exitCode: -1
      })
    })
  })
}

ipcMain.handle('install-apk', async (event, apkPath, workingDir) => {
  console.log(`APK installation request: ${apkPath} in ${workingDir}`)
  
  try {
    console.log('Starting APK installation handler...')
    // First check if emulator is running
    const emulatorStatus = await checkEmulatorStatus()
    
    if (!emulatorStatus.success) {
      return {
        success: false,
        error: 'ADB not available or not in PATH',
        output: emulatorStatus.output
      }
    }
    
    if (!emulatorStatus.hasDevices) {
      // No emulator running, start nuclear restart with APK installation
      console.log('No emulator detected, starting nuclear restart with APK installation...')
      event.sender.send('apk-install-output', '🔄 No emulator detected, starting nuclear restart with APK installation...\n')
      
      // Get the full APK path before starting nuclear restart
      const fullApkPath = path.isAbsolute(apkPath) ? apkPath : path.join(workingDir, apkPath)
      console.log(`Full APK path: ${fullApkPath}`)
      
      if (!fs.existsSync(fullApkPath)) {
        console.log(`APK file not found at: ${fullApkPath}`)
        return {
          success: false,
          error: `APK file not found: ${fullApkPath}`,
          output: ''
        }
      }
      
      // Execute nuclear restart with APK file as argument
      const { spawn } = require('child_process')
      const scriptPath = path.join(__dirname, 'scripts', 'nuclear-restart.sh')
      
      const restartPromise = new Promise((resolve) => {
        console.log(`Starting nuclear restart script with APK: ${scriptPath} ${fullApkPath}`)
        const process = spawn('bash', [scriptPath, fullApkPath], {
          stdio: ['pipe', 'pipe', 'pipe']
        })
        
        process.stdout.on('data', (data) => {
          const output = data.toString()
          console.log(`[nuclear-restart]: ${output.trim()}`)
          event.sender.send('apk-install-output', output)
        })
        
        process.stderr.on('data', (data) => {
          const output = data.toString()
          console.error(`[nuclear-restart ERROR]: ${output.trim()}`)
          event.sender.send('apk-install-output', output)
        })
        
        let resolved = false
        
        process.on('close', (code) => {
          if (!resolved) {
            console.log(`Nuclear restart process CLOSE event with code: ${code}`)
            event.sender.send('apk-install-output', `🔧 Nuclear restart completed with exit code: ${code}\n`)
            console.log(`About to resolve promise with success: ${code === 0}`)
            const result = { success: code === 0 }
            console.log(`Resolving with:`, result)
            resolved = true
            resolve(result)
          }
        })
        
        process.on('exit', (code, signal) => {
          console.log(`Nuclear restart process EXIT event: code=${code}, signal=${signal}`)
          // Exit event fires first, but we'll let close event handle resolution
          // If close doesn't fire within reasonable time, resolve here as fallback
          setTimeout(() => {
            if (!resolved) {
              console.log(`FALLBACK: Close event didn't fire, resolving from exit event`)
              event.sender.send('apk-install-output', `🔧 Nuclear restart completed via fallback with exit code: ${code}\n`)
              resolved = true
              resolve({ success: code === 0 })
            }
          }, 1000) // 1 second fallback
        })
        
        process.on('error', (error) => {
          console.log(`Nuclear restart process error: ${error.message}`)
          event.sender.send('apk-install-output', `❌ Nuclear restart error: ${error.message}\n`)
          const result = { success: false, error: error.message }
          console.log(`Resolving with error:`, result)
          resolve(result)
        })
        
        // Add timeout as failsafe
        setTimeout(() => {
          console.log(`Nuclear restart timeout reached (5 minutes)`)
          event.sender.send('apk-install-output', `⏰ Nuclear restart timeout - continuing anyway...\n`)
          resolve({ success: true }) // Assume success if timeout reached
        }, 300000) // 5 minutes
      })
      
      console.log('About to await restart promise...')
      const restartResult = await restartPromise
      console.log('Restart promise completed!')
      
      console.log(`Nuclear restart result:`, restartResult)
      event.sender.send('apk-install-output', `✅ Nuclear restart promise resolved: success=${restartResult.success}\n`)
      
      if (!restartResult.success) {
        console.log('Nuclear restart was not successful, returning error')
        return {
          success: false,
          error: `Nuclear restart failed: ${restartResult.error || 'Unknown error'}`,
          output: ''
        }
      }
      
      // Nuclear restart script will handle APK installation directly
      console.log('Nuclear restart with APK installation completed')
      return restartResult
    }
    
    // Emulator is running, proceed with direct APK installation
    console.log('Emulator is running, proceeding with direct APK installation...')
    event.sender.send('apk-install-output', '🚀 Emulator is running, installing APK...\n')
    
    const fullApkPath = path.isAbsolute(apkPath) ? apkPath : path.join(workingDir, apkPath)
    console.log(`Full APK path: ${fullApkPath}`)
    
    if (!fs.existsSync(fullApkPath)) {
      console.log(`APK file not found at: ${fullApkPath}`)
      return {
        success: false,
        error: `APK file not found: ${fullApkPath}`,
        output: ''
      }
    }
    
    event.sender.send('apk-install-output', `📱 Installing APK: ${path.basename(fullApkPath)}\n`)
    console.log(`Starting APK installation: ${path.basename(fullApkPath)}`)
    
    const installResult = await installApk(fullApkPath, event)
    
    if (installResult.success) {
      event.sender.send('apk-install-output', '✅ APK installation completed successfully\n')
    } else {
      event.sender.send('apk-install-output', `❌ APK installation failed: ${installResult.error}\n`)
    }
    
    return installResult
    
  } catch (error) {
    console.error('Exception in APK installation handler:', error)
    console.error('Stack trace:', error.stack)
    event.sender.send('apk-install-output', `💥 Exception in APK installation: ${error.message}\n`)
    return {
      success: false,
      error: `Error during APK installation: ${error.message}`,
      output: ''
    }
  }
})

// Settings persistence IPC handlers
ipcMain.handle('load-settings', async () => {
  return loadSettings()
})

ipcMain.handle('save-settings', async (event, settings) => {
  saveSettings(settings)
  return true
})

// Test file management
ipcMain.handle('save-test-file', async (event, filePath, content) => {
  console.log(`Saving test file: ${filePath}`)
  
  try {
    // Ensure the directory exists
    const dirPath = path.dirname(filePath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
      console.log(`Created directory: ${dirPath}`)
    }
    
    // Write the test file
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`Test file saved successfully: ${filePath}`)
    
    return {
      success: true,
      message: `Test file saved: ${path.basename(filePath)}`
    }
    
  } catch (error) {
    console.error(`Error saving test file: ${error.message}`)
    return {
      success: false,
      error: `Failed to save test file: ${error.message}`
    }
  }
})

