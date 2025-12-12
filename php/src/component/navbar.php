<?php
$userId = $_SESSION['user_id'] ?? null;
$userRole = $_SESSION['role'] ?? null;
$checkoutEnabled = false;
$chatEnabled = false;
$auctionEnabled = false;

if ($userId) {
    $stmt = $pdo->prepare("SELECT is_enabled FROM feature_access WHERE user_id IS NULL AND feature_name = 'checkout_enabled' LIMIT 1");
    $stmt->execute();
    $feature = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($feature && $feature['is_enabled']) {
        $stmt = $pdo->prepare("SELECT is_enabled FROM feature_access WHERE user_id = ? AND feature_name = 'checkout_enabled' LIMIT 1");
        $stmt->execute([$userId]);
        $feature = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($feature && $feature['is_enabled']) {
            $checkoutEnabled = true;
        }
    }
    $stmt = $pdo->prepare("SELECT is_enabled FROM feature_access WHERE user_id IS NULL AND feature_name = 'chat_enabled' LIMIT 1");
    $stmt->execute();
    $feature = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($feature && $feature['is_enabled']) {
        $stmt = $pdo->prepare("SELECT is_enabled FROM feature_access WHERE user_id = ? AND feature_name = 'chat_enabled' LIMIT 1");
        $stmt->execute([$userId]);
        $feature = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($feature && $feature['is_enabled']) {
            $chatEnabled = true;
        }
    }
    $stmt = $pdo->prepare("SELECT is_enabled FROM feature_access WHERE user_id IS NULL AND feature_name = 'auction_enabled' LIMIT 1");
    $stmt->execute();
    $feature = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($feature && $feature['is_enabled']) {
        $stmt = $pdo->prepare("SELECT is_enabled FROM feature_access WHERE user_id = ? AND feature_name = 'auction_enabled' LIMIT 1");
        $stmt->execute([$userId]);
        $feature = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($feature && $feature['is_enabled']) {
            $auctionEnabled = true;
        }
    }
}
?>

<link rel="stylesheet" href="/style/navbar.css">
<nav>
     <ul>
        <li class="nav-logo">
            <?php if ($userRole === 'BUYER'): ?>
                <a href="/discovery.php">
                    <div class="logo-placeholder">N</div>
                </a>
            <?php endif; ?>
            <?php if ($userRole === 'SELLER'): ?>
                <a href="/dashboard.php">
                    <div class="logo-placeholder">N</div>
                </a>
            <?php endif; ?>
        </li>  
        <?php if ($userRole === 'BUYER'): ?>
            <?php if ($userRole === 'BUYER' && $checkoutEnabled): ?>
                <li class="nav-cart">
                    <a href="/cart.php">
                        <!-- MENGGUNAKAN ICON SVG YANG ADA DI PATH public/icons/cart.svg -->
                        <img src="../style/icons/shopping-cart.svg" alt="Keranjang" class="icon">
                        <span id="cart-badge" class="<?= $cartCount > 0 ? '' : 'hidden' ?>">
                            <?= $cartCount ?>
                        </span>
                    </a>
                </li>
            <?php endif; ?>
            <li class="nav-balance-mobile">
                <div class="nav-balance">
                    <span class="balance-amount" data-balance="<?= $balance ?>">Rp<?= number_format($balance, 0, ',', '.') ?></span>
                    <button class="topup-btn" onclick="openTopUpModal()">+</button>
                </div>
            </li>
        <?php endif; ?>
        
        <li class="hamburger-container">
            <button class="hamburger" onclick="toggleMobileMenu()" aria-label="Toggle menu navigasi">
                <span></span>
                <span></span>
                <span></span>
            </button>
        </li>
        
        <!-- Desktop Menu Items -->
        <?php if ($userRole === 'BUYER'): ?>
            <li>
                <a href="/order_history.php">
                    History
                </a>
            </li>
            <?php if ($userRole === 'BUYER' && $chatEnabled): ?>
                <li>
                    <a href="http://localhost:5173/chat" target="_blank">💬 Chat</a>
                </li>
            <?php endif; ?>
            <?php if ($userRole === 'BUYER' && $auctionEnabled): ?>
                <li>
                    <a href="http://localhost:5173/auctions" target="_blank">Auction</a>
                </li>   
            <?php endif; ?>
            <li class="nav-balance-desktop">
                 <div class="nav-balance">
                    <span class="balance-amount" data-balance="<?= $balance ?>">Rp<?= number_format($balance, 0, ',', '.') ?></span>
                    <button class="topup-btn" onclick="openTopUpModal()">+</button>
                 </div>
             </li>

            <li><a href="/profile.php"> Profil</a></li> 
            <li><a href="#" class="btn-logout" onclick="logout()">Keluar</a></li>

 
        <?php elseif ($userRole === 'SELLER'): ?>
            <li><a href="/dashboard.php">Dashboard</a></li>
            <li><a href="/product_management.php">Produk</a></li>
            <?php if ($userRole === 'SELLER' && $checkoutEnabled): ?>
                <li><a href="/order_management.php">Orders</a></li>
            <?php endif; ?>
            <?php if ($userRole === 'SELLER' && $chatEnabled): ?>
                <li>
                    <a href="http://localhost:5173/chat" target="_blank">💬 Chat</a>
                </li>
            <?php endif; ?>
            <?php if ($userRole === 'SELLER' && $auctionEnabled): ?>
                <li>
                    <a href="http://localhost:5173/auctions" target="_blank">Auction</a>
                </li>
            <?php endif; ?>
            <li>
                <div class="nav-balance">
                    <span>💰 Saldo:</span>
                    <span class="balance-amount">Rp<?= number_format($storeBalance, 0, ',', '.') ?></span>
                </div>
            </li>
            <li><a href="/profile.php"> Profil</a></li>
            <li><a href="#" class="btn-logout" onclick="logout()">Keluar</a></li>

         <?php else: ?>
             <li class="nav-auth">
                 <a href="/login.php" class="btn-login">Masuk</a>
                 <a href="/register.php" class="btn-register">Daftar</a>
             </li>
         <?php endif; ?>
     </ul>
     
     <!-- Mobile Menu Dropdown -->
     <div class="mobile-menu" id="mobile-menu">
         <ul>
             <?php if ($userRole === 'BUYER'): ?>
                 <li>
                     <a href="/order_history.php">History</a>
                 </li>
                 <li>
                     <a href="http://localhost:5173/chat" target="_blank">💬 Chat</a>
                 </li>
                 <li>
                     <a href="http://localhost:5173/auctions" target="_blank">Auction</a>
                 </li>
                 <li><a href="/profile.php">Profil</a></li> 
                 <li><a href="#" class="btn-logout" onclick="logout()">Keluar</a></li>
     
             <?php elseif ($userRole === 'SELLER'): ?>
                 <li><a href="/dashboard.php">Dashboard</a></li>
                 <li><a href="/product_management.php">Produk</a></li>
                 <li><a href="/order_management.php">Orders</a></li>
                 <li>
                     <a href="http://localhost:5173/chat" target="_blank">💬 Chat</a>
                 </li>
                 <li>
                     <a href="http://localhost:5173/auctions" target="_blank">Auction</a>
                 </li>
                 <li>
                     <div class="nav-balance">
                         <span>💰 Saldo:</span>
                         <span class="balance-amount">Rp<?= number_format($storeBalance, 0, ',', '.') ?></span>
                     </div>
                 </li>
                 <li><a href="#" class="btn-logout" onclick="logout()">Keluar</a></li>
     
             <?php else: ?>
                 <li class="nav-auth">
                     <a href="/login.php" class="btn-login">Masuk</a>
                     <a href="/register.php" class="btn-register">Daftar</a>
                 </li>
             <?php endif; ?>
         </ul>
     </div>
 </nav>

<div id="topup-modal-overlay" class="modal-overlay">
    <div class="modal-content">
        <h3> Top-up Saldo</h3>
        <div class="form-group">
            <label for="topup-modal-input">Masukkan Jumlah Top-up:</label>
            <input 
                type="number" 
                id="topup-modal-input" 
                placeholder="Contoh: 100000"
                min="1000"
            >
        </div>
        <div class="modal-actions">
            <button type="button" id="topup-cancel-btn">Batal</button>
            <button type="button" id="topup-ok-btn">Konfirmasi</button>
        </div>
    </div>
</div>
<script>
    function toggleMobileMenu() {
        const hamburger = document.querySelector('.hamburger');
        const mobileMenu = document.getElementById('mobile-menu');
        
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        const hamburger = document.querySelector('.hamburger');
        const mobileMenu = document.getElementById('mobile-menu');
        const nav = document.querySelector('nav');
        
        if (!nav.contains(event.target) && mobileMenu.classList.contains('active')) {
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('active');
        }
    });
    
    // Close mobile menu when clicking menu item
    document.querySelectorAll('.mobile-menu a').forEach(link => {
        link.addEventListener('click', function() {
            const hamburger = document.querySelector('.hamburger');
            const mobileMenu = document.getElementById('mobile-menu');
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('active');
        });
    });
    function logout() {
        if (confirm('Apakah Anda yakin ingin logout?')) {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/logout.php', true); 
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            alert('Anda telah logout.');
                            window.location.href = '/login.php';
                        } else { alert('Logout gagal: ' + response.message); }
                    } catch (err) { alert('Gagal memproses respons logout.'); }
                } else { alert('Gagal menghubungi server untuk logout.'); }
            };
            xhr.onerror = function() { alert('Error jaringan saat mencoba logout.'); };
            xhr.send();
        }
    }

    function openTopUpModal() {
        const modalOverlay = document.getElementById('topup-modal-overlay');
        const modalInput = document.getElementById('topup-modal-input');
        const okBtn = document.getElementById('topup-ok-btn');
        const cancelBtn = document.getElementById('topup-cancel-btn');

        if (!modalOverlay || !modalInput || !okBtn || !cancelBtn) {
            console.error('Elemen modal top-up tidak ditemukan!');
            return;
        }
        
        modalInput.value = '';
        modalOverlay.classList.add('active');
        modalInput.focus();

        // Tombol "OK" (Top-up Sekarang)
        okBtn.onclick = function() {
            const amount = parseInt(modalInput.value, 10);
            
            // Validasi client-side
            if (isNaN(amount) || amount <= 1000) {
                alert("Masukkan jumlah yang valid (minimal Rp1.000)");
                modalInput.focus();
                return;
            }

            // disable tombol
            okBtn.disabled = true;
            okBtn.textContent = 'Memproses...';
            cancelBtn.disabled = true;

            // call api
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/topup_balance.php', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            xhr.onload = function() {
                // selalu enable tombol kembali, apapun hasilnya
                okBtn.disabled = false;
                okBtn.textContent = 'Konfirmasi';
                cancelBtn.disabled = false;
                
                let responseData = null;
                try { responseData = JSON.parse(xhr.responseText); } catch(e) {
                    console.error("Gagal mengurai respons JSON:", e);
                    alert('Gagal memproses respons server.');
                    return;
                }
                
                if (xhr.status >= 200 && xhr.status < 300 && responseData.success) {
                    alert(responseData.message + `\nSaldo baru Anda: Rp ${responseData.new_balance.toLocaleString('id-ID')}`);
                    modalOverlay.classList.remove('active');
                    window.location.reload(); // reload buat update saldo
                } else {
                    alert('Top-up GAGAL: ' + (responseData ? responseData.message : 'Error Server'));
                    modalInput.focus(); // fokus ke input lagi jika gagal
                }
            };
            
            xhr.onerror = function() {
                okBtn.disabled = false;
                okBtn.textContent = 'Konfirmasi';
                cancelBtn.disabled = false;
                alert('Error jaringan. Tidak dapat terhubung ke server.');
            };
            
            xhr.send(JSON.stringify({ amount: amount }));
        };

        // tombol "Batal"
        cancelBtn.onclick = function() {
            modalOverlay.classList.remove('active');
        };
        
        //  klik Overlay
        modalOverlay.onclick = function(event) {
            if (event.target === modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        };
        modalOverlay.querySelector('.modal-content').onclick = function(event) {
            event.stopPropagation(); // hentikan klik di konten agar tidak menutup modal
        };
    }
    // Format balance untuk mobile (50K, 1.2M, dll)
    function formatBalanceMobile() {
        if (window.innerWidth <= 1024) {
            const balanceElements = document.querySelectorAll('.nav-balance-mobile .balance-amount');
            balanceElements.forEach(el => {
                const rawBalance = parseFloat(el.getAttribute('data-balance'));
                if (isNaN(rawBalance)) return;
                
                let formatted;
                if (rawBalance >= 1000000) {
                    formatted = (rawBalance / 1000000).toFixed(1).replace('.0', '') + 'M';
                } else if (rawBalance >= 1000) {
                    formatted = (rawBalance / 1000).toFixed(1).replace('.0', '') + 'K';
                } else {
                    formatted = rawBalance.toString();
                }
                
                el.textContent = 'Rp' + formatted;
            });
        } else {
            // Kembalikan format lengkap untuk desktop
            const balanceElements = document.querySelectorAll('.balance-amount');
            balanceElements.forEach(el => {
                const rawBalance = parseFloat(el.getAttribute('data-balance'));
                if (isNaN(rawBalance)) return;
                el.textContent = 'Rp' + rawBalance.toLocaleString('id-ID');
            });
        }
    }
    
    // Jalankan saat load dan resize
    formatBalanceMobile();
    window.addEventListener('resize', formatBalanceMobile);
</script>