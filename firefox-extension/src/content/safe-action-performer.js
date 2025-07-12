/**
 * Safe Action Performer - Prevents infinite loops and freezing
 */

class SafeActionPerformer {
  constructor() {
    this.executing = false;
    this.currentAction = null;
    this.abortController = null;
    this.maxRetries = 2; // Reduced from 3 to fail faster
    this.baseRetryDelay = 500;
    this.actionTimeout = 5000; // 5 seconds max per action
  }

  async perform(step) {
    // Prevent concurrent executions
    if (this.executing) {
      logger.warn('SafeActionPerformer', 'Rejecting - already executing', {
        currentAction: this.currentAction,
        newAction: step.action
      });
      throw new Error('Already executing an action');
    }

    this.executing = true;
    this.currentAction = step.action;
    this.abortController = new AbortController();

    try {
      // Set up action timeout
      const timeoutId = setTimeout(() => {
        logger.error('SafeActionPerformer', 'Action timeout - aborting', { action: step.action });
        this.abortController.abort();
      }, this.actionTimeout);

      // Execute with abort signal
      const result = await this._performAction(step, this.abortController.signal);
      
      clearTimeout(timeoutId);
      return result;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Action aborted: ${step.action} took too long`);
      }
      throw error;
    } finally {
      this.executing = false;
      this.currentAction = null;
      this.abortController = null;
    }
  }

  async _performAction(step, signal) {
    // Check abort signal
    if (signal.aborted) {
      throw new Error('Action aborted');
    }

    switch (step.action) {
      case CONSTANTS.ACTION_TYPES.CLICK:
        return await this.performClick(step, signal);
      case CONSTANTS.ACTION_TYPES.INPUT_TEXT:
        return await this.performType(step, signal);
      case CONSTANTS.ACTION_TYPES.WAIT_FOR_ELEMENT:
        return await this.performWaitForElement(step, signal);
      case CONSTANTS.ACTION_TYPES.WAIT_FOR_TIME:
        return await this.performWaitForTime(step, signal);
      default:
        throw new Error(`Unknown action type: ${step.action}`);
    }
  }

  async performClick(step, signal) {
    return await this.retryWithSignal(async () => {
      const element = await this.findElement(step.selector, step.selectorStrategy, signal);
      
      // Check visibility without infinite loops
      const isVisible = await this.checkVisibility(element, signal);
      if (!isVisible) {
        throw new Error('Element not visible');
      }

      // Perform click
      element.click();
      return { clicked: true };
    }, signal);
  }

  async performType(step, signal) {
    return await this.retryWithSignal(async () => {
      const element = await this.findElement(step.selector, step.selectorStrategy, signal);
      
      if (step.clear) {
        element.value = '';
      }
      
      // Type character by character with abort checks
      for (const char of step.value) {
        if (signal.aborted) throw new Error('Type action aborted');
        
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await this.sleep(50, signal);
      }
      
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return { typed: step.value };
    }, signal);
  }

  async findElement(selector, strategy = CONSTANTS.SELECTOR_STRATEGIES.CSS, signal) {
    if (signal.aborted) throw new Error('Find element aborted');
    
    const element = Utils.getElement(selector, strategy);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    return element;
  }

  async checkVisibility(element, signal) {
    if (signal.aborted) throw new Error('Visibility check aborted');
    
    // Quick visibility check without complex parent traversal
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  async retryWithSignal(fn, signal, retries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (signal.aborted) {
        throw new Error('Action aborted during retry');
      }
      
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < retries) {
          const delay = this.baseRetryDelay * Math.pow(2, attempt);
          logger.debug('SafeActionPerformer', `Retry ${attempt + 1} after ${delay}ms`);
          await this.sleep(delay, signal);
        }
      }
    }
    
    throw lastError;
  }

  async sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Sleep aborted'));
      });
    });
  }

  async performWaitForElement(step, signal) {
    const timeout = step.timeout || 10000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (signal.aborted) throw new Error('Wait aborted');
      
      try {
        const element = await this.findElement(step.selector, step.selectorStrategy, signal);
        if (element) {
          return { found: true };
        }
      } catch (e) {
        // Element not found yet, continue waiting
      }
      
      await this.sleep(100, signal);
    }
    
    throw new Error(`Element not found after ${timeout}ms: ${step.selector}`);
  }

  async performWaitForTime(step, signal) {
    const duration = step.duration || 1000;
    await this.sleep(duration, signal);
    return { waited: duration };
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.SafeActionPerformer = SafeActionPerformer;
}