<?php
session_start();

$uri = $_SERVER['REQUEST_URI'];
$uriPath = parse_url($uri, PHP_URL_PATH);
$parts = explode('/', trim($uriPath, '/'));

// skip jika file static (js, css, images, dll)
if(preg_match('/\.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|pdf|zip)$/i', $uriPath)){
    return false;
}

// route untuk product_details.php
$storeSlug = $parts[0] ?? null;
$productSlug = $parts[1] ?? null;
$storeId = $_GET['store_id'] ?? null;
$productId = $_GET['product_id'] ?? null;

if($storeSlug && $productSlug && $storeId && $productId){
    if(file_exists('product_details.php')) {
        include 'product_details.php';
        exit;
    }
}

// daftar halaman yang valid DENGAN .php extension
$validPagesWithExt = [
    'discovery.php',
    'login.php',
    'register.php',
    'dashboard.php',
    'profile.php',
    'cart.php',
    'product_management.php',
    'order_management.php',
    'add_product.php',
    'edit_product.php',
    'store_details.php',
    'checkout.php',
    'order_history.php',
    'change_password.php',
    'product_details.php',
    '404.php'
];

// ambil path tanpa leading/trailing slash
$requestedPath = trim($uriPath, '/');

// jika root path, redirect ke discovery
if(empty($requestedPath) || $requestedPath === 'index.php') {
    header('Location: /discovery.php');
    exit;
}

// cek apakah request adalah file .php
if (preg_match('/\.php$/i', $requestedPath)) {
    // cek apakah file .php yang diminta ada dalam daftar valid
    if (in_array($requestedPath, $validPagesWithExt) && file_exists($requestedPath)) {
        include $requestedPath;
        exit;
    }
    
    // jika .php file tidak valid atau tidak ada, tampilkan 404
    http_response_code(404);
    if(file_exists('404.php')) {
        include '404.php';
    } else {
        echo '<h1>404 - Page Not Found</h1>';
    }
    exit;
}

// handel URL tanpa .php extension
$phpFile = $requestedPath . '.php';
if (in_array($phpFile, $validPagesWithExt) && file_exists($phpFile)) {
    include $phpFile;
    exit;
}

// jika tidak ada yang cocok, tampilkan 404
http_response_code(404);
include '404.php';
exit;