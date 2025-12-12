<?php
session_start();
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['email']) || !isset($input['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email dan password wajib diisi.']);
    exit;
}

$email = $input['email'];
$password = $input['password'];

$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare('SELECT user_id, password, role FROM Users WHERE email = ?');
    $stmt->execute([$email]);
    $userData = $stmt->fetch(PDO::FETCH_ASSOC);

    if($userData['role'] === 'ADMIN'){
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Email atau password salah.']);
        return;
    }

    if ($userData && password_verify($password, $userData['password'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userData['user_id'];
        $_SESSION['role'] = $userData['role'];

        echo json_encode([
            'success' => true,
            'message' => 'Login berhasil!',
            'role' => $userData['role']
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Email atau password salah.']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan pada server.']);
}
?>
