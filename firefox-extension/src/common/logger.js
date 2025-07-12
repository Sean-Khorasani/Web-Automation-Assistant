/**
 * Logger utility for debugging and error tracking
 */

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = CONSTANTS.UI.MAX_LOG_ENTRIES;
    this.logLevel = 'info'; // Default level
    this.initLogLevel();
  }

  async initLogLevel() {
    try {
      // Use browser.storage for Firefox, chrome.storage for Chrome
      const storage = typeof browser !== 'undefined' ? browser.storage : (typeof chrome !== 'undefined' ? chrome.storage : null);
      if (storage) {
        const result = await storage.local.get(['logLevel']);
        if (result.logLevel) {
          this.logLevel = result.logLevel;
        }
      } else if (typeof localStorage !== 'undefined') {
        // Fallback to localStorage for options page
        this.logLevel = localStorage.getItem('logLevel') || 'info';
      }
    } catch (error) {
      console.error('Failed to init log level:', error);
    }
  }

  async setLogLevel(level) {
    this.logLevel = level;
    try {
      const storage = typeof browser !== 'undefined' ? browser.storage : (typeof chrome !== 'undefined' ? chrome.storage : null);
      if (storage) {
        await storage.local.set({ logLevel: level });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('logLevel', level);
      }
    } catch (error) {
      console.error('Failed to save log level:', error);
    }
  }

  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  formatMessage(level, component, message, data) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      component,
      message,
      data: data || null
    };
  }

  addLog(logEntry) {
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }
  }

  debug(component, message, data) {
    if (!this.shouldLog('debug')) return;
    
    const logEntry = this.formatMessage('debug', component, message, data);
    this.addLog(logEntry);
    console.debug(`[${component}]`, message, data || '');
  }

  info(component, message, data) {
    if (!this.shouldLog('info')) return;
    
    const logEntry = this.formatMessage('info', component, message, data);
    this.addLog(logEntry);
    console.info(`[${component}]`, message, data || '');
  }

  warn(component, message, data) {
    if (!this.shouldLog('warn')) return;
    
    const logEntry = this.formatMessage('warn', component, message, data);
    this.addLog(logEntry);
    console.warn(`[${component}]`, message, data || '');
  }

  error(component, message, error) {
    if (!this.shouldLog('error')) return;
    
    const errorData = {
      message: error?.message || error,
      stack: error?.stack || null,
      code: error?.code || null
    };
    
    const logEntry = this.formatMessage('error', component, message, errorData);
    this.addLog(logEntry);
    console.error(`[${component}]`, message, error);
  }

  getLogs(filter = {}) {
    let filteredLogs = [...this.logs];
    
    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }
    
    if (filter.component) {
      filteredLogs = filteredLogs.filter(log => log.component === filter.component);
    }
    
    if (filter.startTime) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= new Date(filter.startTime)
      );
    }
    
    if (filter.endTime) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) <= new Date(filter.endTime)
      );
    }
    
    return filteredLogs;
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  // Create a performance timer
  startTimer(label) {
    const startTime = performance.now();
    return {
      end: () => {
        const duration = performance.now() - startTime;
        this.debug('Performance', `${label} took ${duration.toFixed(2)}ms`, { duration });
        return duration;
      }
    };
  }
}

// Create singleton instance
const logger = new Logger();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = logger;
}