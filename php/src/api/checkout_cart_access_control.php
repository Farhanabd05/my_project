<?php

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'BUYER') {
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Silakan login sebagai Buyer.']);
    exit;
}

$buyerId = $_SESSION['user_id'];

$host = 'database'; $port = '5432'; $dbname = 'nimonspedia'; $user = 'user'; $password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

$checkout_enabled = false;
$current_file = basename($_SERVER['SCRIPT_NAME']);

$pdo = new PDO($dsn);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$stmt = $pdo->prepare("SELECT is_enabled, reason FROM feature_access WHERE user_id IS NULL AND feature_name = 'checkout_enabled' LIMIT 1");
$stmt->execute();
$feature = $stmt->fetch(PDO::FETCH_ASSOC);
if ($feature && !$feature['is_enabled']) {
    if (($current_file === 'cart.php' || $current_file === 'checkout.php')) {
        $_SESSION['reason'] = $feature['reason'];
        include '404.php';
        exit;
    }
} else{
    $stmt = $pdo->prepare("SELECT is_enabled, reason FROM feature_access WHERE user_id = ? AND feature_name = 'checkout_enabled' LIMIT 1");
    $stmt->execute([$buyerId]);
    $feature = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($feature && !$feature['is_enabled']) {
        $checkout_enabled = true;
        if (($current_file === 'cart.php' || $current_file === 'checkout.php')) {
            $_SESSION['reason'] = $feature['reason'];
            include '404.php';
            exit;
        }
    }
}

