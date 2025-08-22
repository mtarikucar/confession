# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start both server (port 3001) and client (port 5173) concurrently
- `npm run server:dev` - Start only the backend server with nodemon
- `npm run client:dev` - Start only the React frontend with Vite

### Client-specific
- `cd client && npm run build` - Build the client for production
- `cd client && npm run lint` - Run ESLint on client code
- `cd client && npm run preview` - Preview production build

### Installation
- `npm install` - Install root dependencies
- `cd client && npm install --legacy-peer-deps` - Install client dependencies (requires --legacy-peer-deps for Three.js compatibility)


## Architecture

### Game System
The application is a real-time multiplayer confession game with a modular mini-game system:

1. **Socket.IO Communication**: All real-time features use Socket.IO with event-based handlers organized by domain (room, chat, game)
2. **Session Management**: Uses localStorage for reconnection capability (`useSocket.ts` manages session state)
3. **Game Plugin System**: Mini-games extend `GameInterface` class and are registered in `GAMES` object

### Key Components

**Backend Structure**:
- `server/socket/` - Socket.IO event handlers split by functionality
- `server/games/` - Mini-game implementations extending GameInterface
- `server/models/` - Room and Player classes for state management

**Frontend Structure**:
- `client/src/hooks/useSocket.ts` - Central Socket.IO hook managing all server communication
- `client/src/components/` - Core UI components (Landing, Room, Chat, ConfessionForm)
- `client/src/games/` - Mini-game React components with their own CSS
- `GameContainer.tsx` - Dynamically renders mini-games based on game type

### Adding New Mini-Games

1. Create server game class extending `GameInterface` in `server/games/`
2. Register in `GAMES` object in `server/socket/gameHandlers.js`
3. Create React component in `client/src/games/`
4. Add case in `GameContainer.tsx` to render the component

### Type Safety
Shared TypeScript types in `shared/types.ts` define all data structures used between client and server.