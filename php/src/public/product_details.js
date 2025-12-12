function showSkeletons() {
    const container = document.getElementById("product-details");
    container.innerHTML = `
        <div class="skeleton-card" role="status" aria-live="polite">
            <div>⏳ Memuat detail produk...</div>
        </div>
     `;
}

function setupQuantityControls(stock, initQuantity) {
    const input = document.getElementById("quantity-input");
    const incBtn = document.getElementById("inc-btn");
    const decBtn = document.getElementById("dec-btn");
    const addToCartBtn = document.getElementById("cart-btn");
    
    input.value = initQuantity || 0;
    const isOutOfStock = (stock === 0);
    
    if (isOutOfStock) {
        input.disabled = true;
        incBtn.disabled = true;
        decBtn.disabled = true;
    } else {
        input.disabled = false;
        incBtn.disabled = false;
        decBtn.disabled = false;
    }
    
    if (addToCartBtn) {
        addToCartBtn.disabled = isOutOfStock;
        if (isOutOfStock) {
            addToCartBtn.textContent = "Stok Habis";
        }
    }

    function clamp(val) {
        return Math.min(Math.max(val, 0), stock);
    }

    function update(newVal) {
        const clampedVal = clamp(newVal);
        input.value = clampedVal;
        input.setAttribute('aria-valuenow', clampedVal);
        if (decBtn) decBtn.disabled = (clampedVal <= 0 || (stock === 0));
        if (incBtn) incBtn.disabled = (clampedVal >= stock || (stock === 0));
        if (addToCartBtn) {
            addToCartBtn.disabled = (clampedVal === 0 || stock === 0);
        }
    }

    incBtn.addEventListener("click", () => {
        const current = parseInt(input.value) || 0;
        update(current + 1);
    });
    decBtn.addEventListener("click", () => {
        const current = parseInt(input.value) || 0;
        update(current - 1);
    });
    input.addEventListener("input", () => {
        const val = parseInt(input.value);
        if (isNaN(val)) input.value = 0;
        else update(val);
    });
    update(initQuantity || 0);
}

function updateNavbarCartCount(count) {
    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
        cartBadge.textContent = count;
        if (count > 0) {
            cartBadge.classList.add('show');
        } else {
            cartBadge.classList.remove('show');
        }
    }
}

// Toast Function
function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 50);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, duration);
}

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get("store_id");
    const productId = params.get("product_id");

    if (!storeId || !productId) {
        console.error("Store ID or Product ID missing");
        document.getElementById("product-details").innerHTML = '<h2>Parameter tidak valid.</h2>';
        window.location.href = "/discovery.php";
        return;
    }

    const container = document.getElementById("product-details");
    showSkeletons();

    const xhrLoad = new XMLHttpRequest();
    const apiUrl = `/api/get_product_details.php?store_id=${storeId}&product_id=${productId}`;
    xhrLoad.open('GET', apiUrl, true);

    xhrLoad.onload = function() {
        if (xhrLoad.status >= 200 && xhrLoad.status < 300) {
            try {
                const data = JSON.parse(xhrLoad.responseText);

                if (data.error) {
                    container.innerHTML = `<h2>${data.error}</h2>`;
                    return;
                }

                const { session, product, categories, store, cart, auction } = data;
                const REACT_URL = "http://localhost:5173";
                let auctionHtml = '';

                if (auction) {
                    const isLive = auction.status === 'active';
                    const label = isLive ? '🔴 SEDANG DILELANG' : '📅 AKAN DILELANG';
                    const color = isLive ? '#d32f2f' : '#1976d2'; // merah jika live, biru jika scheduled

                    auctionHtml = `
                        <div style="margin: 15px 0; padding: 15px; border: 1px solid ${color}; border-radius: 8px; background-color: #fffafa;">
                            <div style="color: ${color}; font-weight: bold; margin-bottom: 5px;">${label}</div>
                            <div style="font-size: 14px; margin-bottom: 10px;">
                                Mulai dari: <strong>Rp${Number(auction.starting_price).toLocaleString('id-ID')}</strong>
                            </div>
                            <a href="${REACT_URL}/auction/${auction.id}" 
                            style="display: block; width: 100%; padding: 10px; background-color: ${color}; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
                            Ikuti Lelang Sekarang ➔
                            </a>
                        </div>
                    `;
                }

                // Build categories HTML
                const categoriesHTML = categories && categories.length > 0
                    ? categories.map(c => `<span class="category-tag">${c.name}</span>`).join('')
                    : '<span class="category-tag">Tidak ada kategori</span>';

                // Render HTML
                container.innerHTML = `
                    <div class="product-grid">
                        <div class="image-section">
                            <img 
                                src="${product.main_image_path}" 
                                alt="${product.product_name || 'Product'}" 
                                class="product-image"
                                onerror="this.onerror=null; this.src='/public/uploads/ui/placeholder.png'"
                            >
                        </div>

                        <div class="product-info">
                            <h1>${product.product_name || 'Nama Produk'}</h1>
                            
                            <div class="store-name">
                                Terjual oleh 
                                <a href="/store_details.php?store_id=${store.store_id}">${store.store_name || 'Nama Toko'}</a>
                            </div>

                            <div class="price" aria-label="Harga produk">Rp${Number(product.price || 0).toLocaleString('id-ID')}</div>
                            ${auctionHtml}
                            <div class="stock">
                                Stok: <span>${product.stock > 0 ? product.stock : 'Habis'}</span>
                            </div>

                            <div class="categories" role="list" aria-label="Kategori produk">
                                ${categoriesHTML}
                            </div>

                            <div class="description">${product.description || 'Tidak ada deskripsi'}</div>
                            
                            <div class="quantity-control" role="group" aria-label="Kontrol jumlah">
                                <button id="dec-btn" aria-label="Kurangi jumlah">−</button>
                                <input 
                                    id="quantity-input" 
                                    type="number" 
                                    value="${cart.quantity}" 
                                    min="0" 
                                    max="${product.stock || 0}" 
                                    readonly
                                    aria-label="Jumlah produk"
                                >
                                <button id="inc-btn" aria-label="Tambah jumlah">+</button>
                            </div>
                     `;

                if (session === "BUYER") {
                    const productInfoDiv = container.querySelector('.product-info');
                    productInfoDiv.innerHTML += `
                            <div class="cart-actions">
                                <button class="btn-add-cart" id="add-to-cart">Tambahkan ke Keranjang</button>
                                <button class="btn-view-cart" onclick="window.location.href='/cart.php'">Lihat Keranjang</button>
                                <button class="btn-chat" id="btn-chat-seller" data-store-id="${store.store_id}">
                                    💬 Chat Penjual
                                </button>
                            </div>
                        `;
                } else { // utk guest
                    const productInfoDiv = container.querySelector('.product-info');
                    productInfoDiv.innerHTML += `
                            <div class="login-prompt" role="alert">
                                <a href="/login.php">Masuk</a> atau <a href="/register.php">Daftar</a> untuk menambahkan ke keranjang
                            </div>
                        `;
                }

                const productInfoDiv = container.querySelector('.product-info');
                productInfoDiv.innerHTML += `
                            <section class="store-info">
                                <h2>Tentang Toko</h2>
                                <p><a href="/store_details.php?store_id=${store.store_id}">${store.store_name || 'Nama Toko'}</a></p>
                                <p>${store.store_description || 'Tidak ada deskripsi toko'}</p>
                            </section>
                        </div>
                    </div>
                `;

                if (session === "BUYER") {
                    setupQuantityControls(product.stock, cart.quantity);
                }

                // --- LOGIKA ADD TO CART ---
                const cartBtn = document.getElementById("cart-btn");
                const quantityInput = document.getElementById("quantity-input"); // Definisikan di sini agar scope aman

                // Pastikan elemen ada sebelum pasang listener (karena conditional session)
                const addToCartButton = document.getElementById("add-to-cart");
                if (addToCartButton && quantityInput) {
                    addToCartButton.addEventListener("click", () => {
                        const quantity = parseInt(quantityInput.value) || 0;
                        const productIdFromButton = productId; // Pakai variable dari URL params

                        addToCartButton.disabled = true;
                        addToCartButton.textContent = 'Memproses...';

                        const xhrUpdateCart = new XMLHttpRequest();
                        xhrUpdateCart.open("POST", "/api/update_cart_item.php", true);
                        xhrUpdateCart.setRequestHeader("Content-Type", "application/json");

                        xhrUpdateCart.onload = function() {
                            addToCartButton.disabled = false;
                            addToCartButton.textContent = 'Tambahkan ke Keranjang';

                            if (xhrUpdateCart.status >= 200 && xhrUpdateCart.status < 300) {
                                try {
                                    const updateData = JSON.parse(xhrUpdateCart.responseText);
                                    if (updateData.success) {
                                        showToast(updateData.message);
                                        updateNavbarCartCount(updateData.cartCount);
                                    } else {
                                        showToast("Gagal: " + updateData.message);
                                    }
                                } catch (e) {
                                    showToast("Format respons server tidak valid.");
                                }
                            } else {
                                showToast(`Error ${xhrUpdateCart.status}: Gagal memperbarui keranjang.`);
                            }
                        };

                        xhrUpdateCart.onerror = function() {
                            addToCartButton.disabled = false;
                            addToCartButton.textContent = 'Tambahkan ke Keranjang';
                            showToast("Error jaringan saat memperbarui keranjang.");
                        };

                        xhrUpdateCart.send(JSON.stringify({
                            product_id: productIdFromButton,
                            quantity: quantity
                        }));
                    });
                }

                // === [LOGIKA CHAT PENJUAL - FINAL CLEAN VERSION] ===
                document.addEventListener('click', async function(e) {
                    const target = e.target.closest('#btn-chat-seller');
                    
                    if (target) {
                        e.preventDefault();
                        
                        const btnChatSeller = target;
                        const storeId = btnChatSeller.getAttribute('data-store-id');
                        const originalText = btnChatSeller.textContent;

                        // Disable tombol & Loading state
                        btnChatSeller.disabled = true;
                        btnChatSeller.textContent = '⏳ Memuat...';

                        try {
                            //  Ambil Token JWT, bukan sekadar user_id biasa
                            // Endpoint ini akan men-generate token berdasarkan session PHP login
                            const authRes = await fetch('/api/get_auth_token.php');
                            const authData = await authRes.json();

                            if (!authData.success || !authData.token) {
                                showToast('Anda harus login terlebih dahulu', 3000);
                                setTimeout(() => window.location.href = '/login.php', 1500);
                                return;
                            }
                            const token = authData.token; // Simpan token

                            // 2. Initiate Chat Room
                            const chatRes = await fetch('/api/node/chats/initiate', {
                                method: 'POST',
                                headers: { 
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    storeId: storeId
                                })
                            });

                            const chatData = await chatRes.json();

                            if (chatData.success) {
                                showToast('Mengalihkan ke chat...', 1000);
                                
                                // 3. Siapkan Data Preview
                                const previewData = {
                                    id: product.product_id,
                                    name: product.product_name,
                                    price: product.price,
                                    image: product.main_image_path
                                };
                                
                                const encodedPreview = encodeURIComponent(JSON.stringify(previewData));
                                const chatUrl = `http://localhost:5173/chat?roomId=${chatData.roomId}&previewProduct=${encodedPreview}`;
                                
                                // Redirect
                                window.location.href = chatUrl;

                            } else {
                                showToast('Gagal: ' + (chatData.message || 'Unknown error'), 3000);
                                btnChatSeller.disabled = false;
                                btnChatSeller.textContent = originalText;
                            }
                        } catch (err) {
                            console.error('Error starting chat:', err);
                            showToast('Error koneksi ke server chat', 3000);
                            btnChatSeller.disabled = false;
                            btnChatSeller.textContent = originalText;
                        }
                    }
                });

            } catch (e) {
                console.error("Error parsing product details JSON:", e);
                container.innerHTML = '<div class="skeleton-card">Terjadi kesalahan saat memproses data produk</div>';
            }
        } else {
            console.error('Error loading product details:', xhrLoad.statusText);
            container.innerHTML = '<div class="skeleton-card">Gagal memuat produk.</div>';
        }
    };

    xhrLoad.onerror = function() {
        console.error('Network Error loading product details');
        container.innerHTML = '<div class="skeleton-card">Tidak dapat terhubung ke server</div>';
    };

    xhrLoad.send();
});