<?php

session_start();

if ($_SESSION['role'] !== 'BUYER') {
http_response_code(403); // forbidden
echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya Buyer yang bisa konfirmasi.']);
exit;
}


// jika lolos, ambil user_id asli
$buyerId = $_SESSION['user_id'];

$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

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

    $stmt = $pdo->prepare('SELECT address, balance FROM Users WHERE user_id = ?');
    $stmt->execute([$buyerId]);
    $buyerInfo = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$buyerInfo) {
        throw new Exception('Buyer tidak ditemukan.');
    }

    $sql = '
        SELECT
            ci.cart_item_id,
            ci.quantity,
            p.product_id,
            p.product_name,
            p.price,
            p.stock,
            p.store_id,
            s.store_name,
            p.main_image_path AS thumbnail_path -- Ganti nama kolom agar konsisten
        FROM Cart_Item ci
        JOIN Product p ON ci.product_id = p.product_id
        JOIN Store s ON p.store_id = s.store_id
        WHERE ci.buyer_id = ? AND p.deleted_at IS NULL
    ';
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$buyerId]);
    $cartItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $storesData = [];
    foreach ($cartItems as $item) {
        $storeId = $item['store_id'];
        if (!isset($storesData[$storeId])) {
            $storesData[$storeId] = [
                'store_id' => $storeId,
                'store_name' => $item['store_name'],
                'items' => []
            ];
        }
        $item['price'] = (int)$item['price'];
        $item['quantity'] = (int)$item['quantity'];
        $storesData[$storeId]['items'][] = $item;
    }

    $checkoutData = [
        'stores' => array_values($storesData), 
        'buyer_info' => [
            'address' => $buyerInfo['address'],
            'current_balance' => (int)$buyerInfo['balance']
        ]
    ];

    echo json_encode($checkoutData);

} catch (Exception $e) {
    http_response_code(500);  
    echo json_encode(['success' => false, 'message' => 'Gagal mengambil data checkout: ' . $e->getMessage()]);
}
?>