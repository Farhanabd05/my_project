<?php
session_start();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Anda harus login terlebih dahulu.']);
    exit;
}

$userId = $_SESSION['user_id'];

$input = json_decode(file_get_contents('php://input'), true);

// Validasi input
if (!$input || !isset($input['name']) || trim($input['name']) === '' || !isset($input['address']) || trim($input['address']) === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nama dan Alamat tidak boleh kosong.']);
    exit;
}

$name = $input['name'];
$address = $input['address'];

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $pdo->prepare('UPDATE Users SET name = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
    $stmt->execute([$name, $address, $userId]);

    echo json_encode(['success' => true, 'message' => 'Profil berhasil diperbarui.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
}
?>