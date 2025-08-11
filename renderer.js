// TODO(wire-cli): All functions here are placeholders for real Maestro CLI integration

// Global state
let currentWorkingDir = null;
let currentEnvironment = 'dev';
let currentUser = '1';
let testFiles = [];
let apkFiles = [];
let saveSettingsTimeout = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Maestro Test Manager loaded');
    
    // Ensure we start on the tests tab
    switchTab('tests');
    
    // Load saved settings
    await loadSavedSettings();
    
    updateUI();
    
    // Add event delegation for test action buttons
    document.addEventListener('click', (event) => {
        const button = event.target;
        if (!button.classList.contains('test-action-btn')) return;
        
        const action = button.dataset.action;
        const testName = button.dataset.test;
        
        // Prevent multiple rapid clicks
        if (button.disabled) return;
        
        switch (action) {
            case 'run-headed':
                runHeaded(testName);
                break;
        }
    });
});

// Settings persistence functions
async function loadSavedSettings() {
    try {
        const settings = await window.electronAPI.loadSettings();
        
        if (settings.workingDirectory) {
            appendToTerminal(`🔄 Restoring workspace...\n`);
            appendToTerminal(`📁 Last directory: ${settings.workingDirectory}\n`);
            appendToTerminal(`🌍 Last environment: ${settings.environment}\n`);
            appendToTerminal(`👤 Last user: USER ${settings.user}\n`);
            if (settings.lastApkInstalled) {
                appendToTerminal(`📱 Last APK: ${settings.lastApkInstalled}\n`);
            }
            
            await setWorkingDirectory(settings.workingDirectory);
        }
        
        if (settings.environment) {
            selectEnvironment(settings.environment);
        }
        
        if (settings.user) {
            selectUser(settings.user);
        }
        
        if (settings.workingDirectory) {
            appendToTerminal(`✅ Workspace restored successfully!\n`, 'success');
            appendToTerminal(`💡 Ready to continue where you left off.\n\n`);
            
            // If there was a previous APK, check if it still exists and install it
            if (settings.lastApkInstalled && currentWorkingDir) {
                const apkExists = apkFiles.some(apk => apk.name === settings.lastApkInstalled);
                if (apkExists) {
                    appendToTerminal(`🔄 Re-installing previous APK: ${settings.lastApkInstalled}\n`, 'info');
                    setTimeout(() => {
                        installApk(settings.lastApkInstalled);
                    }, 2000); // Delay to let workspace load complete
                }
            }
        } else {
            appendToTerminal(`📁 No previous workspace found. Select a directory to get started.\n\n`);
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
        appendToTerminal(`⚠️ Could not restore previous workspace\n`, 'warning');
    }
}

async function saveCurrentSettings() {
    // Clear any existing timeout
    if (saveSettingsTimeout) {
        clearTimeout(saveSettingsTimeout);
    }
    
    // Set a new timeout to save settings after 500ms of inactivity
    saveSettingsTimeout = setTimeout(async () => {
        try {
            const settings = {
                workingDirectory: currentWorkingDir,
                environment: currentEnvironment,
                user: currentUser,
                lastApkInstalled: apkFiles.length > 0 ? apkFiles[0].name : null,
                lastSaved: new Date().toISOString()
            };
            
            await window.electronAPI.saveSettings(settings);
            console.log('Settings saved:', settings);
            
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }, 500);
}

async function setWorkingDirectory(dirPath) {
    appendToTerminal(`📁 Checking directory: ${dirPath}\n`);
    
    try {
        const validation = await window.electronAPI.validateMaestroProject(dirPath);
        
        if (!validation.valid) {
            updateDirectoryStatus(dirPath, false, validation.message || 'Invalid Maestro project');
            appendToTerminal(`❌ Directory validation failed: ${validation.message}\n`, 'error');
            return;
        }
        
        appendToTerminal(`✅ Directory validation passed\n`, 'success');
        currentWorkingDir = dirPath;
        updateDirectoryStatus(dirPath, true, 'Valid Maestro project');
        
        // Load test data
        appendToTerminal(`🔄 Loading test data...\n`);
        await loadTestData();
        
        // Save settings whenever working directory changes
        await saveCurrentSettings();
        
        appendToTerminal(`✅ Working directory set: ${dirPath}\n`, 'success');
        
    } catch (error) {
        currentWorkingDir = null;
        updateDirectoryStatus(dirPath, false, error.message);
        appendToTerminal(`❌ Error setting working directory: ${error.message}\n`, 'error');
        // Ensure UI is updated even on error
        updateUI();
    }
}

// Directory Selection
async function selectDirectory() {
    try {
        const result = await window.electronAPI.selectTestDirectory();
        
        if (!result.canceled && result.filePaths.length > 0) {
            const dirPath = result.filePaths[0];
            await setWorkingDirectory(dirPath);
        }
    } catch (error) {
        appendToTerminal(`❌ Error selecting directory: ${error.message}\n`, 'error');
        showToast('Error selecting directory', 'error');
        console.error('Directory selection error:', error);
    }
}

function updateDirectoryStatus(dirPath, isValid, statusText) {
    document.getElementById('current-dir').textContent = dirPath || 'No directory selected';
    
    const indicator = document.getElementById('dir-status-indicator');
    const text = document.getElementById('dir-status-text');
    
    if (isValid) {
        indicator.className = 'status-indicator status-valid';
        text.textContent = statusText;
        
        // Update workspace status in title bar
        const workspaceName = dirPath ? dirPath.split('/').pop() || dirPath.split('\\').pop() : 'None';
        document.getElementById('workspace-status').textContent = workspaceName;
    } else {
        indicator.className = 'status-indicator status-invalid';
        text.textContent = statusText;
        
        // Update workspace status in title bar
        document.getElementById('workspace-status').textContent = 'Invalid';
    }
    
    updateUI();
}

function clearWorkspace() {
    currentWorkingDir = null;
    currentEnvironment = 'dev';
    currentUser = '1';
    testFiles = [];
    
    updateDirectoryStatus(null, false, 'Select a directory');
    updateTestList();
    updateUI();
    
    // Update workspace status
    document.getElementById('workspace-status').textContent = 'Not loaded';
    
    // Save cleared state
    saveCurrentSettings();
    
    appendToTerminal('🗑️ Workspace cleared\n', 'warning');
    appendToTerminal('📁 Select a directory to get started.\n\n');
}

// Environment and User Selection
function selectEnvironment(env) {
    currentEnvironment = env;
    
    // Update dropdown value
    const envDropdown = document.getElementById('env-dropdown');
    if (envDropdown) {
        envDropdown.value = env;
    }
    
    appendToTerminal(`🌍 Environment changed to: ${env.toUpperCase()}\n`);
    
    // Save settings when environment changes
    saveCurrentSettings();
}

function selectUser(user) {
    currentUser = user;
    
    // Update dropdown value
    const userDropdown = document.getElementById('user-dropdown');
    if (userDropdown) {
        userDropdown.value = user;
    }
    
    appendToTerminal(`👤 User changed to: USER ${user}\n`);
    
    // Save settings when user changes
    saveCurrentSettings();
}

// Maestro Studio
async function openMaestroStudio() {
    if (!currentWorkingDir) {
        appendToTerminal('❌ Please select a working directory first\n', 'error');
        return;
    }
    
    try {
        showToast('Opening Maestro Studio...', 'info');
        // TODO(wire-cli): This should launch: maestro studio
        const result = await window.electronAPI.openMaestroStudio();
        showToast('TODO: open Maestro Studio via CLI', 'info');
        console.log('Maestro Studio result:', result);
    } catch (error) {
        showToast('Error opening Maestro Studio', 'error');
        console.error('Maestro Studio error:', error);
    }
}

async function loadTestData() {
    if (!currentWorkingDir) return;
    
    try {
        const result = await window.electronAPI.scanMaestroTests(currentWorkingDir);
        testFiles = result.tests;
        apkFiles = result.apkFiles || [];
        
        updateTestList();
        appendToTerminal(`✅ ${result.message}\n`, (result.tests.length > 0 || result.apkFiles.length > 0) ? 'success' : 'warning');
        
        // Auto-install APK if found
        if (apkFiles.length > 0) {
            const apkFile = apkFiles[0]; // Install the first APK found
            appendToTerminal(`📱 APK file detected: ${apkFile.name}\n`, 'info');
            await installApk(apkFile.name);
        }
        
    } catch (error) {
        appendToTerminal(`❌ Error loading test data: ${error.message}\n`, 'error');
    }
}

// Test Management
function updateTestList() {
    const container = document.getElementById('test-items');
    
    if (!container) {
        appendToTerminal(`❌ Error: test-items container not found\n`, 'error');
        return;
    }
    
    if (testFiles.length === 0) {
        const message = currentWorkingDir ? 
            "No test files found in .maestro/flows/core/. Add Maestro YAML files to this directory to get started!" :
            "No directory selected. Select a directory containing .maestro/flows/core/ to see tests.";
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #6b7280;">
                ${message}
            </div>
        `;
        return;
    }
    
    container.innerHTML = testFiles.map(test => {
        return `
            <div class="test-item">
                <div class="test-name">
                    🎬 ${test.name}
                </div>
                <div class="test-status">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
                    Ready
                </div>
                <div style="font-size: 12px; color: #6b7280;">
                    ${formatDate(test.lastModified)}
                </div>
                <div class="test-actions">
                    <button class="test-action-btn headed-btn" data-action="run-headed" data-test="${test.name}">👁 RUN TEST</button>
                </div>
            </div>
        `;
    }).join('');
}

// Run Test
async function runHeaded(testName) {
    if (!currentWorkingDir) {
        appendToTerminal('❌ Please select a working directory first\n', 'error');
        return;
    }
    
    try {
        showToast('Running test...', 'info');
        appendToTerminal(`🧪 Running test: ${testName}\n`, 'info');
        appendToTerminal(`📁 Working directory: ${currentWorkingDir}\n`);
        appendToTerminal(`🚀 Command: npm run test:e2e .maestro/flows/core/${testName}\n\n`);
        
        // Set up event listeners for streaming output
        window.electronAPI.onTestE2EOutput((event, output) => {
            appendToTerminal(output);
        });
        
        const result = await window.electronAPI.runTestE2E(testName, currentWorkingDir);
        
        // Clean up event listeners
        window.electronAPI.removeTestE2EListeners();
        
        if (result.success) {
            appendToTerminal(`✅ Test completed successfully\n`, 'success');
            showToast('Test completed successfully!', 'success');
        } else {
            appendToTerminal(`❌ Test failed: ${result.error}\n`, 'error');
            showToast('Test failed', 'error');
        }
        
    } catch (error) {
        appendToTerminal(`❌ Error running test: ${error.message}\n`, 'error');
        showToast('Error running test', 'error');
        console.error('Run test error:', error);
        
        // Clean up event listeners in case of error
        window.electronAPI.removeTestE2EListeners();
    }
}

// APK Installation
async function installApk(apkFileName) {
    if (!currentWorkingDir) {
        appendToTerminal('❌ Please select a working directory first\n', 'error');
        return;
    }
    
    try {
        showToast('Installing APK...', 'info');
        appendToTerminal(`📱 Starting APK installation: ${apkFileName}\n`, 'info');
        
        // Set up event listeners for streaming output
        window.electronAPI.onApkInstallOutput((event, output) => {
            appendToTerminal(output);
        });
        
        const result = await window.electronAPI.installApk(apkFileName, currentWorkingDir);
        
        // Clean up event listeners
        window.electronAPI.removeApkInstallListeners();
        
        if (result.success) {
            appendToTerminal(`✅ APK installation completed successfully\n`, 'success');
            showToast('APK installed successfully!', 'success');
        } else {
            appendToTerminal(`❌ APK installation failed: ${result.error}\n`, 'error');
            showToast('APK installation failed', 'error');
        }
        
    } catch (error) {
        appendToTerminal(`❌ Error during APK installation: ${error.message}\n`, 'error');
        showToast('Error installing APK', 'error');
        console.error('APK installation error:', error);
        
        // Clean up event listeners in case of error
        window.electronAPI.removeApkInstallListeners();
    }
}

// Tab switching functionality
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeTabButton = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (activeTabButton) {
        activeTabButton.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content-right').forEach(content => {
        content.classList.remove('active');
    });
    
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Load specific content when switching tabs
    if (tabName === 'cases') {
        loadTestCases();
    }
    
    appendToTerminal(`📑 Switched to ${tabName} tab\n`);
}

// Load test cases - placeholder
async function loadTestCases() {
    try {
        // TODO(wire-cli): Replace with real test case data from Maestro
        const cases = await window.electronAPI.getMockTestCases();
        
        const casesContainer = document.getElementById('test-cases-items');
        
        if (cases.length === 0) {
            casesContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No Test Cases Found</h3>
                    <p>Test cases will appear here once Maestro tests are created and run.</p>
                </div>
            `;
            return;
        }
        
        casesContainer.innerHTML = cases.map(testCase => {
            const envClass = 'dev'; // Default for now
            
            return `
                <div class="test-case-item">
                    <div class="test-case-name">
                        🎬 ${testCase.name}
                    </div>
                    <div>
                        <span class="test-case-env ${envClass}">dev</span>
                    </div>
                    <div class="test-case-user">
                        👤 User 1
                    </div>
                    <div>
                        <span style="color: #6b7280; font-size: 12px;">N/A</span>
                    </div>
                    <div class="test-case-length">
                        Mock data
                    </div>
                    <div style="font-size: 12px; color: #6b7280;">
                        Just now
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        appendToTerminal(`❌ Error loading test cases: ${error.message}\n`, 'error');
    }
}

// Utility buttons - placeholders
async function createMissingMappings() {
    showToast('TODO: create missing mappings', 'info');
    appendToTerminal('🔗 TODO(wire-cli): Implement mapping creation logic\n');
}

async function showMappingStats() {
    showToast('TODO: show mapping stats', 'info');
    appendToTerminal('📊 TODO(wire-cli): Implement mapping statistics\n');
}

async function refreshTestCases() {
    showToast('Refreshing test cases...', 'info');
    await loadTestCases();
    showToast('Test cases refreshed', 'success');
}

// Database status - placeholder
async function showDatabaseStatus() {
    appendToTerminal('📊 TODO(wire-cli): Show database status and reports\n');
    showToast('TODO: show database status', 'info');
}

// Emulator restart
async function emulatorRestart() {
    try {
        showToast('Restarting emulator...', 'info');
        appendToTerminal('🔄 Starting nuclear restart process...\n', 'info');
        
        // Set up event listeners for streaming output
        window.electronAPI.onEmulatorRestartOutput((event, output) => {
            appendToTerminal(output);
        });
        
        window.electronAPI.onEmulatorRestartComplete((event, result) => {
            if (result.success) {
                appendToTerminal('\n✅ Emulator restart completed successfully\n', 'success');
                showToast('Emulator restarted successfully!', 'success');
            } else {
                appendToTerminal(`\n❌ Emulator restart failed: ${result.error}\n`, 'error');
                showToast('Emulator restart failed', 'error');
            }
            
            // Clean up event listeners
            window.electronAPI.removeEmulatorRestartListeners();
        });
        
        // Start the process
        await window.electronAPI.emulatorRestart();
        
    } catch (error) {
        appendToTerminal(`❌ Error during emulator restart: ${error.message}\n`, 'error');
        showToast('Error restarting emulator', 'error');
        console.error('Emulator restart error:', error);
        
        // Clean up event listeners in case of error
        window.electronAPI.removeEmulatorRestartListeners();
    }
}

// Terminal Functions
function appendToTerminal(text, type = 'normal') {
    const terminal = document.getElementById('terminal-output');
    
    if (!terminal) {
        console.log(`[TERMINAL ${type.toUpperCase()}]`, text);
        return;
    }
    
    let colorClass = '';
    if (type === 'success') colorClass = 'success-text';
    else if (type === 'error') colorClass = 'error-text';
    else if (type === 'warning') colorClass = 'warning-text';
    
    const span = document.createElement('span');
    span.className = colorClass;
    span.textContent = text;
    
    terminal.appendChild(span);
    terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
    const terminal = document.getElementById('terminal-output');
    if (terminal) {
        terminal.innerHTML = '';
        appendToTerminal('Terminal cleared.\n');
    }
}

function copyTerminal() {
    const terminal = document.getElementById('terminal-output');
    if (terminal) {
        const text = terminal.textContent;
        navigator.clipboard.writeText(text);
        appendToTerminal('📋 Terminal output copied to clipboard\n');
    }
}

function toggleTerminal() {
    const terminalSection = document.querySelector('.terminal-section');
    const toggleBtn = document.getElementById('terminal-toggle-btn');
    const mainLayout = document.querySelector('.main-layout');
    
    if (terminalSection && toggleBtn) {
        terminalSection.classList.toggle('minimized');
        
        // Update button text and layout height based on state
        if (terminalSection.classList.contains('minimized')) {
            toggleBtn.textContent = '▲';
            if (mainLayout) {
                mainLayout.style.height = 'calc(100vh - 240px - 44px)';
            }
        } else {
            toggleBtn.textContent = '▼';
            if (mainLayout) {
                mainLayout.style.height = 'calc(100vh - 240px - 300px)';
            }
        }
    }
}

// Update UI state
function updateUI() {
    const hasWorkingDir = !!currentWorkingDir;
    
    // Enable/disable buttons based on working directory
    document.getElementById('open-studio-btn').disabled = !hasWorkingDir;
    
    if (hasWorkingDir) {
        // Force update test list when UI updates
        updateTestList();
    } else {
        // Clear test list when no working directory
        const container = document.getElementById('test-items');
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #6b7280;">
                    No directory selected. Select a directory to see tests.
                </div>
            `;
        }
    }
}

// Toast notifications
function showToast(message, type = 'success') {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    
    // Set message and type
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#dc3545' : 
                            type === 'info' ? '#17a2b8' : '#28a745';
    
    // Show toast
    toast.style.transform = 'translateX(0)';
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
    }, 3000);
}

// Utility functions
function formatDate(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hrs ago`;
    return new Date(date).toLocaleDateString();
}

// Initialize with welcome message
document.addEventListener('DOMContentLoaded', () => {
    appendToTerminal('🎬 Maestro Test Manager loaded\n', 'success');
    appendToTerminal('📁 Select a directory containing Maestro YAML files to get started.\n\n');
});

// Export functions for global access
window.selectDirectory = selectDirectory;
window.clearWorkspace = clearWorkspace;
window.selectEnvironment = selectEnvironment;
window.selectUser = selectUser;
window.openMaestroStudio = openMaestroStudio;
window.runHeaded = runHeaded;
window.clearTerminal = clearTerminal;
window.copyTerminal = copyTerminal;
window.toggleTerminal = toggleTerminal;
window.showDatabaseStatus = showDatabaseStatus;
window.switchTab = switchTab;
window.refreshTestCases = refreshTestCases;
window.createMissingMappings = createMissingMappings;
window.showMappingStats = showMappingStats;
window.emulatorRestart = emulatorRestart;
window.installApk = installApk;