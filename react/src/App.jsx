import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AuctionList from './pages/AuctionList';
import AuctionDetail from './pages/AuctionDetail';
import CreateAuction from './pages/CreateAuction';
import Toast from './components/Toast';
import { useAuctionWebSocket } from './hooks/useAuctionWebSocket';
import Chat from './pages/Chat';
import { subscribeUserToPush } from './utils/pushNotification';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { useLocation } from "react-router-dom";
import { useAuth } from './context/AuthContext'

function App() {
  const [role, setRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const { socket } = useAuctionWebSocket();
  const [toast, setToast] = useState(null);

  const [auctionEnabled, setAuctionEnabled] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);

  const { token, loading: authLoading } = useAuth();
  
  const location = useLocation();
  const isAuthPage = location.pathname.startsWith("/dashboard") || location.pathname === "/login";

  useEffect(() => {
    // cek user ID ke PHP
    fetch('/api/get_user_id.php')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user_id) {
            setRole(data.role);
            // cek izin dulu sebelum maksa subscribe
            if (Notification.permission === 'granted') {
                // kalau sudah diizinkan sebelumnya, baru kita refresh subscriptionnya
                subscribeUserToPush(data.user_id);
            } else if (Notification.permission === 'default') {
                // kalau statusnya 'default' (belum pernah ditanya), 
                // jgn tanya sekarang. biarin user klik tombol nanti.
                console.log("Menunggu user mengaktifkan notifikasi secara manual.");
            } else {
                console.log("User telah memblokir notifikasi.");
            }
        }
      })
      .catch(err => console.error("Gagal cek user:", err));
  }, []);
  useEffect(() => {
    // Cek role saat aplikasi dimuat
    fetch('/api/get_user_id.php')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRole(data.role);
          setCurrentUserId(data.user_id)
        }
      })
      .catch(err => console.error(err));
  }, []);
  
  useEffect(() => {
    if (socket) {
        socket.on('notification', (data) => {
            console.log("🔔 Notification received:", data);
            setToast({ message: data.message, type: data.type });
            const audio = new Audio('/public/uploads/ui/notif.mp3');
            audio.play().catch(e => console.log('Audio play failed', e));
        });
    }
    return () => {
        if (socket) socket.off('notification');
    };
  }, [socket]);

  useEffect(() => {
    const fetchFeature = async () => {
      try {
        console.log("TOKENTOKENTOKEN:");
        console.log(token);
        const res = await fetch(`/api/node/features/auction_enabled`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        console.log('Feature API response:', data);
        setAuctionEnabled(data.enabled);
      } catch (err) {
        console.error('Feature check failed', err);
        setAuctionEnabled(false);
      }
    };

    fetchFeature();
  }, [token]);

  useEffect(() => {
    const fetchFeature = async () => {
      try {
        const res = await fetch(`/api/node/features/chat_enabled`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        console.log('Feature API response:', data);
        setChatEnabled(data.enabled);
      } catch (err) {
        console.error('Feature check failed', err);
        setChatEnabled(false);
      }
    };

    fetchFeature();
  }, [token]);
  
  return (
    <>
      {isAuthPage ? (
        <div style={{ flex: 1, margin: 0, padding: 0, overflow: 'hidden' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </div>
      ) : (
        <div style={{ 
          margin: 0, 
          padding: 0, 
          width: '100%', 
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff'
        }}>
          {toast && (
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onClose={() => setToast(null)} 
            />
          )}
          <nav>
            <a href="http://localhost:8082/discovery.php">
              ← Home (PHP)
            </a>

            <div style={{ width: '1px', height: '20px', background: '#ccc' }}></div>

            {auctionEnabled &&
            <Link to="/auctions">
              🏛️ Daftar Lelang
            </Link>
            }
            {chatEnabled &&
            <Link to="/chat">
              💬 Chat
            </Link>
            }
            <button onClick={() => subscribeUserToPush(currentUserId)}>
              Aktifkan Notifikasi
            </button>
          </nav>

          <div style={{ flex: 1, margin: 0, padding: 0, overflow: 'hidden' }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/auctions" element={<AuctionList />} />
              <Route path="/auction/:id" element={<AuctionDetail />} />
              <Route path="/create-auction" element={
                  role === 'SELLER' ? <CreateAuction /> : <div>Akses Ditolak: Khusus Seller</div>
              } />
            </Routes>
          </div>
        </div>
        )}
      </>
  );
}

export default App;