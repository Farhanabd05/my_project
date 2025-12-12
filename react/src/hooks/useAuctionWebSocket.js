import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
export function useAuctionWebSocket() {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Cek di awal: Kalau tidak ada token, jangan lakukan apa-apa
    if (!token) {
        // Jika user logout socket diputus (cleanup)
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setAuthenticated(false);
            setSocket(null);
        }
        return; 
    }
    const connectWebSocket = async () => {
      try {
        // Get ticket from PHP
        const ticketResponse = await fetch('/api/generate_ws_ticket.php', {
          credentials: 'include' // Important for cookies!
        });
        
        if (!ticketResponse.ok) {
          throw new Error('Failed to get WebSocket ticket');
        }

        const { ticket } = await ticketResponse.json();
        
        // Connect to WebSocket
        const newSocket = io('http://localhost:8082/auction', {
          transports: ['websocket', 'polling']
        });

        socketRef.current = newSocket;

        // Authenticate
        newSocket.emit('authenticate', { ticket });

        // Handle auth response
        newSocket.on('authenticated', (data) => {
          console.log('Authenticated:', data);
          setAuthenticated(true);
          setSocket(newSocket);
        });

        newSocket.on('auth-error', (data) => {
          console.error('Auth error:', data);
          setError(data.message);
        });

      } catch (err) {
        console.error('WebSocket connection error:', err);
        setError(err.message);
      }
    };

    connectWebSocket();

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token]);

  return { socket, authenticated, error };
}