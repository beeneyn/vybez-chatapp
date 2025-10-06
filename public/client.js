document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const applyTheme = (theme) => {
            const icon = theme === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
            document.body.setAttribute('data-theme', theme);
            themeToggle.innerHTML = icon;
        };
        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme);
        themeToggle.addEventListener('click', () => {
            const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    let currentUser = null;
    let currentRoom = '';
    const socket = io({ autoConnect: false });
    let typingTimeout = null;

    const showChatUI = (user) => { 
        currentUser = user.username; 
        if (window.location.pathname !== '/chat') window.location.href = '/chat'; 
        else document.getElementById('app-container')?.classList.remove('hidden'); 
    };

    const generateColorFromUsername = (username) => {
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 65%, 75%)`;
    };

    const rgbToHex = (r, g, b) => {
        return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    };

    const hslToHex = (h, s, l) => {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        const r = Math.round(255 * f(0));
        const g = Math.round(255 * f(8));
        const b = Math.round(255 * f(4));
        return rgbToHex(r, g, b);
    };

    const renderMessage = (msg, isPrivate = false) => { 
        const chatWindow = document.getElementById('chat-window'); 
        const messageContainer = document.getElementById('message-container'); 
        if (!chatWindow || !messageContainer) return; 
        const shouldScroll = chatWindow.scrollHeight - chatWindow.clientHeight <= chatWindow.scrollTop + 50; 
        const item = document.createElement('li'); 
        item.setAttribute('data-message-id', msg.id);
        if (isPrivate) item.classList.add('private-message'); 
        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
        const username = isPrivate ? msg.from : msg.user;
        const initials = username.substring(0, 2).toUpperCase();
        const hslColor = generateColorFromUsername(username);
        const hue = parseInt(hslColor.match(/\d+/)[0]);
        const bgColor = hslToHex(hue, 65, 75);
        const placeholderUrl = `https://placehold.co/256x256/${bgColor}/31343C?font=poppins&text=${initials}`;
        const avatarUrl = msg.avatar || placeholderUrl;
        const avatarHtml = `<img src="${avatarUrl}" alt="${username}" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px; vertical-align: middle; object-fit: cover;">`;
        item.innerHTML = `${avatarHtml}<span class="timestamp">[${time}]</span> <strong style="color: ${msg.color || '#000'}">${isPrivate ? `(private from ${msg.from})` : username}:</strong> `;
        
        if (msg.text) {
            item.appendChild(document.createTextNode(msg.text));
        }
        
        if (msg.fileUrl) {
            const fileLink = document.createElement('a');
            fileLink.href = msg.fileUrl;
            fileLink.target = '_blank';
            fileLink.className = 'btn btn-sm btn-info ms-2';
            if (msg.fileType && msg.fileType.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = msg.fileUrl;
                img.style.maxWidth = '300px';
                img.style.maxHeight = '300px';
                img.className = 'd-block mt-2 rounded';
                item.appendChild(img);
            } else {
                fileLink.innerHTML = '<i class="bi bi-file-earmark"></i> View File';
                item.appendChild(fileLink);
            }
        }
        
        const reactionBtn = document.createElement('button');
        reactionBtn.className = 'btn btn-sm btn-link reaction-btn';
        reactionBtn.innerHTML = '😊';
        reactionBtn.onclick = (e) => showEmojiPicker(msg.id, e);
        item.appendChild(reactionBtn);
        
        const reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'reactions-container mt-1';
        reactionsContainer.setAttribute('data-message-reactions', msg.id);
        item.appendChild(reactionsContainer);
        
        messageContainer.appendChild(item); 
        if (shouldScroll) chatWindow.scrollTop = chatWindow.scrollHeight; 
    };

    const showEmojiPicker = (messageId, event) => {
        const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];
        const picker = document.createElement('div');
        picker.className = 'emoji-picker';
        picker.style.cssText = 'position: fixed; background: white; border: 1px solid #ccc; padding: 10px; border-radius: 8px; z-index: 1000; display: flex; gap: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
        
        emojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm';
            btn.textContent = emoji;
            btn.onclick = () => {
                socket.emit('addReaction', { messageId, emoji });
                picker.remove();
            };
            picker.appendChild(btn);
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-sm btn-secondary';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => picker.remove();
        picker.appendChild(closeBtn);
        
        document.body.appendChild(picker);
        const rect = event.target.getBoundingClientRect();
        picker.style.left = rect.left + 'px';
        picker.style.top = (rect.bottom + 5) + 'px';
    };

    const updateReactions = (messageId, reactions) => {
        const container = document.querySelector(`[data-message-reactions="${messageId}"]`);
        if (!container) return;
        
        container.innerHTML = '';
        const reactionCounts = {};
        reactions.forEach(r => {
            reactionCounts[r.emoji] = reactionCounts[r.emoji] || { count: 0, users: [] };
            reactionCounts[r.emoji].count++;
            reactionCounts[r.emoji].users.push(r.username);
        });
        
        Object.entries(reactionCounts).forEach(([emoji, data]) => {
            const badge = document.createElement('span');
            badge.className = 'badge bg-light text-dark me-1';
            badge.style.cursor = 'pointer';
            badge.textContent = `${emoji} ${data.count}`;
            badge.title = data.users.join(', ');
            badge.onclick = () => {
                if (data.users.includes(currentUser)) {
                    socket.emit('removeReaction', { messageId, emoji });
                } else {
                    socket.emit('addReaction', { messageId, emoji });
                }
            };
            container.appendChild(badge);
        });
    };

    const handleFileUpload = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch('/upload-file', { method: 'POST', body: formData });
            if (response.ok) {
                const data = await response.json();
                return data;
            } else {
                alert('File upload failed');
                return null;
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload error');
            return null;
        }
    };

    const openPrivateMessage = async (username) => {
        const modal = new bootstrap.Modal(document.getElementById('privateMessageModal'));
        document.getElementById('pm-recipient-name').textContent = username;
        document.getElementById('pm-messages-container').innerHTML = '<p class="text-muted">Loading...</p>';
        
        try {
            const response = await fetch(`/private-messages/${username}`);
            if (response.ok) {
                const data = await response.json();
                const container = document.getElementById('pm-messages-container');
                container.innerHTML = '';
                data.messages.forEach(msg => {
                    const div = document.createElement('div');
                    div.className = `mb-2 ${msg.from_user === currentUser ? 'text-end' : ''}`;
                    div.innerHTML = `<strong>${msg.from_user}:</strong> ${msg.message_text}`;
                    container.appendChild(div);
                });
            }
        } catch (error) {
            console.error('Failed to load private messages:', error);
        }
        
        modal.show();
        
        const sendBtn = document.getElementById('pm-send-btn');
        const input = document.getElementById('pm-input');
        sendBtn.onclick = () => {
            if (input.value.trim()) {
                socket.emit('privateMessage', { to: username, text: input.value });
                const container = document.getElementById('pm-messages-container');
                const div = document.createElement('div');
                div.className = 'mb-2 text-end';
                div.innerHTML = `<strong>You:</strong> ${input.value}`;
                container.appendChild(div);
                input.value = '';
            }
        };
    };

    const searchMessages = async () => {
        const query = prompt('Search messages:');
        if (!query) return;
        
        try {
            const response = await fetch(`/search-messages?room=${encodeURIComponent(currentRoom)}&query=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                const container = document.getElementById('message-container');
                container.innerHTML = '<div class="alert alert-info">Search Results</div>';
                data.messages.forEach(msg => {
                    renderMessage({
                        id: msg.id,
                        user: msg.username,
                        text: msg.message_text,
                        color: msg.chat_color,
                        timestamp: msg.timestamp,
                        fileUrl: msg.file_url,
                        fileType: msg.file_type,
                        avatar: msg.avatar_url
                    });
                });
            }
        } catch (error) {
            console.error('Search failed:', error);
        }
    };

    const handleLogin = async (e) => { 
        e.preventDefault(); 
        const username = document.getElementById('login-username').value; 
        const password = document.getElementById('login-password').value; 
        const statusEl = document.getElementById('login-status'); 
        statusEl.textContent = ''; 
        try { 
            const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); 
            if (response.ok) { 
                window.location.href = '/chat'; 
            } else { 
                const data = await response.json(); 
                statusEl.textContent = data.message || 'Login failed.'; 
            } 
        } catch (error) { 
            statusEl.textContent = 'An error occurred.'; 
        } 
    };

    const handleSignup = async (e) => { 
        e.preventDefault(); 
        const username = document.getElementById('signup-username').value; 
        const password = document.getElementById('signup-password').value; 
        const color = document.getElementById('signup-color').value; 
        const statusEl = document.getElementById('signup-status'); 
        statusEl.textContent = ''; 
        try { 
            const response = await fetch('/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, chat_color: color }) }); 
            if (response.ok) { 
                statusEl.textContent = 'Signup successful! Please log in.'; 
                e.target.reset(); 
            } else { 
                const data = await response.json(); 
                statusEl.textContent = data.message || 'Signup failed.'; 
            } 
        } catch (error) { 
            statusEl.textContent = 'An error occurred.'; 
        } 
    };

    const handleLogout = async () => { 
        try { 
            await fetch('/logout', { method: 'POST' }); 
            window.location.href = '/'; 
        } catch (error) { 
            console.error('Logout failed:', error); 
        } 
    };

    const checkSession = async () => { 
        try { 
            const response = await fetch('/check-session'); 
            const data = await response.json(); 
            if (data.loggedIn) { 
                showChatUI(data.user); 
                socket.connect(); 
            } else { 
                window.location.href = '/'; 
            } 
        } catch (error) { 
            window.location.href = '/'; 
        } 
    };

    const initializeSockets = () => {
        const roomList = document.getElementById('room-list');
        const welcomeMessage = document.getElementById('welcome-message');
        const onlineUsersList = document.getElementById('online-users-list');
        const typingIndicator = document.getElementById('typing-indicator');

        socket.on('loadHistory', ({ room, messages }) => { 
            currentRoom = room; 
            if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUser}! | Room: ${room}`; 
            document.querySelectorAll('#room-list li').forEach(li => { 
                li.classList.toggle('active', li.textContent === room); 
            }); 
            document.getElementById('message-container').innerHTML = ''; 
            messages.forEach(msg => renderMessage(msg)); 
        });

        socket.on('roomList', (rooms) => { 
            if (!roomList) return; 
            roomList.innerHTML = ''; 
            rooms.forEach(room => { 
                const item = document.createElement('li'); 
                item.classList.add('list-group-item'); 
                item.textContent = room; 
                if (room === currentRoom) item.classList.add('active'); 
                item.addEventListener('click', () => { 
                    if (room !== currentRoom) socket.emit('switchRoom', room); 
                }); 
                roomList.appendChild(item); 
            }); 
        });

        socket.on('chatMessage', (msg) => { 
            renderMessage(msg); 
        });

        socket.on('updateUserList', (users) => { 
            if (!onlineUsersList) return; 
            onlineUsersList.innerHTML = ''; 
            users.forEach(user => { 
                if (user.username === currentUser) return; 
                const item = document.createElement('li'); 
                item.classList.add('list-group-item'); 
                item.style.cursor = 'pointer';
                item.title = 'Click to send private message';
                item.onclick = () => openPrivateMessage(user.username);
                
                const initials = user.username.substring(0, 2).toUpperCase();
                const hslColor = generateColorFromUsername(user.username);
                const hue = parseInt(hslColor.match(/\d+/)[0]);
                const bgColor = hslToHex(hue, 65, 75);
                const placeholderUrl = `https://placehold.co/256x256/${bgColor}/31343C?font=poppins&text=${initials}`;
                const avatarUrl = user.avatar || placeholderUrl;
                const avatarImg = `<img src="${avatarUrl}" alt="${user.username}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px; vertical-align: middle; object-fit: cover;">`;
                item.innerHTML = `${avatarImg}<span style="color: ${user.color};">${user.username}</span>`;
                
                onlineUsersList.appendChild(item); 
            }); 
        });

        socket.on('typingUsers', (users) => {
            if (!typingIndicator) return;
            const filtered = users.filter(u => u !== currentUser);
            if (filtered.length > 0) {
                typingIndicator.textContent = `${filtered.join(', ')} ${filtered.length === 1 ? 'is' : 'are'} typing...`;
            } else {
                typingIndicator.textContent = '';
            }
        });

        socket.on('reactionUpdate', ({ messageId, reactions }) => {
            updateReactions(messageId, reactions);
        });

        socket.on('privateMessage', (pm) => {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
            
            const pmModal = document.getElementById('privateMessageModal');
            const recipientName = document.getElementById('pm-recipient-name').textContent;
            
            if (pmModal && pmModal.classList.contains('show') && recipientName === pm.from) {
                const container = document.getElementById('pm-messages-container');
                const div = document.createElement('div');
                div.className = 'mb-2';
                div.innerHTML = `<strong>${pm.from}:</strong> ${pm.text}`;
                container.appendChild(div);
                container.scrollTop = container.scrollHeight;
            } else {
                alert(`New private message from ${pm.from}: ${pm.text}`);
            }
        });

        socket.on('privateMessageSent', (pm) => {
            console.log('Private message sent:', pm);
        });

        socket.on('readReceiptUpdate', ({ messageId, receipts }) => {
            console.log('Read receipts updated:', messageId, receipts);
        });
    };

    if (window.location.pathname === '/') {
        document.getElementById('login-form')?.addEventListener('submit', handleLogin);
        document.getElementById('signup-form')?.addEventListener('submit', handleSignup);
    } else if (window.location.pathname === '/chat') {
        initializeSockets();
        checkSession();
        
        document.getElementById('logout-button')?.addEventListener('click', handleLogout);
        
        const messageForm = document.getElementById('message-form');
        const messageInput = document.getElementById('message-input');
        
        messageInput?.addEventListener('input', () => {
            clearTimeout(typingTimeout);
            socket.emit('typing', true);
            typingTimeout = setTimeout(() => {
                socket.emit('typing', false);
            }, 1000);
        });

        messageForm?.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            const input = document.getElementById('message-input'); 
            if (input.value) { 
                socket.emit('chatMessage', { text: input.value }); 
                input.value = ''; 
                socket.emit('typing', false);
            } 
        });

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const result = await handleFileUpload(file);
                if (result) {
                    socket.emit('chatMessage', { 
                        text: '', 
                        fileUrl: result.fileUrl, 
                        fileType: result.fileType 
                    });
                }
            }
        };
        document.body.appendChild(fileInput);

        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'btn btn-secondary btn-sm me-2';
        uploadBtn.innerHTML = '<i class="bi bi-paperclip"></i>';
        uploadBtn.title = 'Upload file';
        uploadBtn.onclick = () => fileInput.click();
        document.querySelector('.card-footer form')?.prepend(uploadBtn);

        const searchBtn = document.createElement('button');
        searchBtn.className = 'btn btn-info btn-sm me-2';
        searchBtn.innerHTML = '<i class="bi bi-search"></i>';
        searchBtn.title = 'Search messages';
        searchBtn.type = 'button';
        searchBtn.onclick = searchMessages;
        document.querySelector('.card-header .btn-group, .card-header div:last-child')?.prepend(searchBtn);

        const settingsModal = document.getElementById('settingsModal');
        settingsModal?.addEventListener('show.bs.modal', async () => {
            try {
                const response = await fetch('/check-session');
                const data = await response.json();
                if (data.loggedIn && data.user) {
                    document.getElementById('settings-bio').value = data.user.bio || '';
                    document.getElementById('settings-status').value = data.user.status || '';
                    document.getElementById('settings-color').value = data.user.color || '#000000';
                    
                    const avatarImg = document.getElementById('current-avatar');
                    const avatarPlaceholder = document.getElementById('avatar-placeholder');
                    if (data.user.avatar) {
                        avatarImg.src = data.user.avatar;
                        avatarImg.style.display = 'block';
                        avatarPlaceholder.style.display = 'none';
                    } else {
                        avatarImg.style.display = 'none';
                        avatarPlaceholder.style.display = 'flex';
                    }
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        });

        document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('avatar', file);
            
            try {
                const response = await fetch('/upload-avatar', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const avatarImg = document.getElementById('current-avatar');
                    const avatarPlaceholder = document.getElementById('avatar-placeholder');
                    avatarImg.src = data.avatarUrl;
                    avatarImg.style.display = 'block';
                    avatarPlaceholder.style.display = 'none';
                    
                    const msgEl = document.getElementById('settings-message');
                    msgEl.className = 'alert alert-success';
                    msgEl.textContent = 'Avatar uploaded successfully!';
                    msgEl.classList.remove('d-none');
                    setTimeout(() => msgEl.classList.add('d-none'), 3000);
                } else {
                    const error = await response.json();
                    alert('Avatar upload failed: ' + (error.message || 'Unknown error'));
                }
            } catch (error) {
                console.error('Avatar upload error:', error);
                alert('Failed to upload avatar');
            }
        });

        document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
            const bio = document.getElementById('settings-bio').value;
            const status = document.getElementById('settings-status').value;
            const chat_color = document.getElementById('settings-color').value;
            
            try {
                const response = await fetch('/update-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bio, status, chat_color })
                });
                
                const msgEl = document.getElementById('settings-message');
                if (response.ok) {
                    msgEl.textContent = 'Settings saved successfully!';
                    msgEl.className = 'alert alert-success';
                } else {
                    const error = await response.json();
                    msgEl.textContent = 'Failed to save settings: ' + (error.message || 'Unknown error');
                    msgEl.className = 'alert alert-danger';
                }
                msgEl.classList.remove('d-none');
                setTimeout(() => msgEl.classList.add('d-none'), 3000);
            } catch (error) {
                console.error('Save settings error:', error);
                const msgEl = document.getElementById('settings-message');
                msgEl.textContent = 'Failed to save settings';
                msgEl.className = 'alert alert-danger';
                msgEl.classList.remove('d-none');
                setTimeout(() => msgEl.classList.add('d-none'), 3000);
            }
        });
    }
});
