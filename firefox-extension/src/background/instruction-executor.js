/**
 * Instruction Executor - Handles execution of recorded instructions
 */

class InstructionExecutor {
  constructor() {
    this.executing = false;
    this.currentTab = null;
    this.executionLog = [];
    this.variables = {};
    this.shouldStop = false;
  }

  async execute(instruction, variables = {}) {
    if (this.executing) {
      throw new Error('Already executing an instruction');
    }

    this.executing = true;
    this.executionLog = [];
    this.variables = { ...variables };
    this.shouldStop = false;

    const timer = logger.startTimer(`Execute instruction: ${instruction.name}`);

    try {
      logger.info('InstructionExecutor', 'Starting execution', {
        name: instruction.name,
        steps: instruction.steps.length,
        variables: Object.keys(variables)
      });

      // Store execution state in background script
      await this.updateExecutionState('started', instruction);

      // Find or create tab
      this.currentTab = await this.findOrCreateTab(instruction.url);
      
      // Update execution state with tab ID
      await this.updateExecutionState('tab_created', { tabId: this.currentTab.id });

      // Wait for page to be ready before starting execution
      logger.info('InstructionExecutor', 'Waiting for page to be ready...');
      await Utils.sleep(2000); // Give page time to fully load
      
      // Send a ping to content script to ensure it's ready
      try {
        await this.sendToContentScript({ type: 'PING' });
      } catch (error) {
        logger.warn('InstructionExecutor', 'Content script not ready, waiting more...');
        await Utils.sleep(2000);
      }

      // Execute each step
      const results = [];
      for (let i = 0; i < instruction.steps.length; i++) {
        if (this.shouldStop) {
          throw new Error('Execution stopped by user');
        }

        const step = instruction.steps[i];
        logger.info('InstructionExecutor', `Executing step ${i + 1}/${instruction.steps.length}`, { action: step.action });
        
        try {
          // Execute step with timeout
          const STEP_TIMEOUT = 30000; // 30 seconds per step
          const stepResult = await Promise.race([
            this.executeStep(step, i),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Step ${i} timeout after ${STEP_TIMEOUT/1000}s`)), STEP_TIMEOUT)
            )
          ]);
          
          results.push(stepResult);

          // Log execution
          this.executionLog.push({
            stepIndex: i,
            action: step.action,
            success: stepResult.success,
            duration: stepResult.duration,
            error: stepResult.error
          });
        } catch (stepError) {
          logger.error('InstructionExecutor', `Step ${i} failed`, stepError);
          
          // Log failed step
          this.executionLog.push({
            stepIndex: i,
            action: step.action,
            success: false,
            duration: 0,
            error: stepError.message
          });
          
          // Continue with next step or throw based on settings
          if (step.continueOnError) {
            results.push({ success: false, error: stepError.message });
          } else {
            throw stepError;
          }
        }
      }

      timer.end();

      // Log successful execution
      await StorageManager.logExecution(instruction.id, 'success', {
        duration: timer.end(),
        steps: this.executionLog
      });

      return {
        success: true,
        results,
        executionLog: this.executionLog
      };

    } catch (error) {
      logger.error('InstructionExecutor', 'Execution failed', error);

      // Update execution state
      await this.updateExecutionState('failed', { error: error.message });

      // Log failed execution
      await StorageManager.logExecution(instruction.id, 'failed', {
        error: error.message,
        steps: this.executionLog
      });

      throw error;
    } finally {
      // Always cleanup
      this.executing = false;
      
      // Close the tab if it was created for this execution
      if (this.currentTab && this.currentTab.id) {
        try {
          // Check if tab still exists before closing
          await browser.tabs.get(this.currentTab.id);
          // Only close if we created it (has about:blank or instruction URL)
          logger.info('InstructionExecutor', 'Keeping tab open after execution for debugging');
          // Uncomment the line below to auto-close tabs after execution
          // await browser.tabs.remove(this.currentTab.id);
        } catch (e) {
          // Tab already closed
        }
      }
      
      this.currentTab = null;
      
      // Clear execution state
      await this.updateExecutionState('completed');
    }
  }

  async findOrCreateTab(url) {
    logger.info('InstructionExecutor', 'Finding or creating tab', { url });
    
    if (!url) {
      // Use current active tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      logger.info('InstructionExecutor', 'Using current active tab', { tabId: tabs[0].id, url: tabs[0].url });
      return tabs[0];
    }

    // Process variables in URL
    const processedUrl = Utils.substituteVariables(url, this.variables);

    // Check if we should use existing tab or create new one
    const USE_EXISTING_TAB = true; // Change this to false to always create new tabs
    
    if (USE_EXISTING_TAB) {
      // Look for existing tab with matching URL
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        if (Utils.matchUrlPattern(tab.url, processedUrl)) {
          logger.info('InstructionExecutor', 'Using existing tab', { tabId: tab.id, url: tab.url });
          // Focus the tab
          await browser.tabs.update(tab.id, { active: true });
          await browser.windows.update(tab.windowId, { focused: true });
          return tab;
        }
      }
    }

    // Create new tab only if no matching tab found
    logger.info('InstructionExecutor', 'Creating new tab', { url: processedUrl });
    const newTab = await browser.tabs.create({ 
      url: processedUrl, 
      active: true 
    });

    // Wait for tab to load
    await this.waitForTabLoad(newTab.id);

    return newTab;
  }

  async waitForTabLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        browser.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, timeout);

      const listener = (id, changeInfo, tab) => {
        if (id === tabId && changeInfo.status === 'complete') {
          clearTimeout(timer);
          browser.tabs.onUpdated.removeListener(listener);
          resolve(tab);
        }
      };

      browser.tabs.onUpdated.addListener(listener);
    });
  }

  async executeStep(step, index) {
    const startTime = performance.now();

    try {
      logger.debug('InstructionExecutor', `Executing step ${index}`, step);

      // Process variables in step
      const processedStep = this.processStepVariables(step);

      // Execute based on action type
      let result;
      switch (processedStep.action) {
        case CONSTANTS.ACTION_TYPES.CLICK:
          result = await this.executeClick(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.INPUT_TEXT:
          result = await this.executeInputText(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.SELECT_OPTION:
          result = await this.executeSelectOption(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.WAIT_FOR_ELEMENT:
          result = await this.executeWaitForElement(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.WAIT_FOR_CONDITION:
          result = await this.executeWaitForCondition(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.WAIT_FOR_TIME:
          result = await this.executeWaitForTime(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.NAVIGATE:
          result = await this.executeNavigate(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.GET_CONTENT:
          result = await this.executeGetContent(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.EXECUTE_SCRIPT:
          result = await this.executeScript(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.TAKE_SCREENSHOT:
          result = await this.executeTakeScreenshot(processedStep);
          break;

        case CONSTANTS.ACTION_TYPES.KEYBOARD_SHORTCUT:
          result = await this.executeKeyboardShortcut(processedStep);
          break;

        default:
          throw new Error(`Unknown action type: ${processedStep.action}`);
      }

      const duration = performance.now() - startTime;
      return {
        success: true,
        result,
        duration
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('InstructionExecutor', `Step ${index} failed`, error);

      // Try fallback selectors if available
      if (step.alternativeSelectors && step.alternativeSelectors.length > 0) {
        logger.info('InstructionExecutor', 'Trying alternative selectors');
        
        for (const altSelector of step.alternativeSelectors) {
          try {
            const altStep = { ...step, selector: altSelector, alternativeSelectors: [] }; // Prevent infinite recursion
            return await this.executeStep(altStep, index);
          } catch (altError) {
            logger.warn('InstructionExecutor', `Alternative selector failed: ${altSelector}`, altError);
            // Continue to next alternative
          }
        }
      }

      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  processStepVariables(step) {
    const processed = Utils.deepClone(step);

    // Process string values
    const processValue = (value) => {
      if (typeof value === 'string') {
        return Utils.substituteVariables(value, this.variables);
      }
      return value;
    };

    // Process all string properties
    Object.keys(processed).forEach(key => {
      if (typeof processed[key] === 'string') {
        processed[key] = processValue(processed[key]);
      } else if (typeof processed[key] === 'object' && processed[key] !== null) {
        // Recursively process nested objects
        Object.keys(processed[key]).forEach(nestedKey => {
          processed[key][nestedKey] = processValue(processed[key][nestedKey]);
        });
      }
    });

    return processed;
  }

  async sendToContentScript(message) {
    if (!this.currentTab) {
      throw new Error('No current tab');
    }

    // Add unique message ID to prevent duplicate processing
    const messageId = `${Date.now()}-${Math.random()}`;
    const messageWithId = { ...message, messageId };

    // Content scripts are already injected via manifest.json
    // Just add a small delay to ensure they're ready
    await Utils.sleep(100);

    try {
      // Send message with timeout
      const timeoutMs = 5000;
      let timeoutId;
      
      const response = await Promise.race([
        browser.tabs.sendMessage(this.currentTab.id, messageWithId),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Content script not responding'));
          }, timeoutMs);
        })
      ]);
      
      // Clear timeout on success
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      return response;
    } catch (error) {
      logger.error('InstructionExecutor', 'Failed to send message to content script', error);
      throw new Error(`Content script communication failed: ${error.message}`);
    }
  }

  // Action implementations
  async executeClick(step) {
    const response = await this.sendToContentScript({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_STEP,
      step: {
        action: CONSTANTS.ACTION_TYPES.CLICK,
        selector: step.selector,
        selectorStrategy: step.selectorStrategy || CONSTANTS.SELECTOR_STRATEGIES.CSS
      }
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    // Wait after click if specified
    if (step.wait_after) {
      await Utils.sleep(step.wait_after);
    }

    return response.result;
  }

  async executeInputText(step) {
    const response = await this.sendToContentScript({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_STEP,
      step: {
        action: CONSTANTS.ACTION_TYPES.INPUT_TEXT,
        selector: step.selector,
        value: step.value || step.text,
        clear: step.clear_first || step.clear,
        selectorStrategy: step.selectorStrategy || CONSTANTS.SELECTOR_STRATEGIES.CSS
      }
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.result;
  }

  async executeSelectOption(step) {
    const response = await this.sendToContentScript({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_STEP,
      step: {
        action: CONSTANTS.ACTION_TYPES.SELECT_OPTION,
        selector: step.selector,
        value: step.value,
        selectorStrategy: step.selectorStrategy || CONSTANTS.SELECTOR_STRATEGIES.CSS
      }
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.result;
  }

  async executeWaitForElement(step) {
    const timeout = step.timeout || CONSTANTS.TIMEOUTS.ELEMENT_WAIT;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await this.sendToContentScript({
        type: 'CHECK_ELEMENT',
        selector: step.selector,
        selectorStrategy: step.selectorStrategy || CONSTANTS.SELECTOR_STRATEGIES.CSS
      });

      if (response.exists) {
        return { found: true };
      }

      await Utils.sleep(100);
    }

    throw new Error(`Element not found: ${step.selector}`);
  }

  async executeWaitForCondition(step) {
    const timeout = step.timeout || CONSTANTS.TIMEOUTS.DEFAULT_WAIT;
    const condition = step.condition;

    if (condition.type === 'custom_script') {
      const response = await this.sendToContentScript({
        type: CONSTANTS.MESSAGE_TYPES.EXECUTE_STEP,
        step: {
          action: 'WAIT_CUSTOM',
          script: condition.script,
          timeout
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.result;
    }

    // Handle other condition types
    throw new Error(`Unsupported condition type: ${condition.type}`);
  }

  async executeWaitForTime(step) {
    const duration = step.duration || step.timeout || 1000;
    await Utils.sleep(duration);
    return { waited: duration };
  }

  async executeNavigate(step) {
    const url = step.url;
    await browser.tabs.update(this.currentTab.id, { url });
    await this.waitForTabLoad(this.currentTab.id);
    return { navigated: url };
  }

  async executeGetContent(step) {
    const response = await this.sendToContentScript({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_STEP,
      step: {
        action: CONSTANTS.ACTION_TYPES.GET_CONTENT,
        selector: step.selector,
        property: step.property || 'textContent',
        selectorStrategy: step.selectorStrategy || CONSTANTS.SELECTOR_STRATEGIES.CSS
      }
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    // Store in variable if specified
    if (step.store_as) {
      this.variables[step.store_as] = response.result;
    }

    return response.result;
  }

  async executeScript(step) {
    const response = await this.sendToContentScript({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_STEP,
      step: {
        action: CONSTANTS.ACTION_TYPES.EXECUTE_SCRIPT,
        script: step.script
      }
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.result;
  }

  async executeTakeScreenshot(step) {
    const dataUrl = await browser.tabs.captureVisibleTab(
      this.currentTab.windowId,
      { format: 'png' }
    );

    // Store in variable if specified
    if (step.store_as) {
      this.variables[step.store_as] = dataUrl;
    }

    return { screenshot: dataUrl };
  }

  async executeKeyboardShortcut(step) {
    const response = await this.sendToContentScript({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_STEP,
      step: {
        action: CONSTANTS.ACTION_TYPES.KEYBOARD_SHORTCUT,
        keys: step.keys,
        selector: step.selector
      }
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.result;
  }

  stop() {
    this.shouldStop = true;
  }
  
  async updateExecutionState(status, data = {}) {
    try {
      await browser.runtime.sendMessage({
        type: 'UPDATE_EXECUTION_STATE',
        data: {
          status,
          ...data
        }
      });
    } catch (error) {
      // Ignore errors - background script might not be listening
      logger.debug('InstructionExecutor', 'Could not update execution state', error);
    }
  }
}

// Export for use in background script
if (typeof window !== 'undefined') {
  window.InstructionExecutor = InstructionExecutor;
}