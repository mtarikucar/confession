import { Router } from 'express';
import { GameService } from '../domain/services/gameService';
import { handleError } from '../utils/errors';

const router = Router();
const gameService = new GameService();

// Get room game history
router.get('/room/:roomId/rounds', async (req, res) => {
  try {
    const rounds = await gameService.getRoomHistory(req.params.roomId);
    res.json({ rounds });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Get round by ID
router.get('/rounds/:id', async (req, res) => {
  try {
    const round = await gameService.getRoundById(req.params.id);
    res.json({ round });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;