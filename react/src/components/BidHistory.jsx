// react/src/components/BidHistory.jsx
import { useState, useEffect } from 'react';

function BidHistory({ auctionId, socket, currentUserId }) {
  const [bids, setBids] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  // Fetch initial bids
  useEffect(() => {
    if (!auctionId) return;

    fetchBids(0);
  }, [auctionId]);

  const fetchBids = async (newOffset) => {
    try {
      const res = await fetch(
        `/api/node/auctions/${auctionId}/bids?limit=${LIMIT}&offset=${newOffset}`
      );
      const data = await res.json();

      if (data.success) {
        if (newOffset === 0) {
          setBids(data.bids);
        } else {
          setBids(prev => [...prev, ...data.bids]);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
        setOffset(newOffset);
      }
    } catch (error) {
      console.error('Failed to fetch bids:', error);
    }
  };

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleNewBid = (data) => {
      if (data.auctionId == auctionId) {
        // Add new bid to top of list
        const newBid = {
          id: Date.now(), // Temporary ID
          bidder_id: data.bidderId,
          bid_amount: data.bidAmount,
          bid_time: data.timestamp,
          name: 'New Bidder' // Will be updated on refresh
        };
        
        setBids(prev => [newBid, ...prev.slice(0, LIMIT - 1)]);
        setTotal(prev => prev + 1);
      }
    };

    socket.on('bid-placed', handleNewBid);

    return () => {
      socket.off('bid-placed', handleNewBid);
    };
  }, [socket, auctionId]);

  const handleLoadMore = () => {
    fetchBids(offset + LIMIT);
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const bidTime = new Date(timestamp);
    const diffMs = now - bidTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    return bidTime.toLocaleDateString();
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>Bid History ({total} total bids)</h3>
      
      {bids.length === 0 ? (
        <p>No bids yet.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Bidder</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid, index) => {
                const isCurrentUser = bid.bidder_id === currentUserId;
                return (
                  <tr 
                    key={bid.id}
                    style={{ 
                      backgroundColor: isCurrentUser ? '#e3f2fd' : 'transparent',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <td style={{ padding: '10px' }}>
                      {isCurrentUser ? <strong>Anda</strong> : `User ${bid.bidder_id}`}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      Rp {bid.bid_amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#666' }}>
                      {formatTimeAgo(bid.bid_time)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {hasMore && (
            <button 
              onClick={handleLoadMore}
              style={{ marginTop: '10px', padding: '8px 16px' }}
            >
              Load More
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default BidHistory;