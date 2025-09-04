import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import Landing from './components/Landing';
import Room from './components/Room';
import './App.css';

function AppContent() {
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Reconnection state management
  const [isReconnecting, setIsReconnecting] = useState(true); // Start with true to check for saved session
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Try to reconnect with saved session on app load
  useEffect(() => {
    const attemptReconnect = async () => {
      const tabId = localStorage.getItem('tab_id');
      
      if (!tabId) {
        // No saved session, not a reconnection attempt
        setIsReconnecting(false);
        setInitialCheckDone(true);
        return;
      }
      
      const savedSession = localStorage.getItem(`confession_game_session_${tabId}`);
      if (!savedSession) {
        // No saved session data
        setIsReconnecting(false);
        setInitialCheckDone(true);
        return;
      }
      
      try {
        const session = JSON.parse(savedSession);
        
        if (!session.token || session.token === 'undefined') {
          // Invalid token, clear session
          localStorage.removeItem(`confession_game_session_${tabId}`);
          localStorage.removeItem(`confession_game_session_${tabId}_room`);
          localStorage.removeItem(`confession_game_session_${tabId}_game`);
          setIsReconnecting(false);
          setInitialCheckDone(true);
          return;
        }
        
        // Valid session found, attempt reconnection
        console.log('[App] Attempting reconnection with saved session');
        
        try {
          // reconnectWithToken returns a promise that resolves when authenticated
          await socket.reconnectWithToken();
          
          console.log('[App] Reconnection successful');
          // If we have a room code and we're not already there, navigate
          if (session.roomCode && !location.pathname.includes(`/room/${session.roomCode}`)) {
            navigate(`/room/${session.roomCode}`);
          }
          setIsReconnecting(false);
          setReconnectFailed(false);
        } catch (error) {
          console.error('[App] Reconnection error:', error);
          setReconnectFailed(true);
          setIsReconnecting(false);
        }
      } catch (error) {
        console.error('[App] Failed to parse saved session:', error);
        // Clear corrupted session
        localStorage.removeItem(`confession_game_session_${tabId}`);
        localStorage.removeItem(`confession_game_session_${tabId}_room`);
        localStorage.removeItem(`confession_game_session_${tabId}_game`);
        setIsReconnecting(false);
      }
      
      setInitialCheckDone(true);
    };
    
    attemptReconnect();
  }, []); // Only run once on mount

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Landing socket={socket} />} />
        <Route path="/room/:roomCode" element={
          <Room 
            socket={socket} 
            isReconnecting={isReconnecting}
            reconnectFailed={reconnectFailed}
            initialCheckDone={initialCheckDone}
          />
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;