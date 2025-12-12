<?php
session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'SELLER') {
    header('Location: /login.php');
    exit;
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

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manajemen Produk</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/style/product_management.css">
    
    <script src="/public/product_management.js" defer></script>
</head>
<body>

    <div class="main-container">
        <div class="page-header">
            <div>
                <h1>Manajemen Produk</h1>
                <p>Kelola semua produk di toko Anda.</p>
            </div>
            <a href="/add_product.php" class="btn-primary">Tambah Produk Baru</a>
        </div>
        
        <?php
        if (isset($_GET['success'])) {
            echo '<div class="message success">' . htmlspecialchars($_GET['success']) . '</div>';
        }
        ?>

        <div class="profile-card">
            <div class="filters">
                <input type="search" id="search-input" placeholder="Cari nama produk...">
                <select id="category-filter">
                    <option value="0">Semua Kategori</option>
                    <?php foreach ($categories as $category): ?>
                        <option value="<?php echo $category['category_id']; ?>">
                            <?php echo htmlspecialchars($category['name']); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <select id="sort-by">
                    <option value="name_asc">Urutkan: Nama (A-Z)</option>
                    <option value="name_desc">Urutkan: Nama (Z-A)</option>
                    <option value="price_asc">Urutkan: Harga (Termurah)</option>
                    <option value="price_desc">Urutkan: Harga (Termahal)</option>
                    <option value="stock_asc">Urutkan: Stok (Tersedikit)</option>
                    <option value="stock_desc">Urutkan: Stok (Terbanyak)</option>
                </select>
            </div>
        </div>

        <div class="profile-card">
            <div id="loading-indicator">Memuat produk...</div>
            
            <div id="product-list" class="product-table-container">
            </div>
            
            <div id="pagination-controls" class="pagination-container">
            </div>
        </div>
    </div>

</body>
<?php include 'component/footer.php'?>
</html>