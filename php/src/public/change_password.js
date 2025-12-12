document.addEventListener('DOMContentLoaded', () => {
    const passwordForm = document.getElementById('password-form');
    const passwordSubmitButton = document.getElementById('password-submit-button');
    const passwordMessage = document.getElementById('password-message');

    if (passwordForm) {
        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const newPassword = document.getElementById('new_password').value;
            const confirmNewPassword = document.getElementById('confirm_new_password').value;
            if (newPassword !== confirmNewPassword) {
                displayMessage(passwordMessage, 'Password baru dan konfirmasi tidak cocok.', false);
                return;
            }

            setLoading(passwordSubmitButton, true, 'Mengubah...');

            const data = {
                old_password: document.getElementById('old_password').value,
                new_password: newPassword,
                confirm_new_password: confirmNewPassword
            };

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/change_password.php', true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onload = function() {
                setLoading(passwordSubmitButton, false, 'Ubah Password');
                try {
                    const response = JSON.parse(xhr.responseText);
                    displayMessage(passwordMessage, response.message, response.success);
                    if (response.success) {
                        passwordForm.reset();
                    }
                } catch (e) {
                    displayMessage(passwordMessage, 'Gagal memproses respons server.', false);
                }
            };
            
            xhr.onerror = function() {
                setLoading(passwordSubmitButton, false, 'Ubah Password');
                displayMessage(passwordMessage, 'Error jaringan.', false);
            };

            xhr.send(JSON.stringify(data));
        });
    }

    function setLoading(button, isLoading, loadingText) {
        button.disabled = isLoading;
        button.textContent = isLoading ? loadingText : 'Ubah Password';
    }

    function displayMessage(element, message, isSuccess) {
        element.textContent = message;
        element.className = isSuccess ? 'message success' : 'message error';
    }
});