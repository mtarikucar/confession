import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { setupSocketHandlers } from './sockets';
import { config } from './config';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.CLIENT_ORIGIN,
    credentials: true,
  },
});

setupSocketHandlers(io);

const PORT = config.SERVER_PORT;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);
});