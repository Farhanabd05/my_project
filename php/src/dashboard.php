<?php
session_start();

if ($_SESSION['role'] !== 'SELLER') {
    header('Location: /login.php'); // arahin ke login jika bukan seller
    exit;
}

include 'api/get_navbar_data.php'; 
include 'component/navbar.php'; 
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Seller - Nimonspedia</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style/dashboard.css">
    <script src="/public/dashboard.js" defer></script>
</head>
<body>

    <div class="dashboard-container">
        <h1>Dashboard Toko</h1>

        <div class="store-info" id="store-info-section">
            <h2>Informasi Toko</h2>
            <p id="loading-store">Memuat info toko...</p>
            </div>

        <h2>Statistik Cepat</h2>
        <div class="stats-grid" id="stats-grid-section">
            <p id="loading-stats">Memuat statistik...</p>
            </div>

        <h2>Aksi Cepat</h2>
        <div class="actions-container">
            <button id="manage-products-btn" aria-label="Kelola produk toko">
                Kelola Produk
            </button>
            <button id="view-orders-btn" aria-label="Lihat pesanan masuk">
                Lihat Orders
            </button>
            <button id="add-product-btn" aria-label="Tambah produk baru">
                Tambah Produk Baru
            </button>
            <button id="export-report-btn" aria-label="Export laporan ke CSV">
                Export Laporan
            </button>
        </div>
    </div>

</body>
<?php include 'component/footer.php'?>
</html>