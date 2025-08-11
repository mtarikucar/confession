import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Room, Confession, GameRound } from '@confess-and-play/shared';

interface AppState {
  // User state
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Room state
  currentRoom: Room | null;
  rooms: Room[];
  setCurrentRoom: (room: Room | null) => void;
  setRooms: (rooms: Room[]) => void;
  
  // Confession state
  confession: Confession | null;
  setConfession: (confession: Confession | null) => void;
  
  // Game state
  currentGame: GameRound | null;
  setCurrentGame: (game: GameRound | null) => void;
  
  // Chat state
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  
  // Socket state
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
  
  // Reset all state
  reset: () => void;
}

export interface ChatMessage {
  id: string;
  from: string;
  nickname?: string;
  text: string;
  ts: number;
  type: 'user' | 'system' | 'confession_reveal';
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // User state
      user: null,
      setUser: (user) => set({ user }),
      
      // Room state
      currentRoom: null,
      rooms: [],
      setCurrentRoom: (room) => set({ currentRoom: room }),
      setRooms: (rooms) => set({ rooms }),
      
      // Confession state
      confession: null,
      setConfession: (confession) => set({ confession }),
      
      // Game state
      currentGame: null,
      setCurrentGame: (game) => set({ currentGame: game }),
      
      // Chat state
      messages: [],
      addMessage: (message) => set((state) => ({
        messages: [...state.messages, message].slice(-100), // Keep last 100 messages
      })),
      clearMessages: () => set({ messages: [] }),
      
      // Socket state
      isConnected: false,
      setConnected: (connected) => set({ isConnected: connected }),
      
      // Reset all state
      reset: () => set({
        user: null,
        currentRoom: null,
        rooms: [],
        confession: null,
        currentGame: null,
        messages: [],
        isConnected: false,
      }),
    }),
    {
      name: 'confess-play-store',
      partialize: (state) => ({ user: state.user }), // Only persist user
    }
  )
);