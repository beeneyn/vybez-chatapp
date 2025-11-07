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
            const response = await fetch('/check-session');
            if (response.ok) {
                const data = await response.json();
                if (data.loggedIn && data.user) {
                    currentUser = data.user.username;
                    loadUserSettings(data.user);
                    socket.auth = { username: currentUser };
                    socket.connect();
                } else {
                    window.location.href = '/';
                }
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
        }
    };

    // Load user settings from server
    const loadUserSettings = (user) => {
        try {
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
            
            // Set display name, bio, and status
            document.getElementById('settings-display-name').value = user.display_name || '';
            document.getElementById('settings-bio').value = user.bio || '';
            document.getElementById('settings-status').value = user.status || 'Online';
            
            // Set chat color
            const chatColor = user.chat_color || '#5b2bff';
            document.getElementById('chat-color-picker').value = chatColor;
            document.getElementById('color-preview-text').style.color = chatColor;
            document.getElementById('color-preview-text').textContent = user.username;
            
            // Set email
            document.getElementById('settings-email').value = user.email || '';
        } catch (error) {
            console.error('Failed to load user settings:', error);
        }
    };

    // Load blocked users
    const loadBlockedUsers = async () => {
        try {
            const response = await fetch('/blocked-users');
            if (response.ok) {
                const data = await response.json();
                const blockedUsers = data.blockedUsers || [];
                const blockedUsersList = document.getElementById('blocked-users-list');
                const noBlockedUsers = document.getElementById('no-blocked-users');
                const blockedUsersCount = document.getElementById('blocked-users-count');
                
                blockedUsersCount.textContent = `${blockedUsers.length} blocked`;
                
                if (blockedUsers.length === 0) {
                    blockedUsersList.innerHTML = '';
                    noBlockedUsers.style.display = 'block';
                } else {
                    noBlockedUsers.style.display = 'none';
                    blockedUsersList.innerHTML = '';
                    
                    // Use DOM APIs to prevent XSS
                    blockedUsers.forEach(user => {
                        const container = document.createElement('div');
                        container.className = 'flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200';
                        
                        const leftSection = document.createElement('div');
                        leftSection.className = 'flex items-center gap-3';
                        
                        const avatar = document.createElement('div');
                        avatar.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-semibold';
                        avatar.textContent = user.blocked_username.substring(0, 2).toUpperCase();
                        
                        const userInfo = document.createElement('div');
                        
                        const username = document.createElement('p');
                        username.className = 'font-medium';
                        username.textContent = user.blocked_username;
                        
                        const blockedDate = document.createElement('p');
                        blockedDate.className = 'text-xs text-gray-500';
                        blockedDate.textContent = `Blocked ${new Date(user.created_at).toLocaleDateString()}`;
                        
                        userInfo.appendChild(username);
                        userInfo.appendChild(blockedDate);
                        
                        leftSection.appendChild(avatar);
                        leftSection.appendChild(userInfo);
                        
                        const unblockBtn = document.createElement('button');
                        unblockBtn.className = 'px-3 py-1 bg-violet-500 hover:bg-violet-600 text-white text-sm rounded transition';
                        unblockBtn.textContent = 'Unblock';
                        unblockBtn.onclick = () => window.unblockUser(user.blocked_username);
                        
                        container.appendChild(leftSection);
                        container.appendChild(unblockBtn);
                        
                        blockedUsersList.appendChild(container);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load blocked users:', error);
        }
    };

    // Unblock user
    window.unblockUser = async (username) => {
        if (!confirm(`Are you sure you want to unblock ${username}?`)) return;
        
        try {
            const response = await fetch('/unblock-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            
            if (response.ok) {
                loadBlockedUsers();
            } else {
                const data = await response.json();
                alert(data.message || 'Failed to unblock user');
            }
        } catch (error) {
            console.error('Failed to unblock user:', error);
            alert('An error occurred');
        }
    };

    // Initialize theme
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
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
            
            // Load blocked users when privacy section is shown
            if (section === 'privacy') {
                loadBlockedUsers();
            }
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
            const response = await fetch('/upload-avatar', {
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
        const displayName = document.getElementById('settings-display-name').value.trim();
        const bio = document.getElementById('settings-bio').value;
        const status = document.getElementById('settings-status').value;
        const chatColor = document.getElementById('chat-color-picker').value;

        try {
            const response = await fetch('/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_name: displayName || null, bio, status, chat_color: chatColor })
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
            const response = await fetch('/update-profile', {
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
            const response = await fetch('/change-username', {
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
            const response = await fetch('/delete-account', {
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

    // === NEW SETTINGS FUNCTIONALITY ===

    // Accessibility Settings
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizePreview = document.getElementById('font-size-preview');
    
    fontSizeSlider?.addEventListener('input', (e) => {
        const size = e.target.value + 'px';
        fontSizePreview.style.fontSize = size;
        localStorage.setItem('vybez_font_size', e.target.value);
    });

    // Load saved font size
    const savedFontSize = localStorage.getItem('vybez_font_size') || '14';
    if (fontSizeSlider) fontSizeSlider.value = savedFontSize;
    if (fontSizePreview) fontSizePreview.style.fontSize = savedFontSize + 'px';

    // Reduce motion toggle
    document.getElementById('reduce-motion')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('vybez_reduce_motion', enabled);
        document.body.style.setProperty('--animation-speed', enabled ? '0' : '1');
        showMessage(enabled ? 'Reduced motion enabled' : 'Animations enabled', 'success');
    });

    // High contrast toggle
    document.getElementById('high-contrast')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('vybez_high_contrast', enabled);
        document.body.classList.toggle('high-contrast', enabled);
        showMessage(enabled ? 'High contrast mode enabled' : 'High contrast mode disabled', 'success');
    });

    // Save accessibility settings
    document.getElementById('save-accessibility-btn')?.addEventListener('click', () => {
        showMessage('Accessibility settings saved!', 'success');
    });

    // Notifications Settings
    const notificationToggles = {
        'desktop-notifications': 'vybez_notify_desktop',
        'notify-dms': 'vybez_notify_dms',
        'notify-mentions': 'vybez_notify_mentions',
        'notify-invites': 'vybez_notify_invites',
        'email-weekly': 'vybez_email_weekly',
        'email-updates': 'vybez_email_updates'
    };

    // Load notification preferences
    Object.entries(notificationToggles).forEach(([id, storageKey]) => {
        const element = document.getElementById(id);
        if (element) {
            const saved = localStorage.getItem(storageKey);
            element.checked = saved === null ? element.checked : saved === 'true';
            element.addEventListener('change', (e) => {
                localStorage.setItem(storageKey, e.target.checked);
            });
        }
    });

    // Request desktop notification permission
    document.getElementById('desktop-notifications')?.addEventListener('change', async (e) => {
        if (e.target.checked && 'Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                e.target.checked = false;
                showMessage('Notification permission denied', 'error');
            }
        }
    });

    document.getElementById('save-notifications-btn')?.addEventListener('click', () => {
        showMessage('Notification preferences saved!', 'success');
    });

    // Chat Preferences
    const chatToggles = {
        'show-timestamps': 'vybez_show_timestamps',
        'compact-mode': 'vybez_compact_mode',
        'group-messages': 'vybez_group_messages',
        'show-avatars': 'vybez_show_avatars',
        'message-sounds': 'vybez_message_sounds',
        'typing-sounds': 'vybez_typing_sounds'
    };

    Object.entries(chatToggles).forEach(([id, storageKey]) => {
        const element = document.getElementById(id);
        if (element) {
            const saved = localStorage.getItem(storageKey);
            element.checked = saved === null ? element.checked : saved === 'true';
            element.addEventListener('change', (e) => {
                localStorage.setItem(storageKey, e.target.checked);
            });
        }
    });

    // Enter key behavior
    const enterBehavior = document.getElementById('enter-behavior');
    if (enterBehavior) {
        enterBehavior.value = localStorage.getItem('vybez_enter_behavior') || 'send';
        enterBehavior.addEventListener('change', (e) => {
            localStorage.setItem('vybez_enter_behavior', e.target.value);
        });
    }

    document.getElementById('save-chat-prefs-btn')?.addEventListener('click', () => {
        showMessage('Chat preferences saved!', 'success');
    });

    // Language & Region Settings
    const appLanguage = document.getElementById('app-language');
    if (appLanguage) {
        appLanguage.value = localStorage.getItem('vybez_language') || 'en';
        appLanguage.addEventListener('change', (e) => {
            localStorage.setItem('vybez_language', e.target.value);
        });
    }

    // Time format
    const timeFormat = document.querySelector('input[name="time-format"]:checked');
    const savedTimeFormat = localStorage.getItem('vybez_time_format') || '12';
    document.querySelectorAll('input[name="time-format"]').forEach(radio => {
        radio.checked = radio.value === savedTimeFormat;
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                localStorage.setItem('vybez_time_format', e.target.value);
            }
        });
    });

    // Date format
    const savedDateFormat = localStorage.getItem('vybez_date_format') || 'mdy';
    document.querySelectorAll('input[name="date-format"]').forEach(radio => {
        radio.checked = radio.value === savedDateFormat;
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                localStorage.setItem('vybez_date_format', e.target.value);
            }
        });
    });

    document.getElementById('save-language-btn')?.addEventListener('click', () => {
        showMessage('Language & region settings saved!', 'success');
    });

    // Sessions Management
    document.getElementById('logout-all-btn')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout from all other sessions?')) {
            try {
                const response = await fetch('/api/sessions/logout-all', { method: 'POST' });
                if (response.ok) {
                    showMessage('Logged out from all other sessions', 'success');
                } else {
                    showMessage('Failed to logout from other sessions', 'error');
                }
            } catch (error) {
                console.error('Logout error:', error);
                showMessage('Failed to logout from other sessions', 'error');
            }
        }
    });

    // Data & Privacy
    const loadUserStats = async () => {
        try {
            const response = await fetch('/api/user/stats');
            if (response.ok) {
                const stats = await response.json();
                document.getElementById('message-count-stat').textContent = stats.messageCount || 0;
                document.getElementById('file-count-stat').textContent = stats.fileCount || 0;
                document.getElementById('room-count-stat').textContent = stats.roomCount || 0;
                document.getElementById('account-age-stat').textContent = stats.accountAge || 0;
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    // Load stats when data section is opened
    document.querySelector('[data-section="data"]')?.addEventListener('click', loadUserStats);

    // Download data
    document.getElementById('download-data-btn')?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/user/download-data');
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vybez-data-${currentUser}-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                showMessage('Data download started!', 'success');
            } else {
                showMessage('Failed to download data', 'error');
            }
        } catch (error) {
            console.error('Download error:', error);
            showMessage('Failed to download data', 'error');
        }
    });

    // Data preferences
    const dataToggles = {
        'analytics-consent': 'vybez_analytics_consent',
        'personalization-consent': 'vybez_personalization_consent'
    };

    Object.entries(dataToggles).forEach(([id, storageKey]) => {
        const element = document.getElementById(id);
        if (element) {
            const saved = localStorage.getItem(storageKey);
            element.checked = saved === null ? element.checked : saved === 'true';
            element.addEventListener('change', (e) => {
                localStorage.setItem(storageKey, e.target.checked);
            });
        }
    });

    document.getElementById('save-data-prefs-btn')?.addEventListener('click', () => {
        showMessage('Data preferences saved!', 'success');
    });

    // Initialize
    initTheme();
    await checkAuth();
});
