<?php

$uri = $_SERVER['REQUEST_URI'];
$uriPath = parse_url($uri, PHP_URL_PATH);
$parts = explode('/', trim($uriPath, '/'));

$storeSlug = $parts[0] ?? null;
$productSlug = $parts[1] ?? null;

$storeId = $_GET['store_id'] ?? null;
$productId = $_GET['product_id'] ?? null;

if(!$storeId || !$productId || !$storeSlug || !$productSlug){
    header("Location: /discovery.php");
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
        <title>Product Details</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/style/product_details.css">
    </head>
    <body>
        <div id="toast-container" role="alert" aria-live="polite"></div>
        <main class="container">
            <div id="product-details">
                <!-- dihandle js -->
            </div>
        </main>
    <script src="/public/product_details.js"></script>
    </body>
    <?php include 'component/footer.php'?>
</html>