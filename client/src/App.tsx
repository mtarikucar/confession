import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import Landing from './components/Landing';
import Room from './components/Room';
import './App.css';

function App() {
  const socket = useSocket();

  // Try to reconnect with saved session on app load
  useEffect(() => {
    const attemptReconnect = async () => {
      const savedSession = localStorage.getItem('confession_game_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.token) {
            await socket.reconnectWithToken();
          }
        } catch (error) {
          console.log('Could not reconnect with saved session');
        }
      }
    };
    
    attemptReconnect();
  }, [socket.reconnectWithToken]);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Landing socket={socket} />} />
          <Route path="/room/:roomCode" element={<Room socket={socket} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;