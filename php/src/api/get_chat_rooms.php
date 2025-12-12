<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
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

    // Query based on role
    if ($role === 'BUYER') {
        // Buyer sees chats with stores
        $stmt = $pdo->prepare("
            SELECT 
                cr.id as room_id,
                cr.store_id,
                cr.updated_at as last_activity,
                s.store_name as partner_name,
                s.store_logo_path as partner_image,
                (
                    SELECT COUNT(*)
                    FROM chat_messages cm 
                    WHERE cm.room_id = cr.id 
                    AND cm.sender_id != ?
                    AND cm.is_read = false
                ) as unread_count,
                (
                    SELECT cm.message
                    FROM chat_messages cm
                    WHERE cm.room_id = cr.id
                    ORDER BY cm.created_at DESC
                    LIMIT 1
                ) as last_message
            FROM chat_room cr
            JOIN Store s ON cr.store_id = s.store_id
            WHERE cr.buyer_id = ?
            ORDER BY cr.updated_at DESC
        ");
        $stmt->execute([$user_id, $user_id]);
    } else {
        // Seller sees chats with buyers
        $stmt = $pdo->prepare("
            SELECT 
                cr.id as room_id,
                cr.buyer_id,
                cr.updated_at as last_activity,
                u.name as partner_name,
                NULL as partner_image,
                (
                    SELECT COUNT(*)
                    FROM chat_messages cm
                    WHERE cm.room_id = cr.id 
                    AND cm.sender_id != ?
                    AND cm.is_read = false
                ) as unread_count,
                (
                    SELECT cm.message
                    FROM chat_messages cm
                    WHERE cm.room_id = cr.id
                    ORDER BY cm.created_at DESC
                    LIMIT 1
                ) as last_message
            FROM chat_room cr
            JOIN Users u ON cr.buyer_id = u.user_id
            JOIN Store s ON cr.store_id = s.store_id
            WHERE s.user_id = ?
            ORDER BY cr.updated_at DESC
        ");
        $stmt->execute([$user_id, $user_id]);
    }

    $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $rooms // Disesuaikan dengan format frontend sebelumnya (data.data)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>