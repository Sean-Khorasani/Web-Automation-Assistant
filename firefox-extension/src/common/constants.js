/**
 * Constants used throughout the extension
 */

const CONSTANTS = {
  // Extension identification
  EXTENSION_NAME: 'Web Automation Recorder',
  EXTENSION_VERSION: '1.0.0',
  
  // Storage keys
  STORAGE_KEYS: {
    INSTRUCTIONS: 'instructions',
    SETTINGS: 'settings',
    RECORDING_STATE: 'recordingState',
    LAST_RECORDING: 'lastRecording'
  },
  
  // Message types for communication
  MESSAGE_TYPES: {
    // Recording messages
    START_RECORDING: 'START_RECORDING',
    STOP_RECORDING: 'STOP_RECORDING',
    PAUSE_RECORDING: 'PAUSE_RECORDING',
    RESUME_RECORDING: 'RESUME_RECORDING',
    GET_RECORDING_STATE: 'GET_RECORDING_STATE',
    
    // Playback messages
    EXECUTE_INSTRUCTION: 'EXECUTE_INSTRUCTION',
    EXECUTE_STEP: 'EXECUTE_STEP',
    STOP_EXECUTION: 'STOP_EXECUTION',
    
    // Storage messages
    SAVE_INSTRUCTION: 'SAVE_INSTRUCTION',
    GET_INSTRUCTION: 'GET_INSTRUCTION',
    GET_ALL_INSTRUCTIONS: 'GET_ALL_INSTRUCTIONS',
    DELETE_INSTRUCTION: 'DELETE_INSTRUCTION',
    UPDATE_INSTRUCTION: 'UPDATE_INSTRUCTION',
    
    // Native messaging
    NATIVE_MESSAGE: 'NATIVE_MESSAGE',
    NATIVE_RESPONSE: 'NATIVE_RESPONSE',
    
    // UI messages
    UPDATE_POPUP: 'UPDATE_POPUP',
    SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',
    
    // Content script messages
    ELEMENT_SELECTED: 'ELEMENT_SELECTED',
    HIGHLIGHT_ELEMENT: 'HIGHLIGHT_ELEMENT',
    CLEAR_HIGHLIGHTS: 'CLEAR_HIGHLIGHTS'
  },
  
  // Action types for instructions
  ACTION_TYPES: {
    CLICK: 'click',
    INPUT_TEXT: 'input_text',
    SELECT_OPTION: 'select_option',
    WAIT_FOR_ELEMENT: 'wait_for_element',
    WAIT_FOR_CONDITION: 'wait_for_condition',
    WAIT_FOR_TIME: 'wait_for_time',
    NAVIGATE: 'navigate',
    GET_CONTENT: 'get_content',
    EXECUTE_SCRIPT: 'execute_script',
    TAKE_SCREENSHOT: 'take_screenshot',
    KEYBOARD_SHORTCUT: 'keyboard_shortcut',
    SCROLL: 'scroll',
    HOVER: 'hover',
    DRAG_DROP: 'drag_drop'
  },
  
  // Selector strategies
  SELECTOR_STRATEGIES: {
    ID: 'id',
    CSS: 'css',
    XPATH: 'xpath',
    TEXT: 'text',
    ARIA: 'aria',
    DATA_ATTR: 'data-attr',
    POSITION: 'position',
    HIERARCHY: 'hierarchy'
  },
  
  // Wait conditions
  WAIT_CONDITIONS: {
    ELEMENT_PRESENT: 'element_present',
    ELEMENT_VISIBLE: 'element_visible',
    ELEMENT_HIDDEN: 'element_hidden',
    ELEMENT_ENABLED: 'element_enabled',
    TEXT_PRESENT: 'text_present',
    TEXT_MATCHES: 'text_matches',
    ATTRIBUTE_EQUALS: 'attribute_equals',
    ATTRIBUTE_CONTAINS: 'attribute_contains',
    CUSTOM_SCRIPT: 'custom_script',
    NETWORK_IDLE: 'network_idle',
    DOM_STABLE: 'dom_stable'
  },
  
  // Default timeouts (in milliseconds)
  TIMEOUTS: {
    DEFAULT_WAIT: 10000,
    ELEMENT_WAIT: 30000,
    NETWORK_IDLE: 2000,
    DOM_STABLE: 1000,
    STEP_DELAY: 100,
    RETRY_DELAY: 500,
    MAX_RETRIES: 3
  },
  
  // Recording settings
  RECORDING: {
    MIN_PAUSE_DETECTION: 2000, // Minimum pause to detect user waiting
    TYPING_DEBOUNCE: 1000, // Debounce for consolidating typing (1 second)
    IGNORED_TAGS: ['HTML', 'HEAD', 'META', 'SCRIPT', 'STYLE', 'LINK'],
    SENSITIVE_ATTRIBUTES: ['password', 'creditcard', 'ssn', 'cvv']
  },
  
  // Native messaging
  NATIVE_MESSAGING: {
    HOST_NAME: 'com.webrecorder.native',
    DEFAULT_PORT: 9999,
    RECONNECT_DELAY: 1000,
    MAX_RECONNECT_ATTEMPTS: 3
  },
  
  // UI settings
  UI: {
    NOTIFICATION_DURATION: 3000,
    HIGHLIGHT_COLOR: '#4A90E2',
    HIGHLIGHT_DURATION: 2000,
    MAX_LOG_ENTRIES: 1000
  },
  
  // Error codes
  ERROR_CODES: {
    ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
    TIMEOUT: 'TIMEOUT',
    INVALID_SELECTOR: 'INVALID_SELECTOR',
    EXECUTION_FAILED: 'EXECUTION_FAILED',
    STORAGE_ERROR: 'STORAGE_ERROR',
    NATIVE_MESSAGING_ERROR: 'NATIVE_MESSAGING_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED'
  }
};

// Make constants available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}