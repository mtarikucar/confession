'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { SOCKET_EVENTS } from '@confess-and-play/shared';

interface ConfessionBoxProps {
  userId: string;
}

export default function ConfessionBox({ userId }: ConfessionBoxProps) {
  const { setConfession } = useStore();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submitConfession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (content.length < 10) {
      setError('Confession must be at least 10 characters');
      return;
    }

    if (content.length > 500) {
      setError('Confession must be less than 500 characters');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Submit via API
      const { confession } = await api.createConfession(userId, content);
      
      // Also emit via socket
      const socket = getSocket();
      socket.emit(SOCKET_EVENTS.SEND_CONFESSION, {
        userId,
        content,
      });

      setConfession(confession);
      
      // Show success message
      useStore.getState().addMessage({
        id: Date.now().toString(),
        from: 'system',
        text: '✅ Your confession has been submitted. It will be revealed if you lose!',
        ts: Date.now(),
        type: 'system',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to submit confession');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
      <h3 className="text-white font-semibold mb-3">Your Confession</h3>
      <p className="text-white/70 text-sm mb-3">
        Write a confession that will be revealed if you lose the game!
      </p>

      <form onSubmit={submitConfession}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your secret... (10-500 characters)"
          className="w-full h-32 px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
          maxLength={500}
          disabled={submitting}
        />
        
        <div className="flex justify-between items-center mt-2">
          <span className="text-white/60 text-sm">
            {content.length}/500
          </span>
          <button
            type="submit"
            disabled={submitting || content.length < 10}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Confession'}
          </button>
        </div>

        {error && (
          <div className="mt-2 text-red-400 text-sm">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}