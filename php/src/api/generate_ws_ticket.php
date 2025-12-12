<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Generate unique token
    $ticket = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', strtotime('+5 minutes'));
    
    // Store ticket
    $stmt = $pdo->prepare("
        INSERT INTO ws_tickets (ticket, user_id, expires_at, created_at)
        VALUES (?, ?, ?, NOW())
    ");
    $stmt->execute([$ticket, $_SESSION['user_id'], $expires_at]);
    
    echo json_encode([
        'success' => true,
        'ticket' => $ticket,
        'expires_at' => $expires_at
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}