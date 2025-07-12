/**
 * Main content script for Web Automation Recorder
 */

// Global state
const contentState = {
  recording: false,
  paused: false,
  recorder: null,
  actionPerformer: null,
  highlightedElements: [],
  processedMessages: new Set(), // Track processed message IDs
  messageCleanupInterval: null,
  currentStep: null // Track current executing step
};

// Initialize content script
function initializeContentScript() {
  logger.info('Content', 'Initializing content script');
  
  // Create instances
  contentState.recorder = new Recorder();
  
  // Use SafeActionPerformer if available, fallback to regular
  if (typeof SafeActionPerformer !== 'undefined') {
    contentState.actionPerformer = new SafeActionPerformer();
    logger.info('Content', 'Using SafeActionPerformer');
  } else {
    contentState.actionPerformer = new ActionPerformer();
    logger.warn('Content', 'Using regular ActionPerformer');
  }
  
  // Set up message listener
  browser.runtime.onMessage.addListener(handleMessage);
  
  // Clean up any existing highlights
  clearAllHighlights();
  
  logger.info('Content', 'Content script initialized');
}

// Handle messages from background script
function handleMessage(message, sender, sendResponse) {
  logger.debug('Content', 'Received message', { type: message.type });
  
  // Check for duplicate messages
  if (message.messageId) {
    if (contentState.processedMessages.has(message.messageId)) {
      logger.warn('Content', 'Ignoring duplicate message', { messageId: message.messageId });
      sendResponse({ success: false, error: 'Duplicate message' });
      return true;
    }
    
    // Add to processed messages
    contentState.processedMessages.add(message.messageId);
    
    // Clean up old message IDs after 1 minute
    setTimeout(() => {
      contentState.processedMessages.delete(message.messageId);
    }, 60000);
  }
  
  // Handle async operations properly
  (async () => {
    try {
      let response;
      
      switch (message.type) {
        case CONSTANTS.MESSAGE_TYPES.START_RECORDING:
          response = startRecording(message.data);
          break;
          
        case CONSTANTS.MESSAGE_TYPES.STOP_RECORDING:
          response = stopRecording();
          break;
          
        case CONSTANTS.MESSAGE_TYPES.PAUSE_RECORDING:
          response = pauseRecording();
          break;
          
        case CONSTANTS.MESSAGE_TYPES.RESUME_RECORDING:
          response = resumeRecording();
          break;
          
        case 'GET_RECORDED_STEPS':
          response = getRecordedSteps();
          break;
          
        case CONSTANTS.MESSAGE_TYPES.EXECUTE_STEP:
          response = await executeStep(message.step);
          break;
          
        case 'CHECK_ELEMENT':
          response = checkElement(message.selector, message.selectorStrategy);
          break;
          
        case CONSTANTS.MESSAGE_TYPES.HIGHLIGHT_ELEMENT:
          response = highlightElement(message.selector, message.duration);
          break;
          
        case CONSTANTS.MESSAGE_TYPES.CLEAR_HIGHLIGHTS:
          response = clearAllHighlights();
          break;
          
        case 'EMERGENCY_STOP':
          // Stop any ongoing operations
          if (contentState.recorder && contentState.recorder.recording) {
            contentState.recorder.stop();
          }
          if (contentState.actionPerformer && contentState.actionPerformer.executing) {
            contentState.actionPerformer.executing = false;
            contentState.actionPerformer.currentAction = null;
          }
          logger.warn('Content', 'Emergency stop received');
          response = { success: true };
          break;
          
        case 'PING':
          // Simple ping to check if content script is ready
          response = { success: true, ready: true };
          break;
          
        default:
          response = { success: false, error: `Unknown message type: ${message.type}` };
      }
      
      sendResponse(response);
    } catch (error) {
      logger.error('Content', 'Message handler error', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  // Return true to indicate async response
  return true;
}

// Start recording
function startRecording(options = {}) {
  if (contentState.recording) {
    return { success: false, error: 'Already recording' };
  }
  
  contentState.recording = true;
  contentState.paused = false;
  contentState.recorder.start(options);
  
  // Add visual indicator
  addRecordingIndicator();
  
  logger.info('Content', 'Recording started');
  
  return { success: true };
}

// Stop recording
function stopRecording() {
  if (!contentState.recording) {
    return { success: false, error: 'Not recording' };
  }
  
  const steps = contentState.recorder.stop();
  contentState.recording = false;
  contentState.paused = false;
  
  // Remove visual indicator
  removeRecordingIndicator();
  
  logger.info('Content', 'Recording stopped', { steps: steps.length });
  
  return { success: true, steps };
}

// Pause recording
function pauseRecording() {
  if (!contentState.recording || contentState.paused) {
    return { success: false, error: 'Cannot pause' };
  }
  
  contentState.paused = true;
  contentState.recorder.pause();
  
  updateRecordingIndicator('paused');
  
  return { success: true };
}

// Resume recording
function resumeRecording() {
  if (!contentState.recording || !contentState.paused) {
    return { success: false, error: 'Cannot resume' };
  }
  
  contentState.paused = false;
  contentState.recorder.resume();
  
  updateRecordingIndicator('recording');
  
  return { success: true };
}

// Get recorded steps
function getRecordedSteps() {
  const steps = contentState.recorder ? contentState.recorder.getSteps() : [];
  return { success: true, steps };
}

// Execute a step
async function executeStep(step) {
  // Check if we're already executing this exact step
  if (contentState.currentStep && 
      contentState.currentStep.action === step.action && 
      contentState.currentStep.selector === step.selector) {
    logger.warn('Content', 'Ignoring duplicate step execution', step);
    return {
      success: false,
      error: 'Duplicate step execution attempted - ignoring'
    };
  }
  
  contentState.currentStep = step;
  
  try {
    const result = await contentState.actionPerformer.perform(step);
    contentState.currentStep = null;
    return { success: true, result };
  } catch (error) {
    logger.error('Content', 'Failed to execute step', error);
    contentState.currentStep = null;
    return { success: false, error: error.message };
  }
}

// Check if element exists
function checkElement(selector, strategy = CONSTANTS.SELECTOR_STRATEGIES.CSS) {
  try {
    const element = Utils.getElement(selector, strategy);
    return { exists: element !== null, visible: element ? Utils.isElementVisible(element) : false };
  } catch (error) {
    return { exists: false, visible: false };
  }
}

// Highlight element
function highlightElement(selector, duration = CONSTANTS.UI.HIGHLIGHT_DURATION) {
  try {
    const element = Utils.getElement(selector);
    if (!element) {
      return { success: false, error: 'Element not found' };
    }
    
    const highlight = createHighlight(element);
    contentState.highlightedElements.push(highlight);
    
    if (duration > 0) {
      setTimeout(() => {
        removeHighlight(highlight);
      }, duration);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Clear all highlights
function clearAllHighlights() {
  contentState.highlightedElements.forEach(highlight => {
    removeHighlight(highlight);
  });
  contentState.highlightedElements = [];
  return { success: true };
}

// Create highlight overlay
function createHighlight(element) {
  const rect = Utils.getElementRect(element);
  const highlight = document.createElement('div');
  
  highlight.style.position = 'absolute';
  highlight.style.left = `${rect.left}px`;
  highlight.style.top = `${rect.top}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
  highlight.style.border = `2px solid ${CONSTANTS.UI.HIGHLIGHT_COLOR}`;
  highlight.style.backgroundColor = `${CONSTANTS.UI.HIGHLIGHT_COLOR}22`;
  highlight.style.pointerEvents = 'none';
  highlight.style.zIndex = '999999';
  highlight.setAttribute('data-automation-highlight', 'true');
  
  document.body.appendChild(highlight);
  
  return highlight;
}

// Remove highlight
function removeHighlight(highlight) {
  if (highlight && highlight.parentNode) {
    highlight.parentNode.removeChild(highlight);
  }
}

// Add recording indicator
function addRecordingIndicator() {
  removeRecordingIndicator(); // Remove any existing indicator
  
  const indicator = document.createElement('div');
  indicator.id = 'web-automation-recording-indicator';
  indicator.innerHTML = `
    <div style="
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ff4444;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      <div style="
        width: 10px;
        height: 10px;
        background: white;
        border-radius: 50%;
        animation: pulse 1s infinite;
      "></div>
      <span>Recording</span>
      <button id="web-automation-stop-button" style="
        background: rgba(255, 255, 255, 0.3);
        border: 1px solid white;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        margin-left: 8px;
        transition: background 0.2s;
      " 
      title="Stop Recording">⏹</button>
    </div>
    <style>
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.3; }
        100% { opacity: 1; }
      }
    </style>
  `;
  
  document.body.appendChild(indicator);
  
  // Add click handler for stop button
  const stopButton = document.getElementById('web-automation-stop-button');
  if (stopButton) {
    // Add hover effects
    stopButton.addEventListener('mouseover', () => {
      stopButton.style.background = 'rgba(255, 255, 255, 0.5)';
    });
    
    stopButton.addEventListener('mouseout', () => {
      stopButton.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    
    stopButton.addEventListener('click', async (event) => {
      // Prevent any event bubbling
      event.preventDefault();
      event.stopPropagation();
      
      logger.info('Content', 'Stop button clicked in indicator');
      
      try {
        // Send stop recording message to background
        const response = await browser.runtime.sendMessage({
          type: CONSTANTS.MESSAGE_TYPES.STOP_RECORDING
        });
        
        logger.info('Content', 'Stop recording response:', response);
      } catch (error) {
        logger.error('Content', 'Failed to stop recording from indicator', error);
        // Try to remove indicator anyway if communication fails
        removeRecordingIndicator();
      }
    });
  }
}

// Update recording indicator
function updateRecordingIndicator(status) {
  const indicator = document.getElementById('web-automation-recording-indicator');
  if (!indicator) return;
  
  const statusText = indicator.querySelector('span');
  const dot = indicator.querySelector('div > div');
  
  if (status === 'paused') {
    statusText.textContent = 'Paused';
    dot.style.animation = 'none';
    dot.style.opacity = '0.5';
  } else {
    statusText.textContent = 'Recording';
    dot.style.animation = 'pulse 1s infinite';
  }
}

// Remove recording indicator
function removeRecordingIndicator() {
  const indicator = document.getElementById('web-automation-recording-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Clean up function
function cleanup() {
  if (contentState.recording) {
    stopRecording();
  }
  clearAllHighlights();
  removeRecordingIndicator();
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Initialize only in main frame
if (window === window.top) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
  } else {
    initializeContentScript();
  }
} else {
  logger.debug('Content', 'Skipping initialization in iframe');
}