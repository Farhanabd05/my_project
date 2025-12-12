<?php
session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    header('Location: /login.php');
    exit;
}
$sellerUserId = $_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /profile.php?store_update_status=error&store_update_message=' . urlencode('Metode request tidak valid.'));
    exit;
}

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";
$pdo = null;
$storeId = null;

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmtStore = $pdo->prepare('SELECT store_id FROM Store WHERE user_id = ?');
    $stmtStore->execute([$sellerUserId]);
    $storeId = $stmtStore->fetchColumn();

    if (!$storeId) {
        throw new Exception("Toko Anda tidak ditemukan.");
    }
} catch (Exception $e) {
    header('Location: /profile.php?store_update_status=error&store_update_message=' . urlencode('Error DB: ' . $e->getMessage()));
    exit;
}

$store_name = $_POST['store_name'] ?? null;
$store_description = $_POST['store_description'] ?? '';

$errors = [];
if (empty($store_name) || strlen($store_name) > 100) $errors[] = "Nama toko tidak valid (maks 100 karakter).";

$new_logo_path = null;
$old_logo_path = null;

if (isset($_FILES['store_logo']) && $_FILES['store_logo']['error'] === UPLOAD_ERR_OK && $_FILES['store_logo']['size'] > 0) {
    $file = $_FILES['store_logo'];
    if ($file['size'] > 2 * 1024 * 1024) $errors[] = "Ukuran file logo maks 2MB.";
    $allowed_types = ['image/jpeg', 'image/png', 'image/webp'];
    $file_type = mime_content_type($file['tmp_name']);
    if (!in_array($file_type, $allowed_types)) $errors[] = "Tipe file logo hanya JPG, PNG, WEBP.";

    if (empty($errors)) {
        $target_directory = __DIR__ . '/../public/uploads/logos/';
        if (!is_dir($target_directory)) mkdir($target_directory, 0755, true);

        $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $unique_filename = uniqid('logo_' . $storeId . '_') . '.' . $file_extension;
        $target_file_path = $target_directory . $unique_filename;

        if (move_uploaded_file($file['tmp_name'], $target_file_path)) {
            $new_logo_path = '/public/uploads/logos/' . $unique_filename;

            $stmtOldLogo = $pdo->prepare("SELECT store_logo_path FROM Store WHERE store_id = ?");
            $stmtOldLogo->execute([$storeId]);
            $old_logo_path = $stmtOldLogo->fetchColumn();
        } else {
            $errors[] = "Gagal memindahkan file logo baru.";
        }
    }
}

if (!empty($errors)) {
    $error_message = implode(' ', $errors);
    header('Location: /profile.php?store_update_status=error&store_update_message=' . urlencode($error_message));
    exit;
}

try {
    $sql_update_store = "UPDATE Store SET store_name = ?, store_description = ?, updated_at = CURRENT_TIMESTAMP";
    $params = [$store_name, $store_description];

    if ($new_logo_path !== null) {
        $sql_update_store .= ", store_logo_path = ?";
        $params[] = $new_logo_path;
    }

    $sql_update_store .= " WHERE store_id = ?";
    $params[] = $storeId;

    $stmt_update = $pdo->prepare($sql_update_store);
    $stmt_update->execute($params);

    if ($new_logo_path !== null && $old_logo_path !== null) {
        $old_file_system_path = __DIR__ . '/../' . ltrim($old_logo_path, '/');
        if (file_exists($old_file_system_path)) {
            @unlink($old_file_system_path);
        }
    }

    header('Location: /profile.php?store_update_status=success&store_update_message=' . urlencode('Informasi toko berhasil diperbarui!'));
    exit;

} catch (Exception $e) {
    header('Location: /profile.php?store_update_status=error&store_update_message=' . urlencode('Error DB: ' . $e->getMessage()));
    exit;
}
?>