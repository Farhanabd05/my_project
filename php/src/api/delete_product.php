<?php
session_start();
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya Seller.']);
    exit;
}
$sellerUserId = $_SESSION['user_id'];

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['product_id']) || !is_numeric($input['product_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Product ID tidak valid.']);
    exit;
}
$productId = (int)$input['product_id'];

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

    $sql = "UPDATE Product 
            SET deleted_at = CURRENT_TIMESTAMP 
            WHERE product_id = ? AND store_id = ? AND deleted_at IS NULL";

    $stmtDelete = $pdo->prepare($sql);
    $stmtDelete->execute([$productId, $storeId]);

    if ($stmtDelete->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Produk berhasil dihapus (soft delete).']);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Produk tidak ditemukan, bukan milik Anda, atau sudah dihapus sebelumnya.']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error database: ' . $e->getMessage()]);
    exit;
}
?>