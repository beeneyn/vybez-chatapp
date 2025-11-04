document.addEventListener('DOMContentLoaded', async () => {
    let currentUser = null;
    const socket = io({ autoConnect: false });

    // Modal functions
    window.openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    };

    window.closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    };

    // Check authentication
    const checkAuth = async () => {
        try {
            const response = await fetch('/api/check-session');
            if (response.ok) {
                const data = await response.json();
                currentUser = data.username;
                loadUserSettings();
                socket.auth = { username: currentUser };
                socket.connect();
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
        }
    };

    // Load user settings from server
    const loadUserSettings = async () => {
        try {
            const response = await fetch('/api/user-profile');
            if (response.ok) {
                const user = await response.json();
                
                // Set username
                document.getElementById('current-username').value = user.username;
                
                // Set avatar
                if (user.avatar_url) {
                    document.getElementById('current-avatar').src = user.avatar_url;
                    document.getElementById('current-avatar').style.display = 'block';
                    document.getElementById('avatar-placeholder').style.display = 'none';
                } else {
                    const initials = user.username.substring(0, 2).toUpperCase();
                    const userColor = (user.chat_color || '#5b2bff').replace('#', '');
                    document.getElementById('avatar-placeholder').style.background = `#${userColor}`;
                }
                
                // Set bio and status
                document.getElementById('settings-bio').value = user.bio || '';
                document.getElementById('settings-status').value = user.status || 'Online';
                
                // Set chat color
                const chatColor = user.chat_color || '#5b2bff';
                document.getElementById('chat-color-picker').value = chatColor;
                document.getElementById('color-preview-text').style.color = chatColor;
                document.getElementById('color-preview-text').textContent = user.username;
                
                // Set email
                document.getElementById('settings-email').value = user.email || '';
            }
        } catch (error) {
            console.error('Failed to load user settings:', error);
        }
    };

    // Initialize theme
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        updateThemeUI(savedTheme);
    };

    const updateThemeUI = (theme) => {
        document.querySelectorAll('.theme-option').forEach(option => {
            if (option.dataset.theme === theme) {
                option.classList.add('border-violet-500');
                option.classList.remove('border-gray-300');
            } else {
                option.classList.remove('border-violet-500');
                option.classList.add('border-gray-300');
            }
        });
    };

    // Section navigation
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            
            // Update active nav item
            document.querySelectorAll('.settings-nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show selected section
            document.querySelectorAll('.settings-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(`${section}-section`).classList.add('active');
        });
    });

    // Theme selection
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            localStorage.setItem('theme', theme);
            document.body.setAttribute('data-theme', theme);
            updateThemeUI(theme);
        });
    });

    // Chat color picker
    document.getElementById('chat-color-picker').addEventListener('input', (e) => {
        const color = e.target.value;
        document.getElementById('color-preview-text').style.color = color;
    });

    // Avatar upload
    document.getElementById('avatar-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await fetch('/api/upload-avatar', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('current-avatar').src = data.avatarUrl;
                document.getElementById('current-avatar').style.display = 'block';
                document.getElementById('avatar-placeholder').style.display = 'none';
                showMessage('Avatar updated successfully!', 'success');
            } else {
                const error = await response.json();
                showMessage(error.error || 'Failed to upload avatar', 'error');
            }
        } catch (error) {
            console.error('Avatar upload error:', error);
            showMessage('Failed to upload avatar', 'error');
        }
    });

    // Save profile settings
    document.getElementById('save-profile-btn').addEventListener('click', async () => {
        const bio = document.getElementById('settings-bio').value;
        const status = document.getElementById('settings-status').value;
        const chatColor = document.getElementById('chat-color-picker').value;

        try {
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bio, status, chatColor })
            });

            if (response.ok) {
                showMessage('Profile updated successfully!', 'success');
                socket.emit('profileUpdate');
            } else {
                const error = await response.json();
                showMessage(error.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            showMessage('Failed to update profile', 'error');
        }
    });

    // Save account settings
    document.getElementById('save-account-btn').addEventListener('click', async () => {
        const email = document.getElementById('settings-email').value.trim();

        try {
            const response = await fetch('/api/update-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email || null })
            });

            if (response.ok) {
                showMessage('Account settings updated successfully!', 'success');
            } else {
                const error = await response.json();
                showMessage(error.error || 'Failed to update account settings', 'error');
            }
        } catch (error) {
            console.error('Account update error:', error);
            showMessage('Failed to update account settings', 'error');
        }
    });

    // Change username
    document.getElementById('change-username-btn').addEventListener('click', () => {
        window.openModal('changeUsernameModal');
    });

    document.getElementById('confirm-username-change').addEventListener('click', async () => {
        const newUsername = document.getElementById('new-username').value.trim();
        const password = document.getElementById('confirm-username-password').value;
        const messageDiv = document.getElementById('change-username-message');

        if (!newUsername || !password) {
            messageDiv.textContent = 'Please fill in all fields';
            messageDiv.className = 'text-sm mb-3 text-red-600';
            messageDiv.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/api/change-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newUsername, password })
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.textContent = 'Username changed successfully! Redirecting...';
                messageDiv.className = 'text-sm mb-3 text-green-600';
                messageDiv.classList.remove('hidden');
                
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                messageDiv.textContent = data.error || 'Failed to change username';
                messageDiv.className = 'text-sm mb-3 text-red-600';
                messageDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Username change error:', error);
            messageDiv.textContent = 'Failed to change username';
            messageDiv.className = 'text-sm mb-3 text-red-600';
            messageDiv.classList.remove('hidden');
        }
    });

    // Delete account
    document.getElementById('delete-account-btn').addEventListener('click', () => {
        window.openModal('deleteAccountModal');
    });

    document.getElementById('confirm-delete-account').addEventListener('click', async () => {
        const confirm1 = document.getElementById('delete-confirm-1').checked;
        const confirm2 = document.getElementById('delete-confirm-2').checked;
        const password = document.getElementById('delete-password').value;
        const messageDiv = document.getElementById('delete-account-message');

        if (!confirm1 || !confirm2) {
            messageDiv.textContent = 'Please check both confirmation boxes';
            messageDiv.className = 'text-sm mb-3 text-red-600';
            messageDiv.classList.remove('hidden');
            return;
        }

        if (!password) {
            messageDiv.textContent = 'Please enter your password';
            messageDiv.className = 'text-sm mb-3 text-red-600';
            messageDiv.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/api/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.textContent = 'Account deleted successfully. Redirecting...';
                messageDiv.className = 'text-sm mb-3 text-green-600';
                messageDiv.classList.remove('hidden');
                
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                messageDiv.textContent = data.error || 'Failed to delete account';
                messageDiv.className = 'text-sm mb-3 text-red-600';
                messageDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Account deletion error:', error);
            messageDiv.textContent = 'Failed to delete account';
            messageDiv.className = 'text-sm mb-3 text-red-600';
            messageDiv.classList.remove('hidden');
        }
    });

    // Back to chat button
    document.getElementById('back-to-chat').addEventListener('click', () => {
        window.location.href = '/chat';
    });

    // Helper function to show messages
    const showMessage = (message, type) => {
        const alertDiv = document.createElement('div');
        alertDiv.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    };

    // Initialize
    initTheme();
    await checkAuth();
});
