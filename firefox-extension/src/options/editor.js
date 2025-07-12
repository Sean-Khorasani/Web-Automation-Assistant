/**
 * Script Editor functionality
 */

// Editor state
const editorState = {
  currentInstruction: null,
  isNew: false,
  currentTab: 'info',
  editingStep: null,
  editingStepIndex: -1
};

// Open editor modal
function openEditor(instruction, isNew = false) {
  editorState.currentInstruction = Utils.deepClone(instruction);
  editorState.isNew = isNew;
  
  // Update modal title
  document.getElementById('editorTitle').textContent = isNew ? 'New Script' : 'Edit Script';
  
  // Show info tab by default
  showEditorTab('info');
  
  // Populate fields
  populateEditorFields();
  
  // Set up editor event listeners
  setupEditorListeners();
  
  // Show modal
  document.getElementById('editorModal').classList.add('active');
}

// Set up editor event listeners
function setupEditorListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      showEditorTab(e.target.dataset.tab);
    });
  });
  
  // Modal controls
  document.getElementById('closeEditorBtn').addEventListener('click', closeEditor);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditor);
  document.getElementById('saveEditBtn').addEventListener('click', saveInstruction);
  
  // Steps tab
  document.getElementById('addStepBtn').addEventListener('click', addNewStep);
  document.getElementById('testStepsBtn').addEventListener('click', testSteps);
  
  // Variables tab
  document.getElementById('addVariableBtn').addEventListener('click', addNewVariable);
  
  // JSON tab
  document.getElementById('formatJsonBtn').addEventListener('click', formatJson);
  document.getElementById('validateJsonBtn').addEventListener('click', validateJson);
  
  // Step editor modal
  document.getElementById('closeStepEditorBtn').addEventListener('click', closeStepEditor);
  document.getElementById('cancelStepBtn').addEventListener('click', closeStepEditor);
  document.getElementById('saveStepBtn').addEventListener('click', saveStep);
  document.getElementById('stepAction').addEventListener('change', updateStepFields);
  
  // Add listener for condition type changes  
  document.addEventListener('change', (e) => {
    if (e.target.id === 'conditionType') {
      updateConditionFields();
    }
  });
  
  // Field change handlers
  document.getElementById('instructionName').addEventListener('input', updateFromFields);
  document.getElementById('instructionUrl').addEventListener('input', updateFromFields);
  document.getElementById('instructionDescription').addEventListener('input', updateFromFields);
  document.getElementById('jsonEditor').addEventListener('input', updateFromJson);
}

// Show editor tab
function showEditorTab(tabName) {
  editorState.currentTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });
  
  // Render tab-specific content
  switch (tabName) {
    case 'steps':
      renderSteps();
      break;
    case 'variables':
      renderVariables();
      break;
    case 'json':
      renderJson();
      break;
  }
}

// Populate editor fields
function populateEditorFields() {
  const instruction = editorState.currentInstruction;
  
  // Info tab
  document.getElementById('instructionName').value = instruction.name || '';
  document.getElementById('instructionUrl').value = instruction.url || '';
  document.getElementById('instructionDescription').value = instruction.description || '';
  
  // Render other tabs if visible
  if (editorState.currentTab === 'steps') renderSteps();
  if (editorState.currentTab === 'variables') renderVariables();
  if (editorState.currentTab === 'json') renderJson();
}

// Update from fields
function updateFromFields() {
  editorState.currentInstruction.name = document.getElementById('instructionName').value;
  editorState.currentInstruction.url = document.getElementById('instructionUrl').value;
  editorState.currentInstruction.description = document.getElementById('instructionDescription').value;
  
  // Update JSON if visible
  if (editorState.currentTab === 'json') {
    renderJson();
  }
}

// Update from JSON
function updateFromJson() {
  try {
    const json = document.getElementById('jsonEditor').value;
    const parsed = JSON.parse(json);
    editorState.currentInstruction = parsed;
    
    // Update other fields if visible
    if (editorState.currentTab === 'info') {
      populateEditorFields();
    }
  } catch (error) {
    // Invalid JSON, ignore for now
  }
}

// Render steps
function renderSteps() {
  const container = document.getElementById('stepsList');
  const steps = editorState.currentInstruction.steps || [];
  
  if (steps.length === 0) {
    container.innerHTML = '<div class="empty-state">No steps yet. Click "Add Step" to begin.</div>';
    return;
  }
  
  container.innerHTML = steps.map((step, index) => `
    <div class="step-item" data-index="${index}">
      <!-- <div class="step-handle">☰</div> -->
      <div class="step-content">
        <div class="step-action">${formatActionName(step.action)}</div>
        <div class="step-details">${getStepDescription(step)}</div>
      </div>
      <div class="step-actions">
        <button class="btn btn-sm" data-action="move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''} title="Move up">↑</button>
        <button class="btn btn-sm" data-action="move-down" data-index="${index}" ${index === steps.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
        <button class="btn btn-sm" data-action="edit-step" data-index="${index}">Edit</button>
        <button class="btn btn-sm" data-action="duplicate-step" data-index="${index}">Duplicate</button>
        <button class="btn btn-sm btn-danger" data-action="delete-step" data-index="${index}">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Make steps sortable
  makeStepsSortable();
  
  // Set up event delegation for step actions
  setupStepEventDelegation();
}

// Render variables
function renderVariables() {
  const container = document.getElementById('variablesList');
  const variables = editorState.currentInstruction.variables || {};
  
  const variableEntries = Object.entries(variables);
  
  if (variableEntries.length === 0) {
    container.innerHTML = '<div class="empty-state">No variables defined. Click "Add Variable" to create one.</div>';
    return;
  }
  
  container.innerHTML = variableEntries.map(([name, config]) => `
    <div class="variable-item" data-name="${name}">
      <div class="variable-name">{{${name}}}</div>
      <div class="variable-details">
        <span>Type:</span> <span>${config.type || 'string'}</span>
        <span>Default:</span> <span>${config.default || '(none)'}</span>
      </div>
      <div class="variable-actions">
        <button class="btn btn-sm" data-action="edit-variable" data-name="${name}">Edit</button>
        <button class="btn btn-sm btn-danger" data-action="delete-variable" data-name="${name}">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Set up event delegation for variable actions
  setupVariableEventDelegation();
}

// Render JSON
function renderJson() {
  const json = JSON.stringify(editorState.currentInstruction, null, 2);
  document.getElementById('jsonEditor').value = json;
}

// Format JSON
function formatJson() {
  try {
    const json = document.getElementById('jsonEditor').value;
    const parsed = JSON.parse(json);
    const formatted = JSON.stringify(parsed, null, 2);
    document.getElementById('jsonEditor').value = formatted;
    showNotification('JSON formatted', 'success');
  } catch (error) {
    showNotification('Invalid JSON: ' + error.message, 'error');
  }
}

// Validate JSON
function validateJson() {
  try {
    const json = document.getElementById('jsonEditor').value;
    const parsed = JSON.parse(json);
    
    // Validate structure
    if (!parsed.name) {
      throw new Error('Missing required field: name');
    }
    if (!Array.isArray(parsed.steps)) {
      throw new Error('Steps must be an array');
    }
    
    // Validate each step
    parsed.steps.forEach((step, index) => {
      if (!step.action) {
        throw new Error(`Step ${index + 1} missing action`);
      }
    });
    
    showNotification('JSON is valid', 'success');
  } catch (error) {
    showNotification('Invalid JSON: ' + error.message, 'error');
  }
}

// Add new step
function addNewStep() {
  const newStep = {
    action: CONSTANTS.ACTION_TYPES.CLICK,
    selector: { css: '' }
  };
  
  editorState.editingStep = newStep;
  editorState.editingStepIndex = -1;
  
  openStepEditor();
}

// Edit step
function editStep(index) {
  const step = editorState.currentInstruction.steps[index];
  editorState.editingStep = Utils.deepClone(step);
  editorState.editingStepIndex = index;
  
  openStepEditor();
}

// Duplicate step
function duplicateStep(index) {
  const step = editorState.currentInstruction.steps[index];
  const duplicate = Utils.deepClone(step);
  
  editorState.currentInstruction.steps.splice(index + 1, 0, duplicate);
  renderSteps();
}

// Delete step
function deleteStep(index) {
  if (confirm('Delete this step?')) {
    editorState.currentInstruction.steps.splice(index, 1);
    renderSteps();
  }
}

// Move step up or down
function moveStep(index, direction) {
  const steps = editorState.currentInstruction.steps;
  const newIndex = index + direction;
  
  // Check bounds
  if (newIndex < 0 || newIndex >= steps.length) {
    return;
  }
  
  // Swap steps
  const temp = steps[index];
  steps[index] = steps[newIndex];
  steps[newIndex] = temp;
  
  // Re-render steps
  renderSteps();
  
  // Update JSON if visible
  if (editorState.currentTab === 'json') {
    renderJson();
  }
  
  logger.debug('Editor', 'Step moved', { from: index, to: newIndex });
}

// Set up event delegation for step actions
function setupStepEventDelegation() {
  const container = document.getElementById('stepsList');
  if (!container) return;
  
  // Remove any existing listener to prevent duplicates
  if (container._stepClickHandler) {
    container.removeEventListener('click', container._stepClickHandler);
  }
  
  // Create and store the click handler
  container._stepClickHandler = function(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.getAttribute('data-action');
    const index = parseInt(button.getAttribute('data-index'));
    
    switch (action) {
      case 'move-up':
        moveStep(index, -1);
        break;
      case 'move-down':
        moveStep(index, 1);
        break;
      case 'edit-step':
        editStep(index);
        break;
      case 'duplicate-step':
        duplicateStep(index);
        break;
      case 'delete-step':
        deleteStep(index);
        break;
    }
  };
  
  container.addEventListener('click', container._stepClickHandler);
}

// Open step editor
function openStepEditor() {
  const step = editorState.editingStep;
  
  // Set action
  document.getElementById('stepAction').value = step.action;
  
  // Update fields
  updateStepFields();
  
  // Show modal
  document.getElementById('stepEditorModal').classList.add('active');
}

// Update step fields based on action
function updateStepFields() {
  const action = document.getElementById('stepAction').value;
  const container = document.getElementById('stepFields');
  const step = editorState.editingStep;
  
  let fieldsHtml = '';
  
  switch (action) {
    case CONSTANTS.ACTION_TYPES.CLICK:
      fieldsHtml = `
        <div class="form-group">
          <label for="stepSelector">CSS Selector</label>
          <input type="text" id="stepSelector" class="form-input" 
                 value="${step.selector?.css || ''}" placeholder="button.submit">
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="stepRightClick" ${step.rightClick ? 'checked' : ''}>
            Right click
          </label>
        </div>
      `;
      break;
      
    case CONSTANTS.ACTION_TYPES.INPUT_TEXT:
      fieldsHtml = `
        <div class="form-group">
          <label for="stepSelector">CSS Selector</label>
          <input type="text" id="stepSelector" class="form-input" 
                 value="${step.selector?.css || ''}" placeholder="input#username">
        </div>
        <div class="form-group">
          <label for="stepValue">Text to Input</label>
          <input type="text" id="stepValue" class="form-input" 
                 value="${step.value || ''}" placeholder="Text or {{variable}}">
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="stepClearFirst" ${step.clear_first ? 'checked' : ''}>
            Clear field first
          </label>
        </div>
      `;
      break;
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_ELEMENT:
      fieldsHtml = `
        <div class="form-group">
          <label for="stepSelector">CSS Selector</label>
          <input type="text" id="stepSelector" class="form-input" 
                 value="${step.selector?.css || ''}" placeholder=".loading-complete">
        </div>
        <div class="form-group">
          <label for="stepTimeout">Timeout (ms)</label>
          <input type="number" id="stepTimeout" class="form-input" 
                 value="${step.timeout || 30000}" min="1000" max="300000" step="1000">
        </div>
      `;
      break;
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_TIME:
      fieldsHtml = `
        <div class="form-group">
          <label for="stepDuration">Duration (ms)</label>
          <input type="number" id="stepDuration" class="form-input" 
                 value="${step.duration || 1000}" min="100" max="60000" step="100">
        </div>
      `;
      break;
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_CONDITION:
      fieldsHtml = `
        <div class="form-group">
          <label for="conditionType">Condition Type</label>
          <select id="conditionType" class="form-input">
            <option value="${CONSTANTS.WAIT_CONDITIONS.ELEMENT_VISIBLE}" 
              ${step.condition?.type === CONSTANTS.WAIT_CONDITIONS.ELEMENT_VISIBLE ? 'selected' : ''}>
              Element Visible
            </option>
            <option value="${CONSTANTS.WAIT_CONDITIONS.ELEMENT_HIDDEN}" 
              ${step.condition?.type === CONSTANTS.WAIT_CONDITIONS.ELEMENT_HIDDEN ? 'selected' : ''}>
              Element Hidden
            </option>
            <option value="${CONSTANTS.WAIT_CONDITIONS.TEXT_PRESENT}" 
              ${step.condition?.type === CONSTANTS.WAIT_CONDITIONS.TEXT_PRESENT ? 'selected' : ''}>
              Text Present
            </option>
            <option value="${CONSTANTS.WAIT_CONDITIONS.NETWORK_IDLE}" 
              ${step.condition?.type === CONSTANTS.WAIT_CONDITIONS.NETWORK_IDLE ? 'selected' : ''}>
              Network Idle
            </option>
            <option value="${CONSTANTS.WAIT_CONDITIONS.DOM_STABLE}" 
              ${step.condition?.type === CONSTANTS.WAIT_CONDITIONS.DOM_STABLE ? 'selected' : ''}>
              DOM Stable
            </option>
            <option value="${CONSTANTS.WAIT_CONDITIONS.CUSTOM_SCRIPT}" 
              ${step.condition?.type === CONSTANTS.WAIT_CONDITIONS.CUSTOM_SCRIPT ? 'selected' : ''}>
              Custom Script
            </option>
          </select>
        </div>
        <div id="conditionFields"></div>
      `;
      // Update condition fields based on type
      setTimeout(() => updateConditionFields(step), 0);
      break;
      
    case CONSTANTS.ACTION_TYPES.NAVIGATE:
      fieldsHtml = `
        <div class="form-group">
          <label for="stepUrl">URL</label>
          <input type="text" id="stepUrl" class="form-input" 
                 value="${step.url || ''}" placeholder="https://example.com">
        </div>
      `;
      break;
      
    case CONSTANTS.ACTION_TYPES.GET_CONTENT:
      fieldsHtml = `
        <div class="form-group">
          <label for="stepSelector">CSS Selector</label>
          <input type="text" id="stepSelector" class="form-input" 
                 value="${step.selector?.css || ''}" placeholder=".result-text">
        </div>
        <div class="form-group">
          <label for="stepProperty">Property</label>
          <select id="stepProperty" class="form-input">
            <option value="textContent" ${step.property === 'textContent' ? 'selected' : ''}>Text Content</option>
            <option value="innerHTML" ${step.property === 'innerHTML' ? 'selected' : ''}>Inner HTML</option>
            <option value="value" ${step.property === 'value' ? 'selected' : ''}>Value</option>
            <option value="href" ${step.property === 'href' ? 'selected' : ''}>Href</option>
            <option value="src" ${step.property === 'src' ? 'selected' : ''}>Src</option>
          </select>
        </div>
        <div class="form-group">
          <label for="stepStoreAs">Store as Variable</label>
          <input type="text" id="stepStoreAs" class="form-input" 
                 value="${step.store_as || ''}" placeholder="result">
        </div>
      `;
      break;
  }
  
  container.innerHTML = fieldsHtml;
}

// Save step
function saveStep() {
  const action = document.getElementById('stepAction').value;
  const step = { action };
  
  // Collect fields based on action
  switch (action) {
    case CONSTANTS.ACTION_TYPES.CLICK:
      step.selector = { css: document.getElementById('stepSelector').value };
      step.rightClick = document.getElementById('stepRightClick').checked;
      break;
      
    case CONSTANTS.ACTION_TYPES.INPUT_TEXT:
      step.selector = { css: document.getElementById('stepSelector').value };
      step.value = document.getElementById('stepValue').value;
      step.clear_first = document.getElementById('stepClearFirst').checked;
      break;
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_ELEMENT:
      step.selector = { css: document.getElementById('stepSelector').value };
      step.timeout = parseInt(document.getElementById('stepTimeout').value);
      break;
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_TIME:
      step.duration = parseInt(document.getElementById('stepDuration').value);
      break;
      
    case CONSTANTS.ACTION_TYPES.NAVIGATE:
      step.url = document.getElementById('stepUrl').value;
      break;
      
    case CONSTANTS.ACTION_TYPES.GET_CONTENT:
      step.selector = { css: document.getElementById('stepSelector').value };
      step.property = document.getElementById('stepProperty').value;
      const storeAs = document.getElementById('stepStoreAs').value;
      if (storeAs) step.store_as = storeAs;
      break;
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_CONDITION:
      const conditionType = document.getElementById('conditionType').value;
      step.condition = { type: conditionType };
      step.timeout = parseInt(document.getElementById('conditionTimeout').value);
      
      switch (conditionType) {
        case CONSTANTS.WAIT_CONDITIONS.ELEMENT_VISIBLE:
        case CONSTANTS.WAIT_CONDITIONS.ELEMENT_HIDDEN:
          step.condition.selector = document.getElementById('conditionSelector').value;
          break;
        case CONSTANTS.WAIT_CONDITIONS.TEXT_PRESENT:
          step.condition.text = document.getElementById('conditionText').value;
          break;
        case CONSTANTS.WAIT_CONDITIONS.NETWORK_IDLE:
          step.condition.idleTime = parseInt(document.getElementById('idleTime').value);
          break;
        case CONSTANTS.WAIT_CONDITIONS.DOM_STABLE:
          step.condition.stableTime = parseInt(document.getElementById('stableTime').value);
          break;
        case CONSTANTS.WAIT_CONDITIONS.CUSTOM_SCRIPT:
          step.condition.script = document.getElementById('conditionScript').value;
          break;
      }
      break;
  }
  
  // Add or update step
  if (editorState.editingStepIndex === -1) {
    editorState.currentInstruction.steps.push(step);
  } else {
    editorState.currentInstruction.steps[editorState.editingStepIndex] = step;
  }
  
  // Close modal and refresh
  closeStepEditor();
  renderSteps();
}

// Close step editor
function closeStepEditor() {
  document.getElementById('stepEditorModal').classList.remove('active');
  editorState.editingStep = null;
  editorState.editingStepIndex = -1;
}

// Test steps
async function testSteps() {
  try {
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.EXECUTE_INSTRUCTION,
      data: {
        instruction: editorState.currentInstruction
      }
    });
    
    if (response.success) {
      showNotification('Test completed successfully', 'success');
    } else {
      showNotification('Test failed: ' + response.error, 'error');
    }
  } catch (error) {
    showNotification('Test error: ' + error.message, 'error');
  }
}

// Add new variable
function addNewVariable() {
  const name = prompt('Variable name (without curly braces):');
  if (!name) return;
  
  if (!editorState.currentInstruction.variables) {
    editorState.currentInstruction.variables = {};
  }
  
  editorState.currentInstruction.variables[name] = {
    type: 'string',
    default: ''
  };
  
  renderVariables();
}

// Edit variable
function editVariable(name) {
  const config = editorState.currentInstruction.variables[name];
  if (!config) return;
  
  // For now, just use prompts - could be enhanced with a proper modal later
  const type = prompt('Variable type (string/number/boolean):', config.type || 'string');
  if (type === null) return;
  
  const defaultValue = prompt('Default value:', config.default || '');
  if (defaultValue === null) return;
  
  editorState.currentInstruction.variables[name] = {
    type: type,
    default: defaultValue
  };
  
  renderVariables();
}

// Delete variable
function deleteVariable(name) {
  if (confirm(`Delete variable {{${name}}}?`)) {
    delete editorState.currentInstruction.variables[name];
    renderVariables();
  }
}

// Set up event delegation for variable actions
function setupVariableEventDelegation() {
  const container = document.getElementById('variablesList');
  if (!container) return;
  
  // Remove any existing listener to prevent duplicates
  if (container._variableClickHandler) {
    container.removeEventListener('click', container._variableClickHandler);
  }
  
  // Create and store the click handler
  container._variableClickHandler = function(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.getAttribute('data-action');
    const name = button.getAttribute('data-name');
    
    switch (action) {
      case 'edit-variable':
        editVariable(name);
        break;
      case 'delete-variable':
        deleteVariable(name);
        break;
    }
  };
  
  container.addEventListener('click', container._variableClickHandler);
}

// Save instruction
async function saveInstruction() {
  try {
    // Update from current tab
    if (editorState.currentTab === 'json') {
      updateFromJson();
    }
    
    // Validate
    if (!editorState.currentInstruction.name) {
      showNotification('Instruction name is required', 'error');
      return;
    }
    
    // Update timestamps
    editorState.currentInstruction.modified = new Date().toISOString();
    if (editorState.isNew) {
      editorState.currentInstruction.created = new Date().toISOString();
    }
    
    // Save
    const response = await browser.runtime.sendMessage({
      type: CONSTANTS.MESSAGE_TYPES.SAVE_INSTRUCTION,
      data: editorState.currentInstruction
    });
    
    if (response.success) {
      showNotification('Instruction saved', 'success');
      closeEditor();
      await loadInstructions();
    } else {
      showNotification('Failed to save instruction', 'error');
    }
  } catch (error) {
    logger.error('Editor', 'Failed to save instruction', error);
    showNotification('Error saving instruction', 'error');
  }
}

// Close editor
function closeEditor() {
  // If this is a new recording that was cancelled, clear it from temporary storage
  if (editorState.isNew && editorState.currentInstruction) {
    browser.storage.local.remove(CONSTANTS.STORAGE_KEYS.LAST_RECORDING).catch(() => {});
  }
  
  document.getElementById('editorModal').classList.remove('active');
  editorState.currentInstruction = null;
  editorState.isNew = false;
}

// Make steps sortable
function makeStepsSortable() {
  const stepsList = document.getElementById('stepsList');
  if (!stepsList) return;
  
  try {
    // Check if Sortable is available
    if (typeof Sortable === 'undefined') {
      logger.warn('Editor', 'Sortable library not loaded, drag-and-drop disabled');
      // Hide drag handles since sorting won't work
      const handles = stepsList.querySelectorAll('.step-handle');
      handles.forEach(handle => handle.style.display = 'none');
      return;
    }
    
    // Try to initialize Sortable with proper syntax
    if (typeof Sortable.create === 'function') {
      // Use Sortable.create method
      const sortableInstance = Sortable.create(stepsList, {
        animation: 150,
        handle: '.step-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        
        // When sorting ends
        onEnd: function(evt) {
          // Get the moved step
          const movedStep = editorState.currentInstruction.steps.splice(evt.oldIndex, 1)[0];
          
          // Insert at new position
          editorState.currentInstruction.steps.splice(evt.newIndex, 0, movedStep);
          
          // Update JSON if visible
          if (editorState.currentTab === 'json') {
            renderJson();
          }
          
          logger.debug('Editor', 'Step reordered', { 
            from: evt.oldIndex, 
            to: evt.newIndex 
          });
        }
      });
      logger.debug('Editor', 'Sortable initialized successfully');
    } else if (typeof Sortable === 'function') {
      // Use new Sortable() syntax
      new Sortable(stepsList, {
        animation: 150,
        handle: '.step-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        
        // When sorting ends
        onEnd: function(evt) {
          // Get the moved step
          const movedStep = editorState.currentInstruction.steps.splice(evt.oldIndex, 1)[0];
          
          // Insert at new position
          editorState.currentInstruction.steps.splice(evt.newIndex, 0, movedStep);
          
          // Update JSON if visible
          if (editorState.currentTab === 'json') {
            renderJson();
          }
          
          logger.debug('Editor', 'Step reordered', { 
            from: evt.oldIndex, 
            to: evt.newIndex 
          });
        }
      });
      logger.debug('Editor', 'Sortable initialized successfully');
    } else {
      logger.warn('Editor', 'Sortable loaded but neither create() nor constructor available');
      // Hide drag handles since sorting won't work
      const handles = stepsList.querySelectorAll('.step-handle');
      handles.forEach(handle => handle.style.display = 'none');
    }
  } catch (error) {
    logger.error('Editor', 'Failed to initialize Sortable', error);
    // Hide drag handles since sorting won't work
    const handles = stepsList.querySelectorAll('.step-handle');
    handles.forEach(handle => handle.style.display = 'none');
  }
}

// Format action name for display
function formatActionName(action) {
  const names = {
    [CONSTANTS.ACTION_TYPES.CLICK]: 'Click',
    [CONSTANTS.ACTION_TYPES.INPUT_TEXT]: 'Input Text',
    [CONSTANTS.ACTION_TYPES.SELECT_OPTION]: 'Select Option',
    [CONSTANTS.ACTION_TYPES.WAIT_FOR_ELEMENT]: 'Wait for Element',
    [CONSTANTS.ACTION_TYPES.WAIT_FOR_CONDITION]: 'Wait for Condition',
    [CONSTANTS.ACTION_TYPES.WAIT_FOR_TIME]: 'Wait',
    [CONSTANTS.ACTION_TYPES.NAVIGATE]: 'Navigate',
    [CONSTANTS.ACTION_TYPES.GET_CONTENT]: 'Get Content',
    [CONSTANTS.ACTION_TYPES.EXECUTE_SCRIPT]: 'Execute Script',
    [CONSTANTS.ACTION_TYPES.KEYBOARD_SHORTCUT]: 'Keyboard Shortcut'
  };
  
  return names[action] || action;
}

// Update condition fields based on type
function updateConditionFields(step) {
  const conditionType = document.getElementById('conditionType')?.value;
  const container = document.getElementById('conditionFields');
  if (!container) return;
  
  let fieldsHtml = '';
  const condition = step?.condition || {};
  
  switch (conditionType) {
    case CONSTANTS.WAIT_CONDITIONS.ELEMENT_VISIBLE:
    case CONSTANTS.WAIT_CONDITIONS.ELEMENT_HIDDEN:
      fieldsHtml = `
        <div class="form-group">
          <label for="conditionSelector">CSS Selector</label>
          <input type="text" id="conditionSelector" class="form-input" 
                 value="${condition.selector || ''}" placeholder=".loading-spinner">
        </div>
      `;
      break;
      
    case CONSTANTS.WAIT_CONDITIONS.TEXT_PRESENT:
      fieldsHtml = `
        <div class="form-group">
          <label for="conditionText">Text to Find</label>
          <input type="text" id="conditionText" class="form-input" 
                 value="${condition.text || ''}" placeholder="Success">
        </div>
      `;
      break;
      
    case CONSTANTS.WAIT_CONDITIONS.NETWORK_IDLE:
      fieldsHtml = `
        <div class="form-group">
          <label for="idleTime">Idle Time (ms)</label>
          <input type="number" id="idleTime" class="form-input" 
                 value="${condition.idleTime || 2000}" min="500" max="10000" step="100">
          <small>Wait for network to be idle for this duration</small>
        </div>
      `;
      break;
      
    case CONSTANTS.WAIT_CONDITIONS.DOM_STABLE:
      fieldsHtml = `
        <div class="form-group">
          <label for="stableTime">Stable Time (ms)</label>
          <input type="number" id="stableTime" class="form-input" 
                 value="${condition.stableTime || 1000}" min="100" max="5000" step="100">
          <small>Wait for DOM to be stable for this duration</small>
        </div>
      `;
      break;
      
    case CONSTANTS.WAIT_CONDITIONS.CUSTOM_SCRIPT:
      fieldsHtml = `
        <div class="form-group">
          <label for="conditionScript">JavaScript Expression</label>
          <textarea id="conditionScript" class="form-textarea" rows="3" 
                    placeholder="document.querySelector('.result').textContent.length > 0">${condition.script || ''}</textarea>
          <small>Must return true when condition is met</small>
        </div>
      `;
      break;
  }
  
  fieldsHtml += `
    <div class="form-group">
      <label for="conditionTimeout">Timeout (ms)</label>
      <input type="number" id="conditionTimeout" class="form-input" 
             value="${step?.timeout || 30000}" min="1000" max="300000" step="1000">
    </div>
  `;
  
  container.innerHTML = fieldsHtml;
}

// Get step description
function getStepDescription(step) {
  switch (step.action) {
    case CONSTANTS.ACTION_TYPES.CLICK:
      return `${step.rightClick ? 'Right-click' : 'Click'} on: ${step.selector?.css || step.selector}`;
      
    case CONSTANTS.ACTION_TYPES.INPUT_TEXT:
      return `Type "${step.value}" in: ${step.selector?.css || step.selector}`;
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_ELEMENT:
      return `Wait for: ${step.selector?.css || step.selector}`;
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_CONDITION:
      if (step.condition) {
        switch (step.condition.type) {
          case CONSTANTS.WAIT_CONDITIONS.NETWORK_IDLE:
            return `Wait for network idle (${step.condition.idleTime || 2000}ms)`;
          case CONSTANTS.WAIT_CONDITIONS.DOM_STABLE:
            return `Wait for DOM stable (${step.condition.stableTime || 1000}ms)`;
          case CONSTANTS.WAIT_CONDITIONS.ELEMENT_VISIBLE:
            return `Wait for element visible: ${step.condition.selector}`;
          case CONSTANTS.WAIT_CONDITIONS.TEXT_PRESENT:
            return `Wait for text: "${step.condition.text}"`;
          default:
            return `Wait for ${step.condition.type}`;
        }
      }
      return 'Wait for condition';
      
    case CONSTANTS.ACTION_TYPES.WAIT_FOR_TIME:
      return `Wait ${step.duration}ms`;
      
    case CONSTANTS.ACTION_TYPES.NAVIGATE:
      return `Go to: ${step.url}`;
      
    case CONSTANTS.ACTION_TYPES.GET_CONTENT:
      return `Get ${step.property || 'text'} from: ${step.selector?.css || step.selector}`;
      
    default:
      return JSON.stringify(step);
  }
}