/**
 * Element Selector - Generates multiple selector strategies for elements
 */

class ElementSelector {
  static generateSelectors(element) {
    if (!element) {
      throw new Error('Element is required');
    }

    const selectors = {
      primary: null,
      alternatives: []
    };

    // Strategy 1: ID (highest priority)
    const idSelector = this.getIdSelector(element);
    if (idSelector) {
      selectors.primary = idSelector;
      selectors.alternatives.push(idSelector);
    }

    // Strategy 2: Data attributes
    const dataSelector = this.getDataAttributeSelector(element);
    if (dataSelector) {
      if (!selectors.primary) {
        selectors.primary = dataSelector;
      }
      selectors.alternatives.push(dataSelector);
    }

    // Strategy 3: ARIA attributes
    const ariaSelector = this.getAriaSelector(element);
    if (ariaSelector) {
      if (!selectors.primary) {
        selectors.primary = ariaSelector;
      }
      selectors.alternatives.push(ariaSelector);
    }

    // Strategy 4: Optimized CSS selector
    const cssSelector = this.getCssSelector(element);
    if (cssSelector) {
      if (!selectors.primary) {
        selectors.primary = cssSelector;
      }
      selectors.alternatives.push(cssSelector);
    }

    // Strategy 5: XPath
    const xpathSelector = this.getXPathSelector(element);
    if (xpathSelector) {
      selectors.alternatives.push(xpathSelector);
    }

    // Strategy 6: Text content (for buttons/links)
    if (['BUTTON', 'A'].includes(element.tagName)) {
      const textSelector = this.getTextSelector(element);
      if (textSelector) {
        selectors.alternatives.push(textSelector);
      }
    }

    // Strategy 7: Position-based selector
    const positionSelector = this.getPositionSelector(element);
    if (positionSelector) {
      selectors.alternatives.push(positionSelector);
    }

    // Remove duplicates from alternatives
    selectors.alternatives = this.removeDuplicateSelectors(selectors.alternatives);

    // Ensure we have at least one selector
    if (!selectors.primary && selectors.alternatives.length > 0) {
      selectors.primary = selectors.alternatives[0];
    }

    return selectors;
  }

  static getIdSelector(element) {
    if (element.id && this.isValidId(element.id)) {
      return {
        strategy: CONSTANTS.SELECTOR_STRATEGIES.ID,
        value: element.id,
        css: `#${CSS.escape(element.id)}`
      };
    }
    return null;
  }

  static getDataAttributeSelector(element) {
    // Look for common data attributes used for testing
    const testAttributes = ['data-testid', 'data-test', 'data-cy', 'data-test-id', 'data-qa'];
    
    for (const attr of testAttributes) {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);
        return {
          strategy: CONSTANTS.SELECTOR_STRATEGIES.DATA_ATTR,
          attribute: attr,
          value: value,
          css: `[${attr}="${CSS.escape(value)}"]`
        };
      }
    }

    // Look for any unique data attribute
    const attributes = element.attributes;
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      if (attr.name.startsWith('data-') && attr.value) {
        // Check if this selector is unique
        const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
        if (document.querySelectorAll(selector).length === 1) {
          return {
            strategy: CONSTANTS.SELECTOR_STRATEGIES.DATA_ATTR,
            attribute: attr.name,
            value: attr.value,
            css: selector
          };
        }
      }
    }

    return null;
  }

  static getAriaSelector(element) {
    const ariaAttributes = ['aria-label', 'aria-labelledby', 'aria-describedby'];
    
    for (const attr of ariaAttributes) {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);
        const selector = `[${attr}="${CSS.escape(value)}"]`;
        
        // Add tag name for more specificity if needed
        const elements = document.querySelectorAll(selector);
        if (elements.length === 1) {
          return {
            strategy: CONSTANTS.SELECTOR_STRATEGIES.ARIA,
            attribute: attr,
            value: value,
            css: selector
          };
        } else if (elements.length > 1) {
          const tagSelector = `${element.tagName.toLowerCase()}${selector}`;
          if (document.querySelectorAll(tagSelector).length === 1) {
            return {
              strategy: CONSTANTS.SELECTOR_STRATEGIES.ARIA,
              attribute: attr,
              value: value,
              css: tagSelector
            };
          }
        }
      }
    }

    // Check for role attribute
    if (element.hasAttribute('role')) {
      const role = element.getAttribute('role');
      const selector = `[role="${role}"]`;
      
      // Combine with other attributes for uniqueness
      if (element.hasAttribute('name')) {
        const nameSelector = `${selector}[name="${CSS.escape(element.getAttribute('name'))}"]`;
        if (document.querySelectorAll(nameSelector).length === 1) {
          return {
            strategy: CONSTANTS.SELECTOR_STRATEGIES.ARIA,
            attribute: 'role+name',
            value: `${role}+${element.getAttribute('name')}`,
            css: nameSelector
          };
        }
      }
    }

    return null;
  }

  static getCssSelector(element) {
    // Build CSS selector from bottom up
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      // Add ID if available
      if (current.id && this.isValidId(current.id)) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break; // ID is unique, no need to go further
      }

      // Add classes
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/)
          .filter(cls => cls && !cls.startsWith('ng-') && !cls.startsWith('v-')) // Filter framework classes
          .map(cls => `.${CSS.escape(cls)}`);
        
        if (classes.length > 0) {
          selector += classes.join('');
        }
      }

      // Add attributes for uniqueness
      const uniqueAttrs = ['type', 'name', 'placeholder', 'value'];
      for (const attr of uniqueAttrs) {
        if (current.hasAttribute(attr)) {
          const value = current.getAttribute(attr);
          if (value && value.length < 50) { // Avoid very long values
            selector += `[${attr}="${CSS.escape(value)}"]`;
            break;
          }
        }
      }

      // Check if this selector is unique among siblings
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        const matchingSiblings = siblings.filter(sib => 
          sib.matches(selector)
        );

        if (matchingSiblings.length > 1) {
          // Add nth-child
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    const fullSelector = path.join(' > ');
    
    // Optimize selector - try to shorten it
    const optimized = this.optimizeCssSelector(element, fullSelector);
    
    return {
      strategy: CONSTANTS.SELECTOR_STRATEGIES.CSS,
      value: optimized,
      css: optimized
    };
  }

  static optimizeCssSelector(element, fullSelector) {
    // Try to find the shortest unique selector
    const parts = fullSelector.split(' > ');
    
    // Try starting from the end
    for (let i = parts.length - 1; i >= 0; i--) {
      const shortSelector = parts.slice(i).join(' > ');
      const matches = document.querySelectorAll(shortSelector);
      
      if (matches.length === 1 && matches[0] === element) {
        return shortSelector;
      }
    }

    return fullSelector;
  }

  static getXPathSelector(element) {
    const paths = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && 
            sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = current.tagName.toLowerCase();
      const pathIndex = index > 0 ? `[${index + 1}]` : '';
      
      // Add attributes to make XPath more specific
      let attributes = '';
      if (current.id && this.isValidId(current.id)) {
        paths.unshift(`${tagName}[@id="${current.id}"]`);
        break; // ID is unique
      } else if (current.className) {
        attributes = `[@class="${current.className}"]`;
      }

      paths.unshift(`${tagName}${pathIndex}${attributes}`);
      current = current.parentElement;
    }

    const xpath = '/' + paths.join('/');
    
    return {
      strategy: CONSTANTS.SELECTOR_STRATEGIES.XPATH,
      value: xpath,
      xpath: xpath
    };
  }

  static getTextSelector(element) {
    const text = element.textContent.trim();
    
    if (!text || text.length > 100) {
      return null;
    }

    const tagName = element.tagName.toLowerCase();
    
    // Try exact text match
    let selector = `${tagName}:contains("${text}")`;
    
    // For more specific matching, we'll need to implement a custom contains
    // that checks exact text content
    return {
      strategy: CONSTANTS.SELECTOR_STRATEGIES.TEXT,
      value: text,
      css: selector,
      customMatch: true // Indicates this needs custom matching logic
    };
  }

  static getPositionSelector(element) {
    // Get element's position relative to viewport and document
    const rect = element.getBoundingClientRect();
    const position = {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height
    };

    // Find a nearby landmark element (with ID)
    const landmark = this.findNearestLandmark(element);
    
    if (landmark) {
      const landmarkRect = landmark.getBoundingClientRect();
      const relativePosition = {
        top: rect.top - landmarkRect.top,
        left: rect.left - landmarkRect.left
      };

      return {
        strategy: CONSTANTS.SELECTOR_STRATEGIES.POSITION,
        landmark: `#${landmark.id}`,
        relative: relativePosition,
        tagName: element.tagName.toLowerCase(),
        position: position
      };
    }

    return null;
  }

  static findNearestLandmark(element) {
    let current = element.parentElement;
    let maxLevels = 5;
    
    while (current && maxLevels > 0) {
      // Check current element
      if (current.id && this.isValidId(current.id)) {
        return current;
      }

      // Check siblings
      const siblings = Array.from(current.children);
      for (const sibling of siblings) {
        if (sibling !== element && sibling.id && this.isValidId(sibling.id)) {
          return sibling;
        }
      }

      current = current.parentElement;
      maxLevels--;
    }

    return null;
  }

  static isValidId(id) {
    // Check if ID is not auto-generated or framework-specific
    const invalidPatterns = [
      /^ng-/,
      /^v-/,
      /^react-/,
      /^ember/,
      /^\d+$/, // Pure numbers
      /^[a-f0-9]{8,}$/i, // Hex strings (likely generated)
      /^(null|undefined|false|true)$/i
    ];

    return !invalidPatterns.some(pattern => pattern.test(id));
  }

  static removeDuplicateSelectors(selectors) {
    const seen = new Set();
    const unique = [];

    for (const selector of selectors) {
      const key = `${selector.strategy}:${selector.value || selector.css}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(selector);
      }
    }

    return unique;
  }

  static testSelector(selector) {
    try {
      let elements;
      
      switch (selector.strategy) {
        case CONSTANTS.SELECTOR_STRATEGIES.ID:
          elements = [document.getElementById(selector.value)].filter(Boolean);
          break;
          
        case CONSTANTS.SELECTOR_STRATEGIES.CSS:
        case CONSTANTS.SELECTOR_STRATEGIES.DATA_ATTR:
        case CONSTANTS.SELECTOR_STRATEGIES.ARIA:
          elements = document.querySelectorAll(selector.css);
          break;
          
        case CONSTANTS.SELECTOR_STRATEGIES.XPATH:
          const result = document.evaluate(
            selector.xpath,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          elements = [];
          for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i));
          }
          break;
          
        case CONSTANTS.SELECTOR_STRATEGIES.TEXT:
          // Custom text matching would go here
          elements = [];
          break;
          
        default:
          elements = [];
      }

      return {
        found: elements.length > 0,
        count: elements.length,
        elements: Array.from(elements)
      };
    } catch (error) {
      return {
        found: false,
        count: 0,
        elements: [],
        error: error.message
      };
    }
  }
}