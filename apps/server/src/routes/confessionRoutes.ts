import { Router } from 'express';
import { ConfessionService } from '../domain/services/confessionService';
import { handleError } from '../utils/errors';
import { createConfessionSchema } from '@confess-and-play/shared';

const router = Router();
const confessionService = new ConfessionService();

// Create confession
router.post('/', async (req, res) => {
  try {
    const validation = createConfessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error.errors 
      });
    }

    const confession = await confessionService.createConfession(
      validation.data.userId,
      validation.data.content
    );
    res.status(201).json({ confession });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Get confession by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const confession = await confessionService.getConfessionByUserId(req.params.userId);
    if (!confession) {
      return res.status(404).json({ error: 'Confession not found' });
    }
    res.json({ confession });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Delete confession
router.delete('/user/:userId', async (req, res) => {
  try {
    await confessionService.deleteConfession(req.params.userId);
    res.status(204).send();
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;