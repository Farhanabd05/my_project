<?php
session_start();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}
// Hapus Subscription dari Database sebelum hancurkan session
if (isset($_SESSION['user_id'])) {
    $userId = $_SESSION['user_id'];
    
    // Konfigurasi Database (Copy dari file lain)
    $host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";
    
    try {
        $pdo = new PDO($dsn);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // Hapus SEMUA subscription milik user ini agar tidak bocor di device manapun (biar pas logout notif gk bocor)
        $stmt = $pdo->prepare("DELETE FROM Push_Subscriptions WHERE user_id = ?");
        $stmt->execute([$userId]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
    }
}

// 2. Hancurkan Session PHP
session_unset();
session_destroy();
header('Content-Type: application/json');
echo json_encode([
    'success' => true, 
    'message' => 'Anda telah berhasil logout.'
]);
?>