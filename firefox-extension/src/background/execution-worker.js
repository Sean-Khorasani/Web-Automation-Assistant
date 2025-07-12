/**
 * Web Worker for handling script execution
 * This runs in a separate thread to prevent freezing the extension
 */

// Message handler
self.onmessage = function(event) {
  const { type, data } = event.data;
  
  switch (type) {
    case 'EXECUTE_STEP':
      executeStep(data);
      break;
      
    case 'CANCEL':
      self.postMessage({ type: 'CANCELLED' });
      self.close();
      break;
  }
};

async function executeStep(step) {
  try {
    // Simulate step execution with timeout
    const result = await Promise.race([
      performStep(step),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Step timeout')), 10000)
      )
    ]);
    
    self.postMessage({ 
      type: 'STEP_COMPLETE', 
      success: true, 
      result 
    });
    
  } catch (error) {
    self.postMessage({ 
      type: 'STEP_COMPLETE', 
      success: false, 
      error: error.message 
    });
  }
}

async function performStep(step) {
  // This would contain the actual step execution logic
  // For now, just return success after a delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return { executed: true };
}