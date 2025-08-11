'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@confess-and-play/shared';

interface ChatBoxProps {
  roomId: string;
  userId: string;
}

export default function ChatBox({ roomId, userId }: ChatBoxProps) {
  const { messages, addMessage } = useStore();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socket = getSocket();

  useEffect(() => {
    // Listen for chat messages
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE_RESPONSE, (data: any) => {
      addMessage({
        id: Date.now().toString(),
        from: data.message.from,
        nickname: data.message.nickname,
        text: data.message.text,
        ts: data.message.ts,
        type: data.message.type,
      });
    });

    return () => {
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE_RESPONSE);
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
      roomId,
      userId,
      text: message.trim(),
    });

    setMessage('');
  };

  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'system':
        return 'bg-gray-700/50 text-gray-300 italic text-center';
      case 'confession_reveal':
        return 'bg-red-900/50 text-red-200 border-l-4 border-red-500 font-semibold';
      default:
        return 'bg-white/10 text-white';
    }
  };

  return (
    <div className="h-full bg-white/10 backdrop-blur-md rounded-xl flex flex-col">
      <div className="p-4 border-b border-white/20">
        <h3 className="text-white font-semibold">Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg ${getMessageStyle(msg.type)} break-words`}
          >
            {msg.type === 'user' && (
              <div className="font-semibold text-sm mb-1 text-blue-300">
                {msg.nickname || 'Anonymous'}
              </div>
            )}
            <div className="text-sm">{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-white/20">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
            maxLength={200}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500/50 hover:bg-blue-500/70 text-white rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}