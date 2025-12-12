document.addEventListener('DOMContentLoaded', () => {
    
    const profileForm = document.getElementById('profile-form');
    const profileSubmitButton = document.getElementById('profile-submit-button');
    const profileMessage = document.getElementById('profile-message');
    const logoutButton = document.getElementById('logout-button');
    const notifOrder = document.getElementById('notif_order');
    const notifAuction = document.getElementById('notif_auction');
    const notifChat = document.getElementById('notif_chat');
    const storeForm = document.getElementById('store-profile-form');
    const storeDescriptionHidden = document.getElementById('store_description');
    const currentLogo = document.getElementById('current-logo');
    let storeQuill = null; 

    function loadProfileData() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/get_profile.php', true);
        
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    
                    if(data.user) {
                        document.getElementById('name').value = data.user.name || '';
                        document.getElementById('email').value = data.user.email || '';
                        document.getElementById('address').value = data.user.address || '';
                    }
                    if (data.preferences) {
                        if (notifOrder) notifOrder.checked = data.preferences.order_enabled;
                        if (notifAuction) notifAuction.checked = data.preferences.auction_enabled;
                        if (notifChat) notifChat.checked = data.preferences.chat_enabled;
                    }
                    if (data.store) {
                        document.getElementById('store_name').value = data.store.store_name || '';
                        
                        storeQuill = new Quill('#store-description-editor', {
                            theme: 'snow',
                            placeholder: 'Masukkan deskripsi toko Anda...'
                        });
                        if (data.store.store_description) {
                            storeQuill.root.innerHTML = data.store.store_description;
                        }

                        if (data.store.store_logo_path) {
                            currentLogo.src = data.store.store_logo_path;
                            currentLogo.classList.add('show');
                        } else {
                            currentLogo.classList.remove('show');
                        }
                    }
                } catch (e) {
                    displayMessage(profileMessage, 'Gagal memproses data profil.', false);
                    console.error("JSON Parse Error:", e);
                    console.error("Response Text:", xhr.responseText);
                }
            } else {
                displayMessage(profileMessage, 'Gagal mengambil data profil.', false);
            }
        };
        
        xhr.onerror = function() {
            displayMessage(profileMessage, 'Error jaringan saat mengambil data.', false);
        };
        
        xhr.send();
    }
    
    loadProfileData();

    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            setLoading(profileSubmitButton, true, 'Menyimpan...');

            const data = {
                name: document.getElementById('name').value,
                address: document.getElementById('address').value
            };
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/update_profile.php', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            xhr.onload = function() {
                setLoading(profileSubmitButton, false, 'Simpan Perubahan Akun');
                try {
                    const response = JSON.parse(xhr.responseText);
                    displayMessage(profileMessage, response.message, response.success);
                } catch (e) {
                    displayMessage(profileMessage, 'Gagal memproses respons server.', false);
                }
            };
            
            xhr.onerror = function() {
                setLoading(profileSubmitButton, false, 'Simpan Perubahan Akun');
                displayMessage(profileMessage, 'Error jaringan.', false);
            };

            xhr.send(JSON.stringify(data));
        });
    }

    if (storeForm && storeQuill) {
        storeForm.addEventListener('submit', (e) => {
            if (storeQuill) {
                storeDescriptionHidden.value = storeQuill.root.innerHTML;
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault(); 
            if (confirm('Apakah Anda yakin ingin logout?')) {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/logout.php', true); 
                xhr.onload = function() { 
                     if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            if (response.success) {
                                alert('Anda telah logout.');
                                window.location.href = '/login.php';
                            }
                        } catch (err) {
                            alert('Gagal memproses respons logout.');
                        }
                    } else {
                        alert('Gagal menghubungi server untuk logout.');
                    }
                };
                xhr.onerror = function() { alert('Error jaringan saat mencoba logout.');};
                xhr.send();
            }
        });
    }

    function setLoading(button, isLoading, loadingText) {
        if (!button) return; 
        button.disabled = isLoading;
        if (isLoading) {
            button.textContent = loadingText;
        } else {
            if (button.id === 'profile-submit-button') button.textContent = 'Simpan Perubahan Akun';
        }
    }

    function displayMessage(element, message, isSuccess) {
        if (!element) return;
        element.textContent = message;
        element.className = isSuccess ? 'message success' : 'message error';
    }

    // Event Listener untuk Auto-Save Notifikasi
    function setupNotificationListeners() {
        const checkboxes = [notifOrder, notifAuction, notifChat];
        
        checkboxes.forEach(box => {
            if (!box) return; // Lewati jika elemen tidak ada (misal di halaman seller/buyer tertentu)

            box.addEventListener('change', () => {
                // Siapkan data yang akan dikirim
                const payload = {
                    order_enabled: notifOrder ? notifOrder.checked : true,
                    auction_enabled: notifAuction ? notifAuction.checked : true,
                    chat_enabled: notifChat ? notifChat.checked : true
                };

                // Kirim ke API update
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/update_notification_preferences.php', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                
                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        console.log('Preferensi notifikasi berhasil disimpan.');
                        // toast/alert
                        alert('Preferensi notifikasi berhasil disimpan.')
                    } else {
                        console.error('Gagal menyimpan preferensi notifikasi.');
                        alert('Gagal menyimpan preferensi notifikasi..');
                    }
                };
                
                xhr.onerror = function() {
                    console.error('Error jaringan saat menyimpan notifikasi.');
                };

                xhr.send(JSON.stringify(payload));
            });
        });
    }

    setupNotificationListeners();
});