import { Router } from 'express';
import { RoomService } from '../domain/services/roomService';
import { UserService } from '../domain/services/userService';
import { handleError } from '../utils/errors';
import { createRoomSchema } from '@confess-and-play/shared';

const router = Router();
const roomService = new RoomService();
const userService = new UserService();

// Create room
router.post('/', async (req, res) => {
  try {
    const validation = createRoomSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error.errors 
      });
    }

    const room = await roomService.createRoom(validation.data.name);
    res.status(201).json({ room });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await roomService.getAllRooms();
    res.json({ rooms });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Get room by ID
router.get('/:id', async (req, res) => {
  try {
    const room = await roomService.getRoom(req.params.id);
    res.json({ room });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Get users in room
router.get('/:id/users', async (req, res) => {
  try {
    const users = await userService.getUsersInRoom(req.params.id);
    res.json({ users });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Update room
router.put('/:id', async (req, res) => {
  try {
    const validation = createRoomSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error.errors 
      });
    }

    const room = await roomService.updateRoom(req.params.id, validation.data.name);
    res.json({ room });
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

// Delete room
router.delete('/:id', async (req, res) => {
  try {
    await roomService.deleteRoom(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    const errorResponse = handleError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
});

export default router;