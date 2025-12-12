<?php
//mock data
session_start();
include '../utils/notif_helper.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if ($_SESSION['role'] !== 'SELLER') {
    http_response_code(403); // Forbidden
    echo json_encode(['success' => false, 'message' => 'Akses ditolak.']);
    exit;
}
// ambil dari data post di order_mangement.js
$input=json_decode(file_get_contents('php://input'), true);
if(
  !$input||
  !isset($input['order_id']) || !is_numeric($input['order_id']) ||
  !isset($input['delivery_estimate']) || trim($input['delivery_estimate']) === ''
){
  http_response_code(400); // bad req
  echo json_encode(['success'=>false, 'message'=>'order id atau estimasi pengiriman tidak valid']);
  exit;
}
$orderId=(int)$input['order_id'];
$deliveryEstimate=trim($input['delivery_estimate']);
$sellerUserId=$_SESSION['user_id'];

// konek db
$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try{
  $pdo=new PDO($dsn);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

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

  // dapetin store_id sller
  $stmt=$pdo->prepare('SELECT store_id FROM Store WHERE user_id = ?');
  $stmt->execute([$sellerUserId]);
  $storeId=$stmt->fetchColumn();

  if(!$storeId){
    throw new Exception("Toko tidak ditemukan untuk sller ini");
  }

  // verif apakah order ini mliki sller ini dan statusnya 'approved?
  // for update buat ngunci
  $stmt = $pdo->prepare('SELECT status, buyer_id from "Order" WHERE order_id = ? AND store_id = ? FOR UPDATE');
  $stmt->execute([$orderId, $storeId]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  if(!$row){
    throw new Exception("Pesanan tdk ditemukan atau bukan milik toko anda.");
  }
  $currentStatus = $row['status'];
  $buyerId = $row['buyer_id'];

  if($currentStatus != 'approved'){
    throw new Exception('Pesanan belum diapprove');
  }

  // hitung target delivery_time berdasarkan estimasi
  $totalSecondsToAdd=0;
  $pattern = '/(\d+)\s*(hari|jam|menit|day|hour|minute|hr|min|d|h|m)/i';
  preg_match_all($pattern, $deliveryEstimate, $matches, PREG_SET_ORDER);

  if(count($matches)>0){
    // jika ada format angka unit ditemukan
    foreach($matches as $match){
      $value=(int)$match[1];
      $unit=strtolower($match[2]);
      if ($value < 0) {
        throw new Exception('Nilai waktu tidak boleh negatif.');
      }
      if($unit==='hari'||$unit==='day'||$unit==='d'){
        $totalSecondsToAdd+=$value*86400;
      } elseif ($unit === 'jam' || $unit === 'hour' || $unit === 'hr' || $unit === 'h') {
        $totalSecondsToAdd+=$value*3600;
      } else if ($unit === 'menit' || $unit === 'minute' || $unit === 'min' || $unit === 'm'){
        $totalSecondsToAdd+=$value*60;
      }
    }
  } else{
    // jika takde format angka unit coba pakai strtotime (misal besok, next week)
    $deliveryTimestampSimple=strtotime($deliveryEstimate);
    if($deliveryTimestampSimple!==false && $deliveryTimestampSimple > time()){
      $totalSecondsToAdd = $deliveryTimestampSimple - time();
    }
  }
  // validasi hasil itung
  if($totalSecondsToAdd<=0){
    throw new Exception('Format estimasi waktu tak valid, atau ngasilin waktu masa lalu');
  }

  $deliveryTimestamp=time() + $totalSecondsToAdd;
  $deliveryDateTimeString = date('Y-m-d H:i:s', $deliveryTimestamp);
  
  // Hitung offset GMT (dalam jam)
  $gmtOffset = date('Z', $deliveryTimestamp) / 3600;
  $gmtOffsetFormatted = sprintf("GMT%+d", $gmtOffset);
  
  // Format tanggal dengan GMT
  $deliveryDateTimeWithGMT = date('Y-m-d H:i:s', $deliveryTimestamp) . ' ' . $gmtOffsetFormatted;

  // update status order, oiya gk oerlu di pake for update lagi karena udah pas "verif apakah order ini mliki sller ini dan statusnya 'approved?"
  $stmt = $pdo->prepare('UPDATE "Order" SET status = ?, delivery_time = ? WHERE order_id = ?');
  $stmt->execute(['on_delivery', $deliveryDateTimeString, $orderId]);

  try {
      $notifTitle = "Pesanan Sedang Dikirim! 🚚";
      $notifMsg = "Paket untuk pesanan #$orderId sedang dalam perjalanan. Estimasi sampai: $deliveryDateTimeWithGMT.";
      $notifUrl = "http://localhost:8082/order_history.php";

      $stmtNotif = $pdo->prepare("INSERT INTO Notifications (user_id, title, message, url) VALUES (?, ?, ?, ?)");
      $stmtNotif->execute([$buyerId, $notifTitle, $notifMsg, $notifUrl]);

  } catch (Exception $e) {
      http_response_code(500);
      echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
  }
  $pdo->commit();
  // sleep(15);
  sendNotificationToNode(
    $buyerId, 
    "Pesanan Sedang Dikirim! 🚚", 
    "Paket untuk pesanan #$orderId sedang dalam perjalanan. Estimasi sampai: $deliveryDateTimeWithGMT",
    "http://localhost:8082/order_history.php",
    "order"
  );

  echo json_encode([
    'success' => true, 
    'message' => 'Pesanan #' . $orderId . ' status diubah ke On Delivery. Target sampai: ' . $deliveryDateTimeWithGMT,
    'delivery_time' => $deliveryDateTimeString,
    'delivery_time_formatted' => $deliveryDateTimeWithGMT
  ]);
} catch (Exception $e){
  if($pdo->inTransaction()){
    $pdo->rollBack();
  }
  http_response_code(500);
  echo json_encode(['success'=>false, 'message'=>"Gagal mengatur pengiriman: " . $e->getMessage()]);
}
?>