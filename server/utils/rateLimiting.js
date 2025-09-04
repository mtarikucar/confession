/**
 * Rate limiting utilities
 */

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, delay) {
  let lastCall = 0;
  let timeout = null;
  
  return function(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    } else {
      // Schedule for later
      if (timeout) clearTimeout(timeout);
      
      timeout = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, delay) {
  let timeout = null;
  
  return function(...args) {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Rate limiter with token bucket algorithm
 */
export class RateLimiter {
  constructor(maxTokens = 10, refillRate = 1, refillInterval = 1000) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
    this.lastRefill = Date.now();
    
    // Start refill timer
    this.startRefillTimer();
  }
  
  startRefillTimer() {
    setInterval(() => {
      this.refill();
    }, this.refillInterval);
  }
  
  refill() {
    this.tokens = Math.min(this.maxTokens, this.tokens + this.refillRate);
    this.lastRefill = Date.now();
  }
  
  tryConsume(tokens = 1) {
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
  
  getTokens() {
    return this.tokens;
  }
  
  reset() {
    this.tokens = this.maxTokens;
  }
}

/**
 * Per-user rate limiter
 */
export class UserRateLimiter {
  constructor(maxTokens = 10, refillRate = 1, refillInterval = 1000) {
    this.limiters = new Map();
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
  }
  
  getLimiter(userId) {
    if (!this.limiters.has(userId)) {
      this.limiters.set(userId, new RateLimiter(
        this.maxTokens,
        this.refillRate,
        this.refillInterval
      ));
    }
    return this.limiters.get(userId);
  }
  
  tryConsume(userId, tokens = 1) {
    return this.getLimiter(userId).tryConsume(tokens);
  }
  
  getTokens(userId) {
    return this.getLimiter(userId).getTokens();
  }
  
  reset(userId) {
    if (this.limiters.has(userId)) {
      this.limiters.get(userId).reset();
    }
  }
  
  remove(userId) {
    this.limiters.delete(userId);
  }
  
  cleanup(maxAge = 3600000) { // 1 hour
    const now = Date.now();
    const toRemove = [];
    
    this.limiters.forEach((limiter, userId) => {
      if (now - limiter.lastRefill > maxAge) {
        toRemove.push(userId);
      }
    });
    
    toRemove.forEach(userId => this.remove(userId));
    
    return toRemove.length;
  }
}