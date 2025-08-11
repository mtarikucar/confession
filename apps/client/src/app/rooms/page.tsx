'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { Room } from '@confess-and-play/shared';

export default function RoomsPage() {
  const router = useRouter();
  const { user, setCurrentRoom } = useStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    
    loadRooms();
    // Refresh rooms every 5 seconds
    const interval = setInterval(loadRooms, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const loadRooms = async () => {
    try {
      const { rooms } = await api.getRooms();
      setRooms(rooms);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      setError('Room name is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const { room } = await api.createRoom(newRoomName);
      await joinRoom(room);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async (room: Room) => {
    if (!user) return;

    try {
      await api.joinRoom(user.id, room.id);
      setCurrentRoom(room);
      router.push(`/room/${room.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading rooms...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Game Rooms</h1>
              <p className="text-white/70 mt-2">Welcome, {user?.nickname}!</p>
            </div>
            <button
              onClick={() => {
                useStore.getState().reset();
                router.push('/');
              }}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg transition-colors"
            >
              Leave Game
            </button>
          </div>

          <div className="flex gap-4 mb-6">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter room name..."
              className="flex-1 px-4 py-3 bg-white/20 backdrop-blur-sm rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              maxLength={50}
            />
            <button
              onClick={createRoom}
              disabled={creating}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Room'}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.length === 0 ? (
            <div className="col-span-full bg-white/10 backdrop-blur-md rounded-xl p-8 text-center">
              <p className="text-white/70">No rooms available. Create one to start playing!</p>
            </div>
          ) : (
            rooms.map((room: any) => (
              <div
                key={room.id}
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 hover:bg-white/20 transition-all duration-200 cursor-pointer"
                onClick={() => joinRoom(room)}
              >
                <h3 className="text-xl font-semibold text-white mb-2">{room.name}</h3>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">
                    {room._count?.users || 0} players
                  </span>
                  <button className="px-4 py-2 bg-blue-500/30 hover:bg-blue-500/40 text-white rounded-lg transition-colors">
                    Join
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}