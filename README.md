# 🎮 Confession Game - Production Ready

A real-time multiplayer confession game with mini-games, built with Node.js, Socket.IO, React, PostgreSQL, and Redis.

## 🚀 Features

### Core Features
- **Real-time Multiplayer**: Socket.IO with Redis adapter for scalability
- **Multiple Game Modes**: Word Battle, Drawing Guess, Racing 3D, Rock Paper Scissors
- **Confession System**: Submit and reveal confessions based on game outcomes
- **Authentication**: JWT-based auth with guest mode support
- **Persistent Sessions**: Automatic reconnection with state recovery
- **Database Storage**: PostgreSQL with Prisma ORM
- **Caching**: Redis for sessions, game state, and leaderboards
- **Production Ready**: Docker support, health checks, monitoring, logging

### Security Features
- Rate limiting on API endpoints and Socket.IO events
- Input validation and sanitization
- Helmet.js for security headers
- CORS configuration
- SQL injection protection via Prisma
- XSS protection
- JWT token rotation

### Monitoring & Observability
- Health check endpoints
- Prometheus metrics endpoint
- Structured logging with Winston
- Error tracking ready (Sentry compatible)
- Performance monitoring

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (optional)

## 🛠️ Installation

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/confession-game.git
cd confession-game
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Start services with Docker Compose:
```bash
npm run docker:up
```

4. Install dependencies:
```bash
npm run install:all
```

5. Run database migrations:
```bash
npx prisma migrate dev
```

6. Seed the database:
```bash
npm run db:seed
```

7. Start the application:
```bash
npm run dev
```

### Manual Installation

1. Install PostgreSQL and Redis locally
2. Create a database named `confession_game`
3. Update `.env` with your database credentials
4. Follow steps 1-2 and 4-7 from Docker installation

## 🗄️ Database Setup

### Run Migrations
```bash
npm run db:migrate
```

### Seed Database (Development)
```bash
npm run db:seed
```

### Open Prisma Studio
```bash
npm run db:studio
```

## 🔧 Available Scripts

### Development
- `npm run dev` - Start both server and client in development mode
- `npm run server:dev` - Start only the backend server
- `npm run client:dev` - Start only the React frontend

### Production
- `npm run build` - Build client for production
- `npm start` - Start production server

### Database
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes (development)
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset database
- `npm run db:studio` - Open Prisma Studio

### Docker
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services
- `npm run docker:logs` - View Docker logs

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/guest` - Create guest session
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

### Health & Monitoring
- `GET /api/health` - Basic health check
- `GET /api/health/live` - Liveness probe
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/detailed` - Detailed health metrics
- `GET /api/health/metrics` - Prometheus metrics
- `GET /api/health/info` - Application info

## 🔌 Socket.IO Events

### Room Events
- `createRoom` - Create a new game room
- `joinRoom` - Join existing room
- `leaveRoom` - Leave current room
- `getRooms` - Get list of public rooms

### Game Events
- `requestMatch` - Request to start a match
- `gameAction` - Send game action
- `submitConfession` - Submit confession

### Chat Events
- `sendMessage` - Send chat message
- `typing` - Typing indicator

## 🐳 Docker Services

The `docker-compose.yml` includes:
- **PostgreSQL**: Database server (port 5432)
- **Redis**: Cache and session store (port 6379)
- **Adminer**: Database management UI (port 8080)
- **Redis Commander**: Redis management UI (port 8081)

## 🔒 Security Configuration

### Environment Variables
Key security-related environment variables:
- `JWT_SECRET` - Secret for JWT signing
- `SESSION_SECRET` - Session encryption key
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window
- `CORS_ORIGINS` - Allowed CORS origins

### Rate Limiting
Default limits:
- Authentication endpoints: 20 requests per minute
- Socket.IO events: 30 events per minute
- General API: 100 requests per 15 minutes

## 📊 Monitoring

### Health Checks
- Liveness: `/api/health/live`
- Readiness: `/api/health/ready`
- Detailed: `/api/health/detailed`

### Metrics (Prometheus Format)
Available at `/api/health/metrics`:
- Process metrics (memory, CPU)
- System metrics (load, memory)
- Application metrics (users, rooms, games)
- Socket.IO metrics (connections)

## 🚀 Deployment

### Using Docker
```bash
docker build -t confession-game .
docker run -p 3001:3001 --env-file .env confession-game
```

### Using PM2
```bash
npm install -g pm2
pm2 start server/index.js --name confession-game
pm2 save
pm2 startup
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use strong, unique secrets for JWT and sessions
- Configure proper CORS origins
- Set up SSL/TLS certificates
- Configure reverse proxy (nginx/Apache)

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React, Vite, Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Authentication**: JWT + Session hybrid
- **Real-time**: Socket.IO with Redis adapter

### Scalability Features
- Redis adapter for multi-server Socket.IO
- Database connection pooling
- Horizontal scaling ready
- Stateless authentication
- Efficient caching strategies

## 📝 How to Play

1. **Register/Login** or continue as guest
2. **Create or Join** a room using a room code
3. **Submit Confession** before playing
4. **Request Match** to start a game
5. **Play Mini-Games**:
   - Word Battle: Form words from given letters
   - Drawing Guess: Draw and guess drawings
   - Racing 3D: Race to the finish line
   - Rock Paper Scissors: Classic game
6. **Winners** keep their confessions hidden
7. **Losers** have confessions revealed!

## 🎮 Game Controls

### Word Battle
- Click letters to form words
- Submit words for points
- Longer words = more points

### Drawing Guess
- Draw with mouse/touch
- Guess other players' drawings
- Type guesses in chat

### Racing 3D
- ↑/W: Accelerate
- ↓/S: Brake
- ←/A: Left lane
- →/D: Right lane
- Space: Boost

### Rock Paper Scissors
- Click your choice
- Best of 3 rounds

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 🐛 Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Run `npm run db:push` to sync schema

### Redis Connection Issues
- Ensure Redis is running
- Check REDIS_HOST and REDIS_PORT in .env

### Port Already in Use
- Change PORT in .env
- Or kill the process using the port

## 📞 Support

For issues and questions, please open a GitHub issue.

## 📝 License

MIT"# confession" 
