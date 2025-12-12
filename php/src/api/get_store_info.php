<?php
session_start();
header('Content-Type: application/json');

$id = $_SESSION['user_id'] ?? null;
$storeId = $_GET["store_id"] ?? null;

$host = 'database';
$port = '5432';
$dbname = 'nimonspedia';
$user = 'user';
$password = 'password';
$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // store
    $storeStmt = $pdo->prepare("
        SELECT store_logo_path, store_name, store_description
        FROM store
        WHERE store_id = ?
    ");
    $storeStmt->execute([$storeId]);
    $store = $storeStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode(['store'=>$store]);
} catch (Exception $e) {
    $errorMessage = $e->getMessage();
}
?>

