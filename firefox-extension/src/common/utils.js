/**
 * Common utility functions
 */

const Utils = {
  /**
   * Generate a unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Deep clone an object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Sleep/delay function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Retry function with exponential backoff
   */
  async retry(fn, options = {}) {
    const {
      maxAttempts = CONSTANTS.TIMEOUTS.MAX_RETRIES,
      delay = CONSTANTS.TIMEOUTS.RETRY_DELAY,
      backoff = 2,
      onRetry = null
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        if (onRetry) {
          onRetry(error, attempt);
        }
        
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await this.sleep(waitTime);
      }
    }
    
    throw lastError;
  },

  /**
   * Format timestamp
   */
  formatTimestamp(date = new Date()) {
    return date.toISOString().replace('T', ' ').substr(0, 19);
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  },

  /**
   * Parse URL and extract components
   */
  parseUrl(url) {
    try {
      const urlObj = new URL(url);
      return {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port,
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash,
        origin: urlObj.origin
      };
    } catch (error) {
      return null;
    }
  },

  /**
   * Check if URL matches pattern
   */
  matchUrlPattern(url, pattern) {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  },

  /**
   * Validate selector
   */
  isValidSelector(selector, type = 'css') {
    try {
      if (type === 'css') {
        document.createElement('div').querySelector(selector);
        return true;
      } else if (type === 'xpath') {
        document.evaluate(selector, document, null, XPathResult.ANY_TYPE, null);
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  },

  /**
   * Get element by various selector types
   */
  getElement(selector, strategy = CONSTANTS.SELECTOR_STRATEGIES.CSS) {
    try {
      switch (strategy) {
        case CONSTANTS.SELECTOR_STRATEGIES.ID:
          return document.getElementById(selector);
          
        case CONSTANTS.SELECTOR_STRATEGIES.CSS:
          return document.querySelector(selector);
          
        case CONSTANTS.SELECTOR_STRATEGIES.XPATH:
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          return result.singleNodeValue;
          
        case CONSTANTS.SELECTOR_STRATEGIES.TEXT:
          const elements = document.querySelectorAll('*');
          for (let element of elements) {
            if (element.textContent?.trim() === selector) {
              return element;
            }
          }
          return null;
          
        case CONSTANTS.SELECTOR_STRATEGIES.ARIA:
          return document.querySelector(`[aria-label="${selector}"]`);
          
        default:
          return null;
      }
    } catch (error) {
      logger.error('Utils', 'Failed to get element', error);
      return null;
    }
  },

  /**
   * Wait for condition with timeout
   */
  async waitForCondition(conditionFn, options = {}) {
    const {
      timeout = CONSTANTS.TIMEOUTS.DEFAULT_WAIT,
      interval = 100,
      message = 'Condition not met'
    } = options;

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await conditionFn();
        if (result) {
          return result;
        }
      } catch (error) {
        // Ignore errors during condition check
      }
      
      await this.sleep(interval);
    }
    
    throw new Error(`Timeout: ${message}`);
  },

  /**
   * Sanitize filename
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substr(0, 255);
  },

  /**
   * Create download link
   */
  downloadFile(content, filename, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Get element position and size
   */
  getElementRect(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      bottom: rect.bottom + window.scrollY,
      right: rect.right + window.scrollX,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2 + window.scrollX,
      centerY: rect.top + rect.height / 2 + window.scrollY
    };
  },

  /**
   * Check if element is visible
   */
  isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    
    // Check if element is in viewport
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  },

  /**
   * Serialize form data
   */
  serializeForm(form) {
    const data = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const name = input.name || input.id;
      if (!name) return;
      
      if (input.type === 'checkbox') {
        data[name] = input.checked;
      } else if (input.type === 'radio') {
        if (input.checked) {
          data[name] = input.value;
        }
      } else {
        data[name] = input.value;
      }
    });
    
    return data;
  },

  /**
   * Variable substitution in strings
   */
  substituteVariables(text, variables = {}) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables.hasOwnProperty(key) ? variables[key] : match;
    });
  },

  /**
   * Compare two objects for equality
   */
  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return false;
    
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (let key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}