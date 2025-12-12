<?php
session_start();
header('Content-Type: application/json');

$id = $_SESSION['user_id'] ?? null;
$cardsPerPage = $_SESSION['cardsPerPage'] ?? 8;
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1; // menyatakan sekarang lagi di halaman ke berapa

$categories = [];
$selectedCategories = $_GET['categories'] ?? [];
$categoryFilter='';

$search = $_GET['search'] ?? '';

$min = $_GET['min'] ?? 0;
$max = $_GET['max'] ?? 100000000;
$offset = max((($page-1) * $cardsPerPage), 0);

// Validation
if(!is_numeric($min)) $min = 0;
if(!is_numeric($max)) $max = 100000000;
if(!is_numeric($page)) $page = 1;

$min = (int)$min;
$max = (int)$max;
$page = max(1, (int)$page);

if($min<0) $min = 0;
if($max<$min) $max = $min + 1;
if($max>999999999) $max = 999999999;

// parameters for sql query
$params = [$min, $max];
$searchFilter = ''; // filter untuk pencarian FTS
$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // fetch kategori
    $catStmt = $pdo->query('SELECT DISTINCT category_id, name FROM category');
    $categories = $catStmt->fetchAll(PDO::FETCH_ASSOC);


    // search & filter
    if(!empty($selectedCategories)){
        $placeholder = implode(',', array_fill(0, count($selectedCategories), '?'));
        $categoryFilter = "AND p.product_id IN (SELECT ci.product_id FROM category_item ci WHERE ci.category_id IN ($placeholder))";
        $params = array_merge($params, $selectedCategories);
    }

    if (!empty($search)) {
        // pake fts
        $searchFilter = "AND p.search_vector @@ plainto_tsquery('english', ?)";
        $params[] = $search;
    }    
    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM product p JOIN store s ON p.store_id = s.store_id
        WHERE price BETWEEN ? AND ?
        $categoryFilter
        $searchFilter 
    ");
    $countStmt->execute($params);
    $totalProducts = $countStmt->fetchColumn() ?? 0;
    $totalPages = ceil($totalProducts/$cardsPerPage);
    $page = min($page, $totalPages);
    $offset = max((($page-1) * $cardsPerPage), 0);

    $params[] = $cardsPerPage;
    $params[] = $offset;
    $stmt = $pdo->prepare("
        SELECT s.store_id, product_id, main_image_path, product_name, price, store_name, p.stock
        FROM product p JOIN store s ON p.store_id = s.store_id
        WHERE price BETWEEN ? AND ?
        $categoryFilter
        $searchFilter 
        LIMIT ? OFFSET ?
    ");
    

    $stmt->execute($params);
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'products' => $products,
        'categories' => $categories,
        'totalProducts' => $totalProducts,
        'totalPages' => $totalPages,
        'currentPage' => $page,
        'cardsPerPage' => $cardsPerPage,
    ]);
} catch (Exception $e) {
    http_response_code(500); // internal server error
    echo json_encode(['success' => false, 'message' => 'Gagal memuat produk: ' . $e->getMessage()]);
}
?>