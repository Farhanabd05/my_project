function renderCheckoutPage(checkoutData) {
    const orderSummaryContainer = document.getElementById('order-summary');
    const totalSummaryContainer = document.getElementById('total-summary');
    const checkoutButton = document.getElementById('checkout-button');
    const shippingAddressDiv =document.getElementById('shipping-address');
    const buyerBalanceSpan =document.getElementById('buyer-balance');
    const editAddressButton =document.getElementById('edit-address-button');
    orderSummaryContainer.innerHTML = '';
    totalSummaryContainer.innerHTML = '';

    const buyer = checkoutData.buyer_info;
    const stores = checkoutData.stores;
    let grandTotal = 0;

    shippingAddressDiv.textContent=buyer.address || 'Alamat belum diisi';
    shippingAddressDiv.contentEditable = "false";
    shippingAddressDiv.classList.remove('editing');
    buyerBalanceSpan.textContent= `Rp ${(buyer.current_balance || 0).toLocaleString('id-ID')}`;
    editAddressButton.textContent="Ubah Alamat";
    editAddressButton.onclick= handleEditAddressClick;

    if (!stores || stores.length === 0) {
        orderSummaryContainer.innerHTML = '<p>Keranjang Anda kosong.</p>';
        checkoutButton.disabled = true;
        totalSummaryContainer.innerHTML = '<p>Total Belanja: Rp 0</p>';
        return;
    }

    stores.forEach(store => {
        let storeSubtotal = 0;
        let itemsHtml = '';
        store.items.forEach(item => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            const itemTotal = price * quantity;
            storeSubtotal += itemTotal;
            itemsHtml += `
                <div class="item">
                    <img src="${item.thumbnail_path || '/images/products/placeholder.png'}" alt="${item.product_name || 'Nama Produk'}">
                    <div><strong>${item.product_name || 'Nama Produk'}</strong><br>${quantity} x Rp ${price.toLocaleString('id-ID')}</div>
                    <div>Rp ${itemTotal.toLocaleString('id-ID')}</div>
                </div>
            `;
        });
        const storeGroupHtml = `
            <div class="store-group">
                <h4>${store.store_name || 'Nama Toko'}</h4>
                ${itemsHtml}
                <strong class="store-subtotal">Subtotal Toko: Rp ${storeSubtotal.toLocaleString('id-ID')}</strong>
            </div>
        `;
        orderSummaryContainer.innerHTML += storeGroupHtml;
        grandTotal += storeSubtotal;
    });

    totalSummaryContainer.innerHTML = `<p>Total Belanja: Rp ${grandTotal.toLocaleString('id-ID')}</p>`;
    const currentBalance = Number(buyer.current_balance) || 0;

    if (currentBalance < grandTotal) {
        totalSummaryContainer.innerHTML += `
            <p class="error-message">
                Saldo tidak cukup! 
            </p>
            <button type="button" class="topup-button" onclick="handleTopUpClick()">Top-up Balance</button>
        `;
        checkoutButton.disabled = true;
    } else {
        totalSummaryContainer.innerHTML += `<p>Sisa Saldo: Rp ${(currentBalance - grandTotal).toLocaleString('id-ID')}</p>`;
        checkoutButton.disabled = false;
    }
}

function handleEditAddressClick(event) {
    const button = event.target;
    const addressDiv = document.getElementById('shipping-address');

    if (addressDiv.contentEditable === "true") {
        // mode edit -> simpan (Nonaktifkan edit)
        addressDiv.contentEditable = "false";
        addressDiv.classList.remove('editing');
        button.textContent = "Ubah Alamat";
        // tidak perlu AJAX save di sini, alamat akan diambil saat checkout
    } else {
        // mode lihat -> Mulai Edit
        addressDiv.contentEditable = "true";
        addressDiv.classList.add('editing');
        addressDiv.focus(); //  fokus ke input
        button.textContent = "Simpan Alamat";
    }
}

function handleTopUpClick() {
    if (typeof openTopUpModal === 'function') {
        // Panggil fungsi global
        openTopUpModal(); 
    } else {
        console.error('Fungsi openTopUpModal() tidak ditemukan.');
        alert('Fitur top-up sedang tidak tersedia. Coba refresh halaman.');
    }
}

function reloadDataCheckout() {
    const orderSummaryContainer = document.getElementById('order-summary');
    const checkoutButton = document.getElementById('checkout-button');

    orderSummaryContainer.innerHTML = '<p>Memuat ulang data keranjang...</p>';
    if (checkoutButton) checkoutButton.disabled = true;

    const xhrLoad = new XMLHttpRequest();
    xhrLoad.open('GET', '/api/get_checkout_data.php', true);
    xhrLoad.onload = function() {
        if (xhrLoad.status >= 200 && xhrLoad.status < 300) {
             try { const dataFromApi = JSON.parse(xhrLoad.responseText); renderCheckoutPage(dataFromApi); } 
             catch (e) { 
                    console.error('Error parsing JSON:', e);
                    orderSummaryContainer.innerHTML = `<p class="error-message">Terjadi kesalahan format data dari server.</p>`;
                    if (checkoutButton) checkoutButton.disabled = true;

              }
        } else {
            let errorMsg = `Gagal memuat data (Status: ${xhrLoad.status}).`;
            try {
                const errData = JSON.parse(xhrLoad.responseText);
                errorMsg = errData.message || errorMsg;
            } catch(e){
                console.error('Error parsing JSON:', e);
            }
            console.error('Error memuat data checkout:', xhrLoad.statusText);
            orderSummaryContainer.innerHTML = `<p class="error-message">${errorMsg}</p>`;
            if (checkoutButton) checkoutButton.disabled = true;
        }
    };
    xhrLoad.onerror = function() { 
        console.error('Network Error');
        orderSummaryContainer.innerHTML = `<p class="error-message">Tidak dapat terhubung ke server.</p>`;
        checkoutButton.disabled = true;
    };
    xhrLoad.send();
}


document.addEventListener('DOMContentLoaded', () => {
    reloadDataCheckout(); 

    const checkoutButton = document.getElementById('checkout-button');
    const orderSummaryContainer = document.getElementById('order-summary');

    orderSummaryContainer.innerHTML = '<p>Memuat data keranjang...</p>';
    checkoutButton.disabled = true;
    // GET Data Checkout
    const xhrLoad = new XMLHttpRequest();
    xhrLoad.open('GET', '/api/get_checkout_data.php', true); // true = asynchronous

    xhrLoad.onload = function() {
        if (xhrLoad.status >= 200 && xhrLoad.status < 300) {
            try {
                const dataFromApi = JSON.parse(xhrLoad.responseText);
                renderCheckoutPage(dataFromApi);
            } catch (e) {
                console.error('Error parsing JSON:', e);
                orderSummaryContainer.innerHTML = `<p class="error-message">Terjadi kesalahan format data dari server.</p>`;
                checkoutButton.disabled = true;
            }
        } else {
            // Handle HTTP errors (404, 500, etc.)
            let errorMsg = `Gagal memuat data (Status: ${xhrLoad.status}).`;
             try {
                 const errData = JSON.parse(xhrLoad.responseText);
                 errorMsg = errData.message || errorMsg;
             } catch(e){
                 console.error('Error parsing JSON:', e);
             }
            console.error('Error memuat data checkout:', xhrLoad.statusText);
            orderSummaryContainer.innerHTML = `<p class="error-message">${errorMsg}</p>`;
            checkoutButton.disabled = true;
        }
    };

    xhrLoad.onerror = function() {
        // Handle network errors
        console.error('Network Error');
        orderSummaryContainer.innerHTML = `<p class="error-message">Tidak dapat terhubung ke server.</p>`;
        checkoutButton.disabled = true;
    };

    xhrLoad.send();  // Kirim request GET


    // EVENT LISTENER TOMBOL CHECKOUT (PAKE XHR POST)
    checkoutButton.addEventListener('click', () => {
        const currentShippingAddress = document.getElementById('shipping-address').textContent.trim();

        // alamat kosong -> kasih alert
        if(!currentShippingAddress){
            alert('Alamat pengiriman tidak boleh kosong');
            checkoutButton.disabled = false;
            checkoutButton.textContent="Bayar Sekarang";
            const addressDiv=document.getElementById('shipping-address');
            if(addressDiv.contentEditable==="true"){
                addressDiv.focus();
            }
            return;
        }

        // konfirmasi sebelum checkout
        if (!confirm('Apakah Anda yakin ingin melakukan checkout sekarang?')) {
            // batal
            checkoutButton.disabled = false;
            checkoutButton.textContent = "Bayar Sekarang";
            const addressDiv = document.getElementById('shipping-address');
            if (addressDiv && addressDiv.contentEditable === "true") {
                addressDiv.focus();
            }
            return;
        }

        checkoutButton.disabled = true; 
        checkoutButton.textContent = "Memproses...";
        
        const dataToSend = {
            shipping_address: currentShippingAddress
        };

        // POST Data Checkout
        const xhrProcess = new XMLHttpRequest();
        xhrProcess.open('POST', '/api/checkout_process.php', true);
        xhrProcess.setRequestHeader('Content-Type', 'application/json');

        xhrProcess.onload = function() {
            let success = false;
            let message = 'Terjadi kesalahan yang tidak diketahui.';
            if (xhrProcess.status >= 200 && xhrProcess.status < 300) {
                 try {
                    const data = JSON.parse(xhrProcess.responseText);
                    success = data.success;
                    message = data.message;
                 } catch (e) {
                    message = "Format respons server tidak valid.";
                 }
            } else {
                message = `Server error (Status: ${xhrProcess.status}).`;
                 try {
                     const errData = JSON.parse(xhrProcess.responseText);
                     message = errData.message || message;
                 } catch(e){}
            }

            if (success) {
                alert('Checkout berhasil! Pesanan Anda sedang diproses.');
                window.location.href = '/order_history.php';
            } else {
                alert('Checkout GAGAL: ' + message);
                checkoutButton.disabled = false;
                checkoutButton.textContent = "Bayar Sekarang";
            }
        };

        xhrProcess.onerror = function() {
            console.error('Network Error');
            alert('Tidak dapat terhubung ke server. Silakan coba lagi.');
            checkoutButton.disabled = false;
            checkoutButton.textContent = "Bayar Sekarang";
        };

        xhrProcess.send(JSON.stringify(dataToSend));
    });
});