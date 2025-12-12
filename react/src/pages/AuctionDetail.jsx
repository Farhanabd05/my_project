import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket';
import BidHistory from '../components/BidHistory';
import { useAuth } from '../context/AuthContext';
import FeatureNotFound from './FeatureNotFound';

function AuctionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();
  const [auction, setAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [message, setMessage] = useState('');
  const [userBalance, setUserBalance] = useState(null);
  // Countdown states
  const [timeLeft, setTimeLeft] = useState(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [auctionEnded, setAuctionEnded] = useState(false);
  
  const { socket, authenticated } = useAuctionWebSocket();
  const timerRef = useRef(null);
  const minIncrementRef = useRef(5000); // (Default 5000 jaga-jaga)
  const [loading, setLoading] = useState(true);
  
  // 1. Buat Ref untuk menyimpan nilai terbaru bidAmount
  const bidAmountRef = useRef(bidAmount);

  // 2. Sinkronisasi: Update Ref setiap kali State berubah
  useEffect(() => {
    bidAmountRef.current = bidAmount;
  }, [bidAmount]);

  const handleCancelAuction = async () => {
    if (!window.confirm("Apakah Anda yakin? Jika ada penawar, uang mereka akan dikembalikan.")) return;

    try {
      const res = await fetch(`/api/node/auctions/${id}/cancel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user?.id })
      });

      const data = await res.json();

      if (data.success) {
        alert("Lelang berhasil dibatalkan.");
        navigate('/auctions');
      } else {
        alert(data.message || "Gagal membatalkan lelang.");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan koneksi.");
    }
  };

  // === FUNGSI UNTUK MULAI CHAT ===
  const handleStartChat = async () => {
    if (!user?.id || !auction) return;

    // Cek apakah user adalah seller sendiri
    if (String(user.id) === String(auction.seller_id)) {
      alert("Anda tidak bisa chat dengan diri sendiri!");
      return;
    }

    try {
      // Panggil API Node.js untuk buat/get room
      const res = await fetch('/api/node/chats/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: user.id,
          storeId: auction.store_id // Pastikan endpoint detail lelang mengembalikan ini
        })
      });

      const data = await res.json();
      
      if (data.success) {
        // Redirect ke halaman Chat dengan membawa state roomId
        navigate('/chat', { state: { activeRoomId: data.roomId } });
      } else {
        alert('Gagal memulai chat: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to chat server');
    }
  };

  const fetchUserBalance = useCallback(async () => {
    try {
      const balanceRes = await fetch('/api/get_user_balance.php');
      const balanceData = await balanceRes.json();
      if (balanceData.success) {
        setUserBalance(balanceData.balance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }, []); 

  // 1. FETCH AUCTION DATA & SERVER TIME
  const fetchAuctionData = useCallback(async () => {
    try {
      // Jangan fetch jika token belum ada!
      if (!token) return;
      const auctionRes = await fetch(`/api/node/auctions/${id}`, {
        headers: {
          'Authorization' : `Bearer ${token}`
        }
      });
      if (auctionRes.status === 401){
          console.error("Token expired or missing");
          // Redirect ke login jika 401
          window.location.href = 'http://localhost:8082/login.php';
          return;
      }
      const auctionData = await auctionRes.json();
      
      if (auctionData.success) {
        setAuction(auctionData.data);
        
        // Ambil min_increment dari DB, atau fallback ke 5000
        const minInc = parseFloat(auctionData.data.min_increment);
        minIncrementRef.current = minInc; // Simpan ke ref agar websocket bisa baca

        // Update bid amount default jika belum diisi user
        if (!bidAmountRef.current) {
            setBidAmount(parseInt(auctionData.data.current_price) + minInc);
        }

        // Cek jika status sudah ended dari server
        if (auctionData.data.status === 'ended' || auctionData.data.status === 'canceled') {
            setAuctionEnded(true);
            setTimeLeft(0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch auction data:', error);
    }
  }, [id, token]);
  useEffect(() => {
    // Tunggu sampai auth selesai loading
    if (authLoading) return;
    const init = async () => {
      // Jika setelah loading selesai token tetap tidak ada, baru redirect
      if (!token) {
         window.location.href = 'http://localhost:8082/login.php';
         return;
      }
      setLoading(true);
      await fetchAuctionData(); // Panggil fungsi di atas
      
      // Ambil waktu server (tetap sama)
      try {
        const timeRes = await fetch('/api/node/server-time');
        const timeData = await timeRes.json();
        setServerOffset(timeData.serverTime - Date.now());
      } catch (e) { console.error("Time sync failed", e); }

      fetchUserBalance();
      setLoading(false);
    };

    init();
  }, [id, fetchAuctionData, fetchUserBalance, authLoading, token]);
  // Listen for balance updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    socket.on('bid-success', (data) => {
      setMessage('Your bid was placed successfully!');
      if (data.newBalance !== undefined) {
        setUserBalance(data.newBalance);
      }
    });

    return () => socket.off('bid-success');
  }, [socket]);

  // 2. COUNTDOWN TIMER LOGIC
  useEffect(() => {
    if (!auction) return;

    const updateCountdown = () => {
      const now = Date.now() + serverOffset;
      let targetTime;

      // [LOGIKA BARU]: Tentukan target waktu berdasarkan status
      if (auction.status === 'scheduled') {
         targetTime = new Date(auction.start_time).getTime();
      } else if (auction.status === 'active') {
         // Logika perpanjangan waktu jika ada bid (tetap dipertahankan)
         if (parseInt(auction.bidder_count) > 0 && auction.last_bid_time) {
            const lastBidMillis = new Date(auction.last_bid_time).getTime();
            targetTime = lastBidMillis + 15000;
         } else {
            targetTime = new Date(auction.end_time).getTime();
         }
      } else {
         setTimeLeft(0);
         return;
      }
      const remaining = targetTime - now;

      // [AUTO REFRESH]: Jika waktu habis
      if (remaining <= 0) {
        setTimeLeft(0);
        
        // Jika status sebelumnya scheduled -> Refresh agar jadi active
        if (auction.status === 'scheduled') {
            fetchAuctionData(); 
        }
        // Jika status active -> Refresh agar jadi ended
        else if (auction.status === 'active' && !auctionEnded) {
            fetchAuctionData();
        }
        return;
      }

      setTimeLeft(remaining);
      timerRef.current = setTimeout(updateCountdown, 1000);
    };

    updateCountdown();

    return () => clearTimeout(timerRef.current);
  }, [auction, serverOffset, fetchAuctionData, auctionEnded]);

  // 3. HANDLE PAGE VISIBILITY
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && auction) {
        const now = Date.now() + serverOffset;
        const endTime = new Date(auction.end_time).getTime();
        const remaining = endTime - now;

        if (remaining <= 0) {
          setTimeLeft(0);
          setAuctionEnded(true);
          setMessage('Auction has ended!');
        } else {
          setTimeLeft(remaining);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [auction, serverOffset]);

  // 4. FORMAT TIME HELPER
  const formatTime = (milliseconds) => {
    if (milliseconds === null || milliseconds <= 0) return '00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 5. WEBSOCKET SETUP
  useEffect(() => {
    if (socket && authenticated && id) {
      socket.emit('join-auction', id);

      socket.on('bid-placed', (data) => {
        if (data.auctionId == id) {
          setAuction(prev => ({
            ...prev,
            current_price: data.bidAmount,
            bidder_count: parseInt(prev?.bidder_count || 0) + 1,
            winner_id: data.bidderId,
            last_bid_time: data.timestamp
          }));
          setMessage(`New bid: Rp ${data.bidAmount}`);
          setBidAmount(parseInt(data.bidAmount) + minIncrementRef.current);
          
          fetchUserBalance();
        }
      });

      socket.on('bid-success', () => {
        setMessage('Your bid was placed successfully!');
      });

      socket.on('bid-error', (data) => {
        setMessage(`Error: ${data.message}`);
      });
      
      socket.on('auction-started', () => {
          console.log("🔔 Socket: Auction Started");
          fetchAuctionData(); // Auto refresh data
      });

      socket.on('auction-ended', (data) => {
        setAuctionEnded(true);
        setTimeLeft(0);
        
        setAuction(prev => ({
            ...prev,
            status: 'ended',        
            winner_id: data.winnerId
        }));

        setMessage(`Auction ended! Winner: User ${data.winnerId}`);
      });

    }

    return () => {
      if (socket) {
        socket.off('bid-placed');
        socket.off('bid-success');
        socket.off('bid-error');
        socket.off('auction-ended');
      }
    };
  }, [socket, authenticated, id, fetchAuctionData, fetchUserBalance]);

  useEffect(() => {
     if(socket) {
         socket.on('auction-canceled', () => {
             alert("Lelang ini baru saja dibatalkan oleh penjual.");
             navigate('/auctions');
         });
         return () => socket.off('auction-canceled');
     }
  }, [socket, navigate]);

  // 6. BID HANDLER
  const handlePlaceBid = () => {
    if (!socket || !authenticated) {
      setMessage('Not connected to WebSocket');
      return;
    }

    if (auctionEnded) {
      setMessage('Auction has ended, cannot place bid');
      return;
    }

    socket.emit('place-bid', {
      auctionId: parseInt(id),
      bidAmount: parseInt(bidAmount)
    });
  };

  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [reason, setReason] = useState('');
  useEffect(() => {
    const fetchFeature = async () => {
      try {
        const res = await fetch(`/api/node/features/auction_enabled`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setFeatureEnabled(data.enabled);
        setReason(data.reason || '');
      } catch (err) {
        console.error('Feature check failed', err);
        setFeatureEnabled(false);
        setReason('Feature check failed');
      }
    };

    fetchFeature();
  }, [token]);
  
  if (!featureEnabled) {
    return <FeatureNotFound reason={reason}/>;
  }

  // 7. RENDER
  if (!auction) return <div>Loading...</div>;
  
  const isSeller = user && String(user.id) === String(auction.seller_id);


  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Auction Detail</h1>
      
      {/* FOTO PRODUK */}
      <img 
        src={`/uploads/products/${auction.main_image_path ? auction.main_image_path.split('/').pop() : ''}`} 
        alt={auction.product_name}
        style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px', marginBottom: '20px' }}
        onError={(e) => { e.target.src = '/public/uploads/ui/placeholder.png'; }}
      />

      {/* INFO PRODUK */}
      <h2>{auction.product_name}</h2>
      <p style={{ color: '#666' }}>{auction.description}</p>
      <p>Dijual oleh: <strong>{auction.seller_name} (user {auction.seller_id})</strong></p>
      
      {/* === TOMBOL CHAT PENJUAL === */}
      {!isSeller && (
        <div style={{ marginTop: '10px', marginBottom: '20px' }}>
          <button 
            onClick={handleStartChat}
            style={{
              padding: '8px 16px',
              backgroundColor: '#25D366',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            💬 Chat Penjual
          </button>
        </div>
      )}
      
      {/* INFO STATUS */}
      <div style={{ margin: '20px 0', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
          <p>Current Price: <strong>Rp {parseInt(auction.current_price).toLocaleString()}</strong></p>
          <p>Total Bidders: {auction.bidder_count}</p>
          <p>Quantity Items: {auction.quantity}</p>
          <p>Your Balance: <strong>Rp {userBalance !== null ? parseInt(userBalance).toLocaleString() : 'Loading...'}</strong></p>
          <p>Status: {authenticated ? '🟢 Live' : '🔴 Connecting...'}</p>

          {/* COUNTDOWN TIMER */}
          <p style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            color: timeLeft !== null && timeLeft < 60000 ? 'red' : 'black',
            marginTop: '10px'
          }}>
           {auction.status === 'scheduled' ? 'Starts in: ' : 'Time Left: '} 
            {formatTime(timeLeft)}
          </p>
      </div>
      
      <hr />

      {/* LOGIKA UTAMA: SELLER vs BUYER */}
      {isSeller ? (
        <div style={{ padding: '20px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '8px', color: '#856404', marginBottom: '20px' }}>
            <h3>👑 Sudut Penjual</h3>
            <p>Ini adalah lelang Anda sendiri.</p>
            
            {(auction.status === 'active' || auction.status === 'scheduled') && (
                <div style={{ marginTop: '15px' }}>
                    <button 
                        onClick={handleCancelAuction}
                        style={{ 
                            padding: '10px 20px', 
                            backgroundColor: '#dc3545', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🚫 Batalkan Lelang
                    </button>
                    <p style={{ fontSize: '12px', marginTop: '5px' }}>
                        *Tindakan ini tidak dapat dibatalkan. Uang penawar tertinggi (jika ada) akan dikembalikan otomatis.
                    </p>
                </div>
            )}
            
            {auction.status === 'canceled' && (
                <p style={{ color: 'red', fontWeight: 'bold' }}>Lelang ini telah dibatalkan.</p>
            )}
        </div>
        ) : (
        <div style={{ marginBottom: '20px' }}>
            {!auctionEnded && auction.status === 'active' && (() => {
                // 1. Hitung Requirement
                const minInc = parseFloat(auction.min_increment) || 5000;
                const currentPrice = parseInt(auction.current_price) || 0;
                const minBid = currentPrice + minInc;
                const userBal = userBalance !== null ? parseInt(userBalance) : 0;
                const numericBid = parseInt(bidAmount) || 0;

                // 2. Logika Validasi Real-time
                let errorText = '';
                if (!bidAmount) errorText = 'Masukkan jumlah bid';
                else if (numericBid < minBid) errorText = `Minimal bid Rp ${minBid.toLocaleString()}`;
                else if (numericBid > userBal) errorText = 'Saldo tidak mencukupi';

                const isInputValid = !errorText;

                return (
                    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <h3>Place Your Bid</h3>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input 
                                    type="number" 
                                    value={bidAmount}
                                    onChange={(e) => setBidAmount(e.target.value)}
                                    placeholder={`Min: ${minBid}`}
                                    style={{ 
                                        flex: 1, 
                                        padding: '10px', 
                                        border: errorText && bidAmount ? '1px solid red' : '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '16px'
                                    }}
                                />
                                <button 
                                    onClick={handlePlaceBid}
                                    disabled={!isInputValid} // DISABLED JIKA INVALID
                                    style={{ 
                                        padding: '10px 20px', 
                                        backgroundColor: isInputValid ? '#007bff' : '#cccccc', // Abu-abu jika disabled
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        cursor: isInputValid ? 'pointer' : 'not-allowed',
                                        fontWeight: 'bold',
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    Place Bid
                                </button>
                            </div>

                            {/* Info Minimal Bid & Error Message */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <small style={{ color: '#666' }}>
                                    Minimal bid berikutnya: <strong>Rp {minBid.toLocaleString()}</strong>
                                </small>
                                
                                {/* Tampilkan Error Merah jika ada input tapi salah */}
                                {bidAmount && errorText && (
                                    <small style={{ color: 'red', fontWeight: 'bold' }}>
                                        ⚠️ {errorText}
                                    </small>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {(auctionEnded || auction.status === 'ended') && (
                <div style={{ padding: '20px', borderRadius: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
                    {user && String(user.id) === String(auction.winner_id) ? (
                        <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '20px', borderRadius: '8px' }}>
                            <h2 style={{ fontSize: '30px', margin: '10px 0' }}>🎉 SELAMAT! 🎉</h2>
                            <p>Anda memenangkan lelang ini!</p>
                            <p>Pesanan telah dibuat otomatis.</p>
                            <button 
                                onClick={() => window.location.href = 'http://localhost:8082/order_history.php'}
                                style={{ marginTop: '10px', padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
                            >
                                📦 Lihat Pesanan Saya
                            </button>
                        </div>
                    ) : (
                        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '15px', borderRadius: '8px' }}>
                            <h3>🏁 Lelang Berakhir</h3>
                            <p>Sayang sekali, lelang ini sudah ditutup.</p>
                            <p>Pemenang: User #{auction.winner_id || '-'}</p>
                        </div>
                    )}
                </div>
            )}

            {auction.status === 'canceled' && (
                <div style={{ padding: '20px', backgroundColor: '#e2e3e5', color: '#383d41', borderRadius: '8px', textAlign: 'center' }}>
                    <h3>🚫 Dibatalkan</h3>
                    <p>Lelang ini telah dibatalkan oleh penjual.</p>
                </div>
            )}
        </div>
      )}
      
      {/* FEEDBACK MESSAGE */}
      {message && (
          <div style={{ padding: '10px', backgroundColor: '#e2e3e5', borderRadius: '4px', marginBottom: '20px' }}>
            <strong>Info:</strong> {message}
          </div>
      )}

      {/* HISTORI BID */}
      <BidHistory 
        auctionId={id} 
        socket={socket} 
        currentUserId={user?.id}
      />
    </div>
  );
}

export default AuctionDetail;