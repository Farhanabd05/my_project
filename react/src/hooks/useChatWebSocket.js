import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
export function useChatWebSocket() {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Cek di awal: Kalau tidak ada token, jangan lakukan apa-apa!
    if (!token) {
        // Jika user logout, pastikan socket diputus (cleanup)
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setAuthenticated(false);
            setSocket(null);
        }
        return; 
    }
    let isMounted = true;

    const connect = async () => {
      try {
        // 1. Minta Tiket ke PHP (Wajib pakai credentials agar session terbaca)
        const res = await fetch('/api/generate_ws_ticket.php', {
            credentials: 'include' 
        });
        
        if (!res.ok) throw new Error('Gagal mendapatkan tiket akses');
        const { ticket } = await res.json();

        if (!isMounted) return;

        // 2. Konek ke Namespace Chat
        // Ganti URL ini dengan http://localhost:8082/chat jika lewat Nginx
        // Atau http://localhost:3001/chat jika direct (Dev Mode)
        // Kita pakai port 8082 agar aman (lewat Nginx)
        const newSocket = io('http://localhost:8082/chat', {
          transports: ['websocket', 'polling'],
          path: '/socket.io/',
          reconnectionAttempts: 5
        });

        socketRef.current = newSocket;

        // 3. Handshake Autentikasi
        newSocket.on('connect', () => {
          console.log('🔌 Terhubung ke Socket Chat, mengirim tiket...');
          newSocket.emit('authenticate', { ticket });
        });

        // 4. Server Menerima Tiket
        newSocket.on('authenticated', () => {
          console.log('✅ Chat Terautentikasi!');
          if (isMounted) {
            setAuthenticated(true);
            setSocket(newSocket);
          }
        });

        // 5. Server Menolak Tiket
        newSocket.on('auth-error', (err) => {
          console.error('⛔ Auth Error:', err.message);
          setAuthenticated(false);
        });

        newSocket.on('disconnect', () => {
          console.log('🔌 Chat Terputus');
          setAuthenticated(false);
        });

      } catch (err) {
        console.error('Setup Chat Error:', err);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [token]);

  return { socket, authenticated };
}