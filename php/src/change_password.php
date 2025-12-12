<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: /login.php');
    exit;
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ubah Password</title>
    
    <link rel="stylesheet" href="/style/change_password.css">
    
    <script src="/public/change_password.js" defer></script>
    
    </head>
<body>
    
    <p><a href="/profile.php" class="back-link">&larr; Kembali ke Profil</a></p>
    
    <div class="form-container">
        <h1>Ubah Password Anda</h1>
    
        <form id="password-form">
            <div class="form-group">
                <label for="old_password">Password Lama:</label>
                <input type="password" id="old_password" name="old_password" required>
            </div>
            <div class="form-group">
                <label for="new_password">Password Baru:</label>
                <input type="password" id="new_password" name="new_password" required>
                <small>Minimal 8 karakter, 1 huruf besar, 1 kecil, 1 angka, 1 simbol.</small>
            </div>
            <div class="form-group">
                <label for="confirm_new_password">Konfirmasi Password Baru:</label>
                <input type="password" id="confirm_new_password" name="confirm_new_password" required>
            </div>
            <button type="submit" id="password-submit-button">Ubah Password</button>
            <div id="password-message" class="message"></div>
        </form>
    </div>

</body>
<?php include 'component/footer.php'?>
</html>