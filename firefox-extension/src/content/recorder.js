/**
 * Recorder - Handles event capture during recording
 */

class Recorder {
  constructor() {
    this.recording = false;
    this.paused = false;
    this.steps = [];
    this.lastEventTime = 0;
    this.lastInputTarget = null;
    this.inputBuffer = '';
    this.inputTimer = null;
    this.eventHandlers = new Map();
  }

  start(options = {}) {
    if (this.recording) return;
    
    this.recording = true;
    this.paused = false;
    this.steps = [];
    this.lastEventTime = Date.now();
    
    // Add initial wait for page load
    if (options.waitForLoad) {
      this.addStep({
        action: CONSTANTS.ACTION_TYPES.WAIT_FOR_ELEMENT,
        selector: { css: 'body' },
        timeout: 5000
      });
    }
    
    this.attachEventListeners();
    logger.info('Recorder', 'Recording started');
  }

  stop() {
    if (!this.recording) return [];
    
    this.recording = false;
    this.detachEventListeners();
    
    // Flush any pending input
    this.flushInputBuffer();
    
    logger.info('Recorder', `Recording stopped with ${this.steps.length} steps`);
    return this.steps;
  }

  pause() {
    this.paused = true;
    logger.info('Recorder', 'Recording paused');
  }

  resume() {
    this.paused = false;
    this.lastEventTime = Date.now(); // Reset to avoid false pause detection
    logger.info('Recorder', 'Recording resumed');
  }

  getSteps() {
    return [...this.steps];
  }

  attachEventListeners() {
    // Click events
    this.addEventListener('click', this.handleClick.bind(this), true);
    
    // Input events
    this.addEventListener('input', this.handleInput.bind(this), true);
    this.addEventListener('change', this.handleChange.bind(this), true);
    
    // Keyboard events
    this.addEventListener('keydown', this.handleKeydown.bind(this), true);
    
    // Focus events (for detecting form field navigation)
    this.addEventListener('focus', this.handleFocus.bind(this), true);
    
    // Form submission
    this.addEventListener('submit', this.handleSubmit.bind(this), true);
    
    // Context menu
    this.addEventListener('contextmenu', this.handleContextMenu.bind(this), true);
    
    // Scroll events (throttled)
    this.addEventListener('scroll', Utils.throttle(this.handleScroll.bind(this), 1000), true);
    
    // File input
    this.addEventListener('change', this.handleFileInput.bind(this), true);
  }

  detachEventListeners() {
    for (const [event, handler] of this.eventHandlers) {
      document.removeEventListener(event, handler, true);
    }
    this.eventHandlers.clear();
  }

  addEventListener(event, handler, useCapture) {
    document.addEventListener(event, handler, useCapture);
    this.eventHandlers.set(event, handler);
  }

  handleClick(event) {
    if (!this.recording || this.paused) return;
    
    const target = event.target;
    
    // Ignore clicks on our own UI elements
    if (target.closest('[data-automation-highlight]') || 
        target.closest('#web-automation-recording-indicator')) {
      return;
    }
    
    // Check for user pause (time since last event)
    this.checkAndAddWaitStep();
    
    // Flush any pending input
    this.flushInputBuffer();
    
    // Generate selectors for the element
    const selectors = ElementSelector.generateSelectors(target);
    
    // Create click step
    const step = {
      action: CONSTANTS.ACTION_TYPES.CLICK,
      selector: selectors.primary,
      alternativeSelectors: selectors.alternatives,
      timestamp: Date.now()
    };
    
    // Add context information
    if (target.tagName === 'A') {
      step.context = {
        type: 'link',
        href: target.href,
        text: target.textContent.trim().substring(0, 50)
      };
    } else if (target.tagName === 'BUTTON' || target.type === 'submit') {
      step.context = {
        type: 'button',
        text: target.textContent.trim().substring(0, 50)
      };
    }
    
    this.addStep(step);
    
    logger.debug('Recorder', 'Click recorded', { 
      element: target.tagName, 
      selector: selectors.primary.css 
    });
  }

  handleInput(event) {
    if (!this.recording || this.paused) return;
    
    const target = event.target;
    
    // Only handle input/textarea elements
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      return;
    }
    
    // Skip password fields if configured
    if (target.type === 'password' && CONSTANTS.RECORDING.SENSITIVE_ATTRIBUTES.includes('password')) {
      return;
    }
    
    // Buffer input to consolidate rapid typing
    if (this.lastInputTarget === target) {
      clearTimeout(this.inputTimer);
      // Update the buffer with current value
      this.inputBuffer = target.value;
    } else {
      // Different input field - flush previous and start new
      this.flushInputBuffer();
      this.lastInputTarget = target;
      this.inputBuffer = target.value;
      
      // Record the initial focus on the new field
      this.checkAndAddWaitStep();
    }
    
    // Set timer to flush the buffer after user stops typing
    this.inputTimer = setTimeout(() => {
      this.flushInputBuffer();
    }, CONSTANTS.RECORDING.TYPING_DEBOUNCE);
  }

  handleChange(event) {
    if (!this.recording || this.paused) return;
    
    const target = event.target;
    
    // Handle select elements
    if (target.tagName === 'SELECT') {
      this.checkAndAddWaitStep();
      
      const selectors = ElementSelector.generateSelectors(target);
      
      const step = {
        action: CONSTANTS.ACTION_TYPES.SELECT_OPTION,
        selector: selectors.primary,
        alternativeSelectors: selectors.alternatives,
        value: target.value,
        timestamp: Date.now(),
        context: {
          selectedText: target.options[target.selectedIndex]?.text
        }
      };
      
      this.addStep(step);
      
      logger.debug('Recorder', 'Select change recorded', { value: target.value });
    }
  }

  handleKeydown(event) {
    if (!this.recording || this.paused) return;
    
    // Detect keyboard shortcuts (Ctrl/Cmd + key)
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      
      // Common shortcuts to record
      if (['a', 'c', 'v', 'x', 'z', 'y', 's'].includes(key)) {
        this.checkAndAddWaitStep();
        
        const step = {
          action: CONSTANTS.ACTION_TYPES.KEYBOARD_SHORTCUT,
          keys: {
            ctrl: event.ctrlKey,
            meta: event.metaKey,
            shift: event.shiftKey,
            alt: event.altKey,
            key: key
          },
          timestamp: Date.now()
        };
        
        // Add target element if focused
        if (document.activeElement && document.activeElement !== document.body) {
          const selectors = ElementSelector.generateSelectors(document.activeElement);
          step.selector = selectors.primary;
          step.alternativeSelectors = selectors.alternatives;
        }
        
        this.addStep(step);
        
        logger.debug('Recorder', 'Keyboard shortcut recorded', step.keys);
      }
    }
    
    // Detect Enter key on forms
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      const form = event.target.closest('form');
      if (form) {
        // This might trigger a form submission
        this.lastEventTime = Date.now(); // Update time to link with potential submit
      }
    }
  }

  handleFocus(event) {
    if (!this.recording || this.paused) return;
    
    // Flush input buffer when focus changes
    if (this.lastInputTarget && this.lastInputTarget !== event.target) {
      this.flushInputBuffer();
    }
  }

  handleSubmit(event) {
    if (!this.recording || this.paused) return;
    
    // Check if this is closely following an Enter key press
    const timeSinceLastEvent = Date.now() - this.lastEventTime;
    if (timeSinceLastEvent < 100) {
      // Likely triggered by Enter key, don't record separately
      return;
    }
    
    const form = event.target;
    const submitButton = form.querySelector('[type="submit"]') || form.querySelector('button');
    
    if (submitButton) {
      // Record as button click
      const selectors = ElementSelector.generateSelectors(submitButton);
      
      const step = {
        action: CONSTANTS.ACTION_TYPES.CLICK,
        selector: selectors.primary,
        alternativeSelectors: selectors.alternatives,
        timestamp: Date.now(),
        context: {
          type: 'form_submit',
          formAction: form.action
        }
      };
      
      this.addStep(step);
    }
  }

  handleContextMenu(event) {
    if (!this.recording || this.paused) return;
    
    // Record right-click events
    const target = event.target;
    const selectors = ElementSelector.generateSelectors(target);
    
    const step = {
      action: CONSTANTS.ACTION_TYPES.CLICK,
      selector: selectors.primary,
      alternativeSelectors: selectors.alternatives,
      rightClick: true,
      timestamp: Date.now()
    };
    
    this.addStep(step);
    
    logger.debug('Recorder', 'Right-click recorded');
  }

  handleScroll(event) {
    if (!this.recording || this.paused) return;
    
    // Only record significant scrolls
    const scrollElement = event.target === document ? document.documentElement : event.target;
    const scrollTop = scrollElement.scrollTop;
    const scrollLeft = scrollElement.scrollLeft;
    
    // Check if scroll position changed significantly
    const lastScroll = this.lastScrollPosition || { top: 0, left: 0 };
    if (Math.abs(scrollTop - lastScroll.top) < 100 && 
        Math.abs(scrollLeft - lastScroll.left) < 100) {
      return;
    }
    
    this.lastScrollPosition = { top: scrollTop, left: scrollLeft };
    
    const step = {
      action: CONSTANTS.ACTION_TYPES.SCROLL,
      scrollTop,
      scrollLeft,
      timestamp: Date.now()
    };
    
    if (event.target !== document) {
      const selectors = ElementSelector.generateSelectors(event.target);
      step.selector = selectors.primary;
      step.alternativeSelectors = selectors.alternatives;
    }
    
    this.addStep(step);
    
    logger.debug('Recorder', 'Scroll recorded', { top: scrollTop, left: scrollLeft });
  }

  handleFileInput(event) {
    if (!this.recording || this.paused) return;
    
    const target = event.target;
    if (target.type !== 'file') return;
    
    const files = Array.from(target.files).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type
    }));
    
    const selectors = ElementSelector.generateSelectors(target);
    
    const step = {
      action: 'FILE_UPLOAD',
      selector: selectors.primary,
      alternativeSelectors: selectors.alternatives,
      files,
      timestamp: Date.now()
    };
    
    this.addStep(step);
    
    logger.debug('Recorder', 'File upload recorded', { fileCount: files.length });
  }

  flushInputBuffer() {
    if (!this.lastInputTarget) return;
    
    clearTimeout(this.inputTimer);
    
    // Only create step if there's actual input
    if (this.inputBuffer && this.inputBuffer.trim()) {
      const selectors = ElementSelector.generateSelectors(this.lastInputTarget);
      
      // Check if the last step was for the same input field
      const lastStep = this.steps[this.steps.length - 1];
      const isSameField = lastStep && 
                         lastStep.action === CONSTANTS.ACTION_TYPES.INPUT_TEXT &&
                         lastStep.selector.css === selectors.primary.css;
      
      if (isSameField) {
        // Update the existing step instead of creating a new one
        lastStep.value = this.inputBuffer;
        lastStep.timestamp = Date.now();
        logger.debug('Recorder', 'Input updated', { 
          value: this.inputBuffer,
          selector: selectors.primary.css
        });
      } else {
        // Create new step
        const step = {
          action: CONSTANTS.ACTION_TYPES.INPUT_TEXT,
          selector: selectors.primary,
          alternativeSelectors: selectors.alternatives,
          value: this.inputBuffer,
          clear_first: true, // Usually want to clear before typing
          timestamp: Date.now()
        };
        
        this.addStep(step);
        logger.debug('Recorder', 'Input recorded', { 
          value: this.inputBuffer,
          selector: selectors.primary.css
        });
      }
    }
    
    // Reset buffer
    this.inputBuffer = '';
    this.lastInputTarget = null;
  }

  checkAndAddWaitStep() {
    const currentTime = Date.now();
    const timeSinceLastEvent = currentTime - this.lastEventTime;
    
    // If user paused for more than threshold, add wait step
    if (timeSinceLastEvent > CONSTANTS.RECORDING.MIN_PAUSE_DETECTION) {
      const waitStep = {
        action: CONSTANTS.ACTION_TYPES.WAIT_FOR_TIME,
        duration: Math.round(timeSinceLastEvent / 100) * 100, // Round to nearest 100ms
        timestamp: this.lastEventTime + timeSinceLastEvent / 2,
        context: {
          reason: 'user_pause'
        }
      };
      
      // Insert wait step at the correct position
      this.addStep(waitStep);
      
      logger.debug('Recorder', 'Wait step added', { duration: waitStep.duration });
    }
    
    this.lastEventTime = currentTime;
  }

  addStep(step) {
    // Add step ID
    step.id = Utils.generateId();
    
    // Ensure steps are in chronological order
    if (this.steps.length > 0) {
      const lastStep = this.steps[this.steps.length - 1];
      if (step.timestamp && lastStep.timestamp && step.timestamp < lastStep.timestamp) {
        // Find correct position to insert
        let insertIndex = this.steps.length - 1;
        while (insertIndex > 0 && this.steps[insertIndex].timestamp > step.timestamp) {
          insertIndex--;
        }
        this.steps.splice(insertIndex + 1, 0, step);
        return;
      }
    }
    
    this.steps.push(step);
    
    // Send update to background
    browser.runtime.sendMessage({
      type: 'RECORDING_STEP_ADDED',
      step: step,
      totalSteps: this.steps.length
    }).catch(() => {
      // Ignore errors (background might not be listening)
    });
  }
}