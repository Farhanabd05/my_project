document.addEventListener('DOMContentLoaded', () => {
    
    var quill = new Quill('#editor', {
        theme: 'snow', 
        placeholder: 'Masukkan deskripsi produk Anda di sini...'
    });
    const form = document.getElementById('add-product-form');
    const hiddenDescription = document.getElementById('description');
    const fileInput = document.getElementById('product_image');

    if (form) {
        form.addEventListener('submit', (e) => {
            const quillContent = quill.root.innerHTML;
            hiddenDescription.value = quillContent;

            // validasi ukuran file
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const maxSize = 2 * 1024 * 1024; // 2MB dalam bytes

                if (file.size > maxSize) {
                    e.preventDefault();
                    alert('Ukuran file foto terlalu besar! Maksimal 2MB.\nFile Anda: ' + (file.size / (1024 * 1024)).toFixed(2) + ' MB');
                    return false;
                }

                // validasi tipe file
                const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                    e.preventDefault();
                    alert('Tipe file tidak didukung! Hanya JPG, PNG, atau WEBP yang diperbolehkan.');
                    return false;
                }
            } else {
                e.preventDefault();
                alert('Foto produk wajib di-upload!');
                return false;
            }
        });
    }

    // previw ukuran file saat dipilih
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const fileInfo = document.getElementById('file-info');
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                
                // Reset classes
                fileInfo.classList.remove('file-error', 'file-success');

                // tampilkan info UI
                if (file.size > 2 * 1024 * 1024) {
                    fileInfo.classList.add('file-error');
                    fileInfo.textContent = `⚠️ File terlalu besar: ${fileSizeMB} MB (Max: 2 MB)`;
                } else {
                    fileInfo.classList.add('file-success');
                    fileInfo.textContent = `✓ ${file.name} (${fileSizeMB} MB)`;
                }
            } else {
                fileInfo.textContent = '';
                fileInfo.classList.remove('file-error', 'file-success');
            }
        });
    }
});