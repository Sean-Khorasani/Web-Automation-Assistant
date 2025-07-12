/**
 * Storage Manager - Handles all storage operations using IndexedDB
 */

class StorageManagerClass {
  constructor() {
    this.dbName = 'WebAutomationDB';
    this.dbVersion = 1;
    this.db = null;
    this.initPromise = this.initialize();
  }

  async initialize() {
    try {
      this.db = await this.openDatabase();
      logger.info('StorageManager', 'Database initialized');
    } catch (error) {
      logger.error('StorageManager', 'Failed to initialize database', error);
      throw error;
    }
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create instructions store
        if (!db.objectStoreNames.contains('instructions')) {
          const instructionStore = db.createObjectStore('instructions', { keyPath: 'id' });
          instructionStore.createIndex('name', 'name', { unique: false });
          instructionStore.createIndex('created', 'created', { unique: false });
          instructionStore.createIndex('modified', 'modified', { unique: false });
          instructionStore.createIndex('url', 'url', { unique: false });
        }

        // Create execution logs store
        if (!db.objectStoreNames.contains('executionLogs')) {
          const logStore = db.createObjectStore('executionLogs', { keyPath: 'id' });
          logStore.createIndex('instructionId', 'instructionId', { unique: false });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
          logStore.createIndex('status', 'status', { unique: false });
        }

        // Create tags store
        if (!db.objectStoreNames.contains('tags')) {
          const tagStore = db.createObjectStore('tags', { keyPath: 'id' });
          tagStore.createIndex('name', 'name', { unique: true });
        }
      };
    });
  }

  async ensureInitialized() {
    if (!this.db) {
      logger.info('StorageManager', 'Database not ready, waiting for initialization...');
      try {
        await this.initPromise;
        if (!this.db) {
          throw new Error('Database initialization failed');
        }
      } catch (error) {
        logger.error('StorageManager', 'Failed to ensure initialization', error);
        throw error;
      }
    }
  }

  // Instruction operations
  async saveInstruction(instruction) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['instructions'], 'readwrite');
      const store = transaction.objectStore('instructions');

      // Add timestamps
      if (!instruction.id) {
        instruction.id = Utils.generateId();
      }
      if (!instruction.created) {
        instruction.created = new Date().toISOString();
      }
      instruction.modified = new Date().toISOString();

      const request = store.put(instruction);

      request.onsuccess = () => {
        logger.info('StorageManager', 'Instruction saved', { id: instruction.id });
        resolve({ success: true, id: instruction.id });
      };

      request.onerror = () => {
        logger.error('StorageManager', 'Failed to save instruction', request.error);
        reject(new Error('Failed to save instruction'));
      };
    });
  }

  async getInstruction(id) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['instructions'], 'readonly');
      const store = transaction.objectStore('instructions');
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve({ success: true, instruction: request.result });
        } else {
          resolve({ success: false, error: 'Instruction not found' });
        }
      };

      request.onerror = () => {
        logger.error('StorageManager', 'Failed to get instruction', request.error);
        reject(new Error('Failed to get instruction'));
      };
    });
  }

  async getAllInstructions(filter = {}) {
    try {
      await this.ensureInitialized();
    } catch (error) {
      logger.error('StorageManager', 'Database not initialized for getAllInstructions', error);
      return { success: false, error: 'Database not initialized', instructions: [] };
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['instructions'], 'readonly');
        const store = transaction.objectStore('instructions');
        const instructions = [];

      let request;
      if (filter.index && filter.value) {
        const index = store.index(filter.index);
        request = index.openCursor(IDBKeyRange.only(filter.value));
      } else {
        request = store.openCursor();
      }

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const instruction = cursor.value;
          
          // Apply filters
          if (!filter.search || 
              instruction.name.toLowerCase().includes(filter.search.toLowerCase()) ||
              instruction.url.toLowerCase().includes(filter.search.toLowerCase())) {
            instructions.push(instruction);
          }
          
          cursor.continue();
        } else {
          // Sort instructions
          if (filter.sortBy) {
            instructions.sort((a, b) => {
              const aVal = a[filter.sortBy];
              const bVal = b[filter.sortBy];
              return filter.sortOrder === 'desc' ? 
                (bVal > aVal ? 1 : -1) : 
                (aVal > bVal ? 1 : -1);
            });
          }
          
          resolve({ success: true, instructions });
        }
      };

      request.onerror = () => {
        logger.error('StorageManager', 'Failed to get instructions', request.error);
        reject(new Error('Failed to get instructions'));
      };
      
      transaction.onerror = () => {
        logger.error('StorageManager', 'Transaction failed', transaction.error);
        reject(new Error('Transaction failed'));
      };
      
      transaction.onabort = () => {
        logger.error('StorageManager', 'Transaction aborted');
        reject(new Error('Transaction aborted'));
      };
    } catch (error) {
      logger.error('StorageManager', 'Error creating transaction', error);
      reject(error);
    }
    });
  }

  async updateInstruction(id, updates) {
    await this.ensureInitialized();

    // Get existing instruction
    const result = await this.getInstruction(id);
    if (!result.success) {
      return result;
    }

    // Merge updates
    const updatedInstruction = {
      ...result.instruction,
      ...updates,
      id: id, // Ensure ID doesn't change
      modified: new Date().toISOString()
    };

    // Save updated instruction
    return await this.saveInstruction(updatedInstruction);
  }

  async deleteInstruction(id) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['instructions'], 'readwrite');
      const store = transaction.objectStore('instructions');
      const request = store.delete(id);

      request.onsuccess = () => {
        logger.info('StorageManager', 'Instruction deleted', { id });
        resolve({ success: true });
      };

      request.onerror = () => {
        logger.error('StorageManager', 'Failed to delete instruction', request.error);
        reject(new Error('Failed to delete instruction'));
      };
    });
  }

  async bulkDeleteInstructions(ids) {
    await this.ensureInitialized();

    const results = await Promise.all(
      ids.map(id => this.deleteInstruction(id).catch(error => ({ success: false, error })))
    );

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: failed === 0,
      succeeded,
      failed,
      results
    };
  }

  // Export/Import operations
  async exportInstructions(ids = null) {
    await this.ensureInitialized();

    let instructions;
    if (ids && ids.length > 0) {
      const results = await Promise.all(ids.map(id => this.getInstruction(id)));
      instructions = results
        .filter(r => r.success)
        .map(r => r.instruction);
    } else {
      const result = await this.getAllInstructions();
      instructions = result.instructions;
    }

    return {
      version: '1.0',
      exported: new Date().toISOString(),
      instructions
    };
  }

  async importInstructions(data) {
    await this.ensureInitialized();

    if (!data.instructions || !Array.isArray(data.instructions)) {
      return { success: false, error: 'Invalid import data' };
    }

    const results = await Promise.all(
      data.instructions.map(instruction => {
        // Generate new ID to avoid conflicts
        instruction.id = Utils.generateId();
        instruction.imported = new Date().toISOString();
        return this.saveInstruction(instruction).catch(error => ({ success: false, error }));
      })
    );

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: failed === 0,
      imported: succeeded,
      failed,
      results
    };
  }

  // Execution log operations
  async logExecution(instructionId, status, details) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['executionLogs'], 'readwrite');
      const store = transaction.objectStore('executionLogs');

      const log = {
        id: Utils.generateId(),
        instructionId,
        timestamp: new Date().toISOString(),
        status,
        details
      };

      const request = store.add(log);

      request.onsuccess = () => {
        resolve({ success: true, id: log.id });
      };

      request.onerror = () => {
        logger.error('StorageManager', 'Failed to log execution', request.error);
        reject(new Error('Failed to log execution'));
      };
    });
  }

  async getExecutionLogs(instructionId = null, limit = 100) {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['executionLogs'], 'readonly');
      const store = transaction.objectStore('executionLogs');
      const logs = [];

      let request;
      if (instructionId) {
        const index = store.index('instructionId');
        request = index.openCursor(IDBKeyRange.only(instructionId));
      } else {
        const index = store.index('timestamp');
        request = index.openCursor(null, 'prev'); // Most recent first
      }

      let count = 0;
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && count < limit) {
          logs.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve({ success: true, logs });
        }
      };

      request.onerror = () => {
        logger.error('StorageManager', 'Failed to get execution logs', request.error);
        reject(new Error('Failed to get execution logs'));
      };
    });
  }

  // Cleanup operations
  async cleanupOldLogs(daysToKeep = 30) {
    await this.ensureInitialized();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.toISOString();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['executionLogs'], 'readwrite');
      const store = transaction.objectStore('executionLogs');
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTimestamp);
      const request = index.openCursor(range);

      let deletedCount = 0;
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          deletedCount++;
          cursor.continue();
        } else {
          logger.info('StorageManager', `Cleaned up ${deletedCount} old logs`);
          resolve({ success: true, deleted: deletedCount });
        }
      };

      request.onerror = () => {
        logger.error('StorageManager', 'Failed to cleanup logs', request.error);
        reject(new Error('Failed to cleanup logs'));
      };
    });
  }

  // Get storage usage
  async getStorageUsage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          success: true,
          usage: estimate.usage,
          quota: estimate.quota,
          percentage: (estimate.usage / estimate.quota) * 100
        };
      } catch (error) {
        logger.error('StorageManager', 'Failed to get storage estimate', error);
      }
    }
    
    return { success: false, error: 'Storage estimation not available' };
  }
}

// Create singleton instance
const StorageManager = new StorageManagerClass();