<?php
// mock data
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'BUYER') {
    header('Location: /login.php');
    exit;
}

include 'api/checkout_cart_access_control.php'; 
include 'api/get_navbar_data.php'; 
include 'component/navbar.php'; 
?>

<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkout</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style/checkout.css">
  <script src="/public/checkout.js" defer></script>
  </style>
</head>
<div class="checkout-container">
    <!-- Header -->
    <div class="checkout-header">
        <h2>Checkout</h2>
        <p>Periksa kembali pesanan Anda sebelum melanjutkan pembayaran</p>
    </div>
    
    <div class="checkout-grid">
        <!-- Left Column -->
        <div class="main-content">
            <!-- Buyer Info -->
            <div class="buyer-info-card">
                <h3>Informasi Pengiriman</h3>
                
                <div class="info-row">
                    <div class="info-label">Alamat Pengiriman</div>
                    <div id="shipping-address" contenteditable="false">
                    </div>
                    <button id="edit-address-button" type="button">Ubah Alamat</button>
                </div>
                
                <div class="info-row">
                    <div class="balance-display">
                        <span>Saldo Anda</span>
                        <span id="buyer-balance">Rp 0</span>
                    </div>
                </div>
                 </div>
            
            <!-- Order Summary -->
            <div class="order-summary-card">
                <h3>Ringkasan Pesanan</h3>
                <div id="order-summary">
                    <div class="loading-state">Memuat data keranjang...</div>
                </div>
            </div>
        </div>
        
        <!-- Right Column - Summary Sidebar -->
        <div class="summary-sidebar">
            <div class="summary-card">
                <h3>Ringkasan Pembayaran</h3>
                <div id="total-summary">
                </div>
                <button id="checkout-button" disabled>Bayar Sekarang</button>
            </div>
        </div>
         </div>
</div>
</body>
<?php include 'component/footer.php'?>
</html>