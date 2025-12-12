<?php
session_start();
include '../utils/notif_helper.php'; 
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if($_SESSION['role']!=='SELLER'){
  http_response_code(403);
  echo json_encode(['success'=>false, 'message' => 'Akses Ditolak.']);
  exit;
}

// ambil order id dari data POST
$input = json_decode(file_get_contents('php://input'), true);
if(!$input || !isset($input['order_id']) || !is_numeric($input['order_id'])){
  http_response_code(400);
  echo json_encode(['success'=>false, 'message'=> 'Order ID tidak valid.']);
  exit;
}
$orderId=(int)$input['order_id'];
$sellerUserId=$_SESSION['user_id'];

// konek ke db
$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try{
  $pdo=new PDO($dsn);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // mulai transaksi
  $pdo->beginTransaction();

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

  // dapetin store_id milik seller yang login
  $stmt=$pdo->prepare('SELECT store_id FROM Store WHERE user_id = ?');
  $stmt->execute([$sellerUserId]);
  $storeId = $stmt->fetchColumn();

  if(!$storeId){
    throw new Exception('Toko tidak ditemukan untuk seller ini');
  }

  // verif: apakah order ini milik toko sller dan sstatusnya waiting approval?
  // for update digunain buat ngunci, agar tidk bisa diubah proses lain
  $stmt = $pdo->prepare('SELECT status, buyer_id FROM "Order" WHERE order_id = ? AND store_id = ? FOR UPDATE');
  $stmt->execute([$orderId, $storeId]);
  $orderData = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$orderData) {
      throw new Exception('Pesanan tidak ditemukan atau bukan milik toko Anda');
  }
  $currentStatus = $orderData['status'];
  $buyerId = $orderData['buyer_id'];
  if($currentStatus!=='waiting_approval'){
    throw new Exception('Hanya pesanan dengan status "Waiting Approval" yang bisa disetujui');
  }

  // update status order jadi approved dan set confirmed at
  $stmt = $pdo->prepare('UPDATE "Order" SET status = ?, confirmed_at = CURRENT_TIMESTAMP WHERE order_id = ?');
  $stmt->execute(['approved', $orderId]);
  
  try {
      $notifTitle = "Pesanan Disetujui! 🎉";
      $notifMsg = "Penjual telah menerima pesanan #$orderId Anda. Mohon tunggu pengiriman.";
      $notifUrl = "http://localhost:8082/order_history.php";

      $stmtNotif = $pdo->prepare("INSERT INTO Notifications (user_id, title, message, url) VALUES (?, ?, ?, ?)");
      $stmtNotif->execute([$buyerId, $notifTitle, $notifMsg, $notifUrl]);

  } catch (Exception $e) {
      http_response_code(500);
      echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
  }
  // simpan
  $pdo->commit();
  // Kirim Notifikasi ke Buyer
  // sleep(15);
  sendNotificationToNode(
    $buyerId, 
    "Pesanan Disetujui! 🎉", 
    "Penjual telah menerima pesanan #$orderId Anda. Mohon tunggu pengiriman.",
    "http://localhost:8082/order_history.php",
    "order"
  );

  // kirim response suces
  echo json_encode(['success'=> true, 'message'=>'Pesanan #' . $orderId . ' berhasil disetujui.']);


} catch (Exception $e){
  // jika eror, batalin
  if($pdo->inTransaction()){
    $pdo->rollBack();
  }
  http_response_code(500); //eror server
  echo json_encode(['success'=>false, 'message'=>'Gagal menyetujui pesanan: ' . $e->getMessage()]);
}
?>