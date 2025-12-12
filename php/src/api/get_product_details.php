<?php
session_start();

header('Content-Type: application/json');
$sessionRole = $_SESSION['role'] ?? 'guest';
$buyerId = $_SESSION['user_id'] ?? null;

$storeId = $_GET['store_id'] ?? null;
$productId = $_GET['product_id'] ?? null;

if(!$storeId || !is_numeric($storeId) || !$productId || !is_numeric($productId)){
    http_response_code(400);
    echo json_encode(['error'=>'Parameter store_id atau product_id tidak valid.']);
    exit;
}

$storeId=(int)$storeId;
$productId=(int)$productId;

$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // fetch product
    $stmt = $pdo->prepare("
         SELECT product_id, main_image_path, product_name, store_name, price, description, stock
         FROM product p JOIN store s ON p.store_id = s.store_id
         WHERE s.store_id = ?
         AND product_id = ?
         AND p.deleted_at IS NULL
    ");
    $stmt->execute([$storeId, $productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if(!$product){
        http_response_code(404); // Not Found
        echo json_encode(['error'=>'Produk tidak ditemukan!']);
        exit;
    }

    // product categories
    $catStmt = $pdo->prepare("
        SELECT DISTINCT category_id, name 
        FROM category NATURAL JOIN category_item
        WHERE product_id = ?
    ");
    $catStmt->execute([$productId]);
    $categories = $catStmt->fetchAll(PDO::FETCH_ASSOC);

    // store
    $storeStmt = $pdo->prepare("
        SELECT store_id, store_name, store_description
        FROM store
        WHERE store_id = ?
    ");
    $storeStmt->execute([$storeId]);
    $store = $storeStmt->fetch(PDO::FETCH_ASSOC);

    if(!$store){
        http_response_code(404);
        echo json_encode(['error'=>'Toko tidak ditemukan!']);
        exit;
    }
    // Cek apakah ada lelang yang statusnya 'active' atau 'scheduled' untuk produk ini
    $auctionStmt = $pdo->prepare("
        SELECT id, status, starting_price, current_price 
        FROM auctions 
        WHERE product_id = ? AND status IN ('active', 'scheduled')
        ORDER BY created_at DESC 
        LIMIT 1
    ");
    $auctionStmt->execute([$productId]);
    $auction = $auctionStmt->fetch(PDO::FETCH_ASSOC);
    // ambil cart hanya jika buyer login
    $cart = ['quantity' => 0]; // deafault utk guest
    if ($sessionRole==='BUYER' && $buyerId){
        $cartStmt = $pdo->prepare("
            SELECT quantity
            FROM cart_item
            WHERE buyer_id = ?
            AND product_id = ?
        ");
        $cartStmt->execute(([$buyerId , $productId]));
        $cartRes = $cartStmt->fetch(PDO::FETCH_ASSOC);
        if ($cartRes){
            $cart['quantity'] = (int)$cartRes['quantity'];
        }
    }

    echo json_encode([
        'session' => $sessionRole, //kirim guest atau buyer
        'product' => $product,
        'categories' => $categories,
        'store' => $store,
        'cart' => $cart,
        'auction' => $auction ?: null
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal mengambil detail produk: ' . $e->getMessage()]);
}
?>