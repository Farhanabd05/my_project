<?php
session_start();
header('Content-Type: application/json');

// 1. Cek Login
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

// 2. Cek apakah ada file
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No file uploaded']);
    exit;
}

$file = $_FILES['image'];
$userId = $_SESSION['user_id'];

// 3. Validasi Error
if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Upload error code: ' . $file['error']]);
    exit;
}

// 4. Validasi Tipe (Hanya Gambar)
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);

if (!in_array($mimeType, $allowedTypes)) {
    echo json_encode(['success' => false, 'message' => 'Invalid file type. Only JPG, PNG, GIF, WEBP allowed.']);
    exit;
}

// 5. Validasi Ukuran (Max 2MB biar ringan)
if ($file['size'] > 2 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'File too large (Max 2MB)']);
    exit;
}

// 6. Siapkan Folder
// Path di dalam container Docker
$uploadDir = __DIR__ . '/../public/uploads/chat/';
// Path relatif untuk browser
$publicPath = '/public/uploads/chat/';

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// 7. Simpan File
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
// Nama file unik: chat_USERID_TIMESTAMP_RANDOM.ext
$filename = 'chat_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
$destination = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $destination)) {
    echo json_encode([
        'success' => true,
        'url' => $publicPath . $filename // URL inilah yang dikirim ke Node.js
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save file on server']);
}
?>