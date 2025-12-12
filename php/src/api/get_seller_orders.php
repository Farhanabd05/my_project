<?php
// mock data
session_start();

header('Content-Type: application/json');

// cek role
if ($_SESSION['role'] !== "SELLER"){
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Akses Ditolak']);
  exit;
}

$sellerUserId = $_SESSION['user_id'];
$response = [
    'success' => false,
    'orders' => [],
    'pagination' => null,
    'message' => ''
];

// 1. konek ke db
$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try{
  $pdo =new PDO($dsn);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $stmt = $pdo->prepare("SELECT is_enabled, reason FROM feature_access WHERE user_id IS NULL AND feature_name = 'checkout_enabled' LIMIT 1");
  $stmt->execute();
  $feature = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$feature || !$feature['is_enabled']) {
      http_response_code(201);
      echo json_encode(['success' => false, 'message' => $feature['reason']]);
      exit;
  }

  $stmt = $pdo->prepare("SELECT is_enabled, reason FROM feature_access WHERE user_id = ? AND feature_name = 'checkout_enabled' LIMIT 1");
  $stmt->execute([$sellerUserId]);
  $feature = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$feature || !$feature['is_enabled']) {
      http_response_code(201);
      echo json_encode(['success' => false, 'message' => $feature['reason']]);
      exit;
  }

  // 2. dapetin store id seller yg lg login
  $stmt=$pdo->prepare('SELECT store_id FROM Store WHERE user_id = ?');
  $stmt->execute([$sellerUserId]);
  $storeId =$stmt->fetchColumn();

  // 3. ambil filter status dari param GET (jika ada)
  $statusFilter = isset($_GET['status']) ? $_GET['status'] : 'all';
  $page = isset($_GET['page']) && is_numeric($_GET['page']) ? max(1, (int)$_GET['page']) : 1; // Halaman saat ini, min 1
  $limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? max(4, (int)$_GET['limit']) : 8; // Item per halaman (default 8, min 4)
  $offset = ($page - 1) * $limit; // Hitung offset
  $searchTerm = isset($_GET['search']) ? trim($_GET['search']) : '';
  
  $validStatuses = ['waiting_approval', 'approved', 'rejected', 'on_delivery', 'received'];
  $sqlBaseWhere ='o.store_id = ?';
  $countParams = [$storeId]; // param untuk query COUNT
  $dataParams = [$storeId]; // param untuk query data utama

  if (in_array($statusFilter,$validStatuses )){
    $sqlBaseWhere .= ' AND o.status = ?';
    $countParams[] = $statusFilter; 
    $dataParams[] = $statusFilter;
  }
    
  $sqlSearchCondition='';
  if(!empty($searchTerm)){
    // cari di order_id (cast ke text) atau nama buyer (case insensitive)
    $sqlSearchCondition = ' AND (CAST(o.order_id AS TEXT) LIKE ? OR LOWER(u.name) LIKE ?)';
    $searchPattern = '%' . strtolower($searchTerm) . '%';
    // tambahin dua kali karena ada dua placeholder di SQL di atas
    $countParams[]=$searchPattern;
    $countParams[]=$searchPattern;
    $dataParams[]=$searchPattern;
    $dataParams[]=$searchPattern;
  }
    // 3b. itung TOTAL pesanan yang cocok dengan filter (TANPA LIMIT/OFFSET)
    $countJoin = !empty($searchTerm) ? ' JOIN Users u ON o.buyer_id = u.user_id' : '';
    $countSql = "SELECT COUNT(DISTINCT o.order_id) FROM \"Order\" o {$countJoin} WHERE {$sqlBaseWhere} {$sqlSearchCondition}";
    
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($countParams);
    $totalOrders = (int)$stmtCount->fetchColumn();
    $totalPages = $totalOrders > 0 ? ceil($totalOrders / $limit) : 0; // indari div by nol
    
    if($page > $totalPages && $totalPages > 0){
      $page = $totalPages;
      $offset = ($page - 1) * $limit;
    } elseif ($totalPages ===0){
      $page = 1;
      $offset = 0;
    }
    // 4. Query utama untuk mengambil data pesanan (DENGAN LIMIT/OFFSET)
    //    Kita butuh subquery atau GROUP BY untuk pagination yang benar jika join ke Order_Items
    //    Cara lebih mudah: Ambil dulu ID order yang sesuai halaman, baru join item
    
    // 4a. ambl Order ID untuk halaman saat ini
    $orderIdJoin = !empty($searchTerm) ? ' JOIN Users u ON o.buyer_id = u.user_id' : '';
    $orderIdSql = "
        SELECT o.order_id 
        FROM \"Order\" o {$orderIdJoin}
        WHERE {$sqlBaseWhere} {$sqlSearchCondition}
        ORDER BY o.created_at DESC, o.order_id
        LIMIT ? OFFSET ? 
    ";
    // tambain LIMIT dan OFFSET ke param data
    $dataParams[] = $limit;
    $dataParams[] = $offset;
    
    $stmtOrderIds = $pdo->prepare($orderIdSql);
    $stmtOrderIds->execute($dataParams);
    $orderIdsOnPage = $stmtOrderIds->fetchAll(PDO::FETCH_COLUMN); // Ambil hanya kolom order_id

    $orders = []; // Reset array orders
    
    // 4b. jika ada order di halaman ini, ambil detailnya
    if (!empty($orderIdsOnPage)) {
      // vuat placeholder (?,?,?) untuk IN clause
      $placeholders = implode(',', array_fill(0, count($orderIdsOnPage), '?'));
      
      $detailsSql = "
            SELECT
                o.order_id, o.created_at, o.total_price, o.status, o.delivery_time, o.reject_reason, o.shipping_address, 
                u.name AS buyer_name,
                oi.quantity, oi.price_at_order,
                p.product_name, p.main_image_path
            FROM \"Order\" o
            JOIN Users u ON o.buyer_id = u.user_id
            JOIN Order_Items oi ON o.order_id = oi.order_id
            JOIN Product p ON oi.product_id = p.product_id
            WHERE o.order_id IN ({$placeholders}) -- Filter berdasarkan ID di halaman ini
            ORDER BY o.created_at DESC, o.order_id, oi.order_item_id; -- Urutkan lagi
        ";
        
      $stmtDetails = $pdo->prepare($detailsSql);
      $stmtDetails->execute($orderIdsOnPage); // gunakan array ID sebagai param
      $results = $stmtDetails->fetchAll(PDO::FETCH_ASSOC);

      foreach ($results as $row) {
            $orderId = $row['order_id'];
            if (!isset($orders[$orderId])) {
              $orders[$orderId] = [
                'order_id' => $orderId,
                'created_at' => $row['created_at'],
                'total_price' => $row['total_price'],
                'status' => $row['status'],
                'buyer_name' => $row['buyer_name'],
                'delivery_time' => $row['delivery_time'], // Kirim delivery_time
                'reject_reason' => $row['reject_reason'],
                'shipping_address' => $row['shipping_address'],
                'items' => []
              ];
            }
            $orders[$orderId]['items'][]= [
               'product_name' => $row['product_name'],
               'quantity' => $row['quantity'],
               'price_at_order' => $row['price_at_order'],
               'main_image_path' => $row['main_image_path']
            ];
        }
  }
  $response['success'] = true;
  $response['orders'] = array_values($orders); // re-index array
  $response['pagination'] = [
      'currentPage' => $page,
      'limit' => $limit,
      'totalOrders' => $totalOrders,
      'totalPages' => $totalPages
    ];
  echo json_encode($response);
} catch (Exception $e) {
  http_response_code(500);
  $response['message'] = 'Gagal mengambil data pesanan: ' . $e->getMessage();
  echo json_encode($response);
}
?>