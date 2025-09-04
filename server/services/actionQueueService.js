import { Queue } from 'bullmq';
import redisClient from '../config/redis.js';
import { logInfo, logError, logWarn } from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Action Queue Service
 * Handles sequential processing of game actions to prevent race conditions
 */
class ActionQueueService {
  constructor() {
    this.queues = new Map();
    this.processing = new Map();
    this.actionHandlers = new Map();
    this.QUEUE_TIMEOUT = 5000; // 5 seconds per action
    this.MAX_QUEUE_SIZE = 100;
    this.MAX_RETRIES = 3;
  }

  /**
   * Get or create queue for a specific game/room
   */
  getQueue(identifier) {
    if (!this.queues.has(identifier)) {
      this.queues.set(identifier, {
        actions: [],
        processing: false,
        created: Date.now()
      });
    }
    return this.queues.get(identifier);
  }

  /**
   * Add action to queue
   */
  async enqueue(identifier, action, handler) {
    try {
      const queue = this.getQueue(identifier);
      
      // Check queue size
      if (queue.actions.length >= this.MAX_QUEUE_SIZE) {
        logWarn('Queue size limit reached', { 
          identifier, 
          size: queue.actions.length 
        });
        throw new Error('Queue is full');
      }
      
      // Create action entry
      const actionEntry = {
        id: uuidv4(),
        type: action.type,
        data: action,
        handler,
        timestamp: Date.now(),
        retries: 0
      };
      
      // Add to queue
      queue.actions.push(actionEntry);
      
      logInfo('Action enqueued', {
        identifier,
        actionId: actionEntry.id,
        type: action.type,
        queueSize: queue.actions.length
      });
      
      // Start processing if not already processing
      if (!queue.processing) {
        this.processQueue(identifier);
      }
      
      return actionEntry.id;
    } catch (error) {
      logError(error, { identifier, action });
      throw error;
    }
  }

  /**
   * Process queue sequentially
   */
  async processQueue(identifier) {
    const queue = this.getQueue(identifier);
    
    // Check if already processing
    if (queue.processing) {
      return;
    }
    
    queue.processing = true;
    
    try {
      while (queue.actions.length > 0) {
        const action = queue.actions[0];
        
        // Check if action is too old
        if (Date.now() - action.timestamp > this.QUEUE_TIMEOUT * 2) {
          logWarn('Action expired', {
            identifier,
            actionId: action.id,
            age: Date.now() - action.timestamp
          });
          queue.actions.shift();
          continue;
        }
        
        try {
          // Process action with timeout
          await this.processAction(action);
          
          // Remove from queue after successful processing
          queue.actions.shift();
          
          logInfo('Action processed', {
            identifier,
            actionId: action.id,
            remaining: queue.actions.length
          });
        } catch (error) {
          logError(error, { identifier, actionId: action.id });
          
          // Retry logic
          action.retries++;
          if (action.retries >= this.MAX_RETRIES) {
            logError(new Error('Action failed after max retries'), {
              identifier,
              actionId: action.id
            });
            queue.actions.shift();
          } else {
            // Move to end of queue for retry
            queue.actions.shift();
            queue.actions.push(action);
          }
        }
        
        // Small delay between actions to prevent overwhelming
        await this.delay(10);
      }
    } finally {
      queue.processing = false;
      
      // Clean up empty queues
      if (queue.actions.length === 0 && 
          Date.now() - queue.created > 60000) {
        this.queues.delete(identifier);
      }
    }
  }

  /**
   * Process single action with timeout
   */
  async processAction(action) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Action processing timeout'));
      }, this.QUEUE_TIMEOUT);
      
      try {
        // Execute handler
        const result = action.handler(action.data);
        
        // Handle promise or direct result
        if (result && typeof result.then === 'function') {
          result
            .then(res => {
              clearTimeout(timeout);
              resolve(res);
            })
            .catch(err => {
              clearTimeout(timeout);
              reject(err);
            });
        } else {
          clearTimeout(timeout);
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Register global action handler
   */
  registerHandler(type, handler) {
    this.actionHandlers.set(type, handler);
    logInfo('Action handler registered', { type });
  }

  /**
   * Process action with registered handler
   */
  async processWithHandler(identifier, action) {
    const handler = this.actionHandlers.get(action.type);
    
    if (!handler) {
      throw new Error(`No handler registered for action type: ${action.type}`);
    }
    
    return this.enqueue(identifier, action, handler);
  }

  /**
   * Clear queue for identifier
   */
  clearQueue(identifier) {
    if (this.queues.has(identifier)) {
      const queue = this.queues.get(identifier);
      const cleared = queue.actions.length;
      queue.actions = [];
      logInfo('Queue cleared', { identifier, cleared });
      return cleared;
    }
    return 0;
  }

  /**
   * Get queue status
   */
  getQueueStatus(identifier) {
    const queue = this.queues.get(identifier);
    
    if (!queue) {
      return {
        exists: false,
        size: 0,
        processing: false
      };
    }
    
    return {
      exists: true,
      size: queue.actions.length,
      processing: queue.processing,
      created: queue.created,
      oldest: queue.actions[0]?.timestamp,
      newest: queue.actions[queue.actions.length - 1]?.timestamp
    };
  }

  /**
   * Get all active queues
   */
  getActiveQueues() {
    const active = [];
    
    for (const [id, queue] of this.queues) {
      active.push({
        id,
        size: queue.actions.length,
        processing: queue.processing,
        created: queue.created
      });
    }
    
    return active;
  }

  /**
   * Batch process actions
   */
  async batchProcess(identifier, actions, handler) {
    const results = [];
    
    for (const action of actions) {
      try {
        const id = await this.enqueue(identifier, action, handler);
        results.push({ success: true, id });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Wait for queue to be empty
   */
  async waitForEmpty(identifier, timeout = 10000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const queue = this.queues.get(identifier);
      
      if (!queue || queue.actions.length === 0) {
        return true;
      }
      
      await this.delay(100);
    }
    
    return false;
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up old queues
   */
  cleanup() {
    let cleaned = 0;
    
    for (const [id, queue] of this.queues) {
      // Remove queues older than 1 hour with no actions
      if (queue.actions.length === 0 && 
          Date.now() - queue.created > 3600000) {
        this.queues.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logInfo('Cleaned up old queues', { count: cleaned });
    }
    
    return cleaned;
  }

  /**
   * Priority queue support
   */
  async enqueuePriority(identifier, action, handler, priority = 0) {
    try {
      const queue = this.getQueue(identifier);
      
      const actionEntry = {
        id: uuidv4(),
        type: action.type,
        data: action,
        handler,
        priority,
        timestamp: Date.now(),
        retries: 0
      };
      
      // Insert based on priority
      let inserted = false;
      for (let i = 0; i < queue.actions.length; i++) {
        if ((queue.actions[i].priority || 0) < priority) {
          queue.actions.splice(i, 0, actionEntry);
          inserted = true;
          break;
        }
      }
      
      if (!inserted) {
        queue.actions.push(actionEntry);
      }
      
      // Start processing if not already processing
      if (!queue.processing) {
        this.processQueue(identifier);
      }
      
      return actionEntry.id;
    } catch (error) {
      logError(error, { identifier, action });
      throw error;
    }
  }
}

export default new ActionQueueService();