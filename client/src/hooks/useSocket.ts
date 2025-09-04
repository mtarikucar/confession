import { useEffect, useState, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import type { Player, Room, ChatMessage } from '../../../shared/types';
import API_CONFIG from '../config/api';

const SOCKET_URL = API_CONFIG.SOCKET_URL;
const STORAGE_KEY = 'confession_game_session';

// Session management helpers - optional persistence for reconnection only
const SessionStorage = {
  save: (data: { 
    playerId?: string; 
    nickname?: string; 
    roomCode?: string; 
    token?: string;
    roomState?: any;
    gameState?: any;
    lastActivity?: number;
    tabId?: string;
  }) => {
    // Validate token before saving
    if (data.token && (data.token === 'undefined' || data.token === undefined)) {
      console.error('[SessionStorage.save] Attempting to save invalid token:', data.token);
      return; // Don't save sessions with invalid tokens
    }
    
    // Only save if user wants to persist session (not blocking new sessions)
    const tabId = localStorage.getItem('tab_id') || Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tab_id', tabId);
    
    localStorage.setItem(`${STORAGE_KEY}_${tabId}`, JSON.stringify({
      ...data,
      tabId,
      lastActivity: Date.now()
    }));
  },
  
  load: () => {
    // Try to load session for this specific tab only
    const tabId = localStorage.getItem('tab_id');
    if (!tabId) {
      return null;
    }
    
    const data = localStorage.getItem(`${STORAGE_KEY}_${tabId}`);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    // Check if session is still valid (24 hours)
    if (parsed.lastActivity && Date.now() - parsed.lastActivity > 24 * 60 * 60 * 1000) {
      SessionStorage.clear();
      return null;
    }
    return parsed;
  },
  
  clear: () => {
    const tabId = localStorage.getItem('tab_id');
    if (tabId) {
      localStorage.removeItem(`${STORAGE_KEY}_${tabId}`);
      localStorage.removeItem(`${STORAGE_KEY}_${tabId}_room`);
      localStorage.removeItem(`${STORAGE_KEY}_${tabId}_game`);
      // Don't remove tab_id itself - we might need it for reconnection
    }
  },
  
  update: (updates: Partial<{ 
    playerId: string; 
    nickname: string; 
    roomCode: string; 
    token: string;
    roomState?: any;
    gameState?: any;
  }>) => {
    const current = SessionStorage.load() || {};
    SessionStorage.save({ ...current, ...updates });
  },
  
  // Separate storage for room and game states (tab-specific)
  saveRoomState: (room: Room | null) => {
    const tabId = localStorage.getItem('tab_id');
    if (room && tabId) {
      localStorage.setItem(`${STORAGE_KEY}_${tabId}_room`, JSON.stringify(room));
    }
  },
  
  loadRoomState: (): Room | null => {
    const tabId = localStorage.getItem('tab_id');
    if (!tabId) return null;
    const data = localStorage.getItem(`${STORAGE_KEY}_${tabId}_room`);
    return data ? JSON.parse(data) : null;
  },
  
  saveGameState: (game: any) => {
    const tabId = localStorage.getItem('tab_id');
    if (game && tabId) {
      localStorage.setItem(`${STORAGE_KEY}_${tabId}_game`, JSON.stringify(game));
    }
  },
  
  loadGameState: () => {
    const tabId = localStorage.getItem('tab_id');
    if (!tabId) return null;
    const data = localStorage.getItem(`${STORAGE_KEY}_${tabId}_game`);
    return data ? JSON.parse(data) : null;
  }
};

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isAuthenticatedRef = useRef(false);
  const playerRef = useRef<Player | null>(null);
  const authPromiseRef = useRef<{
    resolve: ((value: void) => void) | null;
    reject: ((reason: any) => void) | null;
  }>({ resolve: null, reject: null });

  // Initialize socket connection
  useEffect(() => {
    console.log('[useSocket] Initializing socket...');
    
    // Check for saved session BEFORE creating socket
    const savedSession = SessionStorage.load();
    console.log('[useSocket] Saved session:', savedSession ? 'found' : 'not found');
    
    // Create socket with auth if we have a saved session
    const socketOptions: any = {
      autoConnect: false, // We'll manually connect when needed
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    };
    
    // Set auth if we have a valid saved session
    if (savedSession?.token && savedSession.token !== 'undefined') {
      socketOptions.auth = {
        token: savedSession.token,
        roomCode: savedSession.roomCode,
        reconnection: true,
        tabId: savedSession.tabId
      };
      console.log('[useSocket] Socket will have auth token for reconnection');
      
      // Pre-populate player state for optimistic UI
      if (savedSession.playerId && savedSession.nickname) {
        playerRef.current = {
          id: savedSession.playerId,
          nickname: savedSession.nickname,
          hasConfession: false,
          isPlaying: false
        };
        setPlayer(playerRef.current);
      }
      
      // Restore room state
      const savedRoom = SessionStorage.loadRoomState();
      if (savedRoom) {
        setRoom(savedRoom);
      }
    } else {
      console.log('[useSocket] No valid saved session, socket will connect without auth');
    }
    
    const newSocket = io(SOCKET_URL, socketOptions);
    console.log('[useSocket] Socket created with autoConnect:', socketOptions.autoConnect);

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected', {
        hasAuth: !!newSocket.auth?.token,
        authToken: newSocket.auth?.token?.substring(0, 10) + '...'
      });
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      
      // Don't reset authentication for temporary disconnects
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        setIsAuthenticated(false);
      }
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      // Always try to reconnect with saved token if available
      const savedSession = SessionStorage.load();
      if (savedSession?.token) {
        // Always update auth with latest session data
        newSocket.auth = {
          token: savedSession.token,
          roomCode: savedSession.roomCode,
          reconnection: true,
          tabId: savedSession.tabId
        };
        console.log('Updated auth for reconnection attempt with tabId:', savedSession.tabId);
      }
    });
    
    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
    });

    // Authentication event from server
    newSocket.on('authenticated', (data) => {
      console.log('Authenticated event received:', data);
      if (data.success) {
        console.log('Setting isAuthenticated to true');
        
        // Update refs immediately for synchronous access
        isAuthenticatedRef.current = true;
        playerRef.current = {
          id: data.user.id,
          nickname: data.user.nickname,
          hasConfession: false,
          isPlaying: false
        };
        
        // Update state for UI updates
        setIsAuthenticated(true);
        setPlayer(playerRef.current);
        setAuthToken(data.token);
        
        // Save session
        SessionStorage.update({
          playerId: data.user.id,
          nickname: data.user.nickname,
          token: data.token
        });
        console.log('Authentication complete, session saved');
        
        // Resolve the authentication promise if waiting
        if (authPromiseRef.current.resolve) {
          console.log('Resolving auth promise');
          authPromiseRef.current.resolve();
          authPromiseRef.current.resolve = null;
          authPromiseRef.current.reject = null;
        }
      } else {
        console.error('Authentication failed:', data.error);
        isAuthenticatedRef.current = false;
        playerRef.current = null;
        
        // Reject the authentication promise if waiting
        if (authPromiseRef.current.reject) {
          authPromiseRef.current.reject(new Error(data.error || 'Authentication failed'));
          authPromiseRef.current.resolve = null;
          authPromiseRef.current.reject = null;
        }
      }
    });

    // Room events with state persistence
    newSocket.on('playerJoined', (data) => {
      setRoom(data.room);
      SessionStorage.saveRoomState(data.room);
      // Also update the room code in session
      if (data.room?.code) {
        SessionStorage.update({ roomCode: data.room.code });
      }
    });

    newSocket.on('playerLeft', (data) => {
      setRoom(data.room);
      SessionStorage.saveRoomState(data.room);
    });

    newSocket.on('confessionSubmitted', (data) => {
      setRoom(data.room);
      SessionStorage.saveRoomState(data.room);
    });

    newSocket.on('matchStarted', (data) => {
      console.log('[useSocket] matchStarted received:', data);
      setRoom(data.room);
      SessionStorage.saveRoomState(data.room);
      if (data.game) {
        SessionStorage.saveGameState(data.game);
      }
    });

    newSocket.on('gameUpdate', (data) => {
      setRoom(prev => {
        const updated = prev ? { ...prev, currentGame: data.game } : null;
        SessionStorage.saveRoomState(updated);
        return updated;
      });
      if (data.game) {
        SessionStorage.saveGameState(data.game);
      }
    });

    newSocket.on('gameEnded', (data) => {
      setRoom(data.room);
      SessionStorage.saveRoomState(data.room);
      SessionStorage.saveGameState(null); // Clear game state
    });

    // Chat events
    newSocket.on('newMessage', (message: ChatMessage) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          chatHistory: [...prev.chatHistory, message]
        };
      });
    });

    newSocket.on('confessionRevealed', (data) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          chatHistory: [...prev.chatHistory, data.chatMessage]
        };
      });
    });

    // Game pool update event
    newSocket.on('gamePoolUpdated', (data) => {
      setRoom(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          settings: {
            ...prev.settings,
            gamePool: data.gamePool
          }
        };
        SessionStorage.saveRoomState(updated);
        return updated;
      });
    });

    // Room update event (for any room state changes)
    newSocket.on('roomUpdated', (data) => {
      if (data.room) {
        setRoom(data.room);
        SessionStorage.saveRoomState(data.room);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Connect with nickname (for initial connection)
  const connectWithNickname = useCallback((nickname: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not initialized'));
        return;
      }

      // If already authenticated with same nickname, just resolve
      if (isAuthenticatedRef.current && playerRef.current?.nickname === nickname) {
        console.log('Already authenticated with same nickname');
        resolve();
        return;
      }

      // Disconnect if already connected
      if (socketRef.current.connected) {
        socketRef.current.disconnect();
        isAuthenticatedRef.current = false;
        playerRef.current = null;
        setIsAuthenticated(false);
        setPlayer(null);
      }

      // Generate a new tab ID for this session if needed
      let tabId = localStorage.getItem('tab_id');
      if (!tabId) {
        tabId = Math.random().toString(36).substr(2, 9);
        localStorage.setItem('tab_id', tabId);
      }

      // Update auth with nickname and tab ID for independent sessions
      socketRef.current.auth = {
        nickname: nickname,
        tabId: tabId,
        newSession: true  // Force new session, don't reuse existing
      };

      // Set up auth promise handlers
      authPromiseRef.current.resolve = resolve;
      authPromiseRef.current.reject = reject;

      const errorHandler = (error: any) => {
        console.error('Connection error during auth:', error);
        socketRef.current?.off('connect_error', errorHandler);
        clearTimeout(timeout);
        authPromiseRef.current.resolve = null;
        authPromiseRef.current.reject = null;
        reject(new Error(error.message || 'Connection failed'));
      };

      // Set up timeout
      const timeout = setTimeout(() => {
        socketRef.current?.off('connect_error', errorHandler);
        authPromiseRef.current.resolve = null;
        authPromiseRef.current.reject = null;
        reject(new Error('Authentication timeout'));
      }, 10000);  // 10 seconds timeout

      // Listen for connection errors
      socketRef.current.once('connect_error', errorHandler);

      // Now connect - the authenticated event handler will resolve the promise
      console.log('Connecting socket with nickname:', nickname);
      socketRef.current.connect();
    });
  }, []);

  // Reconnect with token and restore full state
  const reconnectWithToken = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      const savedSession = SessionStorage.load();
      const savedRoom = SessionStorage.loadRoomState();
      const savedGame = SessionStorage.loadGameState();
      
      if (!savedSession?.token || savedSession.token === 'undefined' || !socketRef.current) {
        console.log('[reconnectWithToken] No valid saved session or socket not initialized');
        reject(new Error('No saved session'));
        return;
      }

      console.log('Attempting reconnection with saved state', {
        hasRoom: !!savedRoom,
        hasGame: !!savedGame,
        roomCode: savedSession.roomCode,
        token: savedSession.token.substring(0, 10) + '...',
        currentAuth: socketRef.current.auth?.token?.substring(0, 10) + '...'
      });

      // Check if we're already authenticated with the same token
      if (socketRef.current.auth?.token === savedSession.token && isAuthenticatedRef.current) {
        console.log('Already authenticated with the same token');
        // Restore local state
        if (savedRoom) {
          setRoom(savedRoom);
        }
        resolve();
        return;
      }

      // Only disconnect if we're connected with wrong auth
      if (socketRef.current.connected && socketRef.current.auth?.token !== savedSession.token) {
        console.log('Disconnecting to update auth');
        socketRef.current.disconnect();
      }

      // Update auth with token and room info for reconnection
      socketRef.current.auth = {
        token: savedSession.token,
        roomCode: savedSession.roomCode,
        reconnection: true,
        tabId: savedSession.tabId
      };

      // Restore local state immediately for optimistic UI
      if (savedRoom) {
        setRoom(savedRoom);
      }

      // Set up authentication promise handlers
      authPromiseRef.current.resolve = () => {
        console.log('[reconnectWithToken] Authentication successful');
        
        // If we had a room, rejoin it
        if (savedSession.roomCode && socketRef.current) {
          socketRef.current.emit('rejoinRoom', {
            roomCode: savedSession.roomCode,
            lastState: savedRoom
          }, (response: any) => {
            if (response.success) {
              setRoom(response.room);
              SessionStorage.saveRoomState(response.room);
              console.log('Successfully rejoined room:', savedSession.roomCode);
              
              // Restore game state if present
              if (response.game) {
                setRoom(prev => prev ? { ...prev, currentGame: response.game } : null);
                SessionStorage.saveGameState(response.game);
                console.log('Game state restored:', response.game.id);
              }
            } else {
              console.error('Failed to rejoin room:', response.error);
              // Clear invalid room state but keep session
              SessionStorage.update({ roomCode: undefined });
              SessionStorage.saveRoomState(null);
              SessionStorage.saveGameState(null);
            }
          });
        }
        resolve();
      };
      
      authPromiseRef.current.reject = (error: any) => {
        console.error('[reconnectWithToken] Authentication failed:', error);
        // Don't clear session on failure - it might be a temporary issue
        reject(error);
      };

      // Connect if not connected
      if (!socketRef.current.connected) {
        console.log('[reconnectWithToken] Connecting socket...');
        socketRef.current.connect();
      }

      // Set timeout for authentication
      const timeout = setTimeout(() => {
        console.error('[reconnectWithToken] Timeout');
        authPromiseRef.current.resolve = null;
        authPromiseRef.current.reject = null;
        reject(new Error('Reconnection timeout'));
      }, 10000);
    });
  }, []);

  // Update nickname (after connected)
  const updateNickname = useCallback((nickname: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        reject(new Error('Not connected'));
        return;
      }

      socketRef.current.emit('updateNickname', nickname, (response: any) => {
        if (response.success) {
          setPlayer(prev => prev ? { ...prev, nickname } : null);
          SessionStorage.update({ nickname });
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, []);

  // Create room
  const createRoom = useCallback((): Promise<{ roomCode: string; room: Room }> => {
    return new Promise((resolve, reject) => {
      console.log('Creating room...', {
        connected: socketRef.current?.connected,
        isAuthenticated: isAuthenticatedRef.current,
        player: playerRef.current
      });
      
      // Check connection and authentication using refs for immediate access
      if (!socketRef.current?.connected || !isAuthenticatedRef.current) {
        console.error('Cannot create room: not authenticated', {
          connected: socketRef.current?.connected,
          authenticated: isAuthenticatedRef.current
        });
        reject(new Error('Not authenticated'));
        return;
      }

      const roomData = {
        name: `${playerRef.current?.nickname || 'Player'}'s Room`,
        description: 'A fun confession game room',
        maxPlayers: 20,
        isPublic: true
      };

      socketRef.current.emit('createRoom', roomData, (response: any) => {
        console.log('Create room response:', response);
        if (response.success) {
          setRoom(response.room);
          SessionStorage.update({ roomCode: response.room.code });
          SessionStorage.saveRoomState(response.room);
          resolve({ roomCode: response.room.code, room: response.room });
        } else {
          reject(new Error(response.error || 'Failed to create room'));
        }
      });
    });
  }, [isAuthenticated, player]);

  // Join room
  const joinRoom = useCallback((roomCode: string): Promise<Room> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected || !isAuthenticatedRef.current) {
        reject(new Error('Not authenticated'));
        return;
      }

      const joinData = {
        roomCode: roomCode.toUpperCase(),
        password: null
      };

      socketRef.current.emit('joinRoom', joinData, (response: any) => {
        console.log('Join room response:', response);
        if (response.success) {
          setRoom(response.room);
          SessionStorage.update({ roomCode: roomCode.toUpperCase() });
          SessionStorage.saveRoomState(response.room);
          resolve(response.room);
        } else {
          reject(new Error(response.error || 'Failed to join room'));
        }
      });
    });
  }, []);

  // Submit confession
  const submitConfession = useCallback((confession: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected || !room) {
        reject(new Error('Not in a room'));
        return;
      }

      const confessionData = {
        text: confession,
        roomCode: room.code
      };

      socketRef.current.emit('submitConfession', confessionData, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, [room]);

  // Send chat message
  const sendMessage = useCallback((message: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected || !room) {
        reject(new Error('Not in a room'));
        return;
      }

      const messageData = {
        text: message,
        roomCode: room.code
      };

      socketRef.current.emit('sendMessage', messageData, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, [room]);

  // Request match
  const requestMatch = useCallback((): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected || !room) {
        reject(new Error('Not in a room'));
        return;
      }

      socketRef.current.emit('requestMatch', { roomCode: room.code }, (response: any) => {
        if (response.success) {
          resolve(response.matched);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, [room]);

  // Send game action
  const sendGameAction = useCallback((action: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected || !room) {
        reject(new Error('Not in a game'));
        return;
      }

      socketRef.current.emit('gameAction', action, (response: any) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }, [room]);

  // Leave room
  const leaveRoom = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        reject(new Error('Not connected'));
        return;
      }

      socketRef.current.emit('leaveRoom', (response: any) => {
        if (response?.success !== false) {
          setRoom(null);
          SessionStorage.clear(); // Clear all session data when leaving room
          resolve();
        } else {
          reject(new Error(response?.error || 'Failed to leave room'));
        }
      });
    });
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setIsConnected(false);
      setIsAuthenticated(false);
      SessionStorage.clear(); // Clear session on disconnect
      setPlayer(null);
      setRoom(null);
    }
  }, []);

  return {
    socket,
    isConnected,
    isAuthenticated,
    player,
    room,
    authToken,
    
    // Connection methods
    connectWithNickname,
    reconnectWithToken,
    disconnect,
    
    // User methods
    updateNickname,
    
    // Room methods
    createRoom,
    joinRoom,
    leaveRoom,
    
    // Game methods
    submitConfession,
    sendMessage,
    requestMatch,
    sendGameAction
  };
}