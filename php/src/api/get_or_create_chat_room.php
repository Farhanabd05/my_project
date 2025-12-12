<?php
session_start();
header('Content-Type: application/json');

// Must be logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

// Only POST allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$store_id = $input['store_id'] ?? null;

if (!$store_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'store_id required']);
    exit;
}

// Database connection
$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $user_id = $_SESSION['user_id'];
    $role = strtoupper($_SESSION['role']);

    // Determine buyer_id based on role
    if ($role === 'BUYER') {
        $buyer_id = $user_id;
        
        // Verify store exists
        $stmt = $pdo->prepare("SELECT store_id FROM Store WHERE store_id = ?");
        $stmt->execute([$store_id]);
        if (!$stmt->fetch()) {
            throw new Exception('Store not found');
        }
    } else if ($role === 'SELLER') {
        // Seller wants to open chat with buyer
        $buyer_id = $input['buyer_id'] ?? null;
        
        if (!$buyer_id) {
            throw new Exception('buyer_id required for sellers');
        }
        
        // Verify seller owns this store
        $stmt = $pdo->prepare("SELECT store_id FROM Store WHERE store_id = ? AND user_id = ?");
        $stmt->execute([$store_id, $user_id]);
        if (!$stmt->fetch()) {
            throw new Exception('Unauthorized - you do not own this store');
        }
    } else {
        throw new Exception('Invalid role');
    }

    // Check if room already exists
    $stmt = $pdo->prepare("
        SELECT id FROM chat_room 
        WHERE buyer_id = ? AND store_id = ?
    ");
    $stmt->execute([$buyer_id, $store_id]);
    $room = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($room) {
        // Room exists, return it
        $room_id = $room['id'];
        // Update last access time
        $pdo->prepare("UPDATE chat_room SET updated_at = NOW() WHERE id = ?")->execute([$room_id]);
    } else {
        // Create new room
        $stmt = $pdo->prepare("
            INSERT INTO chat_room (buyer_id, store_id, created_at, updated_at)
            VALUES (?, ?, NOW(), NOW())
            RETURNING id
        ");
        $stmt->execute([$buyer_id, $store_id]);
        $room_id = $stmt->fetch(PDO::FETCH_ASSOC)['id'];
    }

    // Get room details for client
    $stmt = $pdo->prepare("
        SELECT 
            cr.id,
            cr.buyer_id,
            cr.store_id,
            s.store_name,
            u.name as buyer_name
        FROM chat_room cr
        JOIN Store s ON cr.store_id = s.store_id
        JOIN Users u ON cr.buyer_id = u.user_id
        WHERE cr.id = ?
    ");
    $stmt->execute([$room_id]);
    $roomDetails = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'room_id' => $room_id,
        'room_details' => $roomDetails
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>