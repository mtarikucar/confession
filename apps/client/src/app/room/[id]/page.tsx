'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import ChatBox from '@/components/ChatBox';
import ConfessionBox from '@/components/ConfessionBox';
import GameArea from '@/components/GameArea';
import PlayerList from '@/components/PlayerList';
import { SOCKET_EVENTS } from '@confess-and-play/shared';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  
  const { user, currentRoom, setCurrentRoom, confession, isConnected, setConnected } = useStore();
  const [roomUsers, setRoomUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameActive, setGameActive] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    initializeRoom();
    
    return () => {
      if (user && roomId) {
        const socket = getSocket();
        socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { userId: user.id, roomId });
      }
    };
  }, [user, roomId]);

  const initializeRoom = async () => {
    try {
      // Load room data
      const { room } = await api.getRoom(roomId);
      setCurrentRoom(room);

      // Load room users
      const { users } = await api.getRoomUsers(roomId);
      setRoomUsers(users);

      // Connect to socket if not connected
      const socket = getSocket();
      
      if (!socket.connected) {
        socket.auth = { userId: user?.id };
        socket.connect();
      }

      // Setup socket listeners
      setupSocketListeners(socket);

      // Join room via socket
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { userId: user?.id, roomId });

      setLoading(false);
    } catch (error) {
      console.error('Failed to initialize room:', error);
      router.push('/rooms');
    }
  };

  const setupSocketListeners = (socket: any) => {
    socket.on('connected', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room_state', (data: any) => {
      setRoomUsers(data.users);
    });

    socket.on(SOCKET_EVENTS.USER_JOINED, (data: any) => {
      setRoomUsers(prev => [...prev, data.user]);
      useStore.getState().addMessage({
        id: Date.now().toString(),
        from: 'system',
        text: `${data.user.nickname} joined the room`,
        ts: Date.now(),
        type: 'system',
      });
    });

    socket.on(SOCKET_EVENTS.USER_LEFT, (data: any) => {
      setRoomUsers(prev => prev.filter(u => u.id !== data.userId));
      useStore.getState().addMessage({
        id: Date.now().toString(),
        from: 'system',
        text: `User left the room`,
        ts: Date.now(),
        type: 'system',
      });
    });

    socket.on(SOCKET_EVENTS.GAME_STARTED, (data: any) => {
      setGameActive(true);
      useStore.getState().setCurrentGame(data);
      useStore.getState().addMessage({
        id: Date.now().toString(),
        from: 'system',
        text: `Game started! ${data.players.map((p: any) => p.nickname).join(' vs ')}`,
        ts: Date.now(),
        type: 'system',
      });
    });

    socket.on(SOCKET_EVENTS.ROUND_RESULT, (data: any) => {
      setGameActive(false);
      if (data.revealedConfession) {
        useStore.getState().addMessage({
          id: Date.now().toString(),
          from: 'system',
          text: `💔 ${data.revealedConfession.nickname}'s confession: "${data.revealedConfession.content}"`,
          ts: Date.now(),
          type: 'confession_reveal',
        });
      }
    });

    socket.on(SOCKET_EVENTS.ERROR_EVENT, (error: any) => {
      console.error('Socket error:', error);
      useStore.getState().addMessage({
        id: Date.now().toString(),
        from: 'system',
        text: `Error: ${error.message}`,
        ts: Date.now(),
        type: 'system',
      });
    });
  };

  const handleLeaveRoom = async () => {
    if (user && roomId) {
      const socket = getSocket();
      socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { userId: user.id, roomId });
      await api.leaveRoom(user.id);
      router.push('/rooms');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading room...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md rounded-t-3xl p-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">{currentRoom?.name}</h1>
            <p className="text-white/70">
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'} • {roomUsers.length} players
            </p>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg transition-colors"
          >
            Leave Room
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white/5 backdrop-blur-sm rounded-b-3xl p-4 flex gap-4 overflow-hidden">
          {/* Left Panel - Players & Confession */}
          <div className="w-80 flex flex-col gap-4">
            <PlayerList users={roomUsers} currentUserId={user?.id} />
            {!confession && <ConfessionBox userId={user?.id!} />}
          </div>

          {/* Center - Game Area */}
          <div className="flex-1 flex flex-col gap-4">
            <GameArea 
              roomId={roomId} 
              userId={user?.id!} 
              gameActive={gameActive}
              hasConfession={!!confession}
            />
          </div>

          {/* Right Panel - Chat */}
          <div className="w-80">
            <ChatBox roomId={roomId} userId={user?.id!} />
          </div>
        </div>
      </div>
    </main>
  );
}