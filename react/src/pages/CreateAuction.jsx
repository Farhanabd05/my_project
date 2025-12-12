import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams} from 'react-router-dom';

function CreateAuction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productIdFromUrl = searchParams.get('productId');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(productIdFromUrl || '')
  const [startPrice, setStartPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [minIncrement, setMinIncrement] = useState(10000);
  const [startTime, setStartTime] = useState('');
  const [serverOffset, setServerOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [endTime, setEndTime] = useState('');
  const currentProduct = products.find(p => String(p.product_id) === String(selectedProduct));
  // 1. Ambil Data Produk & Sync Waktu saat Load
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Ambil produk
        const prodRes = await fetch('/api/get_seller_product.php?limit=100');
        const prodData = await prodRes.json();
        if (prodData.success) setProducts(prodData.products);

        // Ambil waktu server untuk hitung offset (jaga-jaga jam laptop user ngaco dikit)
        const timeRes = await fetch('/api/node/server-time');
        const timeData = await timeRes.json();
        
        // Offset = Waktu Server - Waktu Laptop
        const offset = timeData.serverTime - Date.now();
        setServerOffset(offset);
        
      } catch (err) {
        console.error("Error init:", err);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Waktu yang diinput user (Local Time WIB)
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      if (endDate <= startDate) {
        throw new Error("Waktu selesai harus lebih lama dari waktu mulai!");
      }
      const userTimestamp = startDate.getTime();

      if (userTimestamp <= Date.now()) {
        throw new Error("Waktu mulai harus lebih dari waktu sekarang!");
      }

      const startTimestamp = userTimestamp + serverOffset;
      const startObj = new Date(startTimestamp);
      const endTimestamp = endDate.getTime() + serverOffset;
      const endObj = new Date(endTimestamp);

      const formatTime = (date) => {
        const pad = (num) => String(num).padStart(2, '0');
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
      };

      const finalStartTime = formatTime(startObj);
      const finalEndTime = formatTime(endObj); // String untuk dikirim

      console.log("Input User (WIB):", startTime);
      console.log("Kirim ke Server (UTC):", finalStartTime);

      // --- END KONVERSI ---

      // Kirim ke PHP
      const payload = {
        product_id: selectedProduct,
        starting_price: startPrice,
        start_time: finalStartTime,
        end_time: finalEndTime,
        quantity: quantity,
        min_increment: minIncrement
      };

      const res = await fetch('/api/create_auction.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        alert('Lelang berhasil dibuat!');
        navigate('/auctions');
      } else {
        throw new Error(data.message || 'Gagal membuat lelang');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>Buat Lelang Baru</h2>
      
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Produk</label>
            <input 
              type="text" 
              readOnly
              value={currentProduct ? `${currentProduct.product_name} (Stok: ${currentProduct.stock})` : 'Memuat info produk...'}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd',
                backgroundColor: '#f5f5f5',
                color: '#555',
                cursor: 'not-allowed'
              }}
            />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Harga Awal (Rp)</label>
          <input 
            type="number" 
            required 
            min="1000"
            value={startPrice}
            onChange={(e) => setStartPrice(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>
        {/* MINIMUM KELIPATAN BID */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Kelipatan Bid Minimum (Rp)</label>
          <input 
            type="number" 
            required 
            min="1000"
            value={minIncrement}
            onChange={(e) => setMinIncrement(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <small style={{ color: '#666' }}>Contoh: Jika 10.000, penawar harus menawar kelipatan 10rb dari harga sekarang.</small>
        </div>

        {/* KUANTITAS BARANG */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Jumlah Barang (Qty)</label>
          <input 
            type="number" 
            required 
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Waktu Mulai (WIB/Lokal)</label>
          <input 
            type="datetime-local" 
            required 
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <small style={{ color: '#666' }}>Masukkan waktu sesuai jam Anda sekarang.</small>
        </div>
        <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Waktu Selesai (WIB)</label>
            <input 
                type="datetime-local" 
                required 
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#00AA5B', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Memproses...' : 'Buat Lelang'}
        </button>
      </form>
    </div>
  );
}

export default CreateAuction;