<?php
session_start();
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || 
    !isset($input['email']) || !filter_var($input['email'], FILTER_VALIDATE_EMAIL) ||
    !isset($input['password']) || !isset($input['confirm_password']) || 
    !isset($input['name']) || trim($input['name']) === '' || 
    !isset($input['address']) || trim($input['address']) === '' || 
    !isset($input['role']) || !in_array($input['role'], ['BUYER', 'SELLER']) 
) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Input tidak lengkap atau tidak valid.']);
    exit;
}

$email = $input['email'];
$password = $input['password'];
$name = $input['name'];
$address = $input['address'];
$role = $input['role'];

if ($password !== $input['confirm_password']) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password dan konfirmasi password tidak cocok.']);
    exit;
}

if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/', $password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password minimal 8 karakter, harus mengandung huruf besar, huruf kecil, angka, dan simbol.']);
    exit;
}

$storeName = null;
$storeDesc = null;
if ($role === 'SELLER') {
    if (!isset($input['store_name']) || trim($input['store_name']) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nama toko wajib diisi untuk Seller.']);
        exit;
    }
    
    // validasi maksimal 100 karakter
    if (mb_strlen($input['store_name']) > 100) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nama toko maksimal 100 karakter.']);
        exit;
    }
    
    $storeName = $input['store_name'];
    $storeDesc = $input['store_description'] ?? ''; 
}

$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

$host = 'database'; 
$port = '5432'; 
$dbname = 'nimonspedia'; 
$user = 'user';
$password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT user_id FROM Users WHERE email = ?');
    $stmt->execute([$email]);
    
    if ($stmt->fetch()) {
        throw new Exception('Email sudah terdaftar.');
    }

    $stmt = $pdo->prepare('INSERT INTO Users (email, password, role, name, address) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$email, $hashedPassword, $role, $name, $address]);
    $newUserId = $pdo->lastInsertId('users_user_id_seq'); 
    if ($role === 'SELLER') {
        $stmt = $pdo->prepare('INSERT INTO Store (user_id, store_name, store_description) VALUES (?, ?, ?)');
        $stmt->execute([$newUserId, $storeName, $storeDesc]);
    }
    
    // feature access
    $stmt = $pdo->prepare('INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (?, ?, TRUE, ?)');
    $stmt->execute([$newUserId, 'checkout_enabled', '...']);
    $stmt->execute([$newUserId, 'chat_enabled', '...']);
    $stmt->execute([$newUserId, 'auction_enabled', '...']);

    $pdo->commit();

    session_regenerate_id(true); 
    $_SESSION['user_id'] = $newUserId;
    $_SESSION['role'] = $role;
    echo json_encode(['success' => true, 'message' => 'Registrasi berhasil!', 'role' => $role]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    $errorMessage = $e->getMessage() === 'Email sudah terdaftar.' ? $e->getMessage() : 'Terjadi kesalahan pada server.';
    echo json_encode(['success' => false, 'message' => $errorMessage]);
}
?>