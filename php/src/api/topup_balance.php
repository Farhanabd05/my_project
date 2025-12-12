<?php
session_start();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if ($_SESSION['role'] !== 'BUYER') {
    http_response_code(403); // forbidden
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Hanya Buyer yang bisa top-up.']);
    exit;
}

// amvil jumlah top-up (amount) dari data POST
$input = json_decode(file_get_contents('php://input'), true);
if (
    !$input ||
    !isset($input['amount']) || !is_numeric($input['amount']) || // hrs angka
    (int)$input['amount'] <= 0 // hrs lebih dari 0
) {
    http_response_code(400); // B R
    echo json_encode(['success' => false, 'message' => 'Jumlah top-up tidak valid. Harus angka positif.']);
    exit;
}
$amountToAdd = (int)$input['amount'];
$buyerId = $_SESSION['user_id'];

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->beginTransaction();

    // kunci baris buyer untuk mencegah race condition
    $stmtLock = $pdo->prepare('SELECT user_id FROM Users WHERE user_id = ? FOR UPDATE');
    $stmtLock->execute([$buyerId]);
    // verif apakah user ada (meskipun seharusnya ada jika sesi valid)
    if ($stmtLock->fetchColumn() === false) {
        throw new Exception('Buyer tidak ditemukan.');
    }

    // tambahin saldo ke buyer
    $stmtUpdate = $pdo->prepare('UPDATE Users SET balance = balance + ? WHERE user_id = ?');
    $stmtUpdate->execute([$amountToAdd, $buyerId]);

    // ambil saldo baru untuk dikirim di respons
    $stmtNewBalance = $pdo->prepare('SELECT balance FROM Users WHERE user_id = ?');
    $stmtNewBalance->execute([$buyerId]);
    $newBalance = (int)$stmtNewBalance->fetchColumn();

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Top-up sebesar Rp ' . number_format($amountToAdd, 0, ',', '.') . ' berhasil!',
        'new_balance' => $newBalance
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Gagal melakukan top-up: ' . $e->getMessage()]);
}
?>