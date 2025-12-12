<link rel="stylesheet" href="/style/footer.css">
<footer>
    <hr>
    <div class = "footer-grid">
        <div>
            <h4>Nimonspedia</h4>
            <p>Tentang Nimonspedia</p>
            <p>Hak Kekayaan Intelektial</p>
            <p>Karir</p>
            <p>Blog</p>
            <p>Nimonspedia Affiliate Program</p>
            <p>Nimonspedia B2B Digital</p>
            <p>Nimonspedia Marketing Solutions</p>
            <p>Kalkulator Indeks Masa Tubuh</p>
            <p>Nimonspedia Farma</p>
            <p>Promo Hari Ini</p>
            <p>Beli Lokal</p>
            <p>Promo Guncang</p>
        </div>
        <div>
            <h4>Beli</h4>
            <p>Tagihan & Top Up</p>
            <p>Nimonspedia COD</p>
            <p>Bebas Ongkir</p>
            <h4>Jual</h4>
            <p>Pusat Edukasi Seller</p>
            <p>Daftar Mall</p>
            <h4>Bantuan dan Panduan</h4>
            <p>Nimonspedia Care</p>
            <p>Syarat dan Ketentuan</p>
            <p>Kebijakan Privasi</p>
        </div>
        <div>
            <h4>Keamanan & Privasi</h4>
            <p>Keamanan</p>
            <p>Privasi</p>
            <h4>Nikmatin keuntungan spesial di aplikasi:</h4>
            <p>Diskon 70% hanya di aplikasi</p>
            <p>Promo khusus aplikasi</p>
            <p>Gratis Ongkir tiap hari</p>
        </div>
    </div>
    <div class="footer-bottom">
        <hr>
        <p>© 2025, Milestone 1 K02 - 12. Nimonspedia. All Rights Reserved.</p>
    </div>
</footer>

<script src="/public/push-notif-php.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        // Ambil user_id dari Session PHP
        <?php 
           $loggedInUserId = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 'null';
        ?>
        const userId = <?php echo $loggedInUserId; ?>;

        if (userId) {
            // Jalankan fungsi subscribe yang ada di push-notif-php.js
            subscribeUserToPushPHP(userId);
        }
    });
</script>
<script>
document.addEventListener('DOMContentLoaded', () => {
    // Cek apakah user sedang login (ada session user_id?)
    <?php if(isset($_SESSION['user_id'])): ?>
        fetch('/api/get_unread_notifications.php')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.notifications.length > 0) {
                    data.notifications.forEach(notif => {
                        // TAMPILKAN NOTIFIKASI
                        // Trigger Push Notification Lokal
                        if (Notification.permission === 'granted') {
                            navigator.serviceWorker.ready.then(registration => {
                                registration.showNotification(notif.title, {
                                    body: notif.message,
                                    icon: '/public/uploads/ui/placeholder.png',
                                    data: { url: notif.url }
                                });
                            });
                        }
                    });
                }
            })
            .catch(err => console.error("Gagal cek antrian notif:", err));
    <?php endif; ?>
});
</script>