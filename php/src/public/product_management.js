// /public/product_management.js

document.addEventListener('DOMContentLoaded', () => {
    
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortBy = document.getElementById('sort-by');
    const productListContainer = document.getElementById('product-list');
    const loadingIndicator = document.getElementById('loading-indicator');
    const paginationControls = document.getElementById('pagination-controls');

    let currentSearch = '';
    let currentCategory = 0;
    let currentSort = 'name_asc';
    let currentPage = 1;
    let debounceTimer;

    function fetchAndRenderProducts(page = 1) {
        currentPage = page;
        loadingIndicator.classList.add('show');
        productListContainer.innerHTML = '';
        paginationControls.innerHTML = '';

        const params = new URLSearchParams({
            search: currentSearch,
            category: currentCategory,
            sort: currentSort,
            page: currentPage
        });
        const apiUrl = `/api/get_seller_product.php?${params.toString()}`;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', apiUrl, true);
        
        xhr.onload = function() {
            loadingIndicator.classList.remove('show');
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        renderProducts(response.products); 
                        renderPagination(response.pagination);
                    } else {
                        showError(response.message || 'Gagal memuat data.');
                    }
                } catch (e) {
                    showError('Gagal memproses respons server.');
                }
            } else {
                showError(`Error: ${xhr.status} ${xhr.statusText}`);
            }
        };

        xhr.onerror = function() {
            loadingIndicator.classList.remove('show');
            showError('Error jaringan.');
        };
        
        xhr.send();
    }

    function renderProducts(products) {
        if (products.length === 0) {
            productListContainer.innerHTML = `<p class="product-list-message">Anda belum memiliki produk. <a href="/add_product.php">Tambah produk pertama Anda!</a></p>`;
            return;
        }

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Foto</th>
                        <th>Nama Produk</th>
                        <th>Kategori</th>
                        <th>Harga</th>
                        <th>Stok</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        products.forEach(p => {
            const REACT_URL = "http://localhost:5173";
            let auctionButton = '';
            if (p.auction_id) { 
                // case 1: sudah ada lelang (Active/Scheduled) -> Tampilkan tombol "Lihat Lelang"
                auctionButton = `
                    <a href="${REACT_URL}/auction/${p.auction_id}" 
                       target="_blank"
                       class="btn-auction-view" 
                       style="background-color: #2196F3; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; margin-right: 5px; font-size: 13px; display: inline-flex; align-items: center;">
                       Lihat Lelang
                    </a>
                `;
            } else { 
                // case 2: belum ada lelang -> tampilkan tombol "Mulai Lelang" -> mengarah ke form Create Auction di React
                auctionButton = `
                    <a href="${REACT_URL}/create-auction?productId=${p.product_id}" 
                       target="_blank"
                       class="btn-auction-start"
                       style="background-color: #FF9800; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; margin-right: 5px; font-size: 13px; display: inline-flex; align-items: center;">
                       Mulai Lelang
                    </a>
                `;
            }
            tableHtml += `
                <tr id="product-row-${p.product_id}">
                    <td><img class="product-image" src="${p.main_image_path || '/images/placeholder.png'}" alt="${p.product_name}"></td>
                    <td>${escapeHTML(p.product_name)}</td>
                    <td>${escapeHTML(p.category_name) || '-'}</td>
                    <td>Rp ${Number(p.price).toLocaleString('id-ID')}</td>
                    <td>${p.stock}</td>
                    <td class="actions">
                        ${auctionButton}
                        <a href="/edit_product.php?product_id=${p.product_id}" class="btn-edit">
                            <img src="../style/icons/pen-line.svg" alt="Edit" class="action-icon">
                        </a>
                        <button type="button" class="btn-delete delete-button" data-product-id="${p.product_id}" data-product-name="${escapeHTML(p.product_name)}">
                            <img src="../style/icons/trash-white.svg" alt="Hapus" class="action-icon">
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        productListContainer.innerHTML = tableHtml;
    }

    function renderPagination(pagination) {
        if (!pagination || pagination.totalPages <= 0) return;

        let paginationHtml = '';
        
    
        paginationHtml += `<button onclick="goToPage(${pagination.currentPage - 1})" ${pagination.currentPage <= 1 ? 'disabled' : ''}>&lt; Prev</button>`;

        paginationHtml += `<span> Halaman ${pagination.currentPage} dari ${pagination.totalPages} </span>`;

        paginationHtml += `<button onclick="goToPage(${pagination.currentPage + 1})" ${pagination.currentPage >= pagination.totalPages ? 'disabled' : ''}>Next &gt;</button>`;
        
        paginationControls.innerHTML = paginationHtml;
    }

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = searchInput.value;
            fetchAndRenderProducts(1); 
        }, 500);
    });

    categoryFilter.addEventListener('change', () => {
        currentCategory = categoryFilter.value;
        fetchAndRenderProducts(1);
    });
    sortBy.addEventListener('change', () => {
        currentSort = sortBy.value;
        fetchAndRenderProducts(1);
    });

    productListContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.delete-button');
        if (button) {
            const productId = button.dataset.productId;
            const productName = button.dataset.productName;
            handleDeleteProduct(productId, productName, button);
        }
    });
    
    window.goToPage = (page) => {
        fetchAndRenderProducts(page);
    };

  
    function handleDeleteProduct(productId, productName, button) {
        if (!confirm(`Apakah Anda yakin ingin menghapus produk "${productName}"? Aksi ini tidak dapat dibatalkan.`)) {
            return;
        }

        button.disabled = true;
        button.textContent = '...';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/delete_product.php', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onload = function() {
            try {
                const response = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300 && response.success) {
                    alert(response.message);
                    document.getElementById(`product-row-${productId}`).remove();
                    // Refresh halaman untuk update jumlah produk
                    fetchAndRenderProducts(currentPage);
                } else {
                    alert('Gagal menghapus: ' + (response.message || 'Error'));
                    button.disabled = false;
                    button.innerHTML = '<img src="../style/icons/trash-white.svg" alt="Hapus" class="action-icon">';
                }
            } catch (e) {
                console.error('Parse error:', e);
                console.error('Response was:', xhr.responseText);
                alert('Gagal memproses respons server. Lihat console untuk detail.');
                button.disabled = false;
                button.innerHTML = '<img src="../style/icons/trash-white.svg" alt="Hapus" class="action-icon">';
            }
        };
        
        xhr.onerror = function() {
            console.error('Network error');
            alert('Error jaringan.');
            button.disabled = false;
            button.innerHTML = '<img src="../style/icons/trash-white.svg" alt="Hapus" class="action-icon">';
        };

        xhr.send(JSON.stringify({ product_id: productId }));
    }


    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }
    
    function showError(message) {
        productListContainer.innerHTML = `<p class="product-list-message error-message">${message}</p>`;
    }
    
    fetchAndRenderProducts(1);
});