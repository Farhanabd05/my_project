document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

    // Password visibility toggle
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');
            
            if (input.type === 'password') {
                input.type = 'text';
                eyeIcon.textContent = '◡'; // Closed eye
                this.setAttribute('aria-label', 'Sembunyikan password');
            } else {
                input.type = 'password';
                eyeIcon.textContent = '👁'; // Open eye
                this.setAttribute('aria-label', 'Tampilkan password');
            }
        });
    });

    // Store name character counter
    const storeNameInput = document.getElementById('store_name');
    const storeNameCounter = document.getElementById('store-name-counter');
    
    if (storeNameInput && storeNameCounter) {
        storeNameInput.addEventListener('input', function() {
            const length = this.value.length;
            storeNameCounter.textContent = `${length}/100 karakter`;
            
            // Update styling berdasarkan panjang
            storeNameCounter.classList.remove('warning', 'error');
            if (length > 100) {
                storeNameCounter.classList.add('error');
            } else if (length > 80) {
                storeNameCounter.classList.add('warning');
            }
        });
    }

    if (registerForm){
        const sellerFields = document.getElementById('seller-fields');
        document.querySelectorAll('input[name="role"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'SELLER'){
                    sellerFields.classList.add('show');
                }
                else{
                    sellerFields.classList.remove('show');
                }
            });
        });

        registerForm.addEventListener('submit', (e) => {
            e.preventDefault(); // ajaxnya biar ga reload trus
            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData.entries());

            if (data.password !== data.confirm_password) {
                displayError('Password dan konfirmasi password tidak cocok.');
                return;
            }
            
            if (data.role === 'SELLER') {
                if (!data.store_name) {
                    displayError('Nama toko wajib diisi untuk Seller.');
                    return;
                }
                if (data.store_name.length > 100) {
                    displayError('Nama toko maksimal 100 karakter.');
                    return;
                }
            }

            setLoading(true);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/register.php', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
        
            xhr.onload = function() {
                setLoading(false);
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300 && response.success) {
                        alert(response.message); 
                        if (response.role === 'SELLER') {
                            window.location.href = '/login.php'; 
                        } else {
                            window.location.href = '/'; 
                        }
                    } else {
                        displayError(response.message || 'Terjadi kesalahan.');
                    }
                } catch (err) {
                    displayError('Gagal memproses respons server.');
                }
            };
            xhr.onerror = function() {
                setLoading(false);
                displayError('Tidak dapat terhubung ke server.');
            };

            xhr.send(JSON.stringify(data));
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());
            setLoading(true); 
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/login.php', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function() {
                setLoading(false);
                 try {
                    const response = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300 && response.success) {
                        alert(response.message);
                        if (response.role === 'SELLER') {
                            window.location.href = '/dashboard.php';
                        } else {
                            window.location.href = '/discovery.php'; 
                        }
                    } else {
                        displayError(response.message || 'Terjadi kesalahan.');
                    }
                } catch (err) {
                    displayError('Gagal memproses respons server.');
                }
            };
            
            xhr.onerror = function() {
                setLoading(false);
                displayError('Tidak dapat terhubung ke server.');
            };

            xhr.send(JSON.stringify(data));
        });
    }

    function displayError(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
        }
    }

    function setLoading(isLoading) {
        const submitButton = document.getElementById('submit-button');
        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.textContent = isLoading ? 'Memproses...' : (loginForm ? 'Login' : 'Daftar');
        }
        if (isLoading) displayError('');
    }

});