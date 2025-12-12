const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const pool = require('./config/database');
const cors = require('cors');
const webpush = require('web-push');
const { sendPushNotification } = require('./services/notificationService');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3001;

// TENTUKAN URL FRONTEND REACT ANDA
// Jika development (Vite), biasanya http://localhost:5173
// Jika production (Nginx), mungkin http://localhost:8000 atau port 80
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);
// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected:', res.rows[0]);
    }
});

// untuk react
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:8082'], // Izinkan React DAN PHP (php buat notif)
    methods: ['GET','POST'],
    credentials: true
}));

// const bcrypt = require("bcrypt");

// const password = "Admin#123-";
// const saltRounds = 10;

// bcrypt.hash(password, saltRounds, (err, hash) => {
//   if (err) {
//     console.error(err);
//     return;
//   }
//   console.log("Hashed password to put in DB:", hash);
// });

// Middleware
app.use(express.json());

// Routes
const auctionRoutes = require('./routes/auctionRoutes');
const chatRoutes = require('./routes/chatRoutes');
app.use('/', auctionRoutes);
app.use('/', chatRoutes);

const featuresRouter = require('./routes/features');
app.use('/features', featuresRouter);

const adminRoutes = require("./routes/adminRoutes");
app.use("/admin", adminRoutes);

// Test endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Node.js server running' });
});

// Simple server time endpoint
app.get('/server-time', (req, res) => {
  res.json({ 
    serverTime: Date.now()
  });
});

// Get bid history for auction
app.get('/auctions/:auctionId/bids', async (req, res) => {
  const { auctionId } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  try {
    // Get bids with user info
    const result = await pool.query(`
      SELECT 
        ab.id,
        ab.bidder_id,
        ab.bid_amount,
        ab.bid_time,
        u.name
      FROM auction_bids ab
      JOIN Users u ON ab.bidder_id = u.user_id
      WHERE ab.auction_id = $1
      ORDER BY ab.bid_time DESC
      LIMIT $2 OFFSET $3
    `, [auctionId, limit, offset]);

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM auction_bids WHERE auction_id = $1',
      [auctionId]
    );

    res.json({
      success: true,
      bids: result.rows,
      total: parseInt(countResult.rows[0].total),
      hasMore: offset + limit < parseInt(countResult.rows[0].total)
    });

  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bids' });
  }
});

// Enhanced auction list endpoint
app.get('/auctions', async (req, res) => {
  const { status, page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT 
        a.*,
        p.product_name,
        p.image_url,
        s.store_name,
        COUNT(DISTINCT ab.bidder_id) as bidder_count
      FROM auctions a
      JOIN Product p ON a.product_id = p.product_id
      JOIN Store s ON p.store_id = s.store_id
      LEFT JOIN auction_bids ab ON a.id = ab.auction_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Filter by status
    if (status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
    }

    // Search by product name OR store name
    if (search) {
      paramCount++;
      query += ` AND (p.product_name ILIKE $${paramCount} OR s.store_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY a.id, p.product_name, p.image_url, s.store_name`;
    query += ` ORDER BY a.created_at DESC`;
    
    // Get total count
    const countQuery = query.replace(
      'SELECT a.*, p.product_name, p.image_url, s.store_name, COUNT(DISTINCT ab.bidder_id) as bidder_count',
      'SELECT COUNT(DISTINCT a.id) as total'
    ).split('GROUP BY')[0];

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Add pagination
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      page: parseInt(page),
      limit: parseInt(limit),
      total: total,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Get auctions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch auctions' });
  }
});

app.get('/auctions/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const query = `
      SELECT 
        a.id, a.product_id, a.seller_id, a.starting_price, a.current_price, 
        a.status, a.start_time, a.end_time,
        a.min_increment, a.quantity,
        COUNT(DISTINCT ab.bidder_id) as bidder_count,
        p.product_name, 
        p.description, 
        p.main_image_path as image_url, 
        u.name as seller_name,
        u.user_id as seller_user_id
      FROM auctions a
      JOIN Product p ON a.product_id = p.product_id
      JOIN Users u ON a.seller_id = u.user_id
      LEFT JOIN auction_bids ab ON a.id = ab.auction_id -- JOIN KE BIDS
      WHERE a.id = $1
      GROUP BY a.id, p.product_id, u.user_id
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lelang tidak ditemukan' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching auction detail:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// WebSocket namespaces
const auctionNamespace = io.of('/auction');

auctionNamespace.on('connection', async (socket) => {
    // Join auction-list room
    socket.on('join-auction-list', () => {
        console.log('📥 Received join-auction-list event from', socket.id); // ← ADD THIS
        socket.join('auction-list');
        console.log(`✅ Socket ${socket.id} joined auction-list room`);
    });

    // Leave auction-list room
    socket.on('leave-auction-list', () => {
        socket.leave('auction-list');
        console.log(`Socket ${socket.id} left auction-list room`);
    });

    // Authenticate with ticket
    socket.on('authenticate', async (data) => {
        const { ticket } = data;

        try {
            // Verify ticket
            const result = await pool.query(`
        SELECT user_id, expires_at, used 
        FROM ws_tickets 
        WHERE ticket = $1
      `, [ticket]);

            if (result.rows.length === 0) {
                socket.emit('auth-error', { message: 'Invalid ticket' });
                return;
            }

            const ticketData = result.rows[0];

            // Check if expired
            if (new Date(ticketData.expires_at) < new Date()) {
                socket.emit('auth-error', { message: 'Ticket expired' });
                return;
            }

            // Check if already used
            if (ticketData.used) {
                socket.emit('auth-error', { message: 'Ticket already used' });
                return;
            }

            // Mark ticket as used
            await pool.query('UPDATE ws_tickets SET used = true WHERE ticket = $1', [ticket]);

            // Store user_id in socket
            socket.userId = ticketData.user_id;
            // Masukkan user ke "Kamar Pribadi" di dalam namespace /auction
            const userRoom = `user-${ticketData.user_id}`;
            socket.join(userRoom);
            console.log(`👤 User ${ticketData.user_id} joined personal room: ${userRoom}`);
            socket.emit('authenticated', { userId: ticketData.user_id });

            console.log(`User ${ticketData.user_id} authenticated`);
        } catch (error) {
            console.error('Auth error:', error);
            socket.emit('auth-error', { message: 'Authentication failed' });
        }
    });

    // Join auction room (only if authenticated)
    socket.on('join-auction', (auctionId) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        socket.join(`auction-${auctionId}`);
        console.log(`User ${socket.userId} joined auction-${auctionId}`);
    });

    // Place bid (only if authenticated)
    socket.on('place-bid', async (data) => {
        if (!socket.userId) {
            return socket.emit('bid-error', { message: 'Not authenticated' });
        }

        const { auctionId, bidAmount } = data;
        const client = await pool.connect(); // Get client for transaction

        try {
            await client.query('BEGIN'); // Start transaction

            // VALIDATION
            const validationResult = await client.query(`
            SELECT 
                a.id, a.status, a.current_price, a.seller_id, a.end_time,
                a.min_increment,
                u.role, u.balance
            FROM auctions a
            JOIN Users u ON u.user_id = $1
            WHERE a.id = $2
            `, [socket.userId, auctionId]);

            if (validationResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return socket.emit('bid-error', { message: 'Auction not found' });
            }

            const auction = validationResult.rows[0];
            const user = validationResult.rows[0];

            // All validations (1-8
            
            if (socket.userId === auction.seller_id) {
                await client.query('ROLLBACK');
                return socket.emit('bid-error', { message: 'Sellers cannot bid on their own auctions' });
            }

            if (user.role.toUpperCase() !== 'BUYER') {
                await client.query('ROLLBACK');
                return socket.emit('bid-error', { message: 'Only buyers can place bids' });
            }

            // Check 3: Auction is active
            if (auction.status !== 'active') {
            return socket.emit('bid-error', { 
                message: `Auction is ${auction.status}, cannot place bid` 
            });
            }

            // Check 4: Auction not ended (timing)
            if (new Date(auction.end_time) <= new Date()) {
            return socket.emit('bid-error', { 
                message: 'Auction has ended' 
            });
            }
            const currentPrice = parseFloat(auction.current_price);
            const newBidAmount = parseFloat(bidAmount);

            if (newBidAmount <= currentPrice) {
                await client.query('ROLLBACK');
                return socket.emit('bid-error', { 
                    message: `Bid must be higher than current price (Rp ${currentPrice})` 
                });
            }

            const minIncrementVal = parseFloat(auction.min_increment) || 10000;
            if (newBidAmount < currentPrice + minIncrementVal) {
                await client.query('ROLLBACK');
                return socket.emit('bid-error', { 
                    // Format pesan agar lebih jelas
                    message: `Bid must be at least Rp ${minIncrementVal.toLocaleString()} higher` 
                });
            }

            if (user.balance < newBidAmount) {
                await client.query('ROLLBACK');
                return socket.emit('bid-error', { 
                    message: `Insufficient balance. Your balance: Rp ${user.balance}` 
                });
            }

            const duplicateCheck = await pool.query(`
                SELECT id FROM auction_bids
                WHERE auction_id = $1 
                AND bidder_id = $2 
                AND bid_amount = $3
                AND bid_time > NOW() - INTERVAL '5 seconds'
            `, [auctionId, socket.userId, newBidAmount]);

            if (duplicateCheck.rows.length > 0) {
            return socket.emit('bid-error', { 
                message: 'Duplicate bid detected. Please wait a moment.' 
            });
            }

            // BALANCE DEDUCTION LOGIC
            // 1. Get previous highest bidder (if exists)
            const previousBidResult = await client.query(`
                SELECT bidder_id, bid_amount 
                FROM auction_bids 
                WHERE auction_id = $1 
                ORDER BY bid_amount DESC, bid_time ASC 
                LIMIT 1
            `, [auctionId]);

            // 2. Refund previous bidder
            if (previousBidResult.rows.length > 0) {
                const prevBidder = previousBidResult.rows[0];
                await client.query(`
                    UPDATE Users 
                    SET balance = balance + $1 
                    WHERE user_id = $2
                `, [prevBidder.bid_amount, prevBidder.bidder_id]);
                
                console.log(`💰 Refunded User ${prevBidder.bidder_id}: +Rp ${prevBidder.bid_amount}`);
                // cek biar gk ngirim notif ke diri sendiri (misal top-up bid)
                if (String(prevBidder.bidder_id) !== String(socket.userId)) {
                      sendPushNotification(
                          prevBidder.bidder_id,
                          'Tawaran Terlampaui 😱',
                          `Tawaran Anda di lelang #${auctionId} telah disalip! Tawar lagi sekarang.`,
                          `${CLIENT_URL}/auction/${auctionId}`,
                          "auction"
                      );
                    
                    console.log(`[NOTIF] Sent outbid notification to User ${prevBidder.bidder_id}`);
                }
            }

            // 3. Deduct new bidder's balance
            await client.query(`
                UPDATE Users 
                SET balance = balance - $1 
                WHERE user_id = $2
                `, [newBidAmount, socket.userId]
            );

            console.log(`💸 Deducted User ${socket.userId}: -Rp ${newBidAmount}`);

            // 4. Save bid to auction_bids
            const result = await client.query(`
                INSERT INTO auction_bids (auction_id, bidder_id, bid_amount, bid_time)
                VALUES ($1, $2, $3, NOW())
                RETURNING id, auction_id, bidder_id, bid_amount, bid_time
            `, [auctionId, socket.userId, newBidAmount]);

            const savedBid = result.rows[0];

            // 5. Update auction current_price & last_bid_time
            await client.query(`
                UPDATE auctions 
                SET current_price = $1, last_bid_time = NOW()
                WHERE id = $2
            `, [newBidAmount, auctionId]);

           const countRes = await client.query(
                'SELECT COUNT(DISTINCT bidder_id) as count FROM auction_bids WHERE auction_id = $1',
                [auctionId]
            );
            const newBidderCount = countRes.rows[0].count;

            await client.query('COMMIT'); // Commit transaction

            console.log(`[OK] Bid placed: User ${socket.userId} bid Rp ${newBidAmount} on auction ${auctionId}`);

            // Broadcast to all users (Detail Page)
            auctionNamespace.to(`auction-${auctionId}`).emit('bid-placed', {
                auctionId: auctionId,
                bidAmount: newBidAmount,
                bidderId: socket.userId,
                timestamp: savedBid.bid_time,
                bidderCount: newBidderCount // kirim juga ke detail biar sinkron
            });
            // bc ke room LIST (Halaman Depan/Dashboard)
            // ini yang bikin timer di card lelang kereset jadi 15 detik lagi
            auctionNamespace.to('auction-list').emit('auction-updated', {
                auctionId: auctionId,
                current_price: newBidAmount,
                last_bid_time: savedBid.bid_time,
                bidder_count: newBidderCount
            });

            // Confirm to bidder
            socket.emit('bid-success', {
            bidId: savedBid.id,
            amount: newBidAmount
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Place bid error:', error);
            socket.emit('bid-error', { message: 'Failed to place bid. Please try again.' });
        } finally {
            client.release(); // Release connection back to pool
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ============================================
// CHAT NAMESPACE (Tim B - Production Ready)
// ============================================
const chatNamespace = io.of('/chat');

chatNamespace.on('connection', async (socket) => {
  console.log('Chat client connected:', socket.id);
  
  // State lokal socket
  socket.userId = null;
  socket.currentRoom = null;
  socket.authenticated = false;

  // 1. EVENT: Authenticate (Wajib Tiket)
  socket.on('authenticate', async (data) => {
    const { ticket } = data;
    try {
      // Cek tiket di DB
      const result = await pool.query(`
        SELECT user_id, expires_at, used 
        FROM ws_tickets 
        WHERE ticket = $1
      `, [ticket]);

      if (result.rows.length === 0) {
        return socket.emit('auth-error', { message: 'Tiket tidak valid' });
      }

      const ticketData = result.rows[0];

      // Cek kadaluarsa
      if (new Date(ticketData.expires_at) < new Date()) {
        return socket.emit('auth-error', { message: 'Tiket kadaluarsa' });
      }

      // Cek apakah sudah dipakai
      if (ticketData.used) {
        return socket.emit('auth-error', { message: 'Tiket sudah digunakan' });
      }

      // Tandai tiket sudah dipakai
      await pool.query('UPDATE ws_tickets SET used = true WHERE ticket = $1', [ticket]);

      // Simpan User ID di sesi socket ini
      socket.userId = ticketData.user_id;
      socket.authenticated = true;
      
      socket.emit('authenticated', { userId: ticketData.user_id });
      console.log(`✅ Chat User ${ticketData.user_id} authenticated`);

      // === [BARU] AUTO-JOIN SEMUA ROOM ===
      // Cari semua room di mana user ini terlibat (sebagai Buyer atau Seller)
      const myRooms = await pool.query(`
          SELECT cr.id 
          FROM chat_room cr
          LEFT JOIN Store s ON cr.store_id = s.store_id
          WHERE cr.buyer_id = $1 OR s.user_id = $1
      `, [socket.userId]);

      // Masukkan socket ke dalam semua room tersebut
      if (myRooms.rows.length > 0) {
          myRooms.rows.forEach(row => {
              socket.join(`room_${row.id}`);
          });
          console.log(`🔄 User ${socket.userId} auto-joined ${myRooms.rows.length} rooms.`);
      }
      // ===================================

    } catch (error) {
      console.error('Chat auth error:', error);
      socket.emit('auth-error', { message: 'Gagal autentikasi server' });
    }
  });

  // 2. EVENT: Join Room (Dengan Validasi Kepemilikan)
  socket.on('join_room', async (roomId) => {
    // Tolak jika belum login
    if (!socket.authenticated || !socket.userId) {
      return socket.emit('error', { message: 'Anda belum terautentikasi' });
    }

    try {
      // Validasi: Apakah user ini benar-benar anggota room tersebut?
      // (Mencegah user A mengintip room user B)
      const roomCheck = await pool.query(`
        SELECT id, buyer_id, store_id 
        FROM chat_room 
        WHERE id = $1
      `, [roomId]);

      if (roomCheck.rows.length === 0) {
        return socket.emit('error', { message: 'Room tidak ditemukan' });
      }

      const room = roomCheck.rows[0];
      
      // Ambil user_id milik toko
      const storeCheck = await pool.query('SELECT user_id FROM Store WHERE store_id = $1', [room.store_id]);
      const sellerId = storeCheck.rows[0]?.user_id;

      // Cek Hak Akses
      const isAuthorized = (socket.userId === room.buyer_id || socket.userId === sellerId);
      
      if (!isAuthorized) {
        console.log(`❌ Unauthorized: User ${socket.userId} coba masuk room ${roomId}`);
        return socket.emit('error', { message: 'Anda tidak memiliki akses ke room ini' });
      }

      // Join Room Socket.io
      socket.join(`room_${roomId}`);
      socket.currentRoom = roomId;
      console.log(`✅ User ${socket.userId} masuk ke room_${roomId}`);

      // (Opsional) Load history pesan jika belum dimuat via API
      // socket.emit('room-joined', { roomId });

    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Gagal join room' });
    }
  });

  // 3. EVENT: Send Message (Support Text, Image, Product)
  socket.on('send_message', async (data) => {
    // Validasi dasar
    if (!socket.authenticated || !socket.userId) return;
    if (!socket.currentRoom) return socket.emit('error', { message: 'Belum masuk room' });

    const { message, type = 'text', attachment = null } = data;
    if (type === 'text' && (!message || !message.trim())) return;

    try {
      // Simpan ke Database
      const query = `
        INSERT INTO chat_messages 
        (room_id, sender_id, message, message_type, attachment_info, created_at) 
        VALUES ($1, $2, $3, $4, $5, NOW()) 
        RETURNING id, room_id, sender_id, message, message_type, attachment_info, created_at, is_read
      `;
      
      const result = await pool.query(query, [
          socket.currentRoom, 
          socket.userId, 
          message || '', 
          type,          
          attachment     
      ]);
      
      const savedMessage = result.rows[0];

      // Update timestamp room
      await pool.query('UPDATE chat_room SET updated_at = NOW() WHERE id = $1', [socket.currentRoom]);

      // Broadcast ke semua di room
      chatNamespace.to(`room_${socket.currentRoom}`).emit('receive_message', {
        id: savedMessage.id,
        room_id: savedMessage.room_id,
        sender_id: savedMessage.sender_id,
        message_text: savedMessage.message,
        message_type: savedMessage.message_type,
        attachment_info: savedMessage.attachment_info,
        created_at: savedMessage.created_at,
        is_read: false
      });

      // ============================================================
      // [BARU] LOGIKA PUSH NOTIFIKASI CHAT DIMULAI DI SINI
      // ============================================================
      
      // 1. Cari info room untuk menentukan siapa penerimanya
      const roomRes = await pool.query(`
          SELECT cr.buyer_id, s.user_id as seller_id, s.store_name, u.name as buyer_name
          FROM chat_room cr
          JOIN Store s ON cr.store_id = s.store_id
          JOIN Users u ON cr.buyer_id = u.user_id
          WHERE cr.id = $1
      `, [socket.currentRoom]);

      if (roomRes.rows.length > 0) {
          const roomInfo = roomRes.rows[0];
          let recipientId = null;
          let notificationTitle = "Pesan Baru 💬";
          let notificationBody = "";

          // Cek apakah pengirim adalah Buyer atau Seller
          if (String(socket.userId) === String(roomInfo.buyer_id)) {
              // Jika pengirim Buyer, kirim ke Seller
              recipientId = roomInfo.seller_id;
              notificationTitle = `Pesan dari ${roomInfo.buyer_name}`;
          } else {
              // Jika pengirim Seller, kirim ke Buyer
              recipientId = roomInfo.buyer_id;
              notificationTitle = `Pesan dari ${roomInfo.store_name}`;
          }

          // Tentukan isi pesan (handle jika pesan berupa gambar)
          if (type === 'image') {
              notificationBody = "📷 Mengirim sebuah gambar";
          } else if (type === 'product') {
              notificationBody = "📦 Mengirim info produk";
          } else {
              notificationBody = message;
          }

          // Panggil service notifikasi
          await sendPushNotification(
              recipientId,
              notificationTitle,
              notificationBody,
              `${CLIENT_URL}/chat?roomId=${socket.currentRoom}`, // [UBAH] Gunakan URL Lengkap
              'chat'
          );
          
          console.log(`🔔 Chat notification sent to User ${recipientId}`);
      }
      // ============================================================

    } catch (err) {
      console.error('Save message failed:', err);
      socket.emit('error', { message: 'Gagal mengirim pesan' });
    }
  });

  // 4. EVENT: Typing Indicator
  socket.on('typing', (data) => {
    if (socket.currentRoom) {
      socket.to(`room_${socket.currentRoom}`).emit('partner_typing', {
        isTyping: data.isTyping,
        roomId: socket.currentRoom
      });
    }
  });

  // [DEBUG] 5. EVENT: Mark as Read (Tandai Dibaca)
  socket.on('mark_as_read', async (data) => {
    // Cek data yang masuk
    console.log(`📥 Request Mark Read: Room ${data.roomId} oleh User ${socket.userId}`);

    if (!socket.authenticated || !socket.userId) {
        console.log("❌ Gagal Mark Read: User belum login");
        return;
    }

    try {
      // Pastikan roomId adalah integer
      const roomId = parseInt(data.roomId);
      if (isNaN(roomId)) {
          console.log("❌ Gagal Mark Read: Room ID tidak valid");
          return;
      }

      // Update DB
      const query = `
        UPDATE chat_messages
        SET is_read = true
        WHERE room_id = $1 
        AND sender_id != $2
        AND is_read = false
      `;
      
      const result = await pool.query(query, [roomId, socket.userId]);

      console.log(`✅ Berhasil update DB: ${result.rowCount} pesan ditandai terbaca.`);

      // Jika ada pesan yang diupdate, beritahu lawan bicara
      if (result.rowCount > 0) {
          socket.to(`room_${roomId}`).emit('partner_read_messages', {
            roomId: roomId,
            readerId: socket.userId
          });
      }

    } catch (err) {
      console.error('❌ Error Database Mark Read:', err);
    }
  });

  // 6. Cleanup
  socket.on('disconnect', () => {
    console.log(`Chat client disconnected: ${socket.id}`);
  });
});

// Ganti bagian AuctionService initialization
const AuctionService = require('./services/auctionService');
const auctionService = new AuctionService(io);

// Start transition checker
auctionService.startTransitionChecker();
app.set('auctionService', auctionService);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping transition checker...');
  auctionService.stopTransitionChecker();
  process.exit(0);
});

// Internal route untuk dipanggil oleh PHP
app.post('/internal/send-notification', async (req, res) => {
    const { userId, title, message, url, type } = req.body;

    console.log(`📨 Internal request to send notification to User ${userId}`);
    if (!userId || !title || !message) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    sendPushNotification(userId, title, message, url, type || 'general');

    res.json({ success: true });
});

app.post('/internal/trigger-refresh', (req, res) => {
    console.log("🔄 Received refresh trigger from PHP");
    
    // Kirim sinyal ke semua client yang ada di halaman List
    const auctionNamespace = io.of('/auction');
    auctionNamespace.to('auction-list').emit('refresh-list');
    
    res.json({ success: true });
});

app.post('/notifications/subscribe', async (req, res) => {
  const { subscription, userId } = req.body; 
  
  if (!userId || !subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid data' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. BERSIHKAN DULU: Hapus semua langganan lama user ini
    // Supaya tidak ada double notif dari port 8082 atau sesi lama
    await client.query('DELETE FROM Push_Subscriptions WHERE user_id = $1', [userId]);

    // 2. DAFTAR BARU: Masukkan langganan yang sekarang aktif
    await client.query(`
      INSERT INTO Push_Subscriptions (user_id, endpoint, p256dh_key, auth_key)
      VALUES ($1, $2, $3, $4)
    `, [
      userId, 
      subscription.endpoint, 
      subscription.keys.p256dh, 
      subscription.keys.auth
    ]);
    
    await client.query('COMMIT');
    console.log(`🔔 Subscription diperbarui: Hanya perangkat ini yang aktif untuk User ${userId}`);
    res.status(201).json({ success: true });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save subscription error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});