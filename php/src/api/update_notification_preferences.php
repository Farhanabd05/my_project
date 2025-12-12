<?php
session_start();
header('Content-Type: application/json');

// 1. Cek apakah metode request benar (harus POST)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// 2. Cek apakah user sudah login
if (!isset($_SESSION['user_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'Anda harus login terlebih dahulu.']);
    exit;
}

$userId = $_SESSION['user_id'];

// 3. Ambil data JSON yang dikirim oleh JavaScript
$input = json_decode(file_get_contents('php://input'), true);

// Pastikan data tidak kosong (meskipun false, tetap dianggap ada)
if (!isset($input['chat_enabled']) || !isset($input['auction_enabled']) || !isset($input['order_enabled'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Data tidak lengkap.']);
    exit;
}

// Konversi ke boolean (agar aman saat masuk DB)
// Filter var dengan FILTER_VALIDATE_BOOLEAN akan mengubah "true"/true/1 jadi TRUE, sisanya FALSE
$chatEnabled = filter_var($input['chat_enabled'], FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
$auctionEnabled = filter_var($input['auction_enabled'], FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
$orderEnabled = filter_var($input['order_enabled'], FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';

// 4. Koneksi Database
$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 5. Query "UPSERT" (Update jika ada, Insert jika belum ada)
    // Kita menggunakan ON CONFLICT (user_id) karena user_id adalah Primary Key di tabel Push_Preferences
    $sql = "
        INSERT INTO Push_Preferences (user_id, chat_enabled, auction_enabled, order_enabled, updated_at)
        VALUES (:user_id, :chat, :auction, :order, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            chat_enabled = EXCLUDED.chat_enabled,
            auction_enabled = EXCLUDED.auction_enabled,
            order_enabled = EXCLUDED.order_enabled,
            updated_at = CURRENT_TIMESTAMP
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':user_id' => $userId,
        ':chat'    => $chatEnabled,
        ':auction' => $auctionEnabled,
        ':order'   => $orderEnabled
    ]);

    echo json_encode(['success' => true, 'message' => 'Preferensi notifikasi berhasil disimpan.']);

} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
}
?>