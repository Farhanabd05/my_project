<?php

session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'BUYER') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Silakan login sebagai Buyer.']);
    exit;
}

$buyerId = $_SESSION['user_id'];

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

$response = ['success' => false, 'cart' => [], 'message' => '']; // respons default

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

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

    // ambil semua item keranjang, join produk & toko
    //ambil juga stok produk untuk validasi di frontend nanti
    $sql = '
        SELECT
            ci.cart_item_id,
            ci.quantity,
            p.product_id,
            p.product_name,
            p.price,
            p.stock,
            p.main_image_path AS thumbnail_path,
            s.store_id,
            s.store_name
        FROM Cart_Item ci
        JOIN Product p ON ci.product_id = p.product_id
        JOIN Store s ON p.store_id = s.store_id
        WHERE ci.buyer_id = ? AND p.deleted_at IS NULL
        ORDER BY s.store_id, p.product_id
    ';
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$buyerId]);
    $cartItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // kelompokkan item berdasarkan toko
    $storesData = [];
    foreach ($cartItems as $item) {
        $storeId = $item['store_id'];
        
        // byat "wadah" untuk toko ini jika belum ada
        if (!isset($storesData[$storeId])) {
            $storesData[$storeId] = [
                'store_id' => $storeId,
                'store_name' => $item['store_name'],
                'items' => []
            ];
        }
        
        // cek tipe data untuk JS
        $item['cart_item_id'] = (int)$item['cart_item_id'];
        $item['product_id'] = (int)$item['product_id'];
        $item['price'] = (int)$item['price'];
        $item['quantity'] = (int)$item['quantity'];
        $item['stock'] = (int)$item['stock'];
        
        $storesData[$storeId]['items'][] = $item;
    }

    $response['success'] = true;
    $response['cart'] = array_values($storesData); // kirim sebagai array of stores

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = 'Gagal mengambil data keranjang: ' . $e->getMessage();
}

echo json_encode($response);
?>