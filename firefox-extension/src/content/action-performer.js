/**
 * Action Performer - Executes actions during playback
 */

class ActionPerformer {
  constructor() {
    this.executing = false;
    this.maxRetries = 3;
    this.baseRetryDelay = 500; // 500ms base delay
  }

  async perform(step) {
    if (this.executing) {
      logger.warn('ActionPerformer', 'Rejecting action - already executing', { 
        currentAction: this.currentAction,
        newAction: step.action 
      });
      throw new Error('Already executing an action');
    }

    this.executing = true;
    this.currentAction = step.action;
    const timer = logger.startTimer(`Perform ${step.action}`);

    try {
      // Wrap action execution with per-action timeout
      const ACTION_TIMEOUT = 10000; // 10 seconds per action
      const timeoutId = setTimeout(() => {
        logger.error('ActionPerformer', 'Action timeout - forcing reset', { action: step.action });
        this.executing = false; // Force reset on timeout
      }, ACTION_TIMEOUT);

      const result = await Promise.race([
        this._performAction(step),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Action ${step.action} timeout after ${ACTION_TIMEOUT/1000}s`)), ACTION_TIMEOUT)
        )
      ]);

      clearTimeout(timeoutId);
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      logger.error('ActionPerformer', `Failed to perform ${step.action}`, error);
      throw error;
    } finally {
      this.executing = false;
      this.currentAction = null;
    }
  }

  async _performAction(step) {
    let result;

    switch (step.action) {
        case CONSTANTS.ACTION_TYPES.CLICK:
          result = await this.performClick(step);
          break;

        case CONSTANTS.ACTION_TYPES.INPUT_TEXT:
          result = await this.performInputText(step);
          break;

        case CONSTANTS.ACTION_TYPES.SELECT_OPTION:
          result = await this.performSelectOption(step);
          break;

        case CONSTANTS.ACTION_TYPES.WAIT_FOR_ELEMENT:
          result = await this.performWaitForElement(step);
          break;

        case CONSTANTS.ACTION_TYPES.WAIT_FOR_CONDITION:
          result = await this.performWaitForCondition(step);
          break;

        case CONSTANTS.ACTION_TYPES.WAIT_FOR_TIME:
          result = await this.performWaitForTime(step);
          break;

        case CONSTANTS.ACTION_TYPES.GET_CONTENT:
          result = await this.performGetContent(step);
          break;

        case CONSTANTS.ACTION_TYPES.EXECUTE_SCRIPT:
          result = await this.performExecuteScript(step);
          break;

        case CONSTANTS.ACTION_TYPES.KEYBOARD_SHORTCUT:
          result = await this.performKeyboardShortcut(step);
          break;

        case CONSTANTS.ACTION_TYPES.SCROLL:
          result = await this.performScroll(step);
          break;

        case CONSTANTS.ACTION_TYPES.HOVER:
          result = await this.performHover(step);
          break;

        case 'WAIT_CUSTOM':
          result = await this.performWaitCustom(step);
          break;

        default:
          throw new Error(`Unknown action type: ${step.action}`);
      }

      return result;
  }

  async findElement(step, options = {}) {
    const { required = true, timeout = CONSTANTS.TIMEOUTS.ELEMENT_WAIT } = options;

    // Try primary selector first
    let element = null;
    
    if (step.selector) {
      if (typeof step.selector === 'string') {
        // Legacy format - assume CSS selector
        element = Utils.getElement(step.selector, CONSTANTS.SELECTOR_STRATEGIES.CSS);
      } else if (step.selector.css) {
        element = Utils.getElement(step.selector.css, CONSTANTS.SELECTOR_STRATEGIES.CSS);
      } else if (step.selector.id) {
        element = Utils.getElement(step.selector.id, CONSTANTS.SELECTOR_STRATEGIES.ID);
      } else if (step.selector.xpath) {
        element = Utils.getElement(step.selector.xpath, CONSTANTS.SELECTOR_STRATEGIES.XPATH);
      }
    }

    // Try alternative selectors if primary fails
    if (!element && step.alternativeSelectors) {
      for (const altSelector of step.alternativeSelectors) {
        element = Utils.getElement(
          altSelector.css || altSelector.value,
          altSelector.strategy || CONSTANTS.SELECTOR_STRATEGIES.CSS
        );
        if (element) break;
      }
    }

    // Wait for element if not found immediately
    if (!element && required && timeout > 0) {
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        // Retry finding element
        if (step.selector) {
          if (typeof step.selector === 'string') {
            element = Utils.getElement(step.selector, CONSTANTS.SELECTOR_STRATEGIES.CSS);
          } else if (step.selector.css) {
            element = Utils.getElement(step.selector.css, CONSTANTS.SELECTOR_STRATEGIES.CSS);
          }
        }
        
        if (element) break;
        
        await Utils.sleep(100);
      }
    }

    if (!element && required) {
      throw new Error(`Element not found: ${JSON.stringify(step.selector)}`);
    }

    return element;
  }

  async performClick(step) {
    return await this.retryWithBackoff(async () => {
      const element = await this.findElement(step);
      
      // Wait for DOM stability before interacting
      await this.checkDomStable();

      // Log element details for debugging
      logger.debug('ActionPerformer', 'Click target element', {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        visible: Utils.isElementVisible(element),
        disabled: element.disabled,
        rect: element.getBoundingClientRect()
      });

      // Ensure element is visible and enabled
      if (!Utils.isElementVisible(element)) {
        // Try scrolling into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await Utils.sleep(1000); // Give more time for scroll
        
        // Check visibility again
        if (!Utils.isElementVisible(element)) {
          // Try to make parent elements visible if they're hidden
          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            const display = window.getComputedStyle(parent).display;
            const visibility = window.getComputedStyle(parent).visibility;
            if (display === 'none' || visibility === 'hidden') {
              logger.warn('ActionPerformer', 'Parent element is hidden', {
                tagName: parent.tagName,
                id: parent.id,
                display,
                visibility
              });
            }
            parent = parent.parentElement;
          }
          
          throw new Error('Element is not visible');
        }
      }

      if (element.disabled) {
        throw new Error('Element is disabled');
      }

      // Highlight element before clicking
      const highlight = createHighlight(element);
      await Utils.sleep(200);

      // Perform click
      if (step.rightClick) {
      // Simulate right-click
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 2,
        buttons: 2
      });
      element.dispatchEvent(event);
    } else {
      // Regular click
      element.click();
      
      // Some elements need focus + click
      if (element.tagName === 'INPUT' || element.tagName === 'BUTTON') {
        element.focus();
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        element.dispatchEvent(event);
      }
    }

    // Remove highlight
    removeHighlight(highlight);

      logger.debug('ActionPerformer', 'Click performed', { 
        element: element.tagName,
        rightClick: step.rightClick 
      });

      return { clicked: true };
    }, 'Click');

  }

  async performInputText(step) {
    return await this.retryWithBackoff(async () => {
      const element = await this.findElement(step);
      
      // Wait for DOM stability before interacting
      await this.checkDomStable();

      if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
      throw new Error('Element is not an input field');
    }

    // Focus element
    element.focus();
    await Utils.sleep(100);

    // Clear existing content if requested
    if (step.clear || step.clear_first) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await Utils.sleep(100);
    }

    // Type text with realistic delays
    const text = step.value || step.text || '';
    
    if (step.instant) {
      // Set value instantly
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Type character by character
      for (const char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await Utils.sleep(20 + Math.random() * 30); // 20-50ms per char
      }
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Trigger any framework-specific events
    element.dispatchEvent(new Event('blur', { bubbles: true }));

      logger.debug('ActionPerformer', 'Text input performed', { 
        length: text.length,
        cleared: step.clear || step.clear_first 
      });

      return { typed: text };
    }, 'Input Text');
  }

  async performSelectOption(step) {
    const element = await this.findElement(step);

    if (element.tagName !== 'SELECT') {
      throw new Error('Element is not a select field');
    }

    // Find option by value or text
    let option = null;
    const options = Array.from(element.options);

    // Try by value first
    option = options.find(opt => opt.value === step.value);

    // Try by text if value not found
    if (!option) {
      option = options.find(opt => opt.textContent.trim() === step.value);
    }

    // Try by partial text match
    if (!option) {
      option = options.find(opt => opt.textContent.includes(step.value));
    }

    if (!option) {
      throw new Error(`Option not found: ${step.value}`);
    }

    // Select the option
    element.value = option.value;
    element.dispatchEvent(new Event('change', { bubbles: true }));

    logger.debug('ActionPerformer', 'Option selected', { 
      value: option.value,
      text: option.textContent 
    });

    return { selected: option.value };
  }

  async performWaitForElement(step) {
    const timeout = step.timeout || CONSTANTS.TIMEOUTS.ELEMENT_WAIT;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const element = await this.findElement(step, { required: false, timeout: 0 });
        
        if (element) {
          // Check visibility if specified
          if (step.visible && !Utils.isElementVisible(element)) {
            await Utils.sleep(100);
            continue;
          }
          
          return { found: true, element };
        }
      } catch (error) {
        // Element not found yet
      }

      await Utils.sleep(100);
    }

    throw new Error(`Timeout waiting for element: ${JSON.stringify(step.selector)}`);
  }

  async performWaitForCondition(step) {
    const timeout = step.timeout || CONSTANTS.TIMEOUTS.DEFAULT_WAIT;
    const condition = step.condition;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      let conditionMet = false;

      switch (condition.type) {
        case CONSTANTS.WAIT_CONDITIONS.ELEMENT_VISIBLE:
          try {
            const element = await this.findElement(
              { selector: condition.selector },
              { required: false, timeout: 0 }
            );
            conditionMet = element && Utils.isElementVisible(element);
          } catch (error) {
            conditionMet = false;
          }
          break;

        case CONSTANTS.WAIT_CONDITIONS.ELEMENT_HIDDEN:
          try {
            const element = await this.findElement(
              { selector: condition.selector },
              { required: false, timeout: 0 }
            );
            conditionMet = !element || !Utils.isElementVisible(element);
          } catch (error) {
            conditionMet = true; // Element not found = hidden
          }
          break;

        case CONSTANTS.WAIT_CONDITIONS.TEXT_PRESENT:
          conditionMet = document.body.textContent.includes(condition.text);
          break;

        case CONSTANTS.WAIT_CONDITIONS.NETWORK_IDLE:
          conditionMet = await this.checkNetworkIdle(condition.idleTime || CONSTANTS.TIMEOUTS.NETWORK_IDLE);
          break;

        case CONSTANTS.WAIT_CONDITIONS.DOM_STABLE:
          conditionMet = await this.checkDomStable(condition.stableTime || CONSTANTS.TIMEOUTS.DOM_STABLE);
          break;

        case CONSTANTS.WAIT_CONDITIONS.CUSTOM_SCRIPT:
          try {
            conditionMet = eval(condition.script);
          } catch (error) {
            logger.warn('ActionPerformer', 'Custom script error', error);
            conditionMet = false;
          }
          break;

        default:
          throw new Error(`Unknown wait condition: ${condition.type}`);
      }

      if (conditionMet) {
        return { success: true };
      }

      await Utils.sleep(100);
    }

    throw new Error(`Timeout waiting for condition: ${condition.type}`);
  }

  async performWaitForTime(step) {
    const duration = step.duration || step.timeout || 1000;
    await Utils.sleep(duration);
    return { waited: duration };
  }

  async performGetContent(step) {
    const element = await this.findElement(step);
    const property = step.property || 'textContent';

    let value;
    switch (property) {
      case 'textContent':
      case 'innerText':
      case 'innerHTML':
      case 'value':
        value = element[property];
        break;
      
      case 'href':
      case 'src':
        value = element.getAttribute(property);
        break;
        
      default:
        // Try as attribute
        value = element.getAttribute(property);
        if (value === null) {
          // Try as property
          value = element[property];
        }
    }

    logger.debug('ActionPerformer', 'Content retrieved', { 
      property,
      length: value ? value.length : 0 
    });

    return { content: value };
  }

  async performExecuteScript(step) {
    const script = step.script;
    
    if (!script) {
      throw new Error('No script provided');
    }

    try {
      // Create a function to avoid global scope pollution
      const func = new Function('return ' + script);
      const result = func();
      
      return { result };
    } catch (error) {
      throw new Error(`Script execution failed: ${error.message}`);
    }
  }

  async performKeyboardShortcut(step) {
    const keys = step.keys;
    let target = document.activeElement;

    // Find target element if specified
    if (step.selector) {
      target = await this.findElement(step);
      target.focus();
      await Utils.sleep(100);
    }

    // Create keyboard event
    const event = new KeyboardEvent('keydown', {
      key: keys.key,
      code: `Key${keys.key.toUpperCase()}`,
      ctrlKey: keys.ctrl || false,
      metaKey: keys.meta || false,
      shiftKey: keys.shift || false,
      altKey: keys.alt || false,
      bubbles: true,
      cancelable: true
    });

    target.dispatchEvent(event);

    // Also dispatch keyup
    const keyupEvent = new KeyboardEvent('keyup', {
      key: keys.key,
      code: `Key${keys.key.toUpperCase()}`,
      ctrlKey: keys.ctrl || false,
      metaKey: keys.meta || false,
      shiftKey: keys.shift || false,
      altKey: keys.alt || false,
      bubbles: true,
      cancelable: true
    });

    target.dispatchEvent(keyupEvent);

    logger.debug('ActionPerformer', 'Keyboard shortcut performed', keys);

    return { performed: true };
  }

  async performScroll(step) {
    let element = window;
    
    if (step.selector) {
      element = await this.findElement(step);
    }

    const scrollOptions = {
      top: step.scrollTop || 0,
      left: step.scrollLeft || 0,
      behavior: 'smooth'
    };

    if (element === window) {
      window.scrollTo(scrollOptions);
    } else {
      element.scrollTo(scrollOptions);
    }

    await Utils.sleep(500); // Wait for smooth scroll

    return { 
      scrolled: true,
      position: {
        top: element === window ? window.scrollY : element.scrollTop,
        left: element === window ? window.scrollX : element.scrollLeft
      }
    };
  }

  async performHover(step) {
    const element = await this.findElement(step);

    // Create mouse events
    const mouseOverEvent = new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      view: window
    });

    const mouseEnterEvent = new MouseEvent('mouseenter', {
      bubbles: false,
      cancelable: true,
      view: window
    });

    element.dispatchEvent(mouseOverEvent);
    element.dispatchEvent(mouseEnterEvent);

    // Keep hovering for specified duration
    const duration = step.duration || 1000;
    await Utils.sleep(duration);

    return { hovered: true };
  }

  async performWaitCustom(step) {
    const script = step.script;
    const timeout = step.timeout || CONSTANTS.TIMEOUTS.DEFAULT_WAIT;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const func = new Function('return ' + script);
        const result = func();
        
        if (result) {
          return { success: true, result };
        }
      } catch (error) {
        logger.warn('ActionPerformer', 'Custom wait script error', error);
      }

      await Utils.sleep(100);
    }

    throw new Error('Timeout waiting for custom condition');
  }

  async checkNetworkIdle(idleTime) {
    // Create a promise that resolves when network is idle
    return new Promise((resolve) => {
      let pendingRequests = 0;
      let idleTimer = null;

      // Track fetch requests
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        pendingRequests++;
        clearTimeout(idleTimer);
        
        return originalFetch.apply(this, args).finally(() => {
          pendingRequests--;
          if (pendingRequests === 0) {
            idleTimer = setTimeout(() => {
              window.fetch = originalFetch;
              resolve(true);
            }, idleTime);
          }
        });
      };

      // Track XMLHttpRequests
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(...args) {
        this._isTracked = true;
        return originalOpen.apply(this, args);
      };
      
      XMLHttpRequest.prototype.send = function(...args) {
        if (this._isTracked) {
          pendingRequests++;
          clearTimeout(idleTimer);
          
          this.addEventListener('loadend', () => {
            pendingRequests--;
            if (pendingRequests === 0) {
              idleTimer = setTimeout(() => {
                XMLHttpRequest.prototype.open = originalOpen;
                XMLHttpRequest.prototype.send = originalSend;
                resolve(true);
              }, idleTime);
            }
          });
        }
        return originalSend.apply(this, args);
      };

      // Check if already idle
      if (pendingRequests === 0) {
        idleTimer = setTimeout(() => {
          window.fetch = originalFetch;
          XMLHttpRequest.prototype.open = originalOpen;
          XMLHttpRequest.prototype.send = originalSend;
          resolve(true);
        }, idleTime);
      }
    });
  }

  async checkDomStable(stableTime = 300, maxWaitTime = 2000) {
    return new Promise((resolve) => {
      let mutationCount = 0;
      let stableTimer = null;
      let maxTimer = null;
      const startTime = Date.now();
      
      const cleanup = () => {
        clearTimeout(stableTimer);
        clearTimeout(maxTimer);
        observer.disconnect();
      };
      
      const observer = new MutationObserver(() => {
        mutationCount++;
        clearTimeout(stableTimer);
        
        // Check if we've been waiting too long
        if (Date.now() - startTime > maxWaitTime) {
          cleanup();
          logger.debug('ActionPerformer', `DOM stability timeout after ${mutationCount} mutations`);
          resolve(true);
          return;
        }
        
        stableTimer = setTimeout(() => {
          cleanup();
          logger.debug('ActionPerformer', `DOM stable after ${mutationCount} mutations`);
          resolve(true);
        }, stableTime);
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeOldValue: false,
        characterDataOldValue: false
      });
      
      // Start stability timer
      stableTimer = setTimeout(() => {
        cleanup();
        logger.debug('ActionPerformer', 'DOM already stable');
        resolve(true);
      }, stableTime);
      
      // Max wait timer
      maxTimer = setTimeout(() => {
        cleanup();
        logger.debug('ActionPerformer', 'DOM stability max wait reached');
        resolve(true);
      }, maxWaitTime);
    });
  }
  
  // Retry with exponential backoff
  async retryWithBackoff(action, actionName) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Try the action
        const result = await action();
        
        // Success - return result
        if (attempt > 0) {
          logger.info('ActionPerformer', `${actionName} succeeded on attempt ${attempt + 1}`);
        }
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry for certain errors
        if (error.message.includes('timeout') || 
            error.message.includes('stopped by user') ||
            error.message.includes('Unknown action type')) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === this.maxRetries) {
          logger.error('ActionPerformer', `${actionName} failed after ${this.maxRetries + 1} attempts`, error);
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.baseRetryDelay * Math.pow(2, attempt);
        logger.warn('ActionPerformer', `${actionName} failed on attempt ${attempt + 1}, retrying in ${delay}ms`, error);
        
        // Wait before retrying
        await Utils.sleep(delay);
      }
    }
    
    // Should never reach here, but just in case
    throw lastError || new Error(`${actionName} failed after all retries`);
  }
}