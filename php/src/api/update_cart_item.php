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
    echo json_encode(['success' => false, 'message' => 'Akses ditolak.']);
    exit;
}

// parse the data
$input = json_decode(file_get_contents('php://input'), true);
$buyerId = $_SESSION['user_id'];
$productId = $input['product_id'] ?? null;
 $quantity = $input['quantity'] ?? null;
if ($productId === null || !is_numeric($productId) || $quantity === null || !is_numeric($quantity) || $quantity < 0){
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Product ID atau Quantity tidak valid']);
}

$productId = $input['product_id'];
$quantity = $input['quantity'];

$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // cek stok dan transaksi
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT is_enabled, reason FROM feature_access WHERE user_id IS NULL AND feature_name = 'checkout_enabled' LIMIT 1");
    $stmt->execute();
    $feature = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$feature || !$feature['is_enabled']) {
        http_response_code(201);
        echo json_encode(['success' => false, 'message' => $feature['reason']]);
        exit;
    }

    $stmt = $pdo->prepare("SELECT is_enabled, reason FROM feature_access WHERE user_id = ? AND feature_name = 'checkout_enabled' LIMIT 1");
    $stmt->execute([$buyerId]);
    $feature = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$feature || !$feature['is_enabled']) {
        http_response_code(201);
        echo json_encode(['success' => false, 'message' => $feature['reason']]);
        exit;
    }

    // cek apakah product ada dan stok cukup ?
    if ($quantity>0){
        // for update buat ngunci relasinya, biar gk bisa diubah proses lain
        $stockStmt = $pdo->prepare("SELECT stock FROM Product WHERE product_id = ? AND deleted_at IS NULL FOR UPDATE");
        $stockStmt->execute([$productId]);
        $stock = $stockStmt->fetchColumn();
        if ($stock ===false){
            throw new Exception('Produk tidak ditemukan.');
        }
        if($quantity > $stock){
            throw new Exception("Stock produk tidak mencukupi (tersedia: $stock).");
        }
    }
    $checkStmt = $pdo->prepare("
        SELECT cart_item_id 
        FROM cart_item
        WHERE buyer_id = ? AND product_id = ?
    ");
    $checkStmt->execute([$buyerId, $productId]);
    $isExist = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if($quantity==0){
        $deleteStmt = $pdo->prepare("
        DELETE FROM cart_item
        WHERE buyer_id = ? AND product_id = ?
    ");
    $deleteStmt->execute([$buyerId, $productId]);
    $message = 'Item dihapus dari keranjang.';
    } else if($isExist){
        $updateStmt = $pdo->prepare("
            UPDATE cart_item
            SET quantity = ?, updated_at = NOW()
            WHERE buyer_id = ? AND product_id = ?
        ");
        $updateStmt->execute([$quantity, $buyerId, $productId]);
        $message = 'Jumlah item di keranjang diperbarui.';
    } else{
        $insertStmt = $pdo->prepare("
            INSERT INTO cart_item (buyer_id, product_id, quantity)
            VALUES (?, ?, ?)
        ");
        $insertStmt->execute([$buyerId, $productId, $quantity]);
        $message = 'Item ditambahkan ke keranjang.';
    }
    // ambil cart count baru
    $countStmt = $pdo->prepare("SELECT COUNT(DISTINCT product_id) FROM cart_item WHERE buyer_id = ?");
    $countStmt->execute([$buyerId]);
    $cartCount = (int)$countStmt->fetchColumn();

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => $message, 'cartCount' => $cartCount]);
} catch (Exception $e) {
    if ($pdo->inTransaction()){
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Gagal memperbarui keranjang: ' . $e->getMessage()]);
}
?>