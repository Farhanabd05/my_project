document.addEventListener('DOMContentLoaded', () => {
    
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const form = document.getElementById('edit-product-form');
    const hiddenDescription = document.getElementById('description');
    const currentImage = document.getElementById('current-image');
    const productIdInput = document.getElementById('product_id');
    
    if (!form || !loadingMessage || !errorMessage || !hiddenDescription || !currentImage || !productIdInput) {
        console.error('Satu atau lebih elemen DOM penting tidak ditemukan. Pastikan ID elemen sudah benar.');
        return;
    }

    const productId = productIdInput.value; 

    var quill = new Quill('#editor', {
        theme: 'snow',
        placeholder: 'Masukkan deskripsi produk...'
    });

    function loadProductData() {
        if (!productId) {
            showError("Product ID tidak valid.");
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/api/get_product_detail.php?product_id=${productId}`, true);
        
        xhr.onload = function() {
            loadingMessage.classList.remove('show');

            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    
                    if (data.product_name === undefined) {
                        throw new Error(data.message || 'Format data produk tidak valid.');
                    }
                    
                    document.getElementById('product_name').value = data.product_name || '';
                    document.getElementById('category').value = data.category_id || '';
                    document.getElementById('price').value = data.price || '';
                    document.getElementById('stock').value = data.stock || '';
                    
                    if (data.description) {
                        quill.root.innerHTML = data.description;
                    }
                    
                    if (data.main_image_path) {
                        currentImage.src = data.main_image_path;
                        currentImage.classList.add('show');
                    } else {
                        currentImage.classList.remove('show');
                    }

                    form.classList.add('show');

                } catch (e) {
                    showError(e.message || 'Gagal memproses data produk dari server.');
                    console.error("JSON Parse Error:", e);
                    console.error("Response Text:", xhr.responseText);
                }
            } else {
                let apiError = 'Gagal mengambil data produk.';
                try {
                    const errData = JSON.parse(xhr.responseText);
                    apiError = errData.message || apiError;
                } catch(e){}
                showError(apiError + ` (Status: ${xhr.status})`);
            }
        };
        
        xhr.onerror = function() {
            loadingMessage.classList.remove('show');
            showError('Error jaringan saat mengambil data produk.');
        };
        
        xhr.send();
    }
    
    loadProductData();

    if (form) {
        form.addEventListener('submit', (e) => {
            const quillContent = quill.root.innerHTML;
            hiddenDescription.value = quillContent;
        });
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
        }
        if (loadingMessage) {
            loadingMessage.classList.remove('show');
        }
        if (form) {
            form.classList.remove('show'); 
        }
    }
});