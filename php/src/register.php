<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daftar - Nimonspedia</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"></noscript>
    <link rel="stylesheet" href="/style/register.css">
    <script src="/public/auth.js" defer></script>
</head>
<body>
    <div class="page-container">
        <h1 class="main-title">Nimonspedia</h1>
        <div class="register-wrapper">
            <div class="register-illustration">
                <img src="/style/image/tes4.png" 
                    alt="Ilustrasi Daftar"
                    width="550"
                    height="550">
                <h2>Jual Beli Murah Hanya di Nimonspedia</h2>
                <p>Gabung dan rasakan kemudahan bertansaksi di Nimonspedia.</p>
            </div>
            <div class="register-content">
                <div class="auth-container">
                    <h2>Daftar Akun Baru</h2>
                    <form id="register-form">
                        <div class="form-scroll-wrapper">
                            <div class="form-group">
                                <label>Saya ingin mendaftar sebagai:</label>
                                <div class="role-group">
                                    <label for="role-buyer">
                                        <input type="radio" id="role-buyer" name="role" value="BUYER" checked> Pembeli
                                    </label>
                                    <label for="role-seller">
                                        <input type="radio" id="role-seller" name="role" value="SELLER"> Penjual
                                    </label>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="name">Nama Lengkap:</label>
                                <input type="text" id="name" name="name" required>
                            </div>
                            <div class="form-group">
                                <label for="email">Email:</label>
                                <input type="email" id="email" name="email" required>
                            </div>
                            <!-- Password dengan toggle visibility -->
                            <div class="form-group">
                                <label for="password">Password:</label>
                                <div class="password-wrapper">
                                    <input type="password" id="password" name="password" required>
                                    <button type="button" class="toggle-password" aria-label="Toggle password visibility" data-target="password">
                                        <span class="eye-icon">👁</span>
                                    </button>
                                </div>
                                <small>Minimal 8 karakter, 1 huruf besar, 1 huruf kecil, 1 angka, 1 simbol.</small>
                            </div>
                            <!-- Confirm Password dengan toggle visibility -->
                            <div class="form-group">
                                <label for="confirm_password">Konfirmasi Password:</label>
                                <div class="password-wrapper">
                                    <input type="password" id="confirm_password" name="confirm_password" required>
                                    <button type="button" class="toggle-password" aria-label="Toggle confirm password visibility" data-target="confirm_password">
                                        <span class="eye-icon">👁</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="address">Alamat:</label>
                                <textarea id="address" name="address" rows="3" required></textarea>
                            </div>

                            <div id="seller-fields">
                                <h4>Informasi Toko</h4>
                                <div class="form-group">
                                    <label for="store_name">Nama Toko:</label>
                                    <input type="text" id="store_name" name="store_name" maxlength="100">
                                    <small id="store-name-counter">0/100 karakter</small>
                                </div>
                                <div class="form-group">
                                    <label for="store_description">Deskripsi Toko (Opsional):</label>
                                    <textarea id="store_description" name="store_description" rows="4"></textarea>
                                </div>
                            </div>
                        </div>

                        <div id="error-message" role="alert" aria-live="polite"></div>
                        <button type="submit" id="submit-button">Daftar</button>
                        <p>Sudah punya akun? <a href="/login.php">Login di sini</a>.</p>
                    </form>
                </div>
            </div>
        </div>
    </div>
</body>
<?php include 'component/footer.php'?>
</html>