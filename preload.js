const { contextBridge, ipcRenderer } = require('electron')

// TODO(wire-cli): All these APIs are placeholders that will need real Maestro CLI integration
contextBridge.exposeInMainWorld('electronAPI', {
  // Directory selection and validation
  selectTestDirectory: () => ipcRenderer.invoke('select-test-directory'),
  validateMaestroProject: (path) => ipcRenderer.invoke('validate-maestro-project', path),
  
  // Test scanning
  scanMaestroTests: (path) => ipcRenderer.invoke('scan-maestro-tests', path),
  
  // Test execution (placeholder)
  runHeaded: (scriptPath, options = {}) => ipcRenderer.invoke('run-headed', scriptPath, options),
  
  // Maestro Studio integration (placeholder)  
  openMaestroStudio: () => ipcRenderer.invoke('open-maestro-studio'),
  
  // Emulator restart
  emulatorRestart: () => ipcRenderer.invoke('emulator-restart'),
  
  // Event listeners for streaming output
  onEmulatorRestartOutput: (callback) => ipcRenderer.on('emulator-restart-output', callback),
  onEmulatorRestartComplete: (callback) => ipcRenderer.on('emulator-restart-complete', callback),
  removeEmulatorRestartListeners: () => {
    ipcRenderer.removeAllListeners('emulator-restart-output')
    ipcRenderer.removeAllListeners('emulator-restart-complete')
  },
  
  // Mock data for UI development
  getMockTestScripts: () => Promise.resolve([
    { name: 'login_flow.yaml', path: '/tests/login_flow.yaml', lastModified: '2024-01-15' },
    { name: 'checkout_flow.yaml', path: '/tests/checkout_flow.yaml', lastModified: '2024-01-14' },
    { name: 'navigation_test.yaml', path: '/tests/navigation_test.yaml', lastModified: '2024-01-13' }
  ]),
  
  getMockTestCases: () => Promise.resolve([
    { id: 1, name: 'User Login', status: 'passing', lastRun: '2024-01-15' },
    { id: 2, name: 'Product Checkout', status: 'failing', lastRun: '2024-01-14' },
    { id: 3, name: 'App Navigation', status: 'pending', lastRun: null }
  ])
})