import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import userRoutes from './routes/userRoutes';
import roomRoutes from './routes/roomRoutes';
import confessionRoutes from './routes/confessionRoutes';
import gameRoutes from './routes/gameRoutes';

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.CLIENT_ORIGIN,
  credentials: true,
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests from this IP',
});

app.use('/api', limiter);

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/confessions', confessionRoutes);
app.use('/api/games', gameRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;