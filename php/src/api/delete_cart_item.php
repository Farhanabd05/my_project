<?php

session_start();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'BUYER') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Silakan login sebagai Buyer.']);
    exit;
}

$buyerId = $_SESSION['user_id'];

// ambil cart_item_id dari data POST
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['cart_item_id']) || !is_numeric($input['cart_item_id'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'cart_item_id tidak valid.']);
    exit;
}
$cartItemId = (int)$input['cart_item_id'];

// konek db
$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

$response = ['success' => false, 'message' => ''];

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT is_enabled, reason FROM feature_access WHERE user_id IS NULL AND feature_name = 'checkout_enabled' LIMIT 1");
    $stmt->execute();
    $feature = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$feature || !$feature['is_enabled']) {
        throw new Exception('Feature disabled: ' . $feature['reason']);
    }

    $stmt = $pdo->prepare("SELECT is_enabled, reason FROM feature_access WHERE user_id = ? AND feature_name = 'checkout_enabled' LIMIT 1");
    $stmt->execute([$buyerId]);
    $feature = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$feature || !$feature['is_enabled']) {
        throw new Exception('Feature disabled: ' . $feature['reason']);
    }

    // hapus item milik buyer yg login
    $stmt = $pdo->prepare('
        DELETE FROM Cart_Item 
        WHERE cart_item_id = ? AND buyer_id = ?
    ');
    $stmt->execute([$cartItemId, $buyerId]);

    // cek adakah baris yang terhapus
    if ($stmt->rowCount() === 0) {
        // init terjadi jika cart_item_id tidak ada, atau bukan milik buyer ini
        throw new Exception('Item keranjang tidak ditemukan atau bukan milik Anda.');
    }

    // itung ulang jumlah item unik di keranjang
    $countStmt = $pdo->prepare("SELECT COUNT(DISTINCT product_id) FROM cart_item WHERE buyer_id = ?");
    $countStmt->execute([$buyerId]);
    $cartCount = (int)$countStmt->fetchColumn();

    $pdo->commit();

    $response['success'] = true;
    $response['message'] = 'Item berhasil dihapus dari keranjang.';
    $response['cartCount'] = $cartCount; // kirim count baru

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    $response['message'] = 'Gagal menghapus item: ' . $e->getMessage();
}

echo json_encode($response);
?>