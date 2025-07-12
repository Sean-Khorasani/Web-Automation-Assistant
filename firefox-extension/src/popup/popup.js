/**
 * Popup script for Web Automation Recorder
 */

// State
const popupState = {
  recording: false,
  recordingStartTime: null,
  timerInterval: null
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Popup', 'Initializing popup');
  
  // Set up event listeners
  setupEventListeners();
  
  // Check recording state
  await checkRecordingState();
  
  // Load recent scripts
  await loadRecentInstructions();
  
  // Check native messaging connection
  await checkConnectionStatus();
});

// Set up event listeners
function setupEventListeners() {
  // Recording controls
  document.getElementById('recordButton').addEventListener('click', startRecording);
  document.getElementById('pauseButton').addEventListener('click', handlePauseClick);
  document.getElementById('stopButton').addEventListener('click', stopRecording);
  // Remove quickStopButton listener as it doesn't exist in HTML
  
  // Quick actions
  document.getElementById('manageButton').addEventListener('click', openOptionsPage);
  document.getElementById('importButton').addEventListener('click', importInstructions);
  document.getElementById('exportButton').addEventListener('click', exportInstructions);
  
  // Settings
  document.getElementById('settingsButton').addEventListener('click', openOptionsPage);
  
  // File import
  document.getElementById('importFile').addEventListener('change', handleFileImport);
  
  // Event delegation for dynamically created buttons
  document.getElementById('recentInstructions').addEventListener('click', handleInstructionClick);
}

// Handle pause/resume button clicks
function handlePauseClick() {
  const pauseButton = document.getElementById('pauseButton');
  const isPaused = pauseButton.dataset.paused === 'true';
  
  if (isPaused) {
    resumeRecording();
  } else {
    pauseRecording();
  }
}

// Check current recording state
async function checkRecordingState() {
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.GET_RECORDING_STATE
    });
    
    if (response.recording) {
      popupState.recording = true;
      popupState.recordingStartTime = response.startTime;
      updateRecordingUI(true);
      startTimer();
      
      // Also update step count if available
      if (response.stepCount !== undefined) {
        document.getElementById('stepCount').textContent = response.stepCount;
      }
    } else {
      updateRecordingUI(false);
    }
  } catch (error) {
    logger.error('Popup', 'Failed to check recording state', error);
  }
}

// Start recording
async function startRecording() {
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.START_RECORDING
    });
    
    if (response.success) {
      popupState.recording = true;
      popupState.recordingStartTime = Date.now();
      showNotification('Recording started', 'success');
      // Close popup after starting recording
      window.close();
    } else {
      showNotification(response.error || 'Failed to start recording', 'error');
    }
  } catch (error) {
    logger.error('Popup', 'Failed to start recording', error);
    showNotification('Error starting recording', 'error');
  }
}

// Pause recording
async function pauseRecording() {
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.PAUSE_RECORDING
    });
    
    if (response.success) {
      const pauseButton = document.getElementById('pauseButton');
      pauseButton.textContent = '▶️ Resume';
      pauseButton.dataset.paused = 'true';
      showNotification('Recording paused', 'info');
      // Keep popup open when paused so user can resume or stop
    }
  } catch (error) {
    logger.error('Popup', 'Failed to pause recording', error);
  }
}

// Resume recording
async function resumeRecording() {
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.RESUME_RECORDING
    });
    
    if (response.success) {
      const pauseButton = document.getElementById('pauseButton');
      pauseButton.textContent = '⏸ Pause';
      pauseButton.dataset.paused = 'false';
      showNotification('Recording resumed', 'info');
      // Keep popup open when resumed so user can pause or stop
    }
  } catch (error) {
    logger.error('Popup', 'Failed to resume recording', error);
  }
}

// Stop recording
async function stopRecording() {
  try {
    // Show stopping message
    showNotification('Stopping recording...', 'info');
    
    // Add timeout to prevent hanging
    const response = await Promise.race([
      browser.runtime.sendMessage({
        type: CONSTANTS.MESSAGE_TYPES.STOP_RECORDING
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout stopping recording')), 10000)
      )
    ]);
    
    if (response && response.success) {
      popupState.recording = false;
      stopTimer();
      updateRecordingUI(false);
      
      if (response.instruction) {
        showNotification(`Recording complete: ${response.instruction.steps.length} steps`, 'success');
        
        // Reload recent instructions
        await loadRecentInstructions();
        
        // Open the editor for the user to review and save
        const editUrl = browser.runtime.getURL(
          `src/options/options.html?edit=${response.instruction.id}&new=true`
        );
        browser.tabs.create({ url: editUrl });
      } else {
        // No steps recorded
        showNotification('No steps recorded', 'info');
      }
      
      // Close popup after stopping recording
      window.close();
    } else {
      showNotification(response?.error || 'Failed to stop recording', 'error');
      
      // Force reset UI if communication failed
      popupState.recording = false;
      stopTimer();
      updateRecordingUI(false);
      
      // Still close popup even on error
      setTimeout(() => window.close(), 1000);
    }
  } catch (error) {
    logger.error('Popup', 'Failed to stop recording', error);
    showNotification('Communication error - recording might still be saved', 'error');
    
    // Force reset UI
    popupState.recording = false;
    stopTimer();
    updateRecordingUI(false);
    
    // Still close popup even on error
    setTimeout(() => window.close(), 1000);
  }
}

// Update UI based on recording state
function updateRecordingUI(recording) {
  document.body.classList.toggle('recording', recording);
  
  if (recording) {
    document.getElementById('recordingActive').style.display = 'block';
    document.getElementById('recordingActions').style.display = 'flex';
    document.getElementById('recordButton').style.display = 'none';
  } else {
    document.getElementById('recordingActive').style.display = 'none';
    document.getElementById('recordingActions').style.display = 'none';
    document.getElementById('recordButton').style.display = 'flex';
    document.getElementById('recordingTimer').textContent = '00:00';
    document.getElementById('stepCount').textContent = '0';
  }
}

// Timer functions
function startTimer() {
  stopTimer(); // Clear any existing timer
  
  // Cache the timer element to avoid repeated DOM queries
  const timerElement = document.getElementById('recordingTimer');
  
  popupState.timerInterval = setInterval(() => {
    const elapsed = Date.now() - popupState.recordingStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    // Only update if the element still exists
    if (timerElement) {
      timerElement.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

function stopTimer() {
  if (popupState.timerInterval) {
    clearInterval(popupState.timerInterval);
    popupState.timerInterval = null;
  }
}

// Load recent scripts
async function loadRecentInstructions() {
  const container = document.getElementById('recentInstructions');
  logger.info('Popup', 'Loading recent scripts...');
  
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.GET_ALL_INSTRUCTIONS
    });
    
    logger.info('Popup', 'Instructions response:', response);
    
    if (response && response.success && response.instructions && response.instructions.length > 0) {
      // Sort by modified date and take top 5
      const recent = response.instructions
        .sort((a, b) => new Date(b.modified) - new Date(a.modified))
        .slice(0, 5);
      
      container.innerHTML = recent.map(instruction => `
        <div class="instruction-item" data-id="${instruction.id}">
          <div class="instruction-name">${Utils.escapeHtml(instruction.name)}</div>
          <div class="instruction-meta">
            <span class="instruction-url">${Utils.escapeHtml(instruction.url || 'Any page')}</span>
            <span class="instruction-steps">${instruction.steps.length} steps</span>
          </div>
          <div class="instruction-actions">
            <button class="btn btn-primary btn-sm run-instruction" data-instruction-id="${instruction.id}">
              ▶️ Run
            </button>
            <button class="btn btn-secondary btn-sm edit-instruction" data-instruction-id="${instruction.id}">
              ✏️ Edit
            </button>
          </div>
        </div>
      `).join('');
    } else {
      // Show empty state for any case where there are no instructions
      logger.info('Popup', 'No instructions found, showing empty state');
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No scripts yet</div>
          <div class="empty-state-subtext">Click "Start Recording" to create your first automation</div>
        </div>
      `;
    }
  } catch (error) {
    logger.error('Popup', 'Failed to load instructions', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Failed to load instructions</div>
        <div class="empty-state-subtext">Please try again later</div>
      </div>
    `;
  }
}

// Handle clicks on instruction buttons via event delegation
function handleInstructionClick(event) {
  // Use closest to find the button even if a child element was clicked
  const runButton = event.target.closest('.run-instruction');
  const editButton = event.target.closest('.edit-instruction');
  
  if (runButton) {
    const instructionId = runButton.dataset.instructionId;
    runInstruction(instructionId);
  } else if (editButton) {
    const instructionId = editButton.dataset.instructionId;
    editInstruction(instructionId);
  }
}

// Run script
async function runInstruction(id) {
  try {
    // Show running notification immediately
    showNotification('Starting script execution...', 'info');
    
    // Find and disable the button to prevent double clicks
    const buttons = document.querySelectorAll(`[data-instruction-id="${id}"]`);
    buttons.forEach(btn => {
      if (btn.classList.contains('run-instruction')) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Running...';
      }
    });
    
    // Send message without waiting for response
    browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_INSTRUCTION,
      data: {
        instructionId: id
      }
    }).catch(error => {
      // Log error but don't handle it since popup is closing
      logger.error('Popup', 'Failed to start script execution', error);
    });
    
    // Close popup immediately
    setTimeout(() => window.close(), 100);
    
  } catch (error) {
    logger.error('Popup', 'Failed to run script', error);
    showNotification('Error running script', 'error');
    // Re-enable buttons on error
    const buttons = document.querySelectorAll(`[data-instruction-id="${id}"]`);
    buttons.forEach(btn => {
      if (btn.classList.contains('run-instruction')) {
        btn.disabled = false;
        btn.innerHTML = '▶️ Run';
      }
    });
  }
}

// Edit script
function editInstruction(id) {
  const editUrl = browser.runtime.getURL(
    `src/options/options.html?edit=${id}`
  );
  browser.tabs.create({ url: editUrl });
  window.close();
}

// Open options page
function openOptionsPage() {
  browser.runtime.openOptionsPage();
  window.close();
}

// Import scripts
function importInstructions() {
  // Open options page with import action
  const importUrl = browser.runtime.getURL(
    'src/options/options.html?action=import'
  );
  browser.tabs.create({ url: importUrl });
  window.close();
}

// Handle file import
async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    const response = await browser.runtime.sendMessage({
      type: 'IMPORT_INSTRUCTIONS',
      data: data
    });
    
    if (response.success) {
      showNotification(`Imported ${response.imported} scripts`, 'success');
      await loadRecentInstructions();
      // Close popup after successful import
      setTimeout(() => window.close(), 1000);
    } else {
      showNotification(response.error || 'Import failed', 'error');
    }
  } catch (error) {
    logger.error('Popup', 'Failed to import file', error);
    showNotification('Invalid file format', 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

// Export scripts
async function exportInstructions() {
  try {
    // Check if there are any instructions to export
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.GET_ALL_INSTRUCTIONS
    });
    
    if (response.success && response.instructions && response.instructions.length > 0) {
      // Open options page with export action
      const exportUrl = browser.runtime.getURL(
        'src/options/options.html?action=export'
      );
      browser.tabs.create({ url: exportUrl });
      window.close();
    } else {
      // No scripts to export
      showNotification('No scripts to export. Record some first!', 'info');
    }
  } catch (error) {
    logger.error('Popup', 'Failed to check scripts for export', error);
    showNotification('Error checking scripts', 'error');
  }
}

// Check native messaging connection
async function checkConnectionStatus() {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'GET_CONNECTION_STATUS'
    });
    
    updateConnectionStatus(response && response.connected);
  } catch (error) {
    updateConnectionStatus(false);
  }
}

// Update connection status UI
function updateConnectionStatus(connected) {
  const indicator = document.getElementById('statusIndicator');
  const text = document.getElementById('statusText');
  
  if (connected) {
    indicator.classList.add('connected');
    indicator.classList.remove('disconnected');
    text.textContent = 'Connected';
  } else {
    indicator.classList.remove('connected');
    indicator.classList.add('disconnected');
    text.textContent = 'Disconnected';
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Add to body
  document.body.appendChild(notification);
  
  // Show notification
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Listen for updates from background
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RECORDING_STEP_ADDED') {
    document.getElementById('stepCount').textContent = message.totalSteps;
  } else if (message.type === CONSTANTS.MESSAGE_TYPES.UPDATE_POPUP) {
    if (message.data.recording !== undefined) {
      popupState.recording = message.data.recording;
      updateRecordingUI(message.data.recording);
      
      if (!message.data.recording) {
        stopTimer();
      }
    }
  }
});

// Clean up on unload
window.addEventListener('unload', () => {
  stopTimer();
});