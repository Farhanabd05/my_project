<?php
$message = "Whoops. It seems that this page is unavailable.";
if (!empty($_SESSION['reason'])) {
    $message = htmlspecialchars($_SESSION['reason'], ENT_QUOTES, 'UTF-8');
    unset($_SESSION['reason']); // optional: clear it after use
}
?>
<!DOCTYPE HTML>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <link rel="stylesheet" href="/style/notfound.css">
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">

    <title>Page Not Found</title>
</head>
<body>
    <div class="notfound">
        <p><?php echo $message; ?> </p>
        <p> <a href="/discovery.php">Go back to homepage</a> </p>
    </div>
</body>
</html>