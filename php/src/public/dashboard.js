document.addEventListener('DOMContentLoaded', () => {
    const storeInfoContainer = document.getElementById('store-info-section');
    const statsGridContainer = document.getElementById('stats-grid-section');
    statsGridContainer.innerHTML = `
        <div class="stat-card skeleton">
            <div class="skeleton-title"></div>
            <div class="skeleton-value"></div>
        </div>
    `.repeat(8);
    const loadingStore = document.getElementById('loading-store');
    const loadingStats = document.getElementById('loading-stats');

    // ambil tombol aksi
    const manageProductsBtn = document.getElementById('manage-products-btn');
    const viewOrdersBtn = document.getElementById('view-orders-btn');
    const addProductBtn = document.getElementById('add-product-btn');
    const exportReportBtn = document.getElementById('export-report-btn');
    // var untuk menyimpan data statistik agar bisa diakses oleh fungsi export
    let fullStatsData = null; 

    // untuk membuat kartu statistik
    function createStatCard(title, value) {
        return `
            <div class="stat-card">
                <h3>${title}</h3>
                <div class="value">${value}</div>
            </div>
        `;
    }

    // panggil API untuk mendapatkan data dashboard
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/get_dashboard_stats.php', true);

    xhr.onload = function() {
        // sembunyiin pesan loading awal
        if (loadingStore) loadingStore.classList.add('hidden');
        if (loadingStats) loadingStats.classList.add('hidden');

        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                    const stats = response.stats;           
                    // save data ke variabel global di dalam scope ini
                    fullStatsData = stats;

                    // tampilin Info Toko
                    if (stats.store_info) {
                        storeInfoContainer.innerHTML = `
                            <h2>${stats.store_info.store_name || 'Nama Toko'}</h2>
                            <p>${stats.store_info.store_description || '<i>Deskripsi belum diisi.</i>'}</p>
                            <p><strong>Total Pendapatan:</strong> Rp ${(stats.store_info.balance || 0).toLocaleString('id-ID')}</p>
                            `;
                    } else {
                         storeInfoContainer.innerHTML = '<p class="error-message">Gagal memuat info toko.</p>';
                    }

                    // tampilin Kartu Statistik
                    statsGridContainer.innerHTML = ''; // Kosongkan
                    statsGridContainer.innerHTML += createStatCard('Total Produk Aktif', stats.total_products ?? 0);
                    statsGridContainer.innerHTML += createStatCard('Pesanan Pending', stats.pending_orders ?? 0);
                    statsGridContainer.innerHTML += createStatCard('Produk Stok Menipis (<10)', stats.low_stock_products ?? 0);
                    statsGridContainer.innerHTML += createStatCard('Pesanan Selesai (Diterima)', stats.completed_orders ?? 0);
                    statsGridContainer.innerHTML += createStatCard('Produk Stok Habis', stats.out_of_stock_products ?? 0);
                    statsGridContainer.innerHTML += createStatCard('Pesanan Ditolak', stats.rejected_orders ?? 0);
                    statsGridContainer.innerHTML += createStatCard('Pesanan Sedang Dikirim', stats.on_delivery_orders ?? 0);
                    statsGridContainer.innerHTML += createStatCard('Total Pelanggan', stats.total_customers ?? 0);
                } else {
                    // tampilin pesan error dari API jika success = false
                    storeInfoContainer.innerHTML = `<p class="error-message">Error: ${response.message || 'Gagal memuat data.'}</p>`;
                    statsGridContainer.innerHTML = '';
                }
            } catch (e) {
                console.error('Error parsing JSON:', e);
                storeInfoContainer.innerHTML = '<p class="error-message">Format data dari server tidak valid.</p>';
                statsGridContainer.innerHTML = '';
            }
        } else {
            // tampilin pesan error jika status HTTP bukan 2xx
             let errorMsg = `Gagal memuat data (Status: ${xhr.status}).`;
             try {
                 const errData = JSON.parse(xhr.responseText);
                 errorMsg = errData.message || errorMsg;
             } catch(e){}
            console.error('Error memuat data dashboard:', xhr.statusText);
            storeInfoContainer.innerHTML = `<p class="error-message">${errorMsg}</p>`;
            statsGridContainer.innerHTML = '';
        }
    };

    xhr.onerror = function() {
         if (loadingStore) loadingStore.classList.add('hidden');
         if (loadingStats) loadingStats.add('hidden');
        console.error('Network Error');
        storeInfoContainer.innerHTML = '<p class="error-message">Tidak dapat terhubung ke server.</p>';
        statsGridContainer.innerHTML = '';
    };

    xhr.send();

    // tambahin event listener untuk tombol aksi
    if(manageProductsBtn) {
        manageProductsBtn.onclick = () => { window.location.href = '/product_management.php'; }; // arahin ke halaman manajemen produk
    }
     if(viewOrdersBtn) {
        viewOrdersBtn.onclick = () => { window.location.href = '/order_management.php'; }; // arahin ke halaman manajemen order
    }
     if(addProductBtn) {
        addProductBtn.onclick = () => { window.location.href = '/add_product.php'; }; // arahin ke halaman tambah produk
    }

    // untuk ekspor ke CSV
    function exportSummaryToCSV(stats) {
        if (!stats || !stats.store_info) {
            alert('Data statistik belum siap. Coba lagi beberapa saat.');
            return;
        }

        // header (Judul Kolom)
        let csvContent = "Metrik,Nilai\n"; // \n = baris baru

        // data Rangkuman Toko
        csvContent += `Nama Toko,"${stats.store_info.store_name}"\n`;
        csvContent += `Total Pendapatan,${stats.store_info.balance}\n`;
        
        // data Statistik
        csvContent += `Total Produk Aktif,${stats.total_products}\n`;
        csvContent += `Pesanan Pending,${stats.pending_orders}\n`;
        csvContent += `Produk Stok Menipis,${stats.low_stock_products}\n`;
        csvContent += `Pesanan Selesai,${stats.completed_orders}\n`;
        csvContent += `Produk Stok Habis,${stats.out_of_stock_products}\n`;
        csvContent += `Pesanan Ditolak,${stats.rejected_orders}\n`;
        csvContent += `Pesanan Sedang Dikirim,${stats.on_delivery_orders}\n`;
        csvContent += `Total Pelanggan,${stats.total_customers}\n`;

        // Buat file dan trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        
        // nama file yang dinamis, cth: Laporan_Toko_ABC_2025-11-01.csv
        const tgl = new Date().toISOString().split('T')[0]; // format YYYY-MM-DD
        const namaToko = stats.store_info.store_name.replace(/[^a-z0-9]/gi, '_'); // clean nama toko
        link.setAttribute("download", `Laporan_${namaToko}_${tgl}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // add event listener ke tombol export
    if(exportReportBtn) {
        exportReportBtn.onclick = () => {
            exportSummaryToCSV(fullStatsData); // call fungsi ekspor
        };
    }
});