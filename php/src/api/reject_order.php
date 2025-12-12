<?php
// mirip kek approve sebnarnya, bedanya mesti update saldo dan stock
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

// ambil order_id dan reason dari data POST
$input = json_decode(file_get_contents('php://input'), true);
if (
    !$input ||
    !isset($input['order_id']) || !is_numeric($input['order_id']) ||
    !isset($input['reason']) || trim($input['reason']) === '' 
) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Order ID atau Alasan tidak valid.']);
    exit;
}
$orderId = (int)$input['order_id'];
$rejectReason = trim($input['reason']); // Ambil alasan penolakan
$sellerUserId = $_SESSION['user_id'];

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try {
    $pdo = new PDO($dsn);
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

    $stmt = $pdo->prepare('SELECT store_id FROM Store WHERE user_id = ?');
    $stmt->execute([$sellerUserId]);
    $storeId = $stmt->fetchColumn();

    if (!$storeId) {
        throw new Exception('Toko tidak ditemukan untuk seller ini.');
    }

    // verifikasi order, dapatkan status dan buyer_id, total_price (total_price digunain buat ngembaliin balance buyer dan store)
    // FOR UPDATE buat ngunsi baris oder
    $stmt = $pdo->prepare('SELECT status, buyer_id, total_price FROM "Order" WHERE order_id = ? AND store_id = ? FOR UPDATE');
    $stmt->execute([$orderId, $storeId]);
    $orderData = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$orderData) {
        throw new Exception('Pesanan tidak ditemukan atau bukan milik toko Anda.');
    }
    $currentStatus = $orderData['status'];
    $buyerId = $orderData['buyer_id'];
    $orderTotalPrice = (int)$orderData['total_price']; 

    if ($currentStatus !== 'waiting_approval') {
        throw new Exception('Hanya pesanan dengan status "Waiting Approval" yang bisa ditolak.');
    }

    // a. kunci baris buyer terlebih dahulu dengan SELECT FOR UPDATE (soalnya for update gk bisa buat UPDATE)
    $stmtLockBuyer = $pdo->prepare('SELECT user_id FROM Users WHERE user_id = ? FOR UPDATE');
    $stmtLockBuyer->execute([$buyerId]); // (kita gk perlu mengambil hasilnya, hanya ngunci)

    // b. skrng baris buyer terkunci, lakukan UPDATE saldo
    $stmtUpdateBuyer = $pdo->prepare('UPDATE Users SET balance = balance + ? WHERE user_id = ?');
    $stmtUpdateBuyer->execute([$orderTotalPrice, $buyerId]);

    // kembalikan stok produk
    // ambil semua item dari pesanan ini
    $stmt = $pdo->prepare('SELECT product_id, quantity FROM Order_Items WHERE order_id = ?');
    $stmt->execute([$orderId]);
    $orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($orderItems as $item) {
        $stmtLockProduct = $pdo->prepare('SELECT product_id FROM Product WHERE product_id = ? FOR UPDATE');
        $stmtLockProduct->execute([$item['product_id']]);

        $stmtUpdateStock = $pdo->prepare('UPDATE Product SET stock = stock + ? WHERE product_id = ?');
        $stmtUpdateStock->execute([$item['quantity'], $item['product_id']]);
    }

    // update Status Order menjadi 'rejected', set confirmed_at, dan simpan alasan
    $stmt = $pdo->prepare('UPDATE "Order" SET status = ?, confirmed_at = CURRENT_TIMESTAMP, reject_reason = ? WHERE order_id = ?');
    $stmt->execute(['rejected', $rejectReason, $orderId]);

    try {
      $notifTitle = "Pesanan Ditolak!";
      $notifMsg = "Penjual menolaj pesanan #$orderId. dengan alasan $rejectReason.";
      $notifUrl = "http://localhost:8082/order_history.php";

      $stmtNotif = $pdo->prepare("INSERT INTO Notifications (user_id, title, message, url) VALUES (?, ?, ?, ?)");
      $stmtNotif->execute([$buyerId, $notifTitle, $notifMsg, $notifUrl]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
    }
    $pdo->commit();
    // sleep(15);
    // Kirim Notifikasi ke Buyer
    sendNotificationToNode(
        $buyerId, 
        "Pesanan Dibatalkan 😔", 
        "Pesanan #$orderId ditolak oleh penjual. Alasan: $rejectReason. Saldo telah dikembalikan.",
        "http://localhost:8082/order_history.php",
        "order"
    );

    echo json_encode(['success' => true, 'message' => 'Pesanan #' . $orderId . ' berhasil ditolak. Saldo buyer telah dikembalikan dan stok produk diperbarui.']);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Gagal menolak pesanan: ' . $e->getMessage()]);
}
?>