/**
 * Main background script for Web Automation Recorder
 */

// Global state
const state = {
  recording: false,
  recordingTabId: null,
  recordingStartTime: null,
  currentInstructions: [],
  executingInstruction: false,
  currentExecutor: null,
  executionStartTime: null,
  executionTabId: null,
  nativePort: null,
  settings: {
    nativeMessagingEnabled: true,
    autoSaveRecordings: true,
    defaultTimeout: CONSTANTS.TIMEOUTS.DEFAULT_WAIT
  }
};

// Initialize extension
async function initialize() {
  logger.info('Background', 'Initializing Web Automation Recorder');
  
  // Load settings
  await loadSettings();
  
  // Set up listeners
  setupMessageListeners();
  setupBrowserListeners();
  
  // Initialize native messaging if enabled
  if (state.settings.nativeMessagingEnabled) {
    initializeNativeMessaging();
  }
  
  // Set default icon
  updateIcon(false);
  
  logger.info('Background', 'Initialization complete');
}

// Load settings from storage
async function loadSettings() {
  try {
    // Load both old format and new individual settings
    const stored = await browser.storage.local.get([
      CONSTANTS.STORAGE_KEYS.SETTINGS,
      'logLevel', 
      'autoSaveRecordings', 
      'nativeMessagingEnabled', 
      'defaultTimeout'
    ]);
    
    // Apply old format if exists
    if (stored[CONSTANTS.STORAGE_KEYS.SETTINGS]) {
      Object.assign(state.settings, stored[CONSTANTS.STORAGE_KEYS.SETTINGS]);
    }
    
    // Apply individual settings (these take precedence)
    if (stored.logLevel) {
      logger.setLogLevel(stored.logLevel);
    }
    if (stored.autoSaveRecordings !== undefined) {
      state.settings.autoSaveRecordings = stored.autoSaveRecordings;
    }
    if (stored.nativeMessagingEnabled !== undefined) {
      state.settings.nativeMessagingEnabled = stored.nativeMessagingEnabled;
    }
    if (stored.defaultTimeout !== undefined) {
      state.settings.defaultTimeout = stored.defaultTimeout;
    }
    
    logger.info('Background', 'Settings loaded', state.settings);
  } catch (error) {
    logger.error('Background', 'Failed to load settings', error);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    await browser.storage.local.set({
      [CONSTANTS.STORAGE_KEYS.SETTINGS]: state.settings
    });
  } catch (error) {
    logger.error('Background', 'Failed to save settings', error);
  }
}

// Update browser action icon
function updateIcon(recording, executing = false) {
  try {
    let iconPath, title;
    
    if (executing) {
      // Use different icon/title when executing
      iconPath = {
        16: 'icons/icon-recording-16.png',
        32: 'icons/icon-recording-32.png',
        48: 'icons/icon-recording-48.png',
        128: 'icons/icon-recording-128.png'
      };
      title = 'Executing script... Click to emergency stop';
    } else if (recording) {
      iconPath = {
        16: 'icons/icon-recording-16.png',
        32: 'icons/icon-recording-32.png',
        48: 'icons/icon-recording-48.png',
        128: 'icons/icon-recording-128.png'
      };
      title = 'Recording... Click to stop';
    } else {
      iconPath = {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png'
      };
      title = 'Web Automation Assistant';
    }
    
    browser.browserAction.setIcon({ path: iconPath }).catch(error => {
      logger.error('Background', 'Failed to set icon', error);
    });
    
    browser.browserAction.setTitle({ title });
  } catch (error) {
    logger.error('Background', 'Error updating icon', error);
  }
}

// Set up message listeners
function setupMessageListeners() {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug('Background', 'Received message', { type: message.type, sender: sender.id });
    
    // Handle async responses
    handleMessage(message, sender).then(response => {
      sendResponse(response);
    }).catch(error => {
      logger.error('Background', 'Message handler error', error);
      sendResponse({ success: false, error: error.message });
    });
    
    // Return true to indicate async response
    return true;
  });
}

// Handle incoming messages
async function handleMessage(message, sender) {
  switch (message.type) {
    case CONSTANTS.MESSAGE_TYPES.START_RECORDING:
      return await startRecording(message.data);
      
    case CONSTANTS.MESSAGE_TYPES.STOP_RECORDING:
      return await stopRecording();
      
    case CONSTANTS.MESSAGE_TYPES.PAUSE_RECORDING:
      return await pauseRecording();
      
    case CONSTANTS.MESSAGE_TYPES.RESUME_RECORDING:
      return await resumeRecording();
      
    case CONSTANTS.MESSAGE_TYPES.GET_RECORDING_STATE:
      return getRecordingState();
      
    case CONSTANTS.MESSAGE_TYPES.SAVE_INSTRUCTION:
      return await StorageManager.saveInstruction(message.data);
      
    case CONSTANTS.MESSAGE_TYPES.GET_INSTRUCTION:
      return await StorageManager.getInstruction(message.data.id);
      
    case CONSTANTS.MESSAGE_TYPES.GET_ALL_INSTRUCTIONS:
      return await StorageManager.getAllInstructions();
      
    case CONSTANTS.MESSAGE_TYPES.DELETE_INSTRUCTION:
      return await StorageManager.deleteInstruction(message.data.id);
      
    case CONSTANTS.MESSAGE_TYPES.UPDATE_INSTRUCTION:
      return await StorageManager.updateInstruction(message.data.id, message.data.updates);
      
    case CONSTANTS.MESSAGE_TYPES.EXECUTE_INSTRUCTION:
      return await executeInstruction(message.data);
      
    case CONSTANTS.MESSAGE_TYPES.NATIVE_MESSAGE:
      return await handleNativeMessage(message.data);
      
    case 'IMPORT_INSTRUCTIONS':
      return await handleImportInstructions(message.data);
      
    case 'EXPORT_INSTRUCTIONS':
      return await handleExportInstructions(message.data);
      
    case 'GET_CONNECTION_STATUS':
      return getConnectionStatus();
      
    case 'GET_STORAGE_USAGE':
      return await StorageManager.getStorageUsage();
      
    case 'RECORDING_STEP_ADDED':
      // This is just a notification, no action needed
      logger.debug('Background', 'Recording step added', message);
      return { success: true };
      
    case 'UPDATE_EXECUTION_STATE':
      // Update execution state for monitoring
      if (message.data.status === 'tab_created' && message.data.tabId) {
        state.executionTabId = message.data.tabId;
      }
      logger.debug('Background', 'Execution state updated', message.data);
      return { success: true };
      
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// Set up browser event listeners
function setupBrowserListeners() {
  // Tab events
  browser.tabs.onRemoved.addListener((tabId) => {
    if (tabId === state.recordingTabId && state.recording) {
      stopRecording();
    }
  });
  
  // Web navigation events for recording
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.tabId === state.recordingTabId && details.frameId === 0) {
      handleNavigation(details);
    }
  });
  
  // Browser action click - emergency stop if executing
  browser.browserAction.onClicked.addListener(async () => {
    if (state.executingInstruction) {
      logger.warn('Background', 'Emergency stop triggered');
      await emergencyStopExecution();
    }
  });
  
  // Context menu
  browser.contextMenus.create({
    id: 'record-from-here',
    title: 'Start Recording Here',
    contexts: ['all']
  });
  
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'record-from-here') {
      startRecording({ tabId: tab.id });
    }
  });
  
  // Storage changes - listen for settings updates
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      handleSettingsChange(changes);
    }
  });
}

// Start recording
async function startRecording(options = {}) {
  if (state.recording) {
    return { success: false, error: 'Already recording' };
  }
  
  try {
    // Get active tab if not specified
    let tabId = options.tabId;
    if (!tabId) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      tabId = tabs[0].id;
    }
    
    // Initialize recording state
    state.recording = true;
    state.recordingTabId = tabId;
    state.recordingStartTime = Date.now();
    state.currentInstructions = [];
    
    // Update UI
    updateIcon(true);
    browser.browserAction.setBadgeText({ text: 'REC' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#f44336' });
    
    // Content scripts are already injected via manifest.json
    // Just need to check if the tab is ready
    
    // Send start recording message to content script
    try {
      await browser.tabs.sendMessage(tabId, {
        type: CONSTANTS.MESSAGE_TYPES.START_RECORDING,
        data: options
      });
    } catch (error) {
      logger.warn('Background', 'Failed to send message to content script, tab might not be ready', error);
      // Content script might not be loaded yet - this is ok
    }
    
    // Store recording state
    await browser.storage.local.set({
      [CONSTANTS.STORAGE_KEYS.RECORDING_STATE]: {
        recording: true,
        tabId: tabId,
        startTime: state.recordingStartTime
      }
    });
    
    logger.info('Background', 'Recording started', { tabId });
    
    return { success: true, tabId };
  } catch (error) {
    state.recording = false;
    state.recordingTabId = null;
    updateIcon(false);
    browser.browserAction.setBadgeText({ text: '' });
    logger.error('Background', 'Failed to start recording', error);
    return { success: false, error: error.message };
  }
}

// Stop recording
async function stopRecording() {
  if (!state.recording) {
    return { success: false, error: 'Not recording' };
  }
  
  try {
    // Send stop message to content script
    if (state.recordingTabId) {
      try {
        await browser.tabs.sendMessage(state.recordingTabId, {
          type: CONSTANTS.MESSAGE_TYPES.STOP_RECORDING
        });
      } catch (error) {
        // Tab might be closed
        logger.warn('Background', 'Could not send stop message to tab', error);
      }
    }
    
    // Get recorded steps from content script
    let recordedSteps = [];
    if (state.recordingTabId) {
      try {
        // Add timeout to prevent hanging
        const response = await Promise.race([
          browser.tabs.sendMessage(state.recordingTabId, {
            type: 'GET_RECORDED_STEPS'
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout getting recorded steps')), 5000)
          )
        ]);
        
        if (response && response.success && response.steps) {
          recordedSteps = response.steps;
        }
      } catch (error) {
        logger.warn('Background', 'Could not get recorded steps', error);
      }
    }
    
    // Create instruction object
    const instruction = {
      id: Utils.generateId(),
      name: `Script ${new Date().toLocaleString()}`,
      url: '',
      steps: recordedSteps,
      variables: {},
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0'
    };
    
    // Get URL from tab
    if (state.recordingTabId) {
      try {
        const tab = await browser.tabs.get(state.recordingTabId);
        instruction.url = tab.url;
      } catch (error) {
        logger.warn('Background', 'Could not get tab URL', error);
      }
    }
    
    // Check if there are any steps recorded
    if (recordedSteps.length === 0) {
      logger.info('Background', 'No steps recorded, not saving');
      
      // Reset state
      state.recording = false;
      state.recordingTabId = null;
      state.recordingStartTime = null;
      state.currentInstructions = [];
      
      // Update UI
      updateIcon(false);
      browser.browserAction.setBadgeText({ text: '' });
      
      // Clear recording state from storage
      await browser.storage.local.remove(CONSTANTS.STORAGE_KEYS.RECORDING_STATE);
      
      return { success: true, instruction: null, message: 'No steps recorded' };
    }
    
    // Store the recording temporarily without saving
    await browser.storage.local.set({
      [CONSTANTS.STORAGE_KEYS.LAST_RECORDING]: instruction
    });
    
    // Don't auto-save immediately - let the user review and decide
    logger.info('Background', 'Recording complete, opening editor for review');
    
    // Reset state
    state.recording = false;
    state.recordingTabId = null;
    state.recordingStartTime = null;
    state.currentInstructions = [];
    
    // Update UI
    updateIcon(false);
    browser.browserAction.setBadgeText({ text: '' });
    
    // Clear recording state from storage
    await browser.storage.local.remove(CONSTANTS.STORAGE_KEYS.RECORDING_STATE);
    
    // Open the editor for the user to review and save
    const editUrl = browser.runtime.getURL(
      `src/options/options.html?edit=${instruction.id}&new=true`
    );
    browser.tabs.create({ url: editUrl });
    
    logger.info('Background', 'Recording stopped', { steps: recordedSteps.length });
    
    return { success: true, instruction };
  } catch (error) {
    logger.error('Background', 'Failed to stop recording', error);
    
    // Ensure state is reset even on error
    state.recording = false;
    state.recordingTabId = null;
    state.recordingStartTime = null;
    state.currentInstructions = [];
    updateIcon(false);
    
    // Clear recording state from storage
    await browser.storage.local.remove(CONSTANTS.STORAGE_KEYS.RECORDING_STATE).catch(() => {});
    
    return { success: false, error: error.message };
  }
}

// Pause recording
async function pauseRecording() {
  if (!state.recording) {
    return { success: false, error: 'Not recording' };
  }
  
  try {
    await browser.tabs.sendMessage(state.recordingTabId, {
      type: CONSTANTS.MESSAGE_TYPES.PAUSE_RECORDING
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Background', 'Failed to pause recording', error);
    return { success: false, error: error.message };
  }
}

// Resume recording
async function resumeRecording() {
  if (!state.recording) {
    return { success: false, error: 'Not recording' };
  }
  
  try {
    await browser.tabs.sendMessage(state.recordingTabId, {
      type: CONSTANTS.MESSAGE_TYPES.RESUME_RECORDING
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Background', 'Failed to resume recording', error);
    return { success: false, error: error.message };
  }
}

// Get recording state
function getRecordingState() {
  return {
    recording: state.recording,
    tabId: state.recordingTabId,
    startTime: state.recordingStartTime,
    duration: state.recording ? Date.now() - state.recordingStartTime : 0
  };
}

// Handle navigation during recording
function handleNavigation(details) {
  if (!state.recording || details.tabId !== state.recordingTabId) {
    return;
  }
  
  // Add navigation step
  const navigationStep = {
    action: CONSTANTS.ACTION_TYPES.NAVIGATE,
    url: details.url,
    timestamp: Date.now()
  };
  
  state.currentInstructions.push(navigationStep);
  
  logger.debug('Background', 'Navigation recorded', { url: details.url });
}

// Execute instruction
async function executeInstruction(data) {
  if (state.executingInstruction) {
    return { success: false, error: 'Already executing a script. Please wait for it to complete.' };
  }
  
  let executor = null;
  
  try {
    state.executingInstruction = true;
    state.executionStartTime = Date.now();
    
    // Update UI to show executing
    updateIcon(false, true); // false for not recording, true for executing
    browser.browserAction.setBadgeText({ text: 'RUN' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#ff9800' });
    
    // Get instruction
    let instruction;
    if (data.instructionId) {
      const result = await StorageManager.getInstruction(data.instructionId);
      if (!result.success) {
        throw new Error('Script not found');
      }
      instruction = result.instruction;
    } else if (data.instruction) {
      instruction = data.instruction;
    } else {
      throw new Error('No script provided');
    }
    
    // Execute instruction with a global timeout
    executor = new InstructionExecutor();
    state.currentExecutor = executor;
    
    const GLOBAL_EXECUTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes max
    
    const result = await Promise.race([
      executor.execute(instruction, data.variables),
      new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          logger.error('Background', 'Global execution timeout reached, forcing stop');
          // Force stop the executor
          if (executor) {
            executor.stop();
          }
          reject(new Error('Script execution timeout'));
        }, GLOBAL_EXECUTION_TIMEOUT);
        
        // Store timeout ID for cleanup
        state.currentTimeoutId = timeoutId;
      })
    ]);
    
    return { success: true, result };
  } catch (error) {
    logger.error('Background', 'Failed to execute script', error);
    
    // Try to stop the executor if it exists
    if (executor && typeof executor.stop === 'function') {
      try {
        await executor.stop();
      } catch (stopError) {
        logger.error('Background', 'Failed to stop executor', stopError);
      }
    }
    
    return { success: false, error: error.message };
  } finally {
    // ALWAYS reset the executing state
    state.executingInstruction = false;
    state.currentExecutor = null;
    state.executionStartTime = null;
    state.executionTabId = null;
    
    // Clear any pending timeouts
    if (state.currentTimeoutId) {
      clearTimeout(state.currentTimeoutId);
      state.currentTimeoutId = null;
    }
    
    // Reset UI
    updateIcon(false, false);
    browser.browserAction.setBadgeText({ text: '' });
  }
}

// Handle native messaging
async function handleNativeMessage(data) {
  if (!state.nativePort) {
    return { success: false, error: 'Native messaging not connected' };
  }
  
  try {
    const response = await NativeMessaging.sendMessage(data);
    return { success: true, response };
  } catch (error) {
    logger.error('Background', 'Native messaging error', error);
    return { success: false, error: error.message };
  }
}

// Initialize native messaging
function initializeNativeMessaging() {
  try {
    if (state.settings.nativeMessagingEnabled) {
      NativeMessaging.enable();
      logger.info('Background', 'Native messaging initialized');
    } else {
      NativeMessaging.disable();
      logger.info('Background', 'Native messaging disabled by settings');
    }
  } catch (error) {
    logger.error('Background', 'Failed to initialize native messaging', error);
  }
}

// Handle settings changes
function handleSettingsChange(changes) {
  logger.debug('Background', 'Settings changed', changes);
  
  // Handle log level change - only update if actually changed
  if (changes.logLevel && changes.logLevel.newValue !== logger.logLevel) {
    // Update the logger's log level without saving to storage (to avoid loop)
    logger.logLevel = changes.logLevel.newValue;
    logger.info('Background', 'Log level changed to', changes.logLevel.newValue);
  }
  
  // Handle native messaging enable/disable
  if (changes.nativeMessagingEnabled) {
    state.settings.nativeMessagingEnabled = changes.nativeMessagingEnabled.newValue;
    if (changes.nativeMessagingEnabled.newValue) {
      NativeMessaging.enable();
      logger.info('Background', 'Native messaging enabled');
    } else {
      NativeMessaging.disable();
      logger.info('Background', 'Native messaging disabled');
    }
  }
  
  // Handle other settings
  if (changes.autoSaveRecordings) {
    state.settings.autoSaveRecordings = changes.autoSaveRecordings.newValue;
  }
  
  if (changes.defaultTimeout) {
    state.settings.defaultTimeout = changes.defaultTimeout.newValue;
  }
}

// Cleanup on unload
browser.runtime.onSuspend.addListener(() => {
  logger.info('Background', 'Extension suspending, cleaning up...');
  
  if (state.recording) {
    stopRecording();
  }
  
  if (state.nativePort) {
    NativeMessaging.disconnect();
  }
});

// Handle import instructions
async function handleImportInstructions(data) {
  try {
    const result = await StorageManager.importInstructions(data);
    return { success: true, ...result };
  } catch (error) {
    logger.error('Background', 'Failed to import instructions', error);
    return { success: false, error: error.message };
  }
}

// Handle export instructions
async function handleExportInstructions(data) {
  try {
    const result = await StorageManager.exportInstructions(data?.ids);
    return { success: true, data: result };
  } catch (error) {
    logger.error('Background', 'Failed to export instructions', error);
    return { success: false, error: error.message };
  }
}

// Get connection status
function getConnectionStatus() {
  if (state.nativePort && NativeMessaging) {
    return NativeMessaging.getConnectionStatus();
  }
  return { connected: false };
}

// Emergency stop execution
async function emergencyStopExecution() {
  logger.error('Background', 'EMERGENCY STOP ACTIVATED');
  
  try {
    // Stop the current executor if it exists
    if (state.currentExecutor && typeof state.currentExecutor.stop === 'function') {
      state.currentExecutor.stop();
    }
    
    // Close any execution tabs
    if (state.executionTabId) {
      try {
        await browser.tabs.remove(state.executionTabId);
      } catch (e) {
        // Tab might already be closed
      }
    }
    
    // Send stop message to all tabs
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: 'EMERGENCY_STOP'
        });
      } catch (e) {
        // Ignore errors - tab might not have content script
      }
    }
    
    // Show notification
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Emergency Stop',
      message: 'Script execution has been forcefully stopped'
    });
    
  } finally {
    // Force reset all execution state
    state.executingInstruction = false;
    state.currentExecutor = null;
    state.executionStartTime = null;
    state.executionTabId = null;
    
    // Clear any pending timeouts
    if (state.currentTimeoutId) {
      clearTimeout(state.currentTimeoutId);
      state.currentTimeoutId = null;
    }
    
    // Reset UI
    updateIcon(false, false);
    browser.browserAction.setBadgeText({ text: '' });
  }
}

// Initialize when script loads
initialize();