# Confess & Play 🎮💔

A real-time multiplayer web application where users anonymously join rooms, submit confessions, and play minigames. When a player loses, their confession is revealed to everyone in the room!

## 🌟 Features

- **Anonymous Play**: Join with just a nickname - no registration required
- **Real-time Gameplay**: Powered by Socket.IO for instant communication
- **Confession System**: Submit a secret that gets revealed only if you lose
- **Multiple Games**: 
  - Rock Paper Scissors (2D) - Fully implemented
  - Ball Race 3D - Coming soon
- **Room System**: Create and join rooms with other players
- **Live Chat**: Communicate with other players in real-time
- **Responsive Design**: Works on desktop and mobile devices

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time features
- **Zustand** for state management
- **PixiJS/Phaser** for 2D games
- **React Three Fiber** for 3D games

### Backend
- **Node.js** with Express
- **TypeScript**
- **Socket.IO** for WebSocket connections
- **Prisma ORM** with PostgreSQL
- **Redis** (optional) for Socket.IO scaling
- **Zod** for validation

### Infrastructure
- **Docker** & **Docker Compose** for containerization
- **Nginx** for reverse proxy
- **PostgreSQL** for data persistence
- **Redis** for caching and scaling

## 📋 Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+ (or Docker)
- Redis (optional, for scaling)
- Docker & Docker Compose (for containerized deployment)

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd confession
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
```

4. **Start PostgreSQL and Redis** (using Docker)
```bash
docker-compose up -d
```

Or use local PostgreSQL/Redis and update `.env` files accordingly.

5. **Initialize the database**
```bash
cd apps/server
npx prisma generate
npx prisma migrate dev
cd ../..
```

6. **Build shared packages**
```bash
cd packages/shared
npm run build
cd ../..
```

7. **Start development servers**
```bash
npm run dev
```

The application will be available at:
- Client: http://localhost:3000
- Server: http://localhost:3001
- Prisma Studio: Run `npm run prisma:studio` in `apps/server`

### Using the Setup Script

Alternatively, use the provided setup script:
```bash
chmod +x setup.sh
./setup.sh
```

## 🎮 How to Play

1. **Enter the Game**
   - Visit http://localhost:3000
   - Choose a unique nickname (3-20 characters)
   - Click "Enter Game"

2. **Join or Create a Room**
   - Browse existing rooms or create your own
   - Click on a room to join

3. **Submit Your Confession**
   - Write a confession (10-500 characters)
   - This will be revealed if you lose!
   - You can't play without submitting a confession

4. **Start Playing**
   - Wait for at least 2 players with confessions
   - Click "Start Game" to begin
   - Choose your move in Rock Paper Scissors

5. **See the Results**
   - Winner is safe
   - Loser's confession is revealed in the chat
   - Play again or try a different game!

## 📁 Project Structure

```
confession/
├── apps/
│   ├── server/         # Node.js backend
│   │   ├── src/
│   │   │   ├── domain/     # Business logic
│   │   │   ├── routes/     # API endpoints
│   │   │   ├── sockets/    # Socket.IO handlers
│   │   │   └── prisma/     # Database schema
│   │   └── tests/      # Server tests
│   └── client/         # Next.js frontend
│       ├── src/
│       │   ├── app/        # App Router pages
│       │   ├── components/ # React components
│       │   ├── games/      # Game modules
│       │   ├── lib/        # Utilities
│       │   └── store/      # State management
│       └── public/     # Static assets
├── packages/
│   └── shared/         # Shared types and schemas
├── docker-compose.yml  # Development containers
├── docker-compose.prod.yml # Production setup
└── nginx.conf         # Nginx configuration
```

## 🧪 Testing

### Run Tests
```bash
# All tests
npm test

# Server tests
cd apps/server && npm test

# Client tests (when implemented)
cd apps/client && npm test
```

### Test Coverage
```bash
cd apps/server
npm run test:coverage
```

## 📦 Production Deployment

### Using Docker Compose

1. **Build and start all services**
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

2. **Run database migrations**
```bash
docker exec confess_server npx prisma migrate deploy
```

3. **Access the application**
- Application: http://localhost
- Direct client: http://localhost:3000
- Direct server: http://localhost:3001

### Manual Deployment

1. **Build the applications**
```bash
# Build shared package
cd packages/shared && npm run build

# Build server
cd apps/server
npm run build

# Build client
cd apps/client
npm run build
```

2. **Set production environment variables**
```bash
# Server
export NODE_ENV=production
export DATABASE_URL=your_production_db_url
export CLIENT_ORIGIN=https://your-domain.com

# Client
export NEXT_PUBLIC_SERVER_URL=https://api.your-domain.com
export NEXT_PUBLIC_SOCKET_URL=wss://api.your-domain.com
```

3. **Start the applications**
```bash
# Server
cd apps/server && npm start

# Client
cd apps/client && npm start
```

## 🔧 Configuration

### Environment Variables

#### Server (`apps/server/.env`)
- `SERVER_PORT` - Server port (default: 3001)
- `DATABASE_URL` - PostgreSQL connection string
- `CLIENT_ORIGIN` - Client URL for CORS
- `NODE_ENV` - Environment (development/production)
- `REDIS_URL` - Redis connection (optional)

#### Client (`apps/client/.env`)
- `NEXT_PUBLIC_SERVER_URL` - Backend API URL
- `NEXT_PUBLIC_SOCKET_URL` - WebSocket server URL

## 🔒 Security Features

- **Input Validation**: All inputs validated with Zod schemas
- **Rate Limiting**: API and Socket.IO event throttling
- **Profanity Filter**: Basic content filtering
- **XSS Protection**: Input sanitization
- **CORS Configuration**: Restricted origins
- **Helmet.js**: Security headers
- **No Authentication Required**: Anonymous play only

## 📊 Monitoring

The application includes:
- Health check endpoint: `/health`
- Socket connection monitoring
- Error logging and handling
- Database query logging (development)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🐛 Known Issues

- Ball Race 3D game is not yet implemented
- Mobile responsiveness needs optimization
- No persistent user sessions across browser refreshes

## 🚧 Roadmap

- [ ] Implement Ball Race 3D game
- [ ] Add more game modes
- [ ] Implement spectator mode
- [ ] Add room passwords
- [ ] User avatars
- [ ] Confession voting system
- [ ] Tournament mode
- [ ] Mobile app (React Native)

## 💡 Tips

- Use Chrome DevTools for Socket.IO debugging (Network → WS tab)
- Run `npx prisma studio` to view/edit database
- Check server logs for detailed error messages
- Clear browser storage if experiencing connection issues

## 📧 Support

For issues and questions, please open a GitHub issue.