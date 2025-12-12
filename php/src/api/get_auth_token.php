<?php
// php/src/api/get_auth_token.php
session_start();
header('Content-Type: application/json');

// 1. Cek Login PHP
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated in PHP']);
    exit;
}

// 2. Siapkan data untuk Token
$userId = $_SESSION['user_id'];
$role = $_SESSION['role'] ?? 'BUYER';
$secretKey = '9f9759d6b3518d09097215bcb22ca5f6';

// 3. Fungsi sederhana membuat JWT (Tanpa library berat)
function generate_jwt($headers, $payload, $secret) {
	$headers_encoded = rtrim(strtr(base64_encode(json_encode($headers)), '+/', '-_'), '=');
	$payload_encoded = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');
	$signature = hash_hmac('SHA256', "$headers_encoded.$payload_encoded", $secret, true);
	$signature_encoded = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
	return "$headers_encoded.$payload_encoded.$signature_encoded";
}

$headers = ['alg' => 'HS256', 'typ' => 'JWT'];
$payload = [
    'userId' => $userId,
    'role' => $role,
    'iat' => time(),
    'exp' => time() + (60 * 60 * 24) // Token valid 24 jam
];

try {
    $token = generate_jwt($headers, $payload, $secretKey);
    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $userId,
            'role' => $role
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to generate token']);
}
?>