
let currentPage = 1;
const currentLimit = 4;
let currentStatus = 'all';
let currentSearchTerm = '';

function showInputModal(title, label, callback) {
    const modalOverlay = document.getElementById('input-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalLabel = document.getElementById('modal-label');
    const modalInput = document.getElementById('modal-input');
    const modalOkBtn = document.getElementById('modal-ok-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    if (!modalOverlay || !modalTitle || !modalInput || !modalOkBtn || !modalCancelBtn || !modalLabel) {
        console.error('Elemen modal tidak ditemukan!');
        return;
    }

    modalTitle.textContent = title;
    modalLabel.textContent = label;
    modalInput.value = ''; // Kosongkan input
    
    modalOverlay.classList.add('active');
    modalInput.focus();

    //  fungsi untuk "OK"
    modalOkBtn.onclick = function() {
        const value = modalInput.value.trim();
        if (value === '') {
            // Validasi sederhana, jangan tutup modal jika kosong
            alert('Input tidak boleh kosong.');
            modalInput.focus();
            return;
        }
        modalOverlay.classList.remove('active');
        callback(value); 
    };

    // fungsi untuk "Batal"
    modalCancelBtn.onclick = function() {
        modalOverlay.classList.remove('active'); 
    };
    
    modalOverlay.onclick = function(event) {
        if (event.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    };
    // hentikan event bubbling agar klik di dalam modal content tidak menutup modal
    modalOverlay.querySelector('.modal-content').onclick = function(event) {
        event.stopPropagation();
    };
}

function showDeliveryModal(orderId, callback) {
    const modalOverlay = document.getElementById('delivery-modal-overlay');
    const modalTitle = document.getElementById('delivery-modal-title');
    const daysInput = document.getElementById('delivery-days');
    const hoursInput = document.getElementById('delivery-hours');
    const minutesInput = document.getElementById('delivery-minutes');
    const modalOkBtn = document.getElementById('delivery-modal-ok-btn');
    const modalCancelBtn = document.getElementById('delivery-modal-cancel-btn');

    if (!modalOverlay || !modalTitle || !daysInput || !hoursInput || !minutesInput || !modalOkBtn || !modalCancelBtn) {
        console.error('Elemen modal delivery tidak ditemukan!');
        return;
    }

    modalTitle.textContent = `Kirim Barang #${orderId}`;
    daysInput.value = '0';
    hoursInput.value = '0';
    minutesInput.value = '0';
    
    modalOverlay.classList.add('active');
    daysInput.focus();

    modalOkBtn.onclick = function() {
        const days = parseInt(daysInput.value) || 0;
        const hours = parseInt(hoursInput.value) || 0;
        const minutes = parseInt(minutesInput.value) || 0;

        // Validasi: minimal salah satu harus > 0
        if (days === 0 && hours === 0 && minutes === 0) {
            alert('Mohon masukkan estimasi waktu pengiriman.');
            daysInput.focus();
            return;
        }

        // Validasi: tidak boleh negatif
        if (days < 0 || hours < 0 || minutes < 0) {
            alert('Nilai waktu tidak boleh negatif.');
            return;
        }

        modalOverlay.classList.remove('active');
        
        // Format string untuk backend
        const estimateParts = [];
        if (days > 0) estimateParts.push(`${days} hari`);
        if (hours > 0) estimateParts.push(`${hours} jam`);
        if (minutes > 0) estimateParts.push(`${minutes} menit`);
        
        callback(estimateParts.join(' '));
    };

    modalCancelBtn.onclick = function() {
        modalOverlay.classList.remove('active');
    };
    
    modalOverlay.onclick = function(event) {
        if (event.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    };
    
    modalOverlay.querySelector('.delivery-modal-content').onclick = function(event) {
        event.stopPropagation();
    };
}

function toggleOrderDetails(orderId) {
    const detailsDiv = document.getElementById(`details-${orderId}`);
    const button = event.target; // Tombol yang diklik

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
    const orderListContainer = document.getElementById('order-list');
    orderListContainer.innerHTML = ''; // Kosongkan dulu

     if (orders.length === 0) {
         orderListContainer.innerHTML = '<p>Tidak ada pesanan untuk ditampilkan dengan filter ini.</p>';
         return;
    }

    orders.forEach(order => {
        let itemsHtml = '';
        order.items.forEach(item => {
             const itemTotal = (Number(item.price_at_order) || 0) * (Number(item.quantity) || 0);
             itemsHtml += `...`; // (Sama seperti sebelumnya)
             itemsHtml += `
                <div class="item">
                    <img src="${item.main_image_path || '/images/products/placeholder.png'}" alt="${item.product_name || ''}">
                    <div class="item-details">
                        <strong>${item.product_name || 'Nama Produk'}</strong>
                        <span>${item.quantity || 0} barang x Rp ${Number(item.price_at_order || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div class="item-price">
                        Rp ${itemTotal.toLocaleString('id-ID')}
                    </div>
                </div>`;
        });

        let actionButtonsHtml = '';
        if (order.status === 'waiting_approval') {
            actionButtonsHtml = `...`; // (Sama seperti sebelumnya)
            actionButtonsHtml = `
                <button onclick="approveOrder(${order.order_id})">Approve</button>
                <button onclick="rejectOrder(${order.order_id})">Reject</button>
            `;
        } else if (order.status === 'approved') {
            actionButtonsHtml = `...`; // (Sama seperti sebelumnya)
             actionButtonsHtml = `
                <button onclick="setDelivery(${order.order_id})">Kirim Barang</button>
            `;
        }
        let detailsHtml = `
            <p><strong>Alamat Pengiriman:</strong> ${order.shipping_address || '-'}</p> 
        `; // Apakah di JSON namanya "shipping_address"? YA -> Sepertinya TIDAK, di JSON respons Anda tidak ada shipping_address!
        if (order.status === 'rejected' && order.reject_reason) { // Apakah di JSON namanya "reject_reason"? YA
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
        const orderCardHtml = `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <h3>Pesanan #${order.order_id}</h3>
                        <span>Pembeli: ${order.buyer_name || 'Tanpa Nama'}</span>
                    </div>
                    <div>
                        <span class="status-badge status-${order.status || 'unknown'}">
                            ${(order.status || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <br>
                        <span class="order-date">
                            ${new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                    </div>
                </div>
                <div class="order-body">
                    ${itemsHtml}
                </div>
                <div class="order-footer">
                    <strong>Total Pesanan: Rp ${Number(order.total_price || 0).toLocaleString('id-ID')}</strong>
                    <button type="button" 
                            onclick="toggleOrderDetails(${order.order_id})" 
                            class="details-toggle-btn">
                        Lihat Detail
                    </button>
                </div>
                <div class="order-details hidden" 
                     id="details-${order.order_id}">
                    ${detailsHtml}
                </div>
                ${actionButtonsHtml ? `<div class="order-actions">${actionButtonsHtml}</div>` : ''}
            </div>
        `;
        orderListContainer.innerHTML += orderCardHtml;
    });
}

function renderPaginationControls(pagination){
    const paginationContainer = document.getElementById('pagination-controls');
    paginationContainer.innerHTML = '';
    if(!pagination || pagination.totalPages <= 1){
        return
    }
    const currentPage=pagination.currentPage;
    const totalPages=pagination.totalPages;

    const prevButton = document.createElement('button');
    prevButton.textContent = '< Prev';
    prevButton.disabled = (currentPage === 1);
    prevButton.onclick = () => fetchAndRenderOrders(currentStatus, currentPage - 1);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next >';
    nextButton.disabled = (currentPage === totalPages);
    nextButton.onclick = () => fetchAndRenderOrders(currentStatus, currentPage + 1);

    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'pagination-buttons-row';
    buttonsRow.appendChild(prevButton);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.disabled = (i === currentPage);
        pageButton.onclick = () => fetchAndRenderOrders(currentStatus, i);
        buttonsRow.appendChild(pageButton);
    }

    buttonsRow.appendChild(nextButton);
    paginationContainer.appendChild(buttonsRow);

    const pageInfo = document.createElement('div');
    pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
    pageInfo.className = 'pagination-page-info';
    paginationContainer.appendChild(pageInfo);
}

// fungsi untuk ngambil data
function fetchAndRenderOrders(status='all', page=1, searchTerm=''){
    const orderListContainer=document.getElementById('order-list');
    const loadingIndicator=document.getElementById('loading-indicator');
    const paginationContainer=document.getElementById('pagination-controls');

    loadingIndicator.classList.add('active');
    orderListContainer.innerHTML = '';
    paginationContainer.innerHTML = '';

    currentPage =page;
    currentStatus=status;
    currentSearchTerm = searchTerm;

    let apiUrl = `/api/get_seller_orders.php?status=${status}&page=${page}&limit=${currentLimit}`;
    // tambain param search HANYA klo gk kosong
    if (searchTerm.trim() !== '') {
        apiUrl += `&search=${encodeURIComponent(searchTerm.trim())}`; // Encode untuk keamanan
    }
    const xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl, true);

    xhr.onload=function(){
      loadingIndicator.classList.remove('active');
      if(xhr.status>=200 && xhr.status<300){
          try{
			const response=JSON.parse(xhr.responseText);
			if (response.success){
                renderOrders(response.orders);
                renderPaginationControls(response.pagination);
            } else{
                orderListContainer.innerHTML=`<p class="error-message">${response.message || 'Gagal memuat pesanan.'}</p>`;
            }
		  } catch (e){
			console.error('Error parsing JSON:',e);
			orderListContainer.innerHTML=`<p class="error-message">Terjadi kesalahan format data dari server.</p>`;
		  }
      } else{
		let errorMsg=`Gagal memuat pesanan (Status: ${xhr.status})`;
		try{
			const errData=JSON.parse(xhr.responseText);
			errorMsg = errData.message || errorMsg;
		} catch(e){}
			console.error('Error memuat pesanan:', xhr.statusText);
            orderListContainer.innerHTML = `<p class="error-message">${errorMsg}</p>`;
	  }
    };
    xhr.onerror = function() {
        loadingIndicator.classList.remove('active');
        console.error('Network Error');
        orderListContainer.innerHTML = `<p class="error-message">Tidak dapat terhubung ke server.</p>`;
    };

    xhr.send();
}

document.addEventListener('DOMContentLoaded', () => {
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');

    fetchAndRenderOrders('all', 1, '');

    statusFilter.addEventListener('change', (event) => {
        searchInput.value = '';
        fetchAndRenderOrders(event.target.value, 1, '');
    });
    searchButton.addEventListener('click', (event) => {
        const searchTerm = searchInput.value;
        fetchAndRenderOrders(currentStatus, 1, searchTerm);
    });
    searchInput.addEventListener('keypress', (event) => {
        if (event.key==='Enter'){
            searchButton.click();
        }
    });
});

function approveOrder(orderId) {
	const cardElement = event.target.closest('.order-card'); // Cari kartu order terdekat
    if (!cardElement) return; // Pengaman jika elemen tidak ditemukan

    const approveButton = cardElement.querySelector('button[onclick^="approveOrder"]');
    const rejectButton = cardElement.querySelector('button[onclick^="rejectOrder"]');
    const actionContainer = cardElement.querySelector('.order-actions');
    const statusBadge = cardElement.querySelector('.status-badge');

    // Disable tombol
    if (approveButton) {
         approveButton.disabled = true;
         approveButton.textContent = 'Approving...';
    }
    if (rejectButton) rejectButton.disabled = true;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/approve_order.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function() {
        let responseData = null;
        try {
            responseData = JSON.parse(xhr.responseText);
        } catch(e) {
            alert('Format respons server tidak valid.');
            approveButton.disabled = false; // enable lagi jika error parsing
            approveButton.textContent = 'Approve';
            if (rejectButton) rejectButton.disabled = false;
            return;
        }

        if (xhr.status >= 200 && xhr.status < 300 && responseData.success) {
            alert(responseData.message);
            // refresh daftar order agar status dan tombol berubah
            // Ambil status filter yg aktif saat ini
            const currentStatusFilter = document.getElementById('status-filter').value;
            fetchAndRenderOrders(currentStatusFilter, currentPage, currentSearchTerm); 
        } else {
            alert('Gagal menyetujui pesanan: ' + (responseData.message || `Error ${xhr.status}`));
            approveButton.disabled = false;
            approveButton.textContent = 'Approve';
             if (rejectButton) rejectButton.disabled = false;
        }
    };

    xhr.onerror = function() {
        alert('Tidak dapat terhubung ke server.');
        approveButton.disabled = false;
        approveButton.textContent = 'Approve';
         if (rejectButton) rejectButton.disabled = false;
    };

    // Kirim order_id dalam format JSON
    xhr.send(JSON.stringify({ order_id: orderId }));
}

function rejectOrder(orderId) {
    // panggil modal, minta alasan
    showInputModal(
        `Tolak Pesanan #${orderId}`,
        'Alasan Penolakan (Wajib Diisi):', 
        (reason) => { 
            
            // Validasi 
            if (reason === null || reason.trim() === '') {
                alert('Alasan penolakan wajib diisi.');
                return; 
            }

            const cardElement = document.querySelector(`button[onclick="rejectOrder(${orderId})"]`).closest('.order-card');
            if (!cardElement) return;

            const approveButton = cardElement.querySelector('button[onclick^="approveOrder"]');
            const rejectButton = cardElement.querySelector('button[onclick^="rejectOrder"]');
            
            // Disable tombol
            if (approveButton) approveButton.disabled = true;
            if (rejectButton) {
                 rejectButton.disabled = true;
                 rejectButton.textContent = 'Rejecting...';
            }
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/reject_order.php', true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onload = function() {
                let responseData = null;
                try {
                    responseData = JSON.parse(xhr.responseText);
                } catch(e) { alert('Format respons server tidak valid.'); enableButtons(); return;}

                if (xhr.status >= 200 && xhr.status < 300 && responseData.success) {
                    alert(responseData.message);
                    const currentStatusFilter = document.getElementById('status-filter').value;
                    fetchAndRenderOrders(currentStatusFilter, currentPage, currentSearchTerm); 
                } else {
                    alert('Gagal menolak pesanan: ' + (responseData.message || `Error ${xhr.status}`)); 
                    enableButtons();
                }
            };
            xhr.onerror = function() { alert('Tidak dapat terhubung ke server.'); enableButtons(); };
            xhr.send(JSON.stringify({ order_id: orderId, reason: reason.trim() }));

            function enableButtons() {
                if (approveButton) approveButton.disabled = false;
                if (rejectButton) {
                     rejectButton.disabled = false;
                     rejectButton.textContent = 'Reject';
                }
            }
        }
    );
}

function setDelivery(orderId) {
    showDeliveryModal(orderId, (estimate) => {
        if (estimate === null || estimate.trim() === '') {
            alert('Estimasi waktu wajib diisi.');
            return;
        }

        const deliveryButton = document.querySelector(`button[onclick="setDelivery(${orderId})"]`);
        if (!deliveryButton) return;
        const cardElement = deliveryButton.closest('.order-card');
        const approveButton = cardElement ? cardElement.querySelector('button[onclick^="approveOrder"]') : null;
        const rejectButton = cardElement ? cardElement.querySelector('button[onclick^="rejectOrder"]') : null;

        deliveryButton.disabled = true;
        deliveryButton.textContent = 'Processing...';
        if (approveButton) approveButton.disabled = true;
        if (rejectButton) rejectButton.disabled = true;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/set_delivery.php', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onload = function() {
            let responseData = null;
            try {
                responseData = JSON.parse(xhr.responseText);
            } catch (e) {
                alert('Format respons server tidak valid.');
                enableButtons();
                return;
            }

            if (xhr.status >= 200 && xhr.status < 300 && responseData.success) {
                alert(responseData.message);
                const currentStatusFilter = document.getElementById('status-filter').value;
                fetchAndRenderOrders(currentStatusFilter, currentPage, currentSearchTerm);
            } else {
                alert('Gagal mengatur pengiriman: ' + (responseData.message || `Error ${xhr.status}`));
                enableButtons();
            }
        };

        xhr.onerror = function() {
            alert('Tidak dapat terhubung ke server.');
            enableButtons();
        };

        xhr.send(JSON.stringify({ order_id: orderId, delivery_estimate: estimate.trim() }));

        function enableButtons() {
            if (deliveryButton) {
                deliveryButton.disabled = false;
                deliveryButton.textContent = 'Kirim Barang';
            }
            if (approveButton) approveButton.disabled = false;
            if (rejectButton) rejectButton.disabled = false;
        }
    });
}