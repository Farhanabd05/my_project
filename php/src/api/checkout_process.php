<?php

session_start();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if ($_SESSION['role'] !== 'BUYER') {
    http_response_code(403); // forbidden
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya Buyer yang bisa konfirmasi.']);
    exit;
}
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['shipping_address'])) {
    echo json_encode(['success' => false, 'message' => 'Alamat pengiriman tidak valid.']);
    exit;
}

$shippingAddress = $input['shipping_address'];
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


    $sql = '
        SELECT
            ci.cart_item_id,
            ci.quantity,
            p.product_id,
            p.product_name,
            p.price,
            p.stock,
            p.store_id,
            s.store_name
        FROM Cart_Item ci
        JOIN Product p ON ci.product_id = p.product_id
        JOIN Store s ON p.store_id = s.store_id
        WHERE ci.buyer_id = ? AND p.deleted_at IS NULL
        FOR UPDATE OF p, ci -- Kunci baris di tabel Product dan Cart_Item
    ';
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$buyerId]);
    $cartItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($cartItems)) {
        throw new Exception('Keranjang Anda kosong.');
    }

    $storesData = [];
    $allCartItemIds = [];
    foreach ($cartItems as $item) {
        $storeId = $item['store_id'];
        
        if (!isset($storesData[$storeId])) {
            $storesData[$storeId] = [
                'store_id' => $storeId,
                'store_name' => $item['store_name'],
                'items' => []
            ];
        }
        
        $storesData[$storeId]['items'][] = $item;
        
        $allCartItemIds[] = $item['cart_item_id'];
    }

    $grandTotal = 0;

    foreach ($storesData as $store) {
        $storeTotalPrice = 0;
        $orderItemsData = []; 

        foreach ($store['items'] as $item) {
            
            if ($item['stock'] < $item['quantity']) {
                throw new Exception('Stok untuk produk ' . $item['product_name'] . ' tidak mencukupi.');
            }

            $priceFromDb = (int)$item['price'];
            $itemSubtotal = $priceFromDb * (int)$item['quantity'];
            $storeTotalPrice += $itemSubtotal;

            $stmt = $pdo->prepare('UPDATE Product SET stock = stock - ? WHERE product_id = ?');
            $stmt->execute([$item['quantity'], $item['product_id']]);

            $orderItemsData[] = [
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'price_at_order' => $priceFromDb,
                'subtotal' => $itemSubtotal
            ];
        }

        $stmt = $pdo->prepare(
            'INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status) 
            VALUES (?, ?, ?, ?, ?) RETURNING order_id' 
        );
        $stmt->execute([$buyerId, $store['store_id'], $storeTotalPrice, $shippingAddress, 'waiting_approval']);
        $orderId = $stmt->fetchColumn();

        foreach ($orderItemsData as $orderItem) {
            $stmt = $pdo->prepare(
                'INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $orderId, 
                $orderItem['product_id'], 
                $orderItem['quantity'], 
                $orderItem['price_at_order'], 
                $orderItem['subtotal']
            ]);
        }
        
        $grandTotal += $storeTotalPrice;
    }

    $stmt = $pdo->prepare('SELECT balance FROM Users WHERE user_id = ? FOR UPDATE');
    $stmt->execute([$buyerId]);
    $buyerBalance = (int)$stmt->fetchColumn();

    if ($buyerBalance < $grandTotal) {
        throw new Exception('Saldo Anda tidak mencukupi untuk transaksi ini.');
    }

    $stmt = $pdo->prepare('UPDATE Users SET balance = balance - ? WHERE user_id = ?');
    $stmt->execute([$grandTotal, $buyerId]);
    
    
    if (count($allCartItemIds) > 0) {
        $placeholders = implode(',', array_fill(0, count($allCartItemIds), '?'));
        
        $stmt = $pdo->prepare("DELETE FROM Cart_Item WHERE buyer_id = ? AND cart_item_id IN ($placeholders)");
        
        $params = array_merge([$buyerId], $allCartItemIds);
        
        $stmt->execute($params);
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Checkout berhasil diproses!']);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>