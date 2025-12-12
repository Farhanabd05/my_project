<?php
  session_start();

  header('Content-Type: application/json');

  // cek role
  if ($_SESSION['role'] !== 'SELLER') {
      http_response_code(403);
      echo json_encode(['success' => false, 'message' => 'Akses ditolak.']);
      exit;
  }

  $sellerUserId = $_SESSION['user_id'];
  $stats = []; //aray utk nympen hasil
  
  //konek db
  $host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
  $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

  try{
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // dapetin info toko
    $stmt=$pdo->prepare('SELECT store_id, store_name, store_description, balance FROM Store WHERE user_id=?');
    $stmt->execute([$sellerUserId]);
    $storeInfo = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$storeInfo) {
        throw new Exception('toko tidak ditemukan untuk seller ini.');
    }
    $storeId = $storeInfo['store_id'];
    $stats['store_info'] = $storeInfo; // simpan info toko

    // itung total produk unik (tdk termasuk yg soft deleted)
    $stmt=$pdo->prepare('SELECT COUNT(product_id) FROM Product WHERE store_id = ? AND deleted_at  IS NULL');
    $stmt->execute([$storeId]);
    $stats['total_products']=(int)$stmt->fetchColumn();

    // itung pending orders (waiting_approval ATAU approved)
    $stmt = $pdo->prepare('SELECT COUNT(order_id) FROM "Order" WHERE store_id = ? AND status IN (?, ?)');
    $stmt->execute([$storeId, 'waiting_approval', 'approved']);
    $stats['pending_orders'] = (int)$stmt->fetchColumn();

    // itung produk stok menipis (< 10 dan tidak soft deleted)
    $stmt = $pdo->prepare('SELECT COUNT(product_id) FROM Product WHERE store_id = ? AND stock < 10 AND deleted_at IS NULL');
    $stmt->execute([$storeId]);
    $stats['low_stock_products'] = (int)$stmt->fetchColumn();

    // itung total pesanan yang sudah diterima
    $stmt = $pdo->prepare('SELECT COUNT(order_id) FROM "Order" WHERE store_id = ? AND status = ?');
    $stmt->execute([$storeId, 'received']);
    $stats['completed_orders'] = (int)$stmt->fetchColumn();

    // itung produk stok habis (stock = 0 dan tidak soft deleted)
    $stmt = $pdo->prepare('SELECT COUNT(product_id) FROM Product WHERE store_id = ? AND stock = 0 AND deleted_at IS NULL');
    $stmt->execute([$storeId]);
    $stats['out_of_stock_products'] = (int)$stmt->fetchColumn();

    // itung total pesanan yang dibatalkan
    $stmt = $pdo->prepare('SELECT COUNT(order_id) FROM "Order" WHERE store_id = ? AND status = ?');
    $stmt->execute([$storeId, 'rejected']);
    $stats['rejected_orders'] = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT COUNT(order_id) FROM "Order" WHERE store_id = ? AND status = ?');
    $stmt->execute([$storeId, 'on_delivery']);
    $stats['on_delivery_orders'] = (int)$stmt->fetchColumn();

    // itung total pelanggan unik (berdasarkan order yang masuk)
    $stmt = $pdo->prepare('SELECT COUNT(DISTINCT buyer_id) FROM "Order" WHERE store_id = ?');
    $stmt->execute([$storeId]);
    $stats['total_customers'] = (int)$stmt->fetchColumn();
    
    echo json_encode(['success' => true, 'stats' => $stats]);
  }catch(Exception $e){
    http_response_code(500); // error server
    echo json_encode(['success' => false, 'message' => 'Gagal mengambil data dashboard: ' . $e->getMessage()]);
  }
?>