<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Akses ditolak.']);
    exit;
}
$sellerUserId = $_SESSION['user_id'];

$response = [
    'success' => false,
    'products' => [],
    'pagination' => null,
    'message' => ''
];

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmtStore = $pdo->prepare('SELECT store_id FROM Store WHERE user_id = ?');
    $stmtStore->execute([$sellerUserId]);
    $storeId = $stmtStore->fetchColumn();

    if (!$storeId) {
        throw new Exception('Toko tidak ditemukan.');
    }

    $searchTerm = isset($_GET['search']) ? trim($_GET['search']) : '';
    $categoryId = (isset($_GET['category']) && is_numeric($_GET['category'])) ? (int)$_GET['category'] : 0;
    $sortBy = isset($_GET['sort']) ? $_GET['sort'] : 'name_asc';
    
    $page = isset($_GET['page']) && is_numeric($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = 8; 
    $offset = ($page - 1) * $limit;

    $baseWhere = "p.store_id = ? AND p.deleted_at IS NULL"; 
    $params = [$storeId];
    
    if (!empty($searchTerm)) {
        $baseWhere .= " AND p.product_name ILIKE ?";
        $params[] = '%' . $searchTerm . '%';
    }
    
    $joinCategory = '';
    if ($categoryId > 0) {
        $joinCategory = " JOIN Category_Item ci ON p.product_id = ci.product_id";
        $baseWhere .= " AND ci.category_id = ?";
        $params[] = $categoryId;
    }

    $orderBy = " ORDER BY ";
    switch ($sortBy) {
        case 'price_asc':  $orderBy .= "p.price ASC"; break;
        case 'price_desc': $orderBy .= "p.price DESC"; break;
        case 'stock_asc':  $orderBy .= "p.stock ASC"; break;
        case 'stock_desc': $orderBy .= "p.stock DESC"; break;
        default:           $orderBy .= "p.product_name ASC";
    }

    $countSql = "SELECT COUNT(DISTINCT p.product_id) FROM Product p $joinCategory WHERE $baseWhere";
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($params);
    $totalProducts = (int)$stmtCount->fetchColumn();
    $totalPages = $totalProducts > 0 ? ceil($totalProducts / $limit) : 0;

    if ($page > $totalPages && $totalPages > 0) $page = $totalPages;
    $offset = ($page - 1) * $limit;
    if ($totalPages === 0) $page = 1;

    $dataSql = "SELECT p.product_id, p.product_name, p.price, p.stock, p.main_image_path, c.name as category_name, MAX(a.id) as auction_id 
                FROM Product p
                LEFT JOIN Category_Item ci ON p.product_id = ci.product_id
                LEFT JOIN Category c ON ci.category_id = c.category_id
                LEFT JOIN auctions a ON p.product_id = a.product_id 
                AND a.status IN ('active', 'scheduled') 
                WHERE $baseWhere
                GROUP BY p.product_id, c.name, p.product_name, p.price, p.stock, p.main_image_path
                $orderBy
                LIMIT ? OFFSET ?";
    
    $dataParams = array_merge($params, [$limit, $offset]);
    $stmtData = $pdo->prepare($dataSql);
    $stmtData->execute($dataParams);
    $products = $stmtData->fetchAll(PDO::FETCH_ASSOC);

    $response['success'] = true;
    $response['products'] = $products;
    $response['pagination'] = [
        'currentPage' => $page,
        'limit' => $limit,
        'totalProducts' => $totalProducts,
        'totalPages' => $totalPages
    ];
    
    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = 'Gagal mengambil data produk: ' . $e->getMessage();
    echo json_encode($response);
}
?>