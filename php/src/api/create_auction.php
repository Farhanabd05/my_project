<?php
session_start();
header('Content-Type: application/json');

// Check if user is logged in and is a seller
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$product_id = $data['product_id'] ?? null;
$starting_price = $data['starting_price'] ?? null;
$start_time = $data['start_time'] ?? null;
$end_time = $data['end_time'] ?? null;
$quantity = isset($data['quantity']) ? intval($data['quantity']) : 1;
$minIncrement = isset($data['min_increment']) ? floatval($data['min_increment']) : 10000;

// Validation
if (!$product_id || !$starting_price || !$start_time || !$end_time) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

// Database connection
$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->beginTransaction();
    // Verify product belongs to this seller
    $stmt = $pdo->prepare("SELECT store_id FROM Product WHERE product_id = ?");
    $stmt->execute([$product_id]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$product) {
        throw new Exception('Product not found');
    }
    
    // Verify seller owns this product
    $stmt = $pdo->prepare("SELECT store_id FROM Store WHERE user_id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $store = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($store['store_id'] != $product['store_id']) {
        throw new Exception('Unauthorized - product does not belong to your store');
    }

    $stmtStock = $pdo->prepare("SELECT stock FROM Product WHERE product_id = ?");
    $stmtStock->execute([$product_id]);
    $productData = $stmtStock->fetch(PDO::FETCH_ASSOC);

    if (!$productData) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Produk tidak ditemukan.']);
        exit;
    }

    if ($productData['stock'] < $quantity) {
        http_response_code(400);
        echo json_encode([
            'success' => false, 
            'message' => "Stok tidak cukup! Stok saat ini: " . $productData['stock']
        ]);
        exit;
    }

    // cek apakah ada jadwal lelang lain yang bentrok di rentang waktu ini
    // logika Overlap: (Start Baru < End Lama) DAN (End Baru > Start Lama)
    $stmtCheck = $pdo->prepare("
        SELECT COUNT(*) 
        FROM auctions 
        WHERE seller_id = ? 
        AND status IN ('active', 'scheduled')
        AND (start_time < ? AND end_time > ?)
    ");

    $stmtCheck->execute([
        $_SESSION['user_id'], 
        $end_time,   // end time dari input user
        $start_time  // start time dari input user
    ]);

    if ($stmtCheck->fetchColumn() > 0) {
        http_response_code(400); // Bad Request
        echo json_encode(['success' => false, 'message' => 'Jadwal bentrok dengan lelang Anda yang lain.']);
        exit;
    }
    // Insert auction
    $stmt = $pdo->prepare("
        INSERT INTO auctions (product_id, seller_id, starting_price, current_price, status, start_time, end_time, created_at, quantity, min_increment)
        VALUES (?, ?, ?, ?, 'scheduled', ?, ?, NOW(), ?, ?)
    ");
    
    $stmt->execute([
        $product_id,
        $_SESSION['user_id'],
        $starting_price,
        $starting_price,
        $start_time,
        $end_time,
        $quantity,
        $minIncrement
    ]);
    
    $auction_id = $pdo->lastInsertId();
    // POTONG STOK LANGSUNG DI SINI
    $stmtUpdate = $pdo->prepare("UPDATE Product SET stock = stock - ? WHERE product_id = ?");
    $stmtUpdate->execute([$quantity, $product_id]);

    $pdo->commit();
    // beri jeda 0.5 detik agar DB sempat commit sebelum dibaca Node.js
    usleep(500000);
    // panggil node js untuk broadcast update, biar gk perlu refresh manual
    $ch = curl_init('http://nodejs:3001/internal/trigger-refresh');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT_MS, 500); 
    curl_exec($ch);
    curl_close($ch);
    echo json_encode([
        'success' => true,
        'message' => 'Auction created successfully',
        'auction_id' => $auction_id
    ]);
    
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}
?>