import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket';
import AuctionCard from '../components/AuctionCard';
import { useAuth } from '../context/AuthContext';
import FeatureNotFound from './FeatureNotFound';

function AuctionList() {
  const navigate = useNavigate();
  // Ambil token & status loading dari Global Context
  const { token, loading: authLoading, redirectToLogin } = useAuth();
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'scheduled'
  const [auctions, setAuctions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [serverOffset, setServerOffset] = useState(0);
  const { socket, authenticated } = useAuctionWebSocket();
  const [dataLoading, setDataLoading] = useState(false);
  const LIMIT = 10;

  // Debounce search
  const [searchDebounce, setSearchDebounce] = useState('');

  useEffect(() => {
	  const timer = setTimeout(() => {
      setSearchDebounce(search);
      setPage(1); // Reset to page 1 on search
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [search]);
  // ambil waktu server untuk sinkronisasi timer
  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const res = await fetch('/api/node/server-time');
        const data = await res.json();
        if (data.serverTime) {
          // hitung selisih waktu server dan waktu lokal user
          setServerOffset(data.serverTime - Date.now());
        }
      } catch (e) {
        console.error("Gagal sinkronisasi waktu server:", e);
      }
    };
    fetchServerTime();
  }, []);

  useEffect(() => {
    if (!authLoading && !token) {
        redirectToLogin();
    }
  }, [authLoading, token, redirectToLogin]);
  
  const fetchAuctions = useCallback(async (isBackground = false) => {
    // console.log('🔍 fetchAuctions dipanggil. Token:', token ? 'Ada' : 'Tidak ada');
    if (!token) return;
    if (!isBackground) setDataLoading(true);
    try {
      const params = new URLSearchParams({
        page: page,
        limit: LIMIT,
        search: searchDebounce
      });

      if (activeTab === 'participated') {
          params.append('filterType', 'participated');
      } else {
          params.append('status', activeTab);
      }

      const res = await fetch(`/api/node/auctions?${params}`, {
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      // console.log('📡 Response status:', res.status); 
      if (res.status === 401) {
          redirectToLogin();
          return;
      }

      const data = await res.json();
      // console.log('📦 Data dari backend:', data); 
      if (data.success) {
        setAuctions(data.data);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch auctions:', error);
    } finally {
        if (!isBackground) setDataLoading(false);
    }
  }, [activeTab, page, searchDebounce, redirectToLogin, token]);
  // PENGGANTI (Gabungan Logic WebSocket)
  useEffect(() => {
    // Pastikan socket & auth siap
    if (!socket || !authenticated) return;

    // 1. Join Room
    socket.emit('join-auction-list');

    // 2. Handler Update Data (Harga/Bidder naik)
    const handleAuctionUpdate = (data) => {
      setAuctions(prevAuctions => 
        prevAuctions.map(auction => {
          if (String(auction.id) === String(data.auctionId)) {
            return {
              ...auction,
              // Update data parsial dengan aman
              current_price: data.current_price ?? auction.current_price,
              bidder_count: data.bidder_count ?? auction.bidder_count,
              last_bid_time: data.last_bid_time ?? auction.last_bid_time,
              status: data.status || auction.status,
              end_time: data.end_time || auction.end_time,
              start_time: data.start_time || auction.start_time
            };
          }
          return auction;
        })
      );
    };

    // 3. Handler Refresh List (Kalau ada lelang baru/selesai)
    const handleRefresh = () => fetchAuctions(true);

    // 4. Pasang Event Listener
    socket.on('auction-updated', handleAuctionUpdate);
    socket.on('refresh-list', handleRefresh);
    socket.on('auction-started', handleRefresh); 
    socket.on('auction-ended', handleRefresh);   

    // 5. Cleanup (Bersih-bersih saat keluar halaman)
    return () => {
      socket.off('auction-updated', handleAuctionUpdate);
      socket.off('refresh-list', handleRefresh);
      socket.off('auction-started', handleRefresh);
      socket.off('auction-ended', handleRefresh);
      socket.emit('leave-auction-list');
    };
  }, [socket, authenticated, fetchAuctions]);
  
  useEffect(() => {
      if (token) {
          fetchAuctions();
      }
  }, [fetchAuctions, token]);
  
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

// Switch tab
  const handleTabChange = (tab) => {
	  setActiveTab(tab);
	  setPage(1);
	};
  if (authLoading) return <p>Memeriksa sesi login...</p>;
  if (!token) return null;
  
  if (!featureEnabled) {
    return <FeatureNotFound reason={reason}/>;
  }
  return (
    <div style={{ padding: '20px' }}>
      <h1>Auction List</h1>

      {/* Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => handleTabChange('active')}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: activeTab === 'active' ? '#1976d2' : '#e0e0e0',
            color: activeTab === 'active' ? 'white' : 'black',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Lelang Aktif
        </button>
        <button 
          onClick={() => handleTabChange('scheduled')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'scheduled' ? '#1976d2' : '#e0e0e0',
            color: activeTab === 'scheduled' ? 'white' : 'black',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Lelang Akan Datang
        </button>
        <button 
          onClick={() => handleTabChange('participated')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'participated' ? '#1976d2' : '#e0e0e0',
            color: activeTab === 'participated' ? 'white' : 'black',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          History Lelang
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text"
          placeholder="Search by product name or store..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '10px',
            width: '300px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>

      {/* Loading */}
      {dataLoading && <p>Loading...</p>}

      {/* Auction Cards */}
      {!dataLoading && auctions.length === 0 && (
        <p>No auctions found.</p>
      )}

	  <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {auctions.map(auction => (
          <AuctionCard 
            key={auction.id} 
            auction={auction} 
            onClick={() => navigate(`/auction/${auction.id}`)}
            onTimerEnd={() => fetchAuctions(true)} 
            serverOffset={serverOffset} // server offset dari app
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '8px 16px' }}
          >
            Previous
          </button>
          <span style={{ padding: '8px 16px' }}>
            Page {page} of {totalPages}
          </span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '8px 16px' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default AuctionList;