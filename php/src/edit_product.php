<?php
session_start();
echo '<!DOCTYPE html>';

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    header('Location: /login.php');
    exit;
}

$product_id = isset($_GET['product_id']) ? (int)$_GET['product_id'] : null;
if (!$product_id) {
    die("Product ID tidak ditemukan di URL.");
}

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password_db = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password_db";
$categories = [];
try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $pdo->query('SELECT category_id, name FROM Category ORDER BY name');
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) { }

include 'api/get_navbar_data.php'; 
include 'component/navbar.php'; 
?>

<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Produk</title>

    <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/style/edit_product.css">
    
    <script src="/public/edit_product.js" defer></script>
</head>
<body>

    <div class="main-container">
        <div class="page-header">
            <h1>Edit Produk</h1>
            <p>Ubah detail produk Anda.</p>
        </div>
        
        <div id="loading-message" class="message info">Memuat data produk...</div>
        <div id="error-message" class="message error"></div>
        
        <?php
        if (isset($_GET['error'])) {
            echo '<div class="message error">' . htmlspecialchars($_GET['error']) . '</div>';
        }
        ?>

        <form id="edit-product-form" action="/api/update_product_process.php" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="product_id" id="product_id" value="<?php echo $product_id; ?>">
            
            <div class="add-product-grid">
                
                <div class="profile-card product-main-details">
                    <h2>Detail Produk</h2>
                    <div class="form-content">
                        <div class="form-group">
                            <label for="product_name">Nama Produk:</label>
                            <input type="text" id="product_name" name="product_name" required maxlength="200">
                        </div>

                        <div class="form-group">
                            <label for="category">Kategori:</label>
                            <select id="category" name="category_id" required>
                                <option value="" disabled>-- Pilih Kategori --</option>
                                <?php foreach ($categories as $category): ?>
                                    <option value="<?php echo $category['category_id']; ?>">
                                        <?php echo htmlspecialchars($category['name']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Deskripsi Produk:</label>
                            <div id="editor"></div>
                            <input type="hidden" name="description" id="description">
                        </div>
                        
                        <div class="button-group">
                            <button type="submit">Simpan Perubahan</button>
                            <a href="/product_management.php" class="btn-secondary">Batal</a>
                        </div>
                    </div>
                </div>
                
                <div class="product-sidebar">
                    <div class="profile-card">
                        <h2>Harga & Stok</h2>
                        <div class="form-content">
                            <div class="form-group">
                                <label for="price">Harga (Rp):</label>
                                <input type="number" id="price" name="price" required min="1000">
                            </div>

                            <div class="form-group">
                                <label for="stock">Stok:</label>
                                <input type="number" id="stock" name="stock" required min="0">
                            </div>
                        </div>
                    </div>
                    
                    <div class="profile-card">
                        <h2>Foto Produk</h2>
                        <div class="form-content">
                            <div class="form-group">
                                <label>Foto Utama Saat Ini:</label>
                                <img id="current-image" src="" alt="Foto Produk Saat Ini">
                            </div>
                            <div class="form-group">
                                <label for="product_image">Ganti Foto Utama (Opsional):</label>
                                <input type="file" id="product_image" name="product_image" accept="image/jpeg, image/png, image/webp">
                                <small>Kosongkan jika tidak ingin mengganti foto. Max 2MB.</small>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </form>
    </div>

    <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
</body>
<?php include 'component/footer.php'?>
</html>