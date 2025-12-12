// update badge di navbar
function updateNavbarCartCount(count) {
    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge) {
        cartBadge.textContent = count;
        if (count > 0) {
            cartBadge.classList.remove('hidden');
        } else {
            cartBadge.classList.add('hidden');
        }
    }
}


function loadCartData() {
    const itemsContainer = document.getElementById('cart-items-container');
    const summaryContainer = document.getElementById('cart-summary-container');
    
    // loading
    itemsContainer.innerHTML = '<p id="loading-cart">Memuat keranjang...</p>';
    summaryContainer.innerHTML = '<p>Memuat total...</p>';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/get_cart.php', true);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); // header AJAX

    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                    // fungsi render
                    renderCartItems(response.cart);
                    renderCartSummary(response.cart);
                    // listener stlh HTML dirender
                    attachCartEventListeners(); 
                } else {
                    itemsContainer.innerHTML = `<p class="error-message">${response.message || 'Gagal memuat keranjang.'}</p>`;
                }
            } catch (e) {
                console.error("Error parsing JSON:", e);
                itemsContainer.innerHTML = '<p class="error-message">Format respons server tidak valid.</p>';
            }
        } else {
            itemsContainer.innerHTML = `<p class="error-message">Gagal memuat keranjang (Error: ${xhr.status}).</p>`;
        }
    };

    xhr.onerror = function() {
        itemsContainer.innerHTML = '<p class="error-message">Error jaringan saat memuat keranjang.</p>';
    };

    xhr.send();
}

function renderCartItems(stores) {
    const itemsContainer = document.getElementById('cart-items-container');
    itemsContainer.innerHTML = '';

    if (!stores || stores.length === 0) {
        return;
    }

    stores.forEach(store => {
        itemsContainer.innerHTML += `<h2 class="store-group">${store.store_name}</h2>`;
        
        store.items.forEach(item => {
            const itemSubtotal = item.price * item.quantity;
            itemsContainer.innerHTML += `
                <div class="item-card" id="item-card-${item.cart_item_id}">
                    <img class="cart-image" src="${item.thumbnail_path || '/images/products/placeholder.png'}" alt="${item.product_name}">
                    <div class="item-info">
                        <strong>${item.product_name}</strong>
                        <p>Rp ${Number(item.price).toLocaleString('id-ID')}</p>
                        <p id="subtotal-${item.cart_item_id}">Subtotal: Rp ${itemSubtotal.toLocaleString('id-ID')}</p>
                    </div>
                    <div class="item-actions">
                        <div class="quantity-control">
                            <label for="qty-${item.cart_item_id}" class="sr-only">Jumlah ${item.product_name}</label>
                            <button class="qty-btn qty-dec" 
                                    data-cart-id="${item.cart_item_id}"
                                    data-product-id="${item.product_id}"
                                    data-price="${item.price}"
                                    data-max="${item.stock}"
                                    aria-label="Kurangi jumlah ${item.product_name}">−</button>
                            <input 
                                type="number" 
                                id="qty-${item.cart_item_id}"
                                class="quantity-input"
                                value="${item.quantity}" 
                                min="1" 
                                max="${item.stock}"
                                data-cart-id="${item.cart_item_id}"
                                data-product-id="${item.product_id}"
                                data-price="${item.price}"
                                data-max="${item.stock}"
                                aria-label="Jumlah ${item.product_name}"
                                aria-valuemin="1"
                                aria-valuemax="${item.stock}"
                                aria-valuenow="${item.quantity}"
                            >
                            <button class="qty-btn qty-inc" 
                                    data-cart-id="${item.cart_item_id}"
                                    data-product-id="${item.product_id}"
                                    data-price="${item.price}"
                                    data-max="${item.stock}"
                                    aria-label="Tambah jumlah ${item.product_name}">+</button>
                        </div>
                        <button 
                            class="delete-item-btn" 
                            data-cart-id="${item.cart_item_id}"
                            aria-label="Hapus ${item.product_name} dari keranjang"
                        >
                            <img src="../style/icons/trash-red.svg" alt="" role="presentation">
                        </button>
                    </div>
                </div>
            `;
        });
    });
}

function renderCartSummary(stores) {
    const summaryContainer = document.getElementById('cart-summary-container');
    
    let grandTotal = 0;
    let totalItems = 0;

    if (stores && stores.length > 0) {
        stores.forEach(store => {
            store.items.forEach(item => {
                grandTotal += item.price * item.quantity;
                totalItems += 1; // Hitung item unik (atau item.quantity jika mau total qty)
            });
        });
    }

    summaryContainer.innerHTML = `
        <h3>Ringkasan Belanja</h3>
        <p>Total Item: ${totalItems}</p>
        <hr>
        <h4>Total Harga: Rp ${grandTotal.toLocaleString('id-ID')}</h4>
        <button 
            id="checkout-btn" 
            ${totalItems === 0 ? 'disabled aria-disabled="true"' : ''}
            aria-label="Lanjut ke halaman checkout dengan ${totalItems} item"
        >
            Lanjut ke Checkout
        </button>
    `;

    // listener ke tombol checkout
    document.getElementById('checkout-btn').addEventListener('click', () => {
        window.location.href = '/checkout.php';
    });
}

function attachCartEventListeners() {
    // Listener untuk tombol HAPUS
    document.querySelectorAll('.delete-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            // Pastikan mengambil dari button, bukan dari img di dalamnya
            const cartItemId = e.currentTarget.getAttribute('data-cart-id');
            handleDeleteItem(cartItemId);
        });
    });

    // Listener untuk tombol + dan -
    document.querySelectorAll('.qty-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const cartItemId = e.currentTarget.getAttribute('data-cart-id');
            const productId = e.currentTarget.getAttribute('data-product-id');
            const price = e.currentTarget.getAttribute('data-price');
            const maxStock = parseInt(e.currentTarget.getAttribute('data-max'), 10);

            const input = e.currentTarget.parentElement.querySelector('.quantity-input');
            let currentQty = parseInt(input.value, 10);
            
            if (e.currentTarget.classList.contains('qty-inc')) {
                if (currentQty < maxStock) {
                    currentQty++;
                } else {
                    alert(`Stok produk tidak mencukupi (tersedia: ${maxStock}).`);
                    return;
                }
            } else if (e.currentTarget.classList.contains('qty-dec')) {
                if (currentQty > 1) {
                    currentQty--;
                }
            }
            
            input.value = currentQty;
            handleQuantityChange(cartItemId, productId, currentQty, price, input);
        });
    });

    // Listener untuk input manual
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const cartItemId = e.currentTarget.getAttribute('data-cart-id');
            const productId = e.currentTarget.getAttribute('data-product-id');
            const price = e.currentTarget.getAttribute('data-price');
            const maxStock = parseInt(e.currentTarget.getAttribute('data-max'), 10);

            let newQty = parseInt(e.currentTarget.value, 10);
            
            // Validasi input
            if (isNaN(newQty) || newQty < 1) {
                newQty = 1;
            } else if (newQty > maxStock) {
                alert(`Stok produk tidak mencukupi (tersedia: ${maxStock}).`);
                newQty = maxStock;
            }

            e.currentTarget.value = newQty;
            handleQuantityChange(cartItemId, productId, newQty, price, e.currentTarget);
        });
    });
}

function handleQuantityChange(cartItemId, productId, newQuantity, price, inputElement) {
    inputElement.disabled = true; // disable input
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/update_cart_item.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
        inputElement.disabled = false; // enable lagi
        try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
                updateNavbarCartCount(response.cartCount);
                if (newQuantity === 0) {
                    // Jika kuantitas 0, hapus elemen
                    document.getElementById(`item-card-${cartItemId}`).remove();
                } else {
                    // update subtotal
                    const subtotalEl = document.getElementById(`subtotal-${cartItemId}`);
                    const newSubtotal = newQuantity * price;
                    subtotalEl.textContent = `Subtotal: Rp ${newSubtotal.toLocaleString('id-ID')}`;
                }
                // reload summary untuk update grand total
                // panggil loadCartData() lagi
                loadCartData();
            } else {
                alert("Gagal update kuantitas: " + response.message);
                 // kembalikan input ke nilai lama jika gagal
                let oldQuantity = 1;
                if (response.current_quantity !== undefined) {
                    oldQuantity = response.current_quantity;
                }
                inputElement.value = oldQuantity;
            }
        } catch (e) {
            alert("Error respons server saat update kuantitas.");
        }
    };
    xhr.onerror = function() {
        // ... error handling ...
        inputElement.disabled = false;
        alert("Error jaringan saat memperbarui kuantitas.");
    };
    
    xhr.send(JSON.stringify({
        product_id: productId, // api update_cart_item butuh product_id
        quantity: newQuantity
    }));
}

// 6. Fungsi API: HAPUS ITEM
function handleDeleteItem(cartItemId) {
    if (!confirm("Apakah Anda yakin ingin menghapus item ini dari keranjang?")) {
        return;
    }
    
    const itemCard = document.getElementById(`item-card-${cartItemId}`);
    if (itemCard) itemCard.classList.add('loading'); // UI feedback loading

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/delete_cart_item.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
        try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
                updateNavbarCartCount(response.cartCount);
                // hapus elemen dari DOM
                if (itemCard) itemCard.remove();
                // reload data untuk update summary (cara simpel)
                loadCartData();
            } else {
                alert("Gagal menghapus item: " + response.message);
                if (itemCard) itemCard.classList.remove('loading');
            }
        } catch (e) {
            alert("Error respons server saat menghapus item.");
            if (itemCard) itemCard.classList.remove('loading');
        }
    };
    xhr.onerror = function() {
        alert("Error jaringan saat menghapus item.");
        if (itemCard) itemCard.classList.remove('loading');
    };
    
    xhr.send(JSON.stringify({ cart_item_id: cartItemId }));
}


// --- Panggil fungsi utama saat halaman dimuat ---
document.addEventListener('DOMContentLoaded', loadCartData);