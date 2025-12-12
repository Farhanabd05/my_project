import { useState, useEffect, useRef } from 'react';


function AuctionCard({ auction, onClick, onTimerEnd, serverOffset}) {
  const [timeLeft, setTimeLeft] = useState(null);
  // ref utk lacak apakah ontimerend suadh dipanggil utk state 'scheduled' ini
  const hasTriggeredRef = useRef(false);
  // reset ref jika status lelang berubah  
  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [auction.status]);
  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now() + serverOffset;
      let targetTime;
      if (auction.status === 'active') {
        // cek apakah sudah ada bid? (bisa cek dari bidder_count atau last_bid_time)
        const hasBid = parseInt(auction.bidder_count) > 0;

        if (hasBid && auction.last_bid_time) {
            // case 1: Sudah ada bid -> Pakai Rule 15 Detik (Abaikan end_time asli)
            const lastBidTime = new Date(auction.last_bid_time).getTime();
            targetTime = lastBidTime + 15000;
        } else {
            // case 2: Belum ada bid -> Pakai Rule Jadwal Asli
            targetTime = new Date(auction.end_time).getTime();
        }
      } else {
        // Status Scheduled
        targetTime = new Date(auction.start_time).getTime();
      }
      const diff = targetTime - now;
      if (diff <= 0) {
        setTimeLeft(0);
        // hanya panggil ontimerend jika:
        // 1. status masih scheduled
        // 2. fungsi ontimerend ada
        // 3. belum pernah dipanggil sblmnua (cegah spam)
		if (auction.status === 'scheduled' && onTimerEnd && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            console.log(`⏳ Timer 0 detected for Auction ${auction.id}. Refreshing...`);
            onTimerEnd(); 
        }
        return;
      }
      setTimeLeft(diff > 0 ? diff : 0);
    };

    // Initial calculation
    calculateTime();
    // Update every second
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [auction, serverOffset]);

  const formatTime = (ms) => {
    if (ms === null) return '--:--:--';
    if (ms <= 0) return '00:00:00'
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isActive = auction.status === 'active';
  const isWaitingQueue = auction.status === 'scheduled' && timeLeft === 0;

  return (
    <div 
      onClick={onClick}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        cursor: 'pointer',
        transition: 'box-shadow 0.3s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
    >
      <img 
        src={auction.main_image_path || '/placeholder.png'} 
        alt={auction.product_name}
        style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }}
      />
      
      <h3 style={{ margin: '10px 0', fontSize: '16px' }}>
        {auction.product_name}
      </h3>
      
      <p style={{ color: '#666', fontSize: '14px', margin: '5px 0' }}>
        {auction.store_name}
      </p>
      
      <p style={{ fontWeight: 'bold', color: '#1976d2', margin: '10px 0' }}>
        {isActive 
          ? `Current Bid: Rp ${parseInt(auction.current_price).toLocaleString()}`
          : `Starting Price: Rp ${parseInt(auction.starting_price).toLocaleString()}`
        }
      </p>
      
      <p style={{ fontSize: '14px', color: '#666' }}>
        {auction.bidder_count} bidders
      </p>
      
      {/* Countdown */}
      <p style={{ fontWeight: 'bold', color: isActive ? 'red' : 'green' }}>
        {isActive 
          ? `Ends in: ${formatTime(timeLeft)}` 
          : isWaitingQueue 
             ? "⏳ Waiting for Queue..." 
             : `Starts in: ${formatTime(timeLeft)}`
        }
      </p>
    </div>
  );
}
export default AuctionCard;