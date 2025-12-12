<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if ($_SESSION['role'] !== 'SELLER') {
    header('Location: /login.php');
    exit;
}

include 'api/order_management_access_control.php';
include 'api/get_navbar_data.php';
include 'component/navbar.php';
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manajemen Pesanan</title>
    <script src="/public/order_management.js" defer></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/style/order_management.css">
</head>
<body>
    <h1>Manajemen Pesanan Toko Anda</h1>

    <div class="filter-container">
        <label for="status-filter">Filter Status:</label>
        <select id="status-filter">
            <option value="all">Semua</option>
            <option value="waiting_approval">Menunggu Persetujuan</option>
            <option value="approved">Disetujui</option>
            <option value="on_delivery">Dalam Pengiriman</option>
            <option value="received">Diterima</option>
            <option value="rejected">Ditolak</option>
        </select>

        <label for="search-input" class="search-label">Cari (ID / Nama Buyer):</label>
        <input type="search" id="search-input" placeholder="Masukkan Order ID atau Nama...">
        <button type="button" id="search-button">Cari</button>
    </div>

    <p id="loading-indicator">Memuat pesanan...</p>
    <div id="order-list"></div>
    <div class="pagination-container" id="pagination-controls">
    </div>

    <div id="input-modal-overlay" class="modal-overlay">
        <div class="modal-content">
            <h3 id="modal-title">Judul Modal</h3>
            <div class="form-group">
                <label for="modal-input" id="modal-label">Input:</label>
                <textarea id="modal-input" rows="4" class="modal-textarea"></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" id="modal-cancel-btn">Batal</button>
                <button type="button" id="modal-ok-btn">OK</button>
            </div>
        </div>
    </div>
    <div id="delivery-modal-overlay" class="modal-overlay">
        <div class="modal-content delivery-modal-content">
            <h3 id="delivery-modal-title">Kirim Barang</h3>
            <p style="color: #6d7588; font-size: 14px; margin-bottom: 20px;">
                Masukkan estimasi waktu pengiriman
            </p>
            <div class="delivery-inputs-grid">
                <div class="form-group">
                    <label for="delivery-days">Hari</label>
                    <input type="number" id="delivery-days" min="0" value="0" class="delivery-input">
                </div>
                <div class="form-group">
                    <label for="delivery-hours">Jam</label>
                    <input type="number" id="delivery-hours" min="0" max="23" value="0" class="delivery-input">
                </div>
                <div class="form-group">
                    <label for="delivery-minutes">Menit</label>
                    <input type="number" id="delivery-minutes" min="0" max="59" value="0" class="delivery-input">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" id="delivery-modal-cancel-btn">Batal</button>
                <button type="button" id="delivery-modal-ok-btn">Konfirmasi</button>
            </div>
        </div>
    </div>
</body>
<?php include 'component/footer.php'?>
</html>