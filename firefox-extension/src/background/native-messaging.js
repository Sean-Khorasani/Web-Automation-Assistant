/**
 * Native Messaging handler for communication with external applications
 */

class NativeMessagingHandler {
  constructor() {
    this.port = null;
    this.connected = false;
    this.messageQueue = [];
    this.responseHandlers = new Map();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.maxReconnectAttempts = 3; // Stop after 3 attempts
    this.enabled = true;
    this.userDisabled = false; // Track if user manually disabled
  }

  connect() {
    if (this.userDisabled) {
      logger.info('NativeMessaging', 'Native messaging is disabled by user');
      return;
    }
    
    try {
      logger.info('NativeMessaging', 'Attempting to connect to native host');
      
      this.port = browser.runtime.connectNative(CONSTANTS.NATIVE_MESSAGING.HOST_NAME);
      
      this.port.onMessage.addListener(this.handleMessage.bind(this));
      this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));
      
      this.connected = true;
      this.reconnectAttempts = 0;
      
      logger.info('NativeMessaging', 'Connected to native host');
      
      // Send any queued messages
      this.flushMessageQueue();
      
      // Don't ping immediately - let the connection stabilize
      // The native host will disconnect if it's not actually running
      
    } catch (error) {
      logger.error('NativeMessaging', 'Failed to connect to native host', error);
      this.connected = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
      this.port = null;
    }
    
    this.connected = false;
    this.responseHandlers.clear();
    
    logger.info('NativeMessaging', 'Disconnected from native host');
  }

  handleMessage(message) {
    logger.debug('NativeMessaging', 'Received message', message);
    
    // Handle response messages
    if (message.id && this.responseHandlers.has(message.id)) {
      const handler = this.responseHandlers.get(message.id);
      this.responseHandlers.delete(message.id);
      
      if (message.error) {
        handler.reject(new Error(message.error));
      } else {
        handler.resolve(message.result);
      }
      return;
    }
    
    // Handle request messages from native host
    if (message.type === 'execute') {
      this.handleExecuteRequest(message);
    } else if (message.type === 'ping') {
      this.sendMessage({ type: 'pong', id: message.id });
    }
  }

  handleDisconnect() {
    logger.warn('NativeMessaging', 'Disconnected from native host');
    
    this.connected = false;
    this.port = null;
    
    // Reject all pending responses
    for (const [id, handler] of this.responseHandlers) {
      handler.reject(new Error('Native messaging disconnected'));
    }
    this.responseHandlers.clear();
    
    // Schedule reconnection
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (!this.enabled || this.userDisabled) {
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('NativeMessaging', 'Max reconnection attempts reached. Native messaging disabled.');
      logger.error('NativeMessaging', 'To fix: Install the native host by running install.bat as administrator');
      this.enabled = false;
      return;
    }
    
    const delay = CONSTANTS.NATIVE_MESSAGING.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    logger.info('NativeMessaging', `Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!message.id) {
        message.id = Utils.generateId();
      }
      
      // Store response handler
      this.responseHandlers.set(message.id, { resolve, reject });
      
      // Set timeout for response
      setTimeout(() => {
        if (this.responseHandlers.has(message.id)) {
          this.responseHandlers.delete(message.id);
          reject(new Error('Response timeout'));
        }
      }, CONSTANTS.TIMEOUTS.DEFAULT_WAIT);
      
      if (this.connected && this.port) {
        try {
          this.port.postMessage(message);
          logger.debug('NativeMessaging', 'Sent message', message);
        } catch (error) {
          logger.error('NativeMessaging', 'Failed to send message', error);
          this.responseHandlers.delete(message.id);
          reject(error);
        }
      } else {
        // Queue message for later
        this.messageQueue.push(message);
        logger.debug('NativeMessaging', 'Message queued (not connected)', message);
        
        // Try to connect if not already attempting
        if (!this.reconnectTimer) {
          this.connect();
        }
      }
    });
  }

  flushMessageQueue() {
    if (!this.connected || !this.port) {
      return;
    }
    
    logger.info('NativeMessaging', `Flushing ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      try {
        this.port.postMessage(message);
      } catch (error) {
        logger.error('NativeMessaging', 'Failed to send queued message', error);
        // Put it back in the queue
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  async ping() {
    try {
      await this.sendMessage({ type: 'ping' });
      logger.debug('NativeMessaging', 'Ping successful');
      return true;
    } catch (error) {
      logger.error('NativeMessaging', 'Ping failed', error);
      return false;
    }
  }

  async handleExecuteRequest(message) {
    try {
      logger.info('NativeMessaging', 'Handling execute request', message.request);
      
      const response = {
        type: 'response',
        id: message.id
      };
      
      // Handle different request types
      switch (message.request.action) {
        case 'list':
          const listResult = await StorageManager.getAllInstructions();
          response.result = {
            success: listResult.success,
            instructions: listResult.instructions.map(i => ({
              id: i.id,
              name: i.name,
              url: i.url,
              created: i.created
            }))
          };
          break;
          
        case 'run':
          const executor = new InstructionExecutor();
          const runResult = await executor.execute(
            message.request.instruction,
            message.request.variables
          );
          response.result = runResult;
          break;
          
        case 'get':
          const getResult = await StorageManager.getInstruction(message.request.id);
          response.result = getResult;
          break;
          
        case 'save':
          const saveResult = await StorageManager.saveInstruction(message.request.instruction);
          response.result = saveResult;
          break;
          
        case 'delete':
          const deleteResult = await StorageManager.deleteInstruction(message.request.id);
          response.result = deleteResult;
          break;
          
        default:
          response.error = `Unknown action: ${message.request.action}`;
      }
      
      this.sendMessage(response);
      
    } catch (error) {
      logger.error('NativeMessaging', 'Failed to handle execute request', error);
      
      this.sendMessage({
        type: 'response',
        id: message.id,
        error: error.message
      });
    }
  }

  // API methods for external use
  async executeInstruction(instructionName, variables = {}) {
    const message = {
      type: 'execute',
      request: {
        action: 'run',
        instruction: instructionName,
        variables: variables
      }
    };
    
    return await this.sendMessage(message);
  }

  async listInstructions() {
    const message = {
      type: 'execute',
      request: {
        action: 'list'
      }
    };
    
    return await this.sendMessage(message);
  }

  async getInstruction(id) {
    const message = {
      type: 'execute',
      request: {
        action: 'get',
        id: id
      }
    };
    
    return await this.sendMessage(message);
  }

  async saveInstruction(instruction) {
    const message = {
      type: 'execute',
      request: {
        action: 'save',
        instruction: instruction
      }
    };
    
    return await this.sendMessage(message);
  }

  async deleteInstruction(id) {
    const message = {
      type: 'execute',
      request: {
        action: 'delete',
        id: id
      }
    };
    
    return await this.sendMessage(message);
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      pendingResponses: this.responseHandlers.size,
      enabled: this.enabled,
      userDisabled: this.userDisabled
    };
  }
  
  disable() {
    logger.info('NativeMessaging', 'Disabling native messaging');
    this.userDisabled = true;
    this.enabled = false;
    this.disconnect();
  }
  
  enable() {
    logger.info('NativeMessaging', 'Enabling native messaging');
    this.userDisabled = false;
    this.enabled = true;
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// Create singleton instance
const NativeMessaging = new NativeMessagingHandler();

// Export for use in background script
if (typeof window !== 'undefined') {
  window.NativeMessaging = NativeMessaging;
}