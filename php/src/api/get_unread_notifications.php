<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false]);
    exit;
}

$userId = $_SESSION['user_id'];
// ... (Koneksi DB seperti biasa) ...
$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try {
    $pdo = new PDO($dsn);

    // Ambil notif belum dibaca
    $stmt = $pdo->prepare("SELECT * FROM Notifications WHERE user_id = ? AND is_read = FALSE AND type = 'order' ORDER BY created_at DESC");
    $stmt->execute([$userId]);
    $notifs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Tandai sudah "diambil" (bisa diubah logicnya: tandai read saat diklik)
    // Untuk simpelnya, kita anggap sudah terkirim (delivered) ke frontend
    if(count($notifs) > 0) {
        $ids = array_column($notifs, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $updateStmt = $pdo->prepare("UPDATE Notifications SET is_read = TRUE WHERE id IN ($placeholders)");
        $updateStmt->execute($ids);
    }

    echo json_encode(['success' => true, 'notifications' => $notifs]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>