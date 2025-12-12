<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya Seller.']);
    exit;
}
$sellerUserId = $_SESSION['user_id'];

if (!isset($_GET['product_id']) || !is_numeric($_GET['product_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Product ID tidak valid.']);
    exit;
}
$productId = (int)$_GET['product_id'];

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";
$storeId = null;

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmtStore = $pdo->prepare('SELECT store_id FROM Store WHERE user_id = ?');
    $stmtStore->execute([$sellerUserId]);
    $storeId = $stmtStore->fetchColumn();

    if (!$storeId) {
        throw new Exception("Toko Anda tidak ditemukan.");
    }

    $sql = "SELECT
                p.product_id, p.product_name, p.description, p.price, p.stock, p.main_image_path,
                ci.category_id
            FROM Product p
            LEFT JOIN Category_Item ci ON p.product_id = ci.product_id
            WHERE p.product_id = ? AND p.store_id = ? AND p.deleted_at IS NULL";

    $stmtProduct = $pdo->prepare($sql);
    $stmtProduct->execute([$productId, $storeId]);
    $productData = $stmtProduct->fetch(PDO::FETCH_ASSOC);

    if (!$productData) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Produk tidak ditemukan atau bukan milik Anda.']);
        exit;
    }

    echo json_encode($productData);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
    exit;
}
?>