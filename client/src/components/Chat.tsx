import { useState, useEffect, useRef } from 'react';
import './Chat.css';

interface ChatProps {
  socket: any;
}

function Chat({ socket }: ChatProps) {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Extract room from socket
  const { room } = socket;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [room?.chatHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    try {
      await socket.sendMessage(message);
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className={`chat ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="chat-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>Chat</h3>
        <span className="toggle-icon">{isExpanded ? '▼' : '▲'}</span>
      </div>
      
      {isExpanded && (
        <>
          <div className="chat-messages">
            {room?.chatHistory.map((msg: any) => (
              <div 
                key={msg.id} 
                className={`message ${msg.type === 'confession' ? 'confession-reveal' : ''} ${msg.isSystem ? 'system' : ''}`}
              >
                {!msg.isSystem && (
                  <span className="message-author">{msg.nickname}:</span>
                )}
                <span className="message-text">{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSendMessage} className="chat-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
            />
            <button type="submit">Send</button>
          </form>
        </>
      )}
    </div>
  );
}

export default Chat;