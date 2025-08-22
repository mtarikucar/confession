import { useEffect, useState, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import type { Player, Room, ChatMessage } from '../../../shared/types';

const SOCKET_URL = 'http://localhost:3001';
const STORAGE_KEY = 'confession_game_session';

// Session management helpers
const SessionStorage = {
  save: (data: { playerId?: string; nickname?: string; roomCode?: string; token?: string }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  
  load: () => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  },
  
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  },
  
  update: (updates: Partial<{ playerId: string; nickname: string; roomCode: string; token: string }>) => {
    const current = SessionStorage.load() || {};
    SessionStorage.save({ ...current, ...updates });
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

  // Initialize socket without connecting
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling']
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    // Authentication event from server
    newSocket.on('authenticated', (data) => {
      console.log('Authenticated event received:', data);
      if (data.success) {
        console.log('Setting isAuthenticated to true');
        setIsAuthenticated(true);
        setPlayer({
          id: data.user.id,
          nickname: data.user.nickname,
          hasConfession: false,
          isPlaying: false
        });
        setAuthToken(data.token);
        
        // Save session
        SessionStorage.update({
          playerId: data.user.id,
          nickname: data.user.nickname,
          token: data.token
        });
        console.log('Authentication complete, session saved');
      } else {
        console.error('Authentication failed:', data.error);
      }
    });

    // Room events
    newSocket.on('playerJoined', (data) => {
      setRoom(data.room);
    });

    newSocket.on('playerLeft', (data) => {
      setRoom(data.room);
    });

    newSocket.on('confessionSubmitted', (data) => {
      setRoom(data.room);
    });

    newSocket.on('matchStarted', (data) => {
      setRoom(data.room);
    });

    newSocket.on('gameUpdate', (data) => {
      setRoom(prev => prev ? { ...prev, currentGame: data.game } : null);
    });

    newSocket.on('gameEnded', (data) => {
      setRoom(data.room);
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

      // Disconnect if already connected
      if (socketRef.current.connected) {
        socketRef.current.disconnect();
      }

      // Update auth with nickname
      socketRef.current.auth = {
        nickname: nickname
      };

      // Connect
      socketRef.current.connect();

      // Wait for authentication with timeout
      const timeout = setTimeout(() => {
        if (isAuthenticated) {
          resolve();
        } else {
          reject(new Error('Authentication timeout'));
        }
      }, 5000);

      // Check for authentication every 100ms
      const checkInterval = setInterval(() => {
        if (isAuthenticated) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Listen for connection errors
      const onError = (error: any) => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        socketRef.current?.off('connect_error', onError);
        reject(new Error(error.message || 'Connection failed'));
      };

      socketRef.current.once('connect_error', onError);
    });
  }, [isAuthenticated]);

  // Reconnect with token
  const reconnectWithToken = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      const savedSession = SessionStorage.load();
      
      if (!savedSession?.token || !socketRef.current) {
        reject(new Error('No saved session'));
        return;
      }

      // Update auth with token for reconnection
      socketRef.current.auth = {
        token: savedSession.token,
        reconnection: true
      };

      // Connect if not connected
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }

      // Wait for authentication
      const timeout = setTimeout(() => {
        reject(new Error('Reconnection timeout'));
      }, 5000);

      const onAuthenticated = (data: any) => {
        clearTimeout(timeout);
        socketRef.current?.off('authenticated', onAuthenticated);
        if (data.success) {
          resolve();
        } else {
          SessionStorage.clear();
          reject(new Error('Invalid session'));
        }
      };

      socketRef.current.on('authenticated', onAuthenticated);
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
        isAuthenticated,
        player
      });
      
      if (!socketRef.current?.connected || !isAuthenticated) {
        reject(new Error('Not authenticated'));
        return;
      }

      const roomData = {
        name: `${player?.nickname || 'Player'}'s Room`,
        description: 'A fun confession game room',
        maxPlayers: 20,
        isPublic: true
      };

      socketRef.current.emit('createRoom', roomData, (response: any) => {
        console.log('Create room response:', response);
        if (response.success) {
          setRoom(response.room);
          SessionStorage.update({ roomCode: response.room.code });
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
      if (!socketRef.current?.connected || !isAuthenticated) {
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
          resolve(response.room);
        } else {
          reject(new Error(response.error || 'Failed to join room'));
        }
      });
    });
  }, [isAuthenticated]);

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
          SessionStorage.update({ roomCode: undefined });
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