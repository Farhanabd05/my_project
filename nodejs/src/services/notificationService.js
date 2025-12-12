const webpush = require('web-push');
const pool = require('../config/database');

// Tambahkan parameter 'type' dengan default 'general'
async function sendPushNotification(userId, title, message, url, type = 'general') {
  try {

    // 0. Simpan notifikasi ke Database agar persisten (muncul saat skenario logout terus login lagi)
    await pool.query(`
      INSERT INTO Notifications (user_id, title, message, url, type)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, title, message, url, type]);
    
    console.log(`💾 Notification saved to DB for User ${userId}`);
    // 1. Cek Preferensi User
    // Mapping tipe notifikasi ke nama kolom di database
    const columnMap = {
      'order': 'order_enabled',
      'auction': 'auction_enabled',
      'chat': 'chat_enabled'
    };

    const columnToCheck = columnMap[type];

    if (columnToCheck) {
      const prefResult = await pool.query(`
        SELECT ${columnToCheck} as is_enabled 
        FROM Push_Preferences 
        WHERE user_id = $1
      `, [userId]);

      // Jika data preference ada, DAN user mematikannya (false), maka BATALKAN kirim
      if (prefResult.rows.length > 0 && prefResult.rows[0].is_enabled === false) {
        console.log(`🚫 Notification blocked by user preference (${type}) for User ${userId}`);
        return; // Keluar dari fungsi, jangan kirim apa-apa
      }
    }

    // 2. Ambil semua subscription user
    const result = await pool.query(`
      SELECT endpoint, p256dh_key, auth_key 
      FROM Push_Subscriptions 
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) return;

    const payload = JSON.stringify({ title, message, url });

    // 3. Kirim ke semua device
    const promises = result.rows.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth: sub.auth_key
        }
      };
      const options = { TTL: 86400 };
      return webpush.sendNotification(pushSubscription, payload, options)
        .catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log('Subscription expired, deleting...');
            pool.query('DELETE FROM Push_Subscriptions WHERE endpoint = $1', [sub.endpoint]);
          } else {
            console.error('Push error:', err);
          }
        });
    });

    await Promise.all(promises);
    console.log(`📨 Push notification sent to User ${userId} [Type: ${type}]`);

  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

module.exports = { sendPushNotification };