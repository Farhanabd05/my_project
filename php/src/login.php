<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Nimonspedia</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/style/login.css">
    <script src="/public/auth.js" defer></script>
</head>
<body>
    <div class="page-container">
        <h1 class="main-title">Nimonspedia</h1>
        <div class="login-wrapper">
            <div class="login-illustration">
                <img src="/style/image/tes4.png" alt="Ilustrasi Login">
                <h2>Jual Beli Murah Hanya di Nimonspedia</h2>
                <p>Gabung dan rasakan kemudahan bertansaksi di Nimonspedia.</p>
            </div>
            <div class="login-content">
                <div class="auth-container">
                    <h2>Login ke Nimonspedia</h2>
                    <form id="login-form">
                        <div class="form-group">
                            <label for="email">Email:</label>
                            <input type="email" id="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Password:</label>
                            <input type="password" id="password" name="password" required>
                        </div>
                        
                        <div id="error-message"></div>
                        <button type="submit" id="submit-button">Login</button>
                        <p>Belum punya akun? <a href="/register.php">Daftar di sini</a>.</p>
                    </form>
                </div>
            </div>
        </div>
    </div>
</body>
</html>