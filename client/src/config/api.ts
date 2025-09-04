// API Configuration for different environments

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Get API URL from environment variable or use defaults
const getApiUrl = () => {
  // Check if VITE_API_URL is set in environment
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Default URLs based on environment
  if (isProduction) {
    // In production, use relative URL (same domain)
    // This assumes nginx is proxying /api to the backend
    return '';
  } else {
    // In development, use local backend
    return 'http://localhost:3004';
  }
};

// Get WebSocket URL
const getSocketUrl = () => {
  // Check if VITE_SOCKET_URL is set in environment
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // Default URLs based on environment
  if (isProduction) {
    // In production, use the current domain with wss protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  } else {
    // In development, use local backend
    return 'http://localhost:3004';
  }
};

export const API_CONFIG = {
  API_URL: getApiUrl(),
  SOCKET_URL: getSocketUrl(),
  API_TIMEOUT: 30000, // 30 seconds
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 3000, // 3 seconds
};

export default API_CONFIG;