import { logInfo, logError, logWarn } from '../config/logger.js';
import { throttle, debounce } from '../utils/rateLimiting.js';

/**
 * Optimized Socket Manager
 * Handles socket events with batching, compression, and rate limiting
 */
class SocketManager {
  constructor() {
    this.sockets = new Map();
    this.rooms = new Map();
    this.eventQueue = new Map();
    this.batchInterval = 50; // Batch events every 50ms
    this.compressionThreshold = 1024; // Compress data > 1KB
    
    // Start batch processing
    this.startBatchProcessor();
  }

  /**
   * Register a socket connection
   */
  registerSocket(socket) {
    const socketInfo = {
      id: socket.id,
      userId: socket.userId,
      roomCode: null,
      lastActivity: Date.now(),
      eventBuffer: [],
      stats: {
        messagesSent: 0,
        messagesReceived: 0,
        bytesIn: 0,
        bytesOut: 0
      }
    };
    
    this.sockets.set(socket.id, socketInfo);
    
    // Setup socket middleware for optimization
    this.setupSocketOptimizations(socket);
    
    logInfo('Socket registered', { 
      socketId: socket.id, 
      userId: socket.userId 
    });
  }

  /**
   * Unregister a socket
   */
  unregisterSocket(socketId) {
    const socketInfo = this.sockets.get(socketId);
    
    if (socketInfo) {
      // Remove from room
      if (socketInfo.roomCode) {
        this.removeFromRoom(socketId, socketInfo.roomCode);
      }
      
      this.sockets.delete(socketId);
      
      logInfo('Socket unregistered', { 
        socketId, 
        stats: socketInfo.stats 
      });
    }
  }

  /**
   * Setup socket optimizations
   */
  setupSocketOptimizations(socket) {
    const originalEmit = socket.emit.bind(socket);
    
    // Override emit for batching and compression
    socket.emit = (event, ...args) => {
      const socketInfo = this.sockets.get(socket.id);
      
      if (socketInfo) {
        // Update stats
        const dataSize = JSON.stringify(args).length;
        socketInfo.stats.messagesOut++;
        socketInfo.stats.bytesOut += dataSize;
        
        // Batch small, non-critical events
        if (this.shouldBatch(event, dataSize)) {
          this.addToEventQueue(socket.id, event, args);
          return;
        }
        
        // Compress large data
        if (dataSize > this.compressionThreshold) {
          args = this.compressData(args);
        }
      }
      
      return originalEmit(event, ...args);
    };
    
    // Add incoming message tracking
    socket.use((packet, next) => {
      const socketInfo = this.sockets.get(socket.id);
      
      if (socketInfo) {
        socketInfo.stats.messagesReceived++;
        socketInfo.stats.bytesIn += JSON.stringify(packet).length;
        socketInfo.lastActivity = Date.now();
      }
      
      next();
    });
  }

  /**
   * Check if event should be batched
   */
  shouldBatch(event, dataSize) {
    // Don't batch critical events
    const criticalEvents = [
      'gameAction',
      'disconnect',
      'error',
      'authenticated',
      'roomJoined'
    ];
    
    if (criticalEvents.includes(event)) {
      return false;
    }
    
    // Batch small updates
    return dataSize < 500;
  }

  /**
   * Add event to batch queue
   */
  addToEventQueue(socketId, event, args) {
    if (!this.eventQueue.has(socketId)) {
      this.eventQueue.set(socketId, []);
    }
    
    this.eventQueue.get(socketId).push({
      event,
      args,
      timestamp: Date.now()
    });
  }

  /**
   * Process batched events
   */
  startBatchProcessor() {
    setInterval(() => {
      this.processBatchedEvents();
    }, this.batchInterval);
  }

  /**
   * Process all batched events
   */
  processBatchedEvents() {
    this.eventQueue.forEach((events, socketId) => {
      if (events.length === 0) return;
      
      const socket = this.getSocket(socketId);
      if (!socket) {
        this.eventQueue.delete(socketId);
        return;
      }
      
      // Send batched events
      socket.emit('batch', {
        events: events,
        timestamp: Date.now()
      });
      
      // Clear queue
      this.eventQueue.set(socketId, []);
    });
  }

  /**
   * Compress data (simplified - in production use proper compression)
   */
  compressData(data) {
    // In production, use pako or similar for real compression
    // This is a placeholder
    return {
      compressed: true,
      data: JSON.stringify(data)
    };
  }

  /**
   * Join room with optimization
   */
  joinRoom(socketId, roomCode) {
    const socketInfo = this.sockets.get(socketId);
    
    if (!socketInfo) return false;
    
    // Leave previous room
    if (socketInfo.roomCode) {
      this.removeFromRoom(socketId, socketInfo.roomCode);
    }
    
    // Join new room
    socketInfo.roomCode = roomCode;
    
    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, new Set());
    }
    
    this.rooms.get(roomCode).add(socketId);
    
    logInfo('Socket joined room', { socketId, roomCode });
    
    return true;
  }

  /**
   * Remove from room
   */
  removeFromRoom(socketId, roomCode) {
    const room = this.rooms.get(roomCode);
    
    if (room) {
      room.delete(socketId);
      
      // Clean up empty rooms
      if (room.size === 0) {
        this.rooms.delete(roomCode);
      }
    }
    
    const socketInfo = this.sockets.get(socketId);
    if (socketInfo) {
      socketInfo.roomCode = null;
    }
  }

  /**
   * Broadcast to room with optimization
   */
  broadcastToRoom(roomCode, event, data, excludeSocketId = null) {
    const room = this.rooms.get(roomCode);
    
    if (!room) return;
    
    // Prepare data once
    const serializedData = JSON.stringify(data);
    const shouldCompress = serializedData.length > this.compressionThreshold;
    const preparedData = shouldCompress ? this.compressData(data) : data;
    
    room.forEach(socketId => {
      if (socketId === excludeSocketId) return;
      
      const socket = this.getSocket(socketId);
      if (socket) {
        socket.emit(event, preparedData);
      }
    });
  }

  /**
   * Get socket by ID
   */
  getSocket(socketId) {
    // This should be replaced with actual socket.io socket retrieval
    // For now, returning null as placeholder
    return null;
  }

  /**
   * Get room members
   */
  getRoomMembers(roomCode) {
    const room = this.rooms.get(roomCode);
    return room ? Array.from(room) : [];
  }

  /**
   * Get socket statistics
   */
  getSocketStats(socketId) {
    const socketInfo = this.sockets.get(socketId);
    return socketInfo ? socketInfo.stats : null;
  }

  /**
   * Get all statistics
   */
  getAllStats() {
    const stats = {
      totalSockets: this.sockets.size,
      totalRooms: this.rooms.size,
      sockets: [],
      rooms: []
    };
    
    this.sockets.forEach((info, socketId) => {
      stats.sockets.push({
        id: socketId,
        userId: info.userId,
        roomCode: info.roomCode,
        lastActivity: info.lastActivity,
        stats: info.stats
      });
    });
    
    this.rooms.forEach((members, roomCode) => {
      stats.rooms.push({
        code: roomCode,
        memberCount: members.size,
        members: Array.from(members)
      });
    });
    
    return stats;
  }

  /**
   * Clean up inactive sockets
   */
  cleanupInactiveSockets(maxInactiveTime = 300000) { // 5 minutes
    const now = Date.now();
    const toRemove = [];
    
    this.sockets.forEach((info, socketId) => {
      if (now - info.lastActivity > maxInactiveTime) {
        toRemove.push(socketId);
      }
    });
    
    toRemove.forEach(socketId => {
      this.unregisterSocket(socketId);
      logInfo('Cleaned up inactive socket', { socketId });
    });
    
    return toRemove.length;
  }

  /**
   * Throttled emit for rate limiting
   */
  createThrottledEmit(socket, event, delay = 100) {
    return throttle((data) => {
      socket.emit(event, data);
    }, delay);
  }

  /**
   * Debounced emit for reducing frequency
   */
  createDebouncedEmit(socket, event, delay = 100) {
    return debounce((data) => {
      socket.emit(event, data);
    }, delay);
  }
}

export default new SocketManager();