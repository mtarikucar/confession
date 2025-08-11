import { Server, Socket } from 'socket.io';
import { User } from '@prisma/client';

interface SocketUser {
  socketId: string;
  userId: string;
  nickname: string;
  roomId?: string;
}

export class SocketManager {
  private static instance: SocketManager;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userToSocket: Map<string, string> = new Map();

  private constructor() {}

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  addUser(socketId: string, user: User): void {
    const socketUser: SocketUser = {
      socketId,
      userId: user.id,
      nickname: user.nickname,
      roomId: user.roomId || undefined,
    };
    
    this.connectedUsers.set(socketId, socketUser);
    this.userToSocket.set(user.id, socketId);
  }

  removeUser(socketId: string): SocketUser | undefined {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      this.connectedUsers.delete(socketId);
      this.userToSocket.delete(user.userId);
    }
    return user;
  }

  getUser(socketId: string): SocketUser | undefined {
    return this.connectedUsers.get(socketId);
  }

  getUserByUserId(userId: string): SocketUser | undefined {
    const socketId = this.userToSocket.get(userId);
    if (socketId) {
      return this.connectedUsers.get(socketId);
    }
    return undefined;
  }

  updateUserRoom(socketId: string, roomId: string | undefined): void {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      user.roomId = roomId;
    }
  }

  getUsersInRoom(roomId: string): SocketUser[] {
    return Array.from(this.connectedUsers.values()).filter(
      user => user.roomId === roomId
    );
  }

  getRoomCount(roomId: string): number {
    return this.getUsersInRoom(roomId).length;
  }

  getSocketIdByUserId(userId: string): string | undefined {
    return this.userToSocket.get(userId);
  }
}