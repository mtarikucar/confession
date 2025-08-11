import { Router } from 'express';
import { UserService } from '../domain/services/userService';
import { handleError } from '../utils/errors';
import { createUserSchema } from '@confess-and-play/shared';

const router = Router();
const userService = new UserService();

// Create user
router.post('/', async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error.errors 
      });
    }

    const user = await userService.createUser(validation.data.nickname);
    res.status(201).json({ user });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await userService.getUser(req.params.id);
    res.json({ user });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Join room
router.post('/:id/join-room', async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const user = await userService.joinRoom(req.params.id, roomId);
    res.json({ user });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Leave room
router.post('/:id/leave-room', async (req, res) => {
  try {
    const user = await userService.leaveRoom(req.params.id);
    res.json({ user });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;