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

if (
    !$input || !isset($input['old_password']) || !isset($input['new_password']) || !isset($input['confirm_new_password'])
) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Semua field password wajib diisi.']);
    exit;
}

$oldPassword = $input['old_password'];
$newPassword = $input['new_password'];
$confirmNewPassword = $input['confirm_new_password'];

if ($newPassword !== $confirmNewPassword) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password baru dan konfirmasi tidak cocok.']);
    exit;
}

if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/', $newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password baru minimal 8 karakter, harus mengandung huruf besar, huruf kecil, angka, dan simbol.']);
    exit;
}
$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $pdo->prepare('SELECT password FROM Users WHERE user_id = ?');
    $stmt->execute([$userId]);
    $hashedPasswordFromDb = $stmt->fetchColumn();

    if (!$hashedPasswordFromDb) {
        throw new Exception('Pengguna tidak ditemukan.');
    }
    if (!password_verify($oldPassword, $hashedPasswordFromDb)) {
        http_response_code(401); 
        echo json_encode(['success' => false, 'message' => 'Password lama yang Anda masukkan salah.']);
        exit;
    }

    $newHashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare('UPDATE Users SET password = ? WHERE user_id = ?');
    $stmt->execute([$newHashedPassword, $userId]);

    echo json_encode(['success' => true, 'message' => 'Password berhasil diubah.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan server: ' . $e->getMessage()]);
}
?>