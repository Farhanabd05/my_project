const pool = require('../config/database');
const { checkFeature } = require('../middleware/checkFeature');

// 1. Mendapatkan daftar chat room user
const getChatRooms = async (req, res) => {
  const userId = req.user.userId;     //Ambil ID langsung dari token, bukan query param

  try {
    const isEnabled = await checkFeature(userId, 'chat_enabled');
    if(!isEnabled){
      throw new Error('Feature is disabled');
    }
    const query = `
      SELECT 
        cr.id as room_id,
        CASE 
          WHEN cr.buyer_id = $1 THEN s.store_name 
          ELSE u.name 
        END as partner_name,
        CASE 
          WHEN cr.buyer_id = $1 THEN s.store_logo_path 
          ELSE 'placeholder.png'
        END as partner_image,
        m.message as last_message,
        m.created_at as last_message_time,
        (SELECT COUNT(*) FROM chat_messages WHERE room_id = cr.id AND is_read = FALSE AND sender_id != $1) as unread_count
      FROM chat_room cr 
      JOIN Users u ON cr.buyer_id = u.user_id
      JOIN Store s ON cr.store_id = s.store_id
      LEFT JOIN LATERAL (
        SELECT 
            CASE 
                WHEN message_type = 'image' THEN '📷 Mengirim gambar'
                WHEN message_type = 'product' THEN '📦 Mengirim produk'
                ELSE message 
            END as message, 
            created_at 
        FROM chat_messages 
        WHERE room_id = cr.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) m ON true
      WHERE cr.buyer_id = $1 OR s.user_id = $1
      ORDER BY m.created_at DESC NULLS LAST
    `;

    const result = await pool.query(query, [userId]);
    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Mendapatkan riwayat pesan dalam satu room
const getChatMessages = async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.userId;//Ambil ID langsung dari token, bukan query param

  try {
    const isEnabled = await checkFeature(userId, 'chat_enabled');
    if(!isEnabled){
      throw new Error('Feature is disabled');
    }

    const verify = await pool.query(
      `SELECT * FROM chat_room cr JOIN Store s ON cr.store_id = s.store_id 
       WHERE cr.id = $1 AND (cr.buyer_id = $2 OR s.user_id = $2)`,
      [roomId, userId]
    );

    if (verify.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // [PERBAIKAN] Tambahkan kolom message_type dan attachment_info
    const query = `
      SELECT 
        id, 
        sender_id, 
        message as message_text, 
        message_type, 
        attachment_info,
        is_read, 
        created_at 
      FROM chat_messages 
      WHERE room_id = $1 
      ORDER BY created_at ASC
    `;
    
    const result = await pool.query(query, [roomId]);
    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. Mulai Chat Baru (Get or Create Room)
const initiateChat = async (req, res) => {
  const buyerId = req.user.userId;
  const { storeId } = req.body;

  try {
    const isEnabled = await checkFeature(buyerId, 'chat_enabled');
    if(!isEnabled){
      res.status(500).json({ success: false, message: 'Feature disabled' });
    }

    // 1. Cek apakah room sudah ada
    const checkQuery = `
      SELECT id FROM chat_room 
      WHERE buyer_id = $1 AND store_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [buyerId, storeId]);

    if (checkResult.rows.length > 0) {
      return res.json({ success: true, roomId: checkResult.rows[0].id });
    }

    // 2. Jika belum ada, buat baru
    const insertQuery = `
      INSERT INTO chat_room (buyer_id, store_id) 
      VALUES ($1, $2) 
      RETURNING id
    `;
    const insertResult = await pool.query(insertQuery, [buyerId, storeId]);
    
    res.json({ success: true, roomId: insertResult.rows[0].id });

  } catch (error) {
    console.error('Initiate chat error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getChatRooms, getChatMessages, initiateChat };