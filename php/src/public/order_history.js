
let currentStatus = 'all'; 
function confirmReceipt(orderId) {
    if (confirm(`Apakah Anda yakin ingin mengonfirmasi penerimaan pesanan #${orderId}?`)) {
        const cardElement = event.target.closest('.order-card');
        const confirmButton = event.target;
        const actionContainer = document.getElementById(`actions-${orderId}`); 
        const statusBadge = cardElement ? cardElement.querySelector('.status-badge') : null;

        if (confirmButton) { 
            confirmButton.disabled = true;
            confirmButton.textContent = 'Memproses...';
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/confirm_receipt.php', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onload = function() {
            let responseData = null;
            try { responseData = JSON.parse(xhr.responseText); } 
            catch(e) {alert('Format respons server tidak valid.'); enableButton(); return; }

            if (xhr.status >= 200 && xhr.status < 300 && responseData.success) {
                alert(responseData.message);
                // Update UI
                if (statusBadge) {
                    statusBadge.textContent = 'Received';
                    statusBadge.className = 'status-badge status-received'; 
                }
                if (actionContainer) { actionContainer.remove(); }
            } else {alert('Gagal konfirmasi: ' + (responseData.message || `Error ${xhr.status}`)); enableButton(); }
        };
        xhr.onerror = function() {alert('Tidak dapat terhubung ke server.'); enableButton(); };
        xhr.send(JSON.stringify({ order_id: orderId }));
        function enableButton() {
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.textContent = 'Konfirmasi Terima Barang';
            }
        }
    }
}

function toggleOrderDetails(orderId) {
    const detailsDiv = document.getElementById(`details-${orderId}`);
    const button = event.target; // yombol yang diklik

    if (detailsDiv) {
        detailsDiv.classList.toggle('hidden');
        if (detailsDiv.classList.contains('hidden')) {
            button.textContent = 'Lihat Detail';
        } else {
            button.textContent = 'Sembunyikan Detail';
        }
    }
}

function renderOrders(orders) {
    // console.log("Memulai renderOrders. Data orders:", orders);
    const orderListContainer = document.getElementById('order-list');
    orderListContainer.innerHTML = ''; 

     if (orders.length === 0) {
         orderListContainer.innerHTML = '<p>Tidak ada pesanan untuk ditampilkan dengan filter ini.</p>';
         return;
    }

    const nowTimestamp = Date.now(); 

    orders.forEach(order => {
        let itemsHtml = '';
        order.items.forEach(item => {
             const itemTotal = (Number(item.price_at_order) || 0) * (Number(item.quantity) || 0);
             itemsHtml += `
                <div class="item">
                    <img src="${item.main_image_path || './public/uploads/ui/placeholder.png'}" 
                         alt="${item.product_name || ''}"
                         onerror="this.src='./public/uploads/ui/placeholder.png'">
                    <div class="item-details">
                        <strong>${item.product_name || 'Nama Produk'}</strong>
                        <span class="item-qty">${item.quantity || 0} barang × Rp ${Number(item.price_at_order || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div class="item-price">
                        Rp ${itemTotal.toLocaleString('id-ID')}
                    </div>
                </div>`;
        });
        
        // Cek apakah tombol konfirmasi harus ditampilkan
        let confirmButtonHtml = '';
        let showConfirmButton = false;
        if (order.status === 'on_delivery' && order.delivery_time) {
            // Bandingkan timestamp (konversi string DB ke JS Date)
            const deliveryTimestamp = new Date(order.delivery_time.replace(' ', 'T')).getTime(); // Format agar JS Date paham
            if (nowTimestamp >= deliveryTimestamp) {
                showConfirmButton = true;
            }
        }

        if (showConfirmButton) {
            confirmButtonHtml = `
                <div class="order-actions" id="actions-${order.order_id}"> 
                    <button type="button" onclick="confirmReceipt(${order.order_id})">
                        Konfirmasi Terima Barang
                    </button>
                </div>
            `;
        }
        
        let detailsHtml = `
          <p><strong>Alamat Pengiriman:</strong> ${order.shipping_address || '-'}</p>
        `;

        if (order.status === 'rejected' && order.reject_reason) {
            detailsHtml += `<p><strong>Alasan Ditolak:</strong> ${order.reject_reason}</p>`;
        }
        if (order.status === 'on_delivery' && order.delivery_time) {
             // Tambahkan informasi GMT
             const deliveryDate = new Date(order.delivery_time.replace(' ', 'T'));
             const gmtOffset = -deliveryDate.getTimezoneOffset() / 60;
             const gmtString = `GMT${gmtOffset >= 0 ? '+' : ''}${gmtOffset}`;
             
             detailsHtml += `<p><strong>Estimasi Tiba:</strong> ${deliveryDate.toLocaleString('id-ID', { 
                 dateStyle: 'long', 
                 timeStyle: 'short' 
             })} (${gmtString})</p>`;
        }

        const statusLabels = {
            'waiting_approval': 'Menunggu Persetujuan',
            'approved': 'Disetujui',
            'on_delivery': 'Dalam Pengiriman',
            'received': 'Diterima',
            'rejected': 'Ditolak'
        };

        const orderCardHtml = `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-header-left">
                        <h3>Pesanan #${order.order_id}</h3>
                        ${order.store_name ? `<span class="order-store"><strong>${order.store_name}</strong></span>` : ''}
                    </div>
                    <span class="order-date">${new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span class="status-badge status-${order.status}">
                        ${statusLabels[order.status] || order.status}
                    </span>
                </div>
                <div class="order-body">
                    ${itemsHtml}
                </div>
                <div class="order-footer">
                    <strong>Total Pesanan: Rp ${Number(order.total_price || 0).toLocaleString('id-ID')}</strong>
                    <button type="button" 
                            onclick="toggleOrderDetails(${order.order_id})">
                        Lihat Detail
                    </button>
                </div>

                <div class="order-details" 
                     id="details-${order.order_id}" 
                     class="hidden">
                    ${detailsHtml}
                </div>
                ${confirmButtonHtml}
            </div>
        `;
        orderListContainer.innerHTML += orderCardHtml;
    });
}


// Fungsi untuk mengambil data (AJAX GET)
function fetchAndRenderHistory(status = 'all') {
    const orderListContainer = document.getElementById('order-list');
    const loadingIndicator = document.getElementById('loading-indicator');

    loadingIndicator.classList.add('active');
    orderListContainer.innerHTML = ''; 

    currentStatus = status; // Simpan status filter

    const apiUrl = `/api/get_order_history.php?status=${status}`;

    const xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl, true);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); 

    xhr.onload = function() {
        loadingIndicator.classList.remove('active');
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const response = JSON.parse(xhr.responseText); 
                if (response.success) {
                    renderOrders(response.orders); // call fungsi render
                } else {
                     orderListContainer.innerHTML = `<p class="error-message">${response.message || 'Gagal memuat riwayat.'}</p>`;
                }
            } catch (e) {
                orderListContainer.innerHTML = '<p class="error-message">Format respons server tidak valid.</p>';
                console.error('Error parsing JSON:', e);
                console.error('Response text:', xhr.responseText);
            }
        } else { 
            orderListContainer.innerHTML = `<p class="error-message">Gagal memuat riwayat (Status: ${xhr.status}).</p>`;
            console.error('Error loading order history:', xhr.statusText);
        }
    };

    xhr.onerror = function() {
        loadingIndicator.classList.remove('active');
        orderListContainer.innerHTML = '<p class="error-message">Tidak dapat terhubung ke server.</p>';
        console.error('Network error while loading order history.');
    };
    xhr.send();
}

// even listener DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const statusFilter = document.getElementById('status-filter');
    
    // call API saat halaman dimuat
    fetchAndRenderHistory('all'); 

    // call API lagi saat filter berubah
    statusFilter.addEventListener('change', (event) => {
        fetchAndRenderHistory(event.target.value); 
    });
});