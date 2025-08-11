# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Confess & Play" is a real-time web application where users join rooms anonymously with nicknames, submit confessions, and play 2D/3D minigames. When a player loses, their confession is revealed in the room chat.

### Tech Stack
- **Frontend**: Next.js + TypeScript + Tailwind CSS, Socket.IO client, PixiJS/Phaser (2D), React Three Fiber/Three.js (3D)
- **Backend**: Node.js + TypeScript (Express), Socket.IO, Prisma ORM, PostgreSQL
- **Database**: PostgreSQL (persistent), optional Redis for Socket.IO scaling
- **Architecture**: Monorepo with apps (server/client) and shared packages

## Development Commands

```bash
# Root level
npm install                 # Install all workspace dependencies
npm run dev                 # Run both server and client in development
npm run build              # Build all packages
npm run test               # Run all tests
npm run lint               # Lint all packages
npm run typecheck          # Type check all packages

# Server specific (apps/server)
npm run dev                # Start dev server with hot reload
npm run build              # Build production server
npm run start              # Start production server
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run database migrations
npm run prisma:studio      # Open Prisma Studio

# Client specific (apps/client)
npm run dev                # Start Next.js dev server
npm run build              # Build production client
npm run start              # Start production client
npm run lint               # Run ESLint
npm run type-check         # Check TypeScript types

# Testing
npm run test:unit          # Run unit tests
npm run test:integration   # Run integration tests
npm run test:e2e          # Run E2E tests with Playwright
```

## Architecture

### Monorepo Structure
```
/
├── apps/
│   ├── server/           # Node.js backend
│   │   └── src/
│   │       ├── modules/   # Feature modules (rooms, games, chat, confessions)
│   │       ├── sockets/   # Socket.IO handlers
│   │       ├── domain/    # Business logic, entities, repositories
│   │       └── prisma/    # Database schema and client
│   └── client/           # Next.js frontend
│       └── src/
│           ├── app/       # Next.js App Router
│           ├── components/# React components
│           ├── games/     # Game modules (rps2d, ballrace3d)
│           └── lib/       # Socket client, API helpers
├── packages/
│   └── shared/           # Shared types, DTOs, validation
└── docker-compose.yml    # PostgreSQL and Redis setup
```

### Key Design Patterns
1. **Modular Game System**: Each game implements a common interface with mount/unmount/handleRemote methods
2. **Socket-First Architecture**: Real-time updates via Socket.IO for all game and chat interactions
3. **Anonymous User System**: No authentication; users identified by unique nicknames and session IDs
4. **Confession Mechanism**: One confession per user per room; revealed only when user loses

## Database Schema (Prisma)

### Core Models
- **User**: id, nickname (unique case-insensitive), roomId, createdAt
- **Room**: id, name, createdAt, relations to users and game rounds
- **Confession**: id, userId (unique), content, isRevealed, createdAt
- **GameRound**: id, roomId, player1Id, player2Id, winnerId, revealedConfessionId, gameId, status, metadata

### Important Indexes
- Unique lowercase index on User.nickname
- Index on User.roomId for room queries
- Index on GameRound.roomId for game history
- Index on Confession.userId for quick lookups

## Socket.IO Events

### Client → Server
- `join_room`: { userId, roomId }
- `leave_room`: { userId, roomId }
- `send_confession`: { userId, content }
- `start_game`: { roomId, gameId? }
- `play_move`: { roomId, userId, move }
- `chat_message`: { roomId, userId, text }

### Server → Client
- `user_joined`: { roomId, user }
- `user_left`: { roomId, userId }
- `confession_submitted`: { userId, status }
- `game_started`: { roomId, roundId, gameId, players, assets? }
- `round_update`: { roundId, state }
- `round_result`: { roundId, winnerId, loserId, revealedConfession? }
- `chat_message`: { roomId, message }
- `error_event`: { code, message, context? }

## Game Module Interface

Each game module must implement:
```typescript
interface GameModule {
  id: string;              // e.g., "rps", "ballrace3d"
  name: string;            
  type: "2D" | "3D";
  assets: string[];        // Paths relative to public/assets/games/<id>/
  mount(container: HTMLElement, options: GameOptions): void;
  handleRemote(stateOrMove: any): void;
  unmount(): void;
}
```

## Security & Validation

1. **Nickname**: 3-20 characters, alphanumeric + underscore, case-insensitive unique
2. **Confession**: Max 500 characters, profanity filter, XSS sanitization
3. **Rate Limiting**: IP-based for HTTP endpoints, user-based for Socket events
4. **Room Spam Protection**: Creation rate limits, TTL for empty rooms

## Asset Pipeline

### 2D Assets
- Tools: Sketch/Figma/Illustrator → PNG/SVG/Spritesheet
- Location: `client/public/assets/games/<gameId>/`
- Loader: PixiJS/Phaser asset loader

### 3D Assets
- Tools: Blender → glTF/GLB (single .glb preferred)
- Textures: PBR workflow (baseColor, normal, roughness, metallic)
- Location: `client/public/assets/games/<gameId>/`
- Loader: useGLTF with React Three Fiber

## Business Rules

1. **Unique Nicknames**: Case-insensitive, database-enforced uniqueness
2. **Confession Required**: Users must submit confession before playing
3. **One Confession Per User**: Single active confession per session/room
4. **Game Start Conditions**: Minimum 2 players with confessions in same room
5. **Result Handling**: Loser's confession becomes visible (isRevealed=true)
6. **Draw Resolution**: In case of draw, game repeats or new sub-round
7. **Disconnection**: Rounds cancelled or auto-win if player leaves mid-game

## Environment Variables

```env
# Server
SERVER_PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/confess_game
CLIENT_ORIGIN=http://localhost:3000
NODE_ENV=development|production
REDIS_URL=redis://localhost:6379  # Optional, for Socket.IO scaling

# Client
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3001
```

## Testing Strategy

- **Unit Tests**: Game logic, services, validators
- **Integration Tests**: Socket flows, database operations
- **E2E Tests**: Multi-browser scenarios with Playwright
- **Visual Tests**: Optional baseline screenshots for games

## Performance Considerations

1. Use PostgreSQL indexes strategically
2. Implement Socket.IO Redis adapter for horizontal scaling
3. CDN for static assets (models, images)
4. WebGL optimization: Low polygon count, instancing, minimal lights
5. Pagination for confessions and game rounds

## Common Tasks

### Adding a New Game Module
1. Create directory in `apps/client/src/games/<gameId>/`
2. Implement GameModule interface
3. Add assets to `public/assets/games/<gameId>/`
4. Register in game registry
5. Add server-side game logic in `apps/server/src/modules/games/`
6. Update Socket handlers for new game type

### Database Migrations
```bash
cd apps/server
npx prisma migrate dev --name <migration-name>
npx prisma generate
```

### Running with Docker
```bash
docker-compose up -d        # Start PostgreSQL and Redis
npm run dev                 # Start development servers
```

## Debugging Tips

1. Check Socket.IO connection: Browser DevTools → Network → WS tab
2. Database queries: Use Prisma Studio (`npm run prisma:studio`)
3. Game state: Add debug overlay in development mode
4. Rate limiting: Check server logs for throttled requests