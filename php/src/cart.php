<?php
session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'BUYER') {
    header('Location: /login.php');
}

?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-M">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Keranjang Belanja</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/style/cart.css"> 
    <script src="/public/cart.js" defer></script>
    </head>
<body>

<?php
include 'api/checkout_cart_access_control.php'; 
include 'api/get_navbar_data.php'; 
include 'component/navbar.php'; 
?>

    <div class="cart-header">
        <h1>Keranjang Belanja Anda</h1>
    </div>

    <div class="cart-container">
        <div class="cart-items" id="cart-items-container">
            <p id="loading-cart">Memuat keranjang...</p>
        </div>

        <div class="cart-summary" id="cart-summary-container">
            </div>
    </div>
</body>
<?php include 'component/footer.php'?>
</html>