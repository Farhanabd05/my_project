<?php
session_start();
header('Content-Type: application/json');

$response = ['success' => false, 'orders' => [], 'message' => ''];

// Cek role buyer
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'BUYER') {
    http_response_code(403);
    $response['message'] = 'Akses ditolak.';
    echo json_encode($response);
    exit;
}

$buyerId = $_SESSION['user_id'];

// Koneksi DB
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
    
    // Ambil filter status dari parameter GET
    $statusFilter = isset($_GET['status']) ? $_GET['status'] : 'all';
    $validStatuses = ['waiting_approval', 'approved', 'rejected', 'on_delivery', 'received'];
    
    $sqlWhereStatus = '';
    $params = [$buyerId];

    if (in_array($statusFilter, $validStatuses)) {
        $sqlWhereStatus = 'AND o.status = ?';
        $params[] = $statusFilter;
    }

    $sql = "
        SELECT
            o.order_id, o.created_at, o.total_price, o.status, o.delivery_time,
            o.shipping_address, o.reject_reason,
            s.store_name,
            oi.quantity, oi.price_at_order,
            p.product_name, p.main_image_path
        FROM \"Order\" o
        JOIN Store s ON o.store_id = s.store_id
        JOIN Order_Items oi ON o.order_id = oi.order_id
        JOIN Product p ON oi.product_id = p.product_id
        WHERE o.buyer_id = ? {$sqlWhereStatus}
        ORDER BY o.created_at DESC, o.order_id;
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $orders = [];
    foreach ($results as $row) {
        $orderId = $row['order_id'];
        if (!isset($orders[$orderId])) {
            $orders[$orderId] = [
                'order_id' => $orderId,
                'created_at' => $row['created_at'],
                'total_price' => $row['total_price'],
                'status' => $row['status'],
                'delivery_time' => $row['delivery_time'],
                'shipping_address' => $row['shipping_address'], 
                'reject_reason' => $row['reject_reason'],    
                'store_name' => $row['store_name'],
                'items' => []
            ];
        }
        $orders[$orderId]['items'][] = [
            'product_name' => $row['product_name'],
            'quantity' => $row['quantity'],
            'price_at_order' => $row['price_at_order'],
            'main_image_path' => $row['main_image_path']
        ];
    }
    
    $response['success'] = true;
    $response['orders'] = array_values($orders);

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = 'Gagal mengambil data riwayat: ' . $e->getMessage();
}

echo json_encode($response);
?>