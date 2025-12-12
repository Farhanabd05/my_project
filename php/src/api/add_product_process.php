<?php
session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    die("Akses ditolak. Anda harus login sebagai Seller.");
}
$sellerUserId = $_SESSION['user_id'];
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    die("Metode request tidak valid.");
}

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";
$pdo = null;
$storeId = null;

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $stmt = $pdo->prepare('SELECT store_id FROM Store WHERE user_id = ?');
    $stmt->execute([$sellerUserId]);
    $storeId = $stmt->fetchColumn();

    if (!$storeId) {
        throw new Exception("Toko Anda tidak ditemukan.");
    }

} catch (Exception $e) {
    header('Location: /add_product.php?error=' . urlencode('Error: ' . $e->getMessage()));
    exit;
}

$product_name = $_POST['product_name'] ?? null;
$description = $_POST['description'] ?? null; 
$category_id = $_POST['category_id'] ?? null;
$price = $_POST['price'] ?? null;
$stock = $_POST['stock'] ?? null;

$errors = [];
if (empty($product_name) || strlen($product_name) > 200) $errors[] = "Nama produk tidak valid (maks 200 karakter).";
if (empty($description) || strlen($description) > 1000) $errors[] = "Deskripsi tidak valid (maks 1000 karakter).";
if (empty($category_id) || !is_numeric($category_id)) $errors[] = "Kategori tidak valid.";
if (!is_numeric($price) || $price < 1000) $errors[] = "Harga minimal adalah Rp 1.000.";
if (!is_numeric($stock) || $stock < 0) $errors[] = "Stok minimal adalah 0.";


$db_image_path = null;
if (isset($_FILES['product_image']) && $_FILES['product_image']['error'] === UPLOAD_ERR_OK) {
    
    $file = $_FILES['product_image'];
    
   
    if ($file['size'] > 2 * 1024 * 1024) {
        $errors[] = "Ukuran file foto maksimal adalah 2MB.";
    }

    
    $allowed_types = ['image/jpeg', 'image/png', 'image/webp'];
    $file_type = mime_content_type($file['tmp_name']);
    
    if (!in_array($file_type, $allowed_types)) {
        $errors[] = "Tipe file foto hanya boleh JPG, PNG, atau WEBP.";
    }

    if (empty($errors)) {
        $target_directory = __DIR__ . '/../public/uploads/products/';
        if (!is_dir($target_directory)) {
            mkdir($target_directory, 0755, true);
        }

        $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $unique_filename = uniqid('prod_') . '.' . $file_extension;
        
        $target_file_path = $target_directory . $unique_filename;

        if (move_uploaded_file($file['tmp_name'], $target_file_path)) {
            $db_image_path = '/public/uploads/products/' . $unique_filename;
        } else {
            $errors[] = "Gagal memindahkan file yang di-upload.";
        }
    }

} else {
    $errors[] = "Foto produk wajib di-upload.";
}

if (!empty($errors)) {
    $error_message = implode(' ', $errors);
    header('Location: /add_product.php?error=' . urlencode($error_message));
    exit;
}

try {
    $pdo->beginTransaction();

    $sql_product = "INSERT INTO Product 
                    (store_id, product_name, description, price, stock, main_image_path) 
                    VALUES (?, ?, ?, ?, ?, ?)";
    $stmt_product = $pdo->prepare($sql_product);
    $stmt_product->execute([
        $storeId,
        $product_name,
        $description,
        $price,
        $stock,
        $db_image_path
    ]);

    $new_product_id = $pdo->lastInsertId('product_product_id_seq');

    $sql_category = "INSERT INTO Category_Item (category_id, product_id) VALUES (?, ?)";
    $stmt_category = $pdo->prepare($sql_category);
    $stmt_category->execute([$category_id, $new_product_id]);

    $pdo->commit();
    header('Location: /product_management.php?success=' . urlencode('Produk berhasil ditambahkan!'));
    exit;

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    header('Location: /add_product.php?error=' . urlencode('Error database: ' . $e->getMessage()));
    exit;
}
?>