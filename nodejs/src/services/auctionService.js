const pool = require('../config/database');
const { sendPushNotification } = require('./notificationService');
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
class AuctionService {
  constructor(io) {
    this.io = io;
    this.checkInterval = null;
    this.processingAuctions = new Set();     // untuk mencatat ID yang sedang diproses
  }

  startTransitionChecker() {
    console.log('Starting auction transition checker...');
    
    this.checkInterval = setInterval(() => {
      this.checkAuctionTransitions();
    }, 1000); // Check every second
  }

  async checkAuctionTransitions() {
    try {
      const endingSoonResult = await pool.query(`
        SELECT id 
        FROM auctions 
        WHERE status = 'active' 
          AND end_time > NOW() 
          AND end_time <= NOW() + INTERVAL '1 minutes'
          AND ending_soon_notified = FALSE
      `);
      if (endingSoonResult.rows.length > 0) {
          console.log(`🚨 FOUND CANDIDATE for Notification!`, endingSoonResult.rows);
      }
      for (const auction of endingSoonResult.rows) {
        await this.notifyEndingSoon(auction.id);
      }
      const result = await pool.query(`
        SELECT * FROM auctions 
        WHERE 
          -- Case 1: Waktunya mulai (Scheduled -> Active)
          (status = 'scheduled' AND start_time <= NOW())
          OR 
          -- Case 2: Waktunya selesai (Active -> Ended)
          (status = 'active' AND (
             -- OPSI A: Belum ada bid sama sekali DAN Waktu Jadwal Habis
             (
                NOT EXISTS (SELECT 1 FROM auction_bids WHERE auction_id = auctions.id)
                AND end_time <= NOW()
             )
             OR 
             -- OPSI B: Sudah ada bid DAN Sudah lewat 15 detik dari bid terakhir
             -- (Tanpa peduli end_time asli masih ada atau tidak)
             (
                EXISTS (SELECT 1 FROM auction_bids WHERE auction_id = auctions.id)
                AND last_bid_time < NOW() - INTERVAL '15 seconds'
             )
          ))
        ORDER BY id
      `);

      for (const auction of result.rows) {
        // Cek apakah auction ini sedang diproses
        if (this.processingAuctions.has(auction.id)) {
            console.log(`⚠️ Auction ${auction.id} is already being processed. Skipping...`);
            continue; // Skip loop ini
        }
        this.processingAuctions.add(auction.id);
        try {
          if (auction.status === 'scheduled') {
            await this.startAuction(auction.id);
          } else if (auction.status === 'active') {
            await this.endAuction(auction.id);
          }
        } finally {
            // Hapus tanda setelah SELESAI (sukses/gagal)
            this.processingAuctions.delete(auction.id);
        }
      }

    } catch (error) {
      console.error('Error checking auction transitions:', error);
    }
  }
    async notifyEndingSoon(auctionId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const biddersRes = await client.query(`
            SELECT DISTINCT bidder_id FROM auction_bids WHERE auction_id = $1
        `, [auctionId]);

        // LOG DEBUG 3: Berapa user yang akan dikirimi pesan?
        console.log(`📨 Preparing notification for Auction #${auctionId}. Found ${biddersRes.rows.length} bidders.`);

        const namespace = this.io.of('/auction');
        
        biddersRes.rows.forEach(async row => {
            // LOG DEBUG 4: Kirim ke room spesifik
            console.log(`👉 Emitting to room: user-${row.bidder_id}`);
            
            await sendPushNotification(
                row.bidder_id,
                'Lelang Segera Berakhir!',
                `Lelang #${auctionId} akan berakhir dalam 1 menit!`,
                `${CLIENT_URL}/auction/${auctionId}`,
                "auction"
            );
        });

        await client.query(`
            UPDATE auctions SET ending_soon_notified = TRUE WHERE id = $1
        `, [auctionId]);

        await client.query('COMMIT');
        console.log(`⏳ Ending soon notification sent for Auction ${auctionId}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Failed sending ending soon notif:", err);
    } finally {
        client.release();
    }
  }

  async startAuction(auctionId) {
    try {
      // Validate auction sebelum start
      const validationResult = await pool.query(`
        SELECT 
          a.id,
          a.product_id,
          a.seller_id,
          a.starting_price,
          a.start_time,
          a.end_time,
          p.product_id as product_exists,
          p.stock,
          u.user_id as seller_exists
        FROM auctions a
        LEFT JOIN Product p ON a.product_id = p.product_id
        LEFT JOIN Users u ON a.seller_id = u.user_id
        WHERE a.id = $1
      `, [auctionId]);

      if (validationResult.rows.length === 0) {
        console.log(`❌ Auction ${auctionId} not found`);
        return;
      }

      const auction = validationResult.rows[0];

      // Check A: Product exists
      if (!auction.product_exists) {
        console.log(`❌ Auction ${auctionId} - Product deleted`);
        await this.cancelAuctionStr(auctionId, 'Product no longer exists');
        return;
      }

      // Check B: Stock available
      if (auction.stock <= 0) {
        console.log(`❌ Auction ${auctionId} - Out of stock`);
        await this.cancelAuctionStr(auctionId, 'Product out of stock');
        return;
      }

      // Check C: Starting price valid
      if (!auction.starting_price || auction.starting_price <= 0) {
        console.log(`❌ Auction ${auctionId} - Invalid starting price`);
        await this.cancelAuctionStr(auctionId, 'Invalid starting price');
        return;
      }

      // Check D: Seller exists
      if (!auction.seller_exists) {
        console.log(`❌ Auction ${auctionId} - Seller deleted`);
        await this.cancelAuctionStr(auctionId, 'Seller account no longer exists');
        return;
      }

      // Check E: Time valid
      if (new Date(auction.end_time) <= new Date(auction.start_time)) {
        console.log(`❌ Auction ${auctionId} - Invalid time range`);
        await this.cancelAuctionStr(auctionId, 'Invalid time configuration');
        return;
      }
      const activeAuctionCheck = await pool.query(`
        SELECT id FROM auctions 
        WHERE seller_id = $1 AND status = 'active' AND id != $2
      `, [auction.seller_id, auctionId]);

      if (activeAuctionCheck.rows.length > 0) {
        console.log(`⏳ Seller ${auction.seller_id} is busy with another auction. Postponing start for Auction ${auctionId}.`);
        return;
      }
      
      // All checks passed - start auction
      await pool.query(`
        UPDATE auctions 
        SET status = 'active', 
            last_bid_time = NOW(),
            end_time = end_time + (NOW() - start_time),
            start_time = NOW()
        WHERE id = $1
      `, [auctionId]);

      // Ambil data terbaru untuk dikirim ke frontend
      const updatedAuctionRes = await pool.query(`SELECT * FROM auctions WHERE id = $1`, [auctionId]);
      const updatedAuction = updatedAuctionRes.rows[0];

      console.log(`✅ Auction ${auctionId} started (Late start adjusted).`);

      // --- [TAMBAHAN BARU] Broadcast ke Room List ---
      // Agar status di card berubah jadi 'active' secara real-time
      this.io.of('/auction').to('auction-list').emit('auction-updated', {
          auctionId: auctionId,
          status: 'active',
          current_price: updatedAuction.current_price,
          end_time: updatedAuction.end_time,
          start_time: updatedAuction.start_time,
          last_bid_time: updatedAuction.last_bid_time
      });

      // Also broadcast to specific auction room
      this.io.of('/auction').to(`auction-${auctionId}`).emit('auction-started', {
        auctionId: auctionId,
        timestamp: new Date()
      });
      // 2. Kirim juga ke user yang sedang melihat DAFTAR lelang (Auction List)
      this.io.of('/auction').to('auction-list').emit('auction-started', {
        auctionId: auctionId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error(`Error starting auction ${auctionId}:`, error);
    }
  }

  async cancelAuctionStr(auctionId, reason) {
    try {
      await pool.query(`
        UPDATE auctions 
        SET status = 'cancelled'
        WHERE id = $1
      `, [auctionId]);

      console.log(`🚫 Auction ${auctionId} cancelled: ${reason}`);

      // Notify seller via WebSocket
      this.io.of('/auction').to(`auction-${auctionId}`).emit('auction-cancelled', {
        auctionId: auctionId,
        reason: reason,
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`Error cancelling auction ${auctionId}:`, error);
    }
  }
// Gunakan kode ini untuk menggantikan cancelAuction yang lama
  async cancelAuction(auctionId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Validasi & Locking
      const auctionRes = await client.query(`
        SELECT * FROM auctions WHERE id = $1 FOR UPDATE
      `, [auctionId]);

      if (auctionRes.rows.length === 0) {
        throw new Error('Lelang tidak ditemukan');
      }

      const auction = auctionRes.rows[0];

      if (String(auction.seller_id) !== String(userId)) {
        throw new Error('Anda tidak memiliki izin membatalkan lelang ini');
      }

      if (auction.status !== 'active' && auction.status !== 'scheduled') {
        throw new Error('Lelang yang sudah berakhir atau dibatalkan tidak bisa dicancel');
      }
      // Karena dibatalkan seller, barang dianggap kembali ke gudang
      const qtyReturn = auction.quantity;
      await client.query("UPDATE Product SET stock = stock + $1 WHERE product_id = $2", [qtyReturn, auction.product_id]);
      console.log(`🚫 Auction ${auctionId} canceled. Stock refunded: +${qtyReturn}`);
      // 2. Logic Refund
      // refund hanya perlu untuk highest bidder karena bidder lain sudah direfund saat tersalip (di logic placeBid)
      const highestBidRes = await client.query(`
        SELECT * FROM auction_bids 
        WHERE auction_id = $1 
        ORDER BY bid_amount DESC 
        LIMIT 1
      `, [auctionId]);

      if (highestBidRes.rows.length > 0) {
        const highestBid = highestBidRes.rows[0];
        console.log(`💸 Refunding IDR ${highestBid.bid_amount} to User ${highestBid.bidder_id} due to cancellation`);

        await client.query(`
          UPDATE Users 
          SET balance = balance + $1 
          WHERE user_id = $2
        `, [highestBid.bid_amount, highestBid.bidder_id]);
        
        // kirim notifikasi personal ke bidder yang di-refund
        this.io.of('/auction').to(`user-${highestBid.bidder_id}`).emit('notification', {
            type: 'info',
            message: `Lelang #${auctionId} dibatalkan penjual. Dana Rp ${highestBid.bid_amount} telah dikembalikan.`,
            auctionId
        });
      }

      // update Status DB
      await client.query(`
        UPDATE auctions 
        SET status = 'cancelled', updated_at = NOW() 
        WHERE id = $1
      `, [auctionId]);

      await client.query('COMMIT');
      
      console.log(`✅ Auction ${auctionId} cancelled by seller ${userId}`);
      
      // BROADCASTING
      // kirim ke Room Detail (Biar user yang lagi lihat tau)
      this.io.of('/auction').to(`auction-${auctionId}`).emit('auction-canceled', { // Typo di event name frontend Anda 'canceled' (satu L)
        auctionId: auctionId,
        message: 'Lelang dibatalkan oleh penjual.'
      });

      // kirim ke Room List 
      // agar antrian "Waiting for Queue" di lelang berikutnya tahu jalan sudah kosong
      this.io.of('/auction').to('auction-list').emit('auction-updated', {
          auctionId: auctionId,
          status: 'cancelled'
      });

      // trigger Refresh List
      // Untuk memastikan kartu pindah tab atau hilang dari view
      this.io.of('/auction').to('auction-list').emit('refresh-list');

      return { success: true };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error cancelling auction ${auctionId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  async endAuction(auctionId) {
    try {
      // Get auction with highest bid
      const auctionResult = await pool.query(`
        SELECT a.*, ab.bidder_id, ab.bid_amount
        FROM auctions a
        LEFT JOIN auction_bids ab ON a.id = ab.auction_id
        WHERE a.id = $1
        ORDER BY ab.bid_amount DESC, ab.bid_time ASC
        LIMIT 1
      `, [auctionId]);

      if (auctionResult.rows.length === 0) return;

      const auction = auctionResult.rows[0];
      const winnerId = auction.bidder_id;

      // Update auction status
      await pool.query(`
        UPDATE auctions 
        SET status = 'ended', 
            winner_id = $1,
            end_time = NOW()
        WHERE id = $2
      `, [winnerId, auctionId]);

      console.log(`✅ Auction ${auctionId} ended. Winner: ${winnerId || 'none'}`);

      // Broadcast to WebSocket clients
      this.io.of('/auction').to(`auction-${auctionId}`).emit('auction-ended', {
        auctionId: auctionId,
        winnerId: winnerId,
        finalPrice: auction.current_price,
        timestamp: new Date()
      });

      // TODO: Create order if there's a winner
      if (winnerId) {
        await this.createOrder(auctionId, winnerId, auction.current_price);
        await sendPushNotification(
                winnerId,
                'Selamat! Anda Menang Lelang 🎉',
                `Anda memenangkan lelang #${auctionId}. Order Otomatis Dibuat.`,
                `http://localhost:8082/order_history.php`,
                "auction"
        );
        console.log(`🏆 Win notification sent to User ${winnerId}`);
      } else {
        await pool.query(`UPDATE auctions SET status = 'ended' WHERE id = $1`, [auctionId]);
        //  KEMBALIKAN STOK (REFUND STOCK)
        // Karena tidak laku, barang dikembalikan ke gudang
        const auctionInfo = await pool.query('SELECT product_id, quantity FROM auctions WHERE id = $1', [auctionId]);
      
        if (auctionInfo.rows.length > 0) {
            const { product_id, quantity } = auctionInfo.rows[0];
            // Default quantity 1 jika null (jaga-jaga)
            const qtyReturn = quantity || 1; 

            await pool.query(`
               UPDATE Product SET stock = stock + $1 WHERE product_id = $2
            `, [qtyReturn, product_id]);
          
            console.log(`↩️ Auction ${auctionId} ended (No Winner). Stock refunded: +${qtyReturn}`);
        }

        console.log(`✅ Auction ${auctionId} ended. Winner: none`);
        return;
      }
      // bc ke Room LIST (biar kartu di halaman auction-list hilang/pindah)
      this.io.of('/auction').to('auction-list').emit('auction-ended', {
        auctionId: auctionId
      });
    } catch (error) {
      console.error(`Error ending auction ${auctionId}:`, error);
    }
  }

  async createOrder(auctionId, buyerId, totalPrice) {
    try {
      // 1. Ambil kolom 'a.quantity'
      const auctionResult = await pool.query(`
        SELECT a.product_id, a.seller_id, a.quantity, s.store_id 
        FROM auctions a
        JOIN Store s ON a.seller_id = s.user_id
        WHERE a.id = $1
      `, [auctionId]);

      if (auctionResult.rows.length === 0) {
        console.error(`Auction ${auctionId} not found or Seller has no Store.`);
        return;
      }

      // 2. Destructure quantity dan siapkan default value
      const { product_id, seller_id, store_id, quantity } = auctionResult.rows[0];
      const finalQty = quantity || 1; // Jaga-jaga jika null, anggap 1

      const buyerResult = await pool.query(`
        SELECT address FROM Users WHERE user_id = $1
      `, [buyerId]);
      
      const shippingAddress = buyerResult.rows[0]?.address || 'Alamat belum diatur';

      const orderResult = await pool.query(`
        INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at)
        VALUES ($1, $2, $3, $4, 'approved', NOW())
        RETURNING order_id
      `, [buyerId, store_id, totalPrice, shippingAddress]);

      const orderId = orderResult.rows[0].order_id;

      // 3. hitung Harga Satuan (Unit Price)
      // totalPrice adalah "Subtotal" (Total Harga Menang Lelang)
      // price_at_order adalah Harga Satuan
      const unitPrice = Math.round(parseFloat(totalPrice) / finalQty);

      // 4. Masukkan finalQty dan unitPrice ke Order_Items
      await pool.query(`
        INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal)
        VALUES ($1, $2, $3, $4, $5)
      `, [orderId, product_id, finalQty, unitPrice, totalPrice]);

      console.log(`📦 Order created successfully: Order #${orderId} for Auction #${auctionId} (Qty: ${finalQty})`);

    } catch (error) {
      console.error(`Error creating order for auction ${auctionId}:`, error);
    }
  }

  stopTransitionChecker() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      console.log('Auction transition checker stopped');
    }
  }
}

module.exports = AuctionService;