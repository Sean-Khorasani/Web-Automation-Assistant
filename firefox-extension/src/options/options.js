/**
 * Options page script for managing scripts
 */

// State
const optionsState = {
  instructions: [],
  filteredInstructions: [],
  currentFilter: 'all',
  currentSort: 'modified-desc',
  searchQuery: '',
  selectedInstructions: new Set()
};

// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Options', 'Initializing options page');
  
  // Set up event listeners
  setupEventListeners();
  
  // Load scripts
  await loadInstructions();
  
  // Update statistics
  await updateStatistics();
  
  // Check for URL parameters
  checkUrlParameters();
});

// Set up event listeners
function setupEventListeners() {
  // Header actions
  document.getElementById('newInstructionBtn').addEventListener('click', createNewInstruction);
  document.getElementById('importBtn').addEventListener('click', importInstructions);
  document.getElementById('exportBtn').addEventListener('click', exportAllInstructions);
  
  // Search and filter
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  document.querySelectorAll('input[name="filter"]').forEach(radio => {
    radio.addEventListener('change', handleFilterChange);
  });
  document.getElementById('sortSelect').addEventListener('change', handleSortChange);
  
  // File import
  document.getElementById('importFile').addEventListener('change', handleFileImport);
  
  // Settings button (if exists)
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }
}

// Set up event delegation for instruction actions
function setupInstructionEventDelegation() {
  const container = document.getElementById('instructionsGrid');
  if (!container) return;
  
  // Remove any existing listener to prevent duplicates
  if (container._clickHandler) {
    container.removeEventListener('click', container._clickHandler);
  }
  
  // Create and store the click handler
  container._clickHandler = async function(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.getAttribute('data-action');
    const id = button.getAttribute('data-id');
    
    switch (action) {
      case 'toggle-favorite':
        await toggleFavorite(id);
        break;
      case 'run':
        await runInstruction(id);
        break;
      case 'edit':
        await editInstruction(id);
        break;
      case 'duplicate':
        await duplicateInstruction(id);
        break;
      case 'delete':
        await deleteInstruction(id);
        break;
    }
  };
  
  container.addEventListener('click', container._clickHandler);
}

// Load all scripts
async function loadInstructions() {
  try {
    logger.info('Options', 'Loading scripts...');
    
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.GET_ALL_INSTRUCTIONS
    });
    
    logger.info('Options', 'Load response:', response);
    
    if (response && response.success) {
      optionsState.instructions = response.instructions || [];
      logger.info('Options', `Loaded ${optionsState.instructions.length} scripts`);
      applyFiltersAndSort();
      renderInstructions();
    } else {
      logger.error('Options', 'Failed response:', response);
      showError(response?.error || 'Failed to load scripts');
      
      // Show empty state
      optionsState.instructions = [];
      renderInstructions();
    }
  } catch (error) {
    logger.error('Options', 'Failed to load scripts', error);
    showError(`Error loading scripts: ${error.message}`);
    
    // Show empty state
    optionsState.instructions = [];
    renderInstructions();
  }
}

// Apply filters and sorting
function applyFiltersAndSort() {
  let filtered = [...optionsState.instructions];
  
  // Apply search filter
  if (optionsState.searchQuery) {
    const query = optionsState.searchQuery.toLowerCase();
    filtered = filtered.filter(instruction => 
      instruction.name.toLowerCase().includes(query) ||
      (instruction.url && instruction.url.toLowerCase().includes(query)) ||
      (instruction.description && instruction.description.toLowerCase().includes(query))
    );
  }
  
  // Apply category filter
  switch (optionsState.currentFilter) {
    case 'recent':
      // Filter to instructions used in last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(instruction => 
        instruction.lastUsed && new Date(instruction.lastUsed) > weekAgo
      );
      break;
    case 'favorites':
      filtered = filtered.filter(instruction => instruction.favorite);
      break;
  }
  
  // Apply sorting
  const [sortField, sortOrder] = optionsState.currentSort.split('-');
  filtered.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortField) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'modified':
        aVal = new Date(a.modified);
        bVal = new Date(b.modified);
        break;
      case 'created':
        aVal = new Date(a.created);
        bVal = new Date(b.created);
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return bVal > aVal ? 1 : -1;
    }
  });
  
  optionsState.filteredInstructions = filtered;
}

// Render scripts grid
function renderInstructions() {
  const container = document.getElementById('instructionsGrid');
  
  if (optionsState.filteredInstructions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div>${optionsState.searchQuery ? 'No scripts match your search' : 'No scripts yet'}</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = optionsState.filteredInstructions.map(instruction => `
    <div class="instruction-card" data-id="${instruction.id}">
      <div class="instruction-header">
        <div>
          <div class="instruction-title">${Utils.escapeHtml(instruction.name)}</div>
          <div class="instruction-url">${Utils.escapeHtml(instruction.url || 'Any page')}</div>
        </div>
        <button class="instruction-favorite ${instruction.favorite ? 'active' : ''}" 
                data-action="toggle-favorite"
                data-id="${instruction.id}"
                title="Toggle favorite">
          ⭐
        </button>
      </div>
      <div class="instruction-meta">
        <span>${instruction.steps.length} steps</span>
        <span>Modified ${formatDate(instruction.modified)}</span>
      </div>
      <div class="instruction-actions">
        <button class="btn btn-primary btn-sm" data-action="run" data-id="${instruction.id}">
          ▶️ Run
        </button>
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${instruction.id}">
          ✏️ Edit
        </button>
        <button class="btn btn-secondary btn-sm" data-action="duplicate" data-id="${instruction.id}">
          📋 Duplicate
        </button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${instruction.id}">
          🗑️ Delete
        </button>
      </div>
    </div>
  `).join('');
  
  // Add event delegation for instruction actions
  setupInstructionEventDelegation();
}

// Event handlers
function handleSearch(event) {
  optionsState.searchQuery = event.target.value;
  applyFiltersAndSort();
  renderInstructions();
}

function handleFilterChange(event) {
  optionsState.currentFilter = event.target.value;
  applyFiltersAndSort();
  renderInstructions();
}

function handleSortChange(event) {
  optionsState.currentSort = event.target.value;
  applyFiltersAndSort();
  renderInstructions();
}

// Create new script
function createNewInstruction() {
  const newInstruction = {
    id: Utils.generateId(),
    name: 'New Script',
    url: '',
    steps: [],
    variables: {},
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    version: '1.0'
  };
  
  openEditor(newInstruction, true);
}

// Run script
async function runInstruction(id) {
  try {
    // Show running notification
    showNotification('Starting script execution...', 'info');
    
    // Find and disable all run buttons for this script
    const buttons = document.querySelectorAll(`button[data-action="run"][data-id="${id}"]`);
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.innerHTML = '⏳ Running...';
    });
    
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_INSTRUCTION,
      data: {
        instructionId: id
      }
    });
    
    if (response.success) {
      showNotification('Script executed successfully', 'success');
    } else {
      showNotification(response.error || 'Execution failed', 'error');
    }
    
    // Re-enable buttons after execution
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.innerHTML = '▶️ Run';
    });
  } catch (error) {
    logger.error('Options', 'Failed to run script', error);
    showNotification('Error running script', 'error');
    
    // Re-enable buttons on error
    const buttons = document.querySelectorAll(`button[data-action="run"][data-id="${id}"]`);
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.innerHTML = '▶️ Run';
    });
  }
};

// Edit script
async function editInstruction(id) {
  const instruction = optionsState.instructions.find(i => i.id === id);
  if (instruction) {
    openEditor(instruction, false);
  }
};

// Duplicate script
async function duplicateInstruction(id) {
  const instruction = optionsState.instructions.find(i => i.id === id);
  if (!instruction) return;
  
  const duplicate = {
    ...Utils.deepClone(instruction),
    id: Utils.generateId(),
    name: `${instruction.name} (Copy)`,
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  };
  
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.SAVE_INSTRUCTION,
      data: duplicate
    });
    
    if (response.success) {
      showNotification('Script duplicated', 'success');
      await loadInstructions();
    } else {
      showNotification('Failed to duplicate script', 'error');
    }
  } catch (error) {
    logger.error('Options', 'Failed to duplicate script', error);
    showNotification('Error duplicating script', 'error');
  }
};

// Delete script
async function deleteInstruction(id) {
  if (!confirm('Are you sure you want to delete this script?')) {
    return;
  }
  
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.DELETE_INSTRUCTION,
      data: { id }
    });
    
    if (response.success) {
      showNotification('Script deleted', 'success');
      await loadInstructions();
    } else {
      showNotification('Failed to delete script', 'error');
    }
  } catch (error) {
    logger.error('Options', 'Failed to delete script', error);
    showNotification('Error deleting script', 'error');
  }
};

// Toggle favorite
async function toggleFavorite(id) {
  const instruction = optionsState.instructions.find(i => i.id === id);
  if (!instruction) return;
  
  instruction.favorite = !instruction.favorite;
  
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.UPDATE_INSTRUCTION,
      data: {
        id,
        updates: { favorite: instruction.favorite }
      }
    });
    
    if (response.success) {
      renderInstructions();
    }
  } catch (error) {
    logger.error('Options', 'Failed to toggle favorite', error);
  }
};

// Import scripts
function importInstructions() {
  document.getElementById('importFile').click();
}

// Handle file import
async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validate format
    if (!data.instructions || !Array.isArray(data.instructions)) {
      throw new Error('Invalid file format');
    }
    
    // Import scripts
    let imported = 0;
    for (const instruction of data.instructions) {
      try {
        const response = await browser.runtime.sendMessage({
          type: CONSTANTS.MESSAGE_TYPES.SAVE_INSTRUCTION,
          data: {
            ...instruction,
            id: Utils.generateId(), // Generate new ID
            imported: new Date().toISOString()
          }
        });
        
        if (response.success) {
          imported++;
        }
      } catch (error) {
        logger.error('Options', 'Failed to import instruction', error);
      }
    }
    
    showNotification(`Imported ${imported} of ${data.instructions.length} scripts`, 'success');
    await loadInstructions();
    
  } catch (error) {
    logger.error('Options', 'Failed to import file', error);
    showNotification('Invalid file or format', 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

// Export all scripts
async function exportAllInstructions() {
  try {
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      instructions: optionsState.instructions
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const filename = `web-automation-export-${new Date().toISOString().split('T')[0]}.json`;
    
    Utils.downloadFile(json, filename, 'application/json');
    showNotification('Scripts exported successfully', 'success');
    
  } catch (error) {
    logger.error('Options', 'Failed to export scripts', error);
    showNotification('Error exporting scripts', 'error');
  }
}

// Show export dialog
function showExportDialog() {
  // Create a simple dialog overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    max-width: 500px;
    text-align: center;
  `;
  
  dialog.innerHTML = `
    <h2 style="margin-top: 0; margin-bottom: 20px;">Export Scripts</h2>
    <p style="margin-bottom: 20px;">You have ${optionsState.instructions.length} script(s) ready to export.</p>
    <div style="display: flex; gap: 10px; justify-content: center;">
      <button class="btn btn-primary" id="confirmExport">Export All</button>
      <button class="btn btn-secondary" id="cancelExport">Cancel</button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Add event listeners
  document.getElementById('confirmExport').addEventListener('click', () => {
    exportAllInstructions();
    document.body.removeChild(overlay);
  });
  
  document.getElementById('cancelExport').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

// Update statistics
async function updateStatistics() {
  // Update script count
  document.getElementById('totalCount').textContent = optionsState.instructions.length;
  
  // Update storage usage
  try {
    const response = await browser.runtime.sendMessage({
      type: 'GET_STORAGE_USAGE'
    });
    
    if (response && response.success) {
      const usageMB = (response.usage / 1024 / 1024).toFixed(2);
      document.getElementById('storageUsed').textContent = `${usageMB} MB`;
    }
  } catch (error) {
    // Ignore errors
  }
}

// Check for URL parameters
function checkUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  const action = params.get('action');
  const isNew = params.get('new') === 'true';
  
  if (editId) {
    // Check if this is a new recording that hasn't been saved yet
    if (isNew) {
      // Load from temporary storage
      setTimeout(async () => {
        const stored = await browser.storage.local.get(CONSTANTS.STORAGE_KEYS.LAST_RECORDING);
        const instruction = stored[CONSTANTS.STORAGE_KEYS.LAST_RECORDING];
        if (instruction && instruction.id === editId) {
          openEditor(instruction, true); // Open as new instruction
        }
      }, 500);
    } else {
      // Find and edit existing instruction
      setTimeout(() => {
        const instruction = optionsState.instructions.find(i => i.id === editId);
        if (instruction) {
          openEditor(instruction, false);
        }
      }, 500);
    }
  }
  
  if (action === 'import') {
    // Trigger import after page loads
    setTimeout(() => {
      importInstructions();
    }, 500);
  }
  
  if (action === 'export') {
    // Show export dialog
    setTimeout(() => {
      if (optionsState.instructions.length > 0) {
        showExportDialog();
      } else {
        showNotification('No scripts to export', 'info');
      }
    }, 500);
  }
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  // Less than a minute
  if (diff < 60000) {
    return 'just now';
  }
  
  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  
  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Less than a week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Format as date
  return date.toLocaleDateString();
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Show notification
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Show error
function showError(message) {
  showNotification(message, 'error');
}

// Settings functionality
async function openSettings() {
  logger.info('Options', 'Opening settings modal');
  
  // Load current settings
  const storage = typeof browser !== 'undefined' ? browser.storage : chrome.storage;
  const settings = await storage.local.get([
    'logLevel',
    'autoSaveRecordings',
    'nativeMessagingEnabled',
    'defaultTimeout'
  ]);
  
  // Populate settings fields
  document.getElementById('logLevel').value = settings.logLevel || 'info';
  document.getElementById('autoSaveRecordings').checked = settings.autoSaveRecordings !== false;
  document.getElementById('nativeMessagingEnabled').checked = settings.nativeMessagingEnabled !== false;
  document.getElementById('defaultTimeout').value = settings.defaultTimeout || 30000;
  
  // Set up settings event listeners
  document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
  document.getElementById('cancelSettingsBtn').addEventListener('click', closeSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  
  // Show modal
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('active');
}

async function saveSettings() {
  const logLevel = document.getElementById('logLevel').value;
  const autoSaveRecordings = document.getElementById('autoSaveRecordings').checked;
  const nativeMessagingEnabled = document.getElementById('nativeMessagingEnabled').checked;
  const defaultTimeout = parseInt(document.getElementById('defaultTimeout').value);
  
  try {
    // Save settings
    const storage = typeof browser !== 'undefined' ? browser.storage : chrome.storage;
    await storage.local.set({
      logLevel,
      autoSaveRecordings,
      nativeMessagingEnabled,
      defaultTimeout
    });
    
    // Update logger level immediately
    await logger.setLogLevel(logLevel);
    
    // Test debug logging
    logger.debug('Options', 'Settings saved with log level:', logLevel);
    logger.info('Options', 'Settings saved successfully');
    
    showNotification('Settings saved successfully', 'success');
    closeSettings();
  } catch (error) {
    logger.error('Options', 'Failed to save settings', error);
    showNotification('Failed to save settings', 'error');
  }
}

// Export helper functions for editor
window.loadInstructions = loadInstructions;
window.showNotification = showNotification;