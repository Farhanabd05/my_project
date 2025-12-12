<?php
session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    die("Akses ditolak.");
}
$sellerUserId = $_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    die("Metode request tidak valid.");
}

if (!isset($_POST['product_id']) || !is_numeric($_POST['product_id'])) {
    die("Product ID tidak valid.");
}
$productId = (int)$_POST['product_id'];

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
    header('Location: /edit_product.php?product_id=' . $productId . '&error=' . urlencode('Error: ' . $e->getMessage()));
    exit;
}

$product_name = $_POST['product_name'] ?? null;
$description = $_POST['description'] ?? null; 
$category_id = $_POST['category_id'] ?? null;
$price = $_POST['price'] ?? null;
$stock = $_POST['stock'] ?? null;

$errors = [];
if (empty($product_name) || strlen($product_name) > 200) $errors[] = "Nama produk tidak valid.";
if (empty($description) || strlen($description) > 1000) $errors[] = "Deskripsi tidak valid.";
if (empty($category_id) || !is_numeric($category_id)) $errors[] = "Kategori tidak valid.";
if (!is_numeric($price) || $price < 1000) $errors[] = "Harga minimal Rp 1.000.";
if (!is_numeric($stock) || $stock < 0) $errors[] = "Stok minimal 0.";

$new_db_image_path = null; 
$old_db_image_path = null; 

if (isset($_FILES['product_image']) && $_FILES['product_image']['error'] === UPLOAD_ERR_OK && $_FILES['product_image']['size'] > 0) {
    
    $file = $_FILES['product_image'];
    
    if ($file['size'] > 2 * 1024 * 1024) $errors[] = "Ukuran file baru maks 2MB.";
    $allowed_types = ['image/jpeg', 'image/png', 'image/webp'];
    $file_type = mime_content_type($file['tmp_name']);
    if (!in_array($file_type, $allowed_types)) $errors[] = "Tipe file baru hanya JPG, PNG, WEBP.";

    if (empty($errors)) {
        $target_directory = __DIR__ . '/../public/uploads/products/';
        if (!is_dir($target_directory)) mkdir($target_directory, 0755, true);

        $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $unique_filename = uniqid('prod_') . '.' . $file_extension;
        $target_file_path = $target_directory . $unique_filename;

        if (move_uploaded_file($file['tmp_name'], $target_file_path)) {
            $new_db_image_path = '/public/uploads/products/' . $unique_filename;
            
            $stmtOldImg = $pdo->prepare("SELECT main_image_path FROM Product WHERE product_id = ? AND store_id = ?");
            $stmtOldImg->execute([$productId, $storeId]);
            $old_db_image_path = $stmtOldImg->fetchColumn();

        } else {
            $errors[] = "Gagal memindahkan file baru.";
        }
    }
} 

if (!empty($errors)) {
    $error_message = implode(' ', $errors);
    header('Location: /edit_product.php?product_id=' . $productId . '&error=' . urlencode($error_message));
    exit;
}

try {
    $pdo->beginTransaction();

    $sql_update_product = "UPDATE Product SET 
                             product_name = ?, 
                             description = ?, 
                             price = ?, 
                             stock = ?, 
                             updated_at = CURRENT_TIMESTAMP";
    
    $params = [$product_name, $description, $price, $stock];

    if ($new_db_image_path !== null) {
        $sql_update_product .= ", main_image_path = ?";
        $params[] = $new_db_image_path;
    }

    $sql_update_product .= " WHERE product_id = ? AND store_id = ?";
    $params[] = $productId;
    $params[] = $storeId; 

    $stmt_update = $pdo->prepare($sql_update_product);
    $stmt_update->execute($params);

    $stmt_delete_cat = $pdo->prepare("DELETE FROM Category_Item WHERE product_id = ?");
    $stmt_delete_cat->execute([$productId]);

    $stmt_insert_cat = $pdo->prepare("INSERT INTO Category_Item (category_id, product_id) VALUES (?, ?)");
    $stmt_insert_cat->execute([$category_id, $productId]);

    $pdo->commit();

    if ($new_db_image_path !== null && $old_db_image_path !== null) {
        $old_file_system_path = __DIR__ . '/../' . ltrim($old_db_image_path, '/');
        if (file_exists($old_file_system_path)) {
            @unlink($old_file_system_path); 
        }
    }

    header('Location: /product_management.php?success=' . urlencode('Produk berhasil diperbarui!'));
    exit;

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    header('Location: /edit_product.php?product_id=' . $productId . '&error=' . urlencode('Error database: ' . $e->getMessage()));
    exit;
}
?>