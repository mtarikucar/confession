'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';

export default function HomePage() {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, setUser } = useStore();

  useEffect(() => {
    // If user already exists, redirect to rooms
    if (user) {
      router.push('/rooms');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (nickname.length < 3 || nickname.length > 20) {
      setError('Nickname must be between 3 and 20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      setError('Nickname can only contain letters, numbers, and underscores');
      return;
    }

    setLoading(true);

    try {
      // Create user via API
      const { user } = await api.createUser(nickname);
      
      // Store user in state
      setUser(user);
      
      // Navigate to rooms page
      router.push('/rooms');
    } catch (err: any) {
      setError(err.message || 'Failed to create user. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <h1 className="text-4xl font-bold text-white text-center mb-2">
          Confess & Play
        </h1>
        <p className="text-white/80 text-center mb-8">
          Enter your nickname to start playing
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Choose a nickname"
              className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              maxLength={20}
            />
            {error && (
              <p className="text-red-300 text-sm mt-2">{error}</p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            {loading ? 'Creating...' : 'Enter Game'}
          </button>
        </form>
      </div>
    </main>
  );
}