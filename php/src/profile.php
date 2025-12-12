<?php
session_start();
echo '<!doctype html>';
if (!isset($_SESSION['user_id'])) {
    header('Location: /login.php');
    exit;
}
$is_seller = ($_SESSION['role'] === 'SELLER');
include 'api/get_navbar_data.php'; 
include 'component/navbar.php'; 
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profil Saya</title>
    
    <link rel="stylesheet" href="/style/profile.css">
    
    <script src="/public/profile.js" defer></script>
    <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    
    <div class="main-container">

        <!-- <div class="profile-header">
            <h1>Profil Saya</h1>
            <p>Kelola informasi akun dan toko Anda.</p>
        </div> -->

        <div class="profile-content-wrapper">

            <?php if ($is_seller): ?>
                
                <div class="profile-grid-container-3-col">
                    
                    <div class="profile-card card-logo-uploader">
                        <h2>Logo Toko</h2>
                        <div class="store-logo-uploader">
                            <div class="form-group">
                                <label>Logo Saat Ini:</label>
                                <img id="current-logo" src="/public/uploads/ui/placeholder.png" alt="Logo Toko">
                            </div>
                            <div class="form-group">
                                <label for="store_logo">Ganti Logo:</label>
                                <input type="file" id="store_logo" name="store_logo" accept="image/jpeg, image/png, image/webp" form="store-profile-form">
                                <small>Max 2MB. Tipe: JPG, PNG, WEBP.</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="profile-card">
                        <h2>Informasi Toko</h2>
                        <form id="store-profile-form" action="/api/update_store_profile.php" method="POST" enctype="multipart/form-data">
                            <div class="store-fields">
                                <div class="form-group">
                                    <label for="store_name">Nama Toko:</label>
                                    <input type="text" id="store_name" name="store_name" required maxlength="100">
                                </div>
                                <div class="form-group">
                                    <label>Deskripsi Toko:</label>
                                    <div id="store-description-editor"></div>
                                    <input type="hidden" name="store_description" id="store_description">
                                </div>
                            </div>
                            
                            <button type="submit" id="store-profile-submit-button">Simpan Perubahan Toko</button>
                            
                            <?php if (isset($_GET['store_update_status'])): ?>
                                <div class="message <?php echo $_GET['store_update_status'] === 'success' ? 'success' : 'error'; ?>">
                                    <?php echo htmlspecialchars($_GET['store_update_message']); ?>
                                </div>
                            <?php endif; ?>
                        </form>
                    </div>
                    
                    <div class="profile-card">
                        <h2>Informasi Akun</h2>
                        <form id="profile-form">
                            <div class="form-group">
                                <label for="name">Nama Lengkap:</label>
                                <input type="text" id="name" name="name" required>
                            </div>
                            <div class="form-group">
                                <label for="email">Email:</label>
                                <input type="email" id="email" name="email" readonly>
                            </div>
                            <div class="form-group">
                                <label for="address">Alamat:</label>
                                <textarea id="address" name="address" rows="3" required></textarea>
                            </div>
                            <button type="submit" id="profile-submit-button">Simpan Perubahan Akun</button>
                            <div id="profile-message" class="message"></div>
                        </form>
                    </div>
                </div>
                
                <div class="profile-footer-wrapper">
                    <div class="profile-card security-section">
                        <div class="profile-card notification-section">
                            <h2>Pengaturan Notifikasi</h2>
                            <form id="notification-pref-form">
                                <div class="form-group-checkbox">
                                    <input type="checkbox" id="notif_order" name="order_enabled">
                                    <label for="notif_order">Notifikasi Pesanan (Order)</label>
                                </div>
                                <div class="form-group-checkbox">
                                    <input type="checkbox" id="notif_auction" name="auction_enabled">
                                    <label for="notif_auction">Notifikasi Lelang (Auction)</label>
                                </div>
                                <div class="form-group-checkbox">
                                    <input type="checkbox" id="notif_chat" name="chat_enabled">
                                    <label for="notif_chat">Notifikasi Chat</label>
                                </div>
                                </form>
                        </div>
                        <h2>Keamanan Akun</h2>
                        <div class="info-row">
                            <div>
                                <div class="label">Password</div>
                                <div class="value">**********</div>
                            </div>
                            <a href="/change_password.php" class="action-link btn-secondary">Ubah Password</a>
                        </div>
                    </div>

                    <div class="profile-card logout-section">
                        <button type="button" id="logout-button" class="btn-danger">Logout</button>
                    </div>
                </div>

            <?php else: ?>
                
                <div class="profile-grid-container-2-col">
                    
                    <div class="profile-card">
                        <h2>Informasi Akun</h2>
                        <form id="profile-form">
                            <div class="form-group">
                                <label for="name">Nama Lengkap:</label>
                                <input type="text" id="name" name="name" required>
                            </div>
                            <div class="form-group">
                                <label for="email">Email:</label>
                                <input type="email" id="email" name="email" readonly>
                            </div>
                            <div class="form-group">
                                <label for="address">Alamat:</label>
                                <textarea id="address" name="address" rows="3" required></textarea>
                            </div>
                            <button type="submit" id="profile-submit-button">Simpan Perubahan Akun</button>
                            <div id="profile-message" class="message"></div>
                        </form>
                    </div>

                    <div class="buyer-sidebar">
                        <div class="profile-card security-section">
                            <div class="profile-card notification-section">
                                <h2>Pengaturan Notifikasi</h2>
                                <form id="notification-pref-form">
                                    <div class="form-group-checkbox">
                                        <input type="checkbox" id="notif_order" name="order_enabled">
                                        <label for="notif_order">Notifikasi Pesanan (Order)</label>
                                    </div>
                                    <div class="form-group-checkbox">
                                        <input type="checkbox" id="notif_auction" name="auction_enabled">
                                        <label for="notif_auction">Notifikasi Lelang (Auction)</label>
                                    </div>
                                    <div class="form-group-checkbox">
                                        <input type="checkbox" id="notif_chat" name="chat_enabled">
                                        <label for="notif_chat">Notifikasi Chat</label>
                                    </div>
                                    </form>
                            </div>
                            <h2>Keamanan Akun</h2>
                            <div class="info-row">
                                <div>
                                    <div class="label">Password</div>
                                    <div class="value">**********</div>
                                </div>
                                <a href="/change_password.php" class="action-link btn-secondary">Ubah Password</a>
                            </div>
                        </div>

                        <div class="profile-card logout-section">
                             <h2>Logout Akun</h2>
                            <div class="info-row">
                                <p>Anda yakin ingin keluar?</p>
                                <button type="button" id="logout-button" class="btn-danger">Logout</button>
                            </div>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

        </div>
    </div>

    <?php if ($is_seller): ?>
    <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
    <?php endif; ?>
</body>
<?php include 'component/footer.php'?>
</html>