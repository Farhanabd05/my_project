<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'BUYER') {
    header('Location: /login.php');
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
    <title>Riwayat Pesanan - Nimonspedia</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/style/order_history.css">
    <script src="/public/order_history.js" defer></script>
</head>
<body>
    <div class="history-container">
        <div class="history-header">
            <h1>Riwayat Pesanan</h1>
        </div>

        <div class="filter-container">
            <label for="status-filter">Filter Status:</label>
            <select id="status-filter">
                <option value="all">Semua Pesanan</option>
                <option value="waiting_approval">Menunggu Persetujuan</option>
                <option value="approved">Disetujui</option>
                <option value="on_delivery">Dalam Pengiriman</option>
                <option value="received">Diterima</option>
                <option value="rejected">Ditolak</option>
            </select>
        </div>
        
        <p id="loading-indicator">Memuat riwayat pesanan...</p>

        <div id="order-list"></div>
    </div>
</body>
<?php include 'component/footer.php'?>
</html>