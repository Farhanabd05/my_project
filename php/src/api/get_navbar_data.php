<?php
$userId = $_SESSION['user_id'] ?? null;
$userRole= $_SESSION['role'] ?? 'guest';
$cartCount = 0;
$balance = 0;
$storeBalance=0;

if($userId){
    $host = 'database';
    $port = '5432';
    $dbname = 'nimonspedia';
    $user = 'user';
    $password = 'password';
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;user=$user;password=$password";

    try {
        $pdo = new PDO($dsn);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        if ($userRole ==='BUYER'){
        
            $cartSql = 'select count(cart_item_id) from cart_item where buyer_id = ?';
            $cartStmt = $pdo->prepare($cartSql);
            $cartStmt->execute([$userId]);
            $cartCount = $cartStmt->fetchColumn();
    
            $balanceSql = 'select balance from users where user_id = ?';
            $balanceStmt = $pdo->prepare($balanceSql);
            $balanceStmt->execute([$userId]);
            $balance = $balanceStmt->fetchColumn();
        } else if ($userRole === 'SELLER'){
            $storeBalanceSql = 'SELECT balance FROM store WHERE user_id = ?';
            $storeBalanceStmt = $pdo->prepare($storeBalanceSql);
            $storeBalanceStmt->execute([$userId]);
            $storeBalance = (int)$storeBalanceStmt->fetchColumn();
        }
    } catch (Exception $e) {
        error_log("Error in get_navbar_data.php: " . $e->getMessage());
    }
}
?>

