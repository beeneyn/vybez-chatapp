document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    let currentUser = null;
    let currentRoom = '';
    const socket = io({ autoConnect: false });
    let typingTimeout = null;

    const showChatUI = (user) => { 
        currentUser = user.username; 
        if (window.location.pathname !== '/chat') window.location.href = '/chat'; 
        else document.getElementById('app-container')?.classList.remove('hidden'); 
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
        const userColor = (msg.color || '#EEE').replace('#', '');
        const placeholderUrl = `https://placehold.co/256x256/${userColor}/31343C?font=poppins&text=${initials}`;
        const avatarUrl = msg.avatar || placeholderUrl;
        const avatarHtml = `<img src="${avatarUrl}" alt="${username}" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 8px; vertical-align: middle; object-fit: cover;">`;
        item.innerHTML = `${avatarHtml}<span class="timestamp">[${time}]</span> <strong style="color: ${msg.color || '#000'}">${isPrivate ? `(private from ${msg.from})` : username}:</strong> `;
        
        if (msg.text) {
            const textWithMentions = msg.text.replace(/@(\w+)/g, (match, username) => {
                if (username === currentUser) {
                    return `<span style="background-color: #5b2bff; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600;">@${username}</span>`;
                }
                return `<span style="background-color: rgba(91, 43, 255, 0.1); color: #5b2bff; padding: 2px 6px; border-radius: 4px; font-weight: 600;">@${username}</span>`;
            });
            
            const textSpan = document.createElement('span');
            textSpan.innerHTML = textWithMentions;
            item.appendChild(textSpan);
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
        window.openModal('privateMessageModal');
        document.getElementById('pm-recipient-name').textContent = username;
        document.getElementById('pm-messages-container').innerHTML = '<p class="text-gray-500">Loading...</p>';
        
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
        statusEl.classList.add('hidden');
        try { 
            const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, client: 'web' }), credentials: 'same-origin' });
            if (response.ok) { 
                const authModal = document.getElementById('authModal');
                if (authModal) authModal.style.display = 'none';
                setTimeout(() => { window.location.href = '/chat'; }, 250);
            } else { 
                const data = await response.json(); 
                console.error('Login failed:', data.message);
                statusEl.textContent = data.message || 'Login failed.';
                statusEl.classList.remove('hidden');
            } 
        } catch (error) { 
            console.error('Login error:', error);
            statusEl.textContent = 'Network error. Please try again.';
            statusEl.classList.remove('hidden');
        } 
    };

    const handleSignup = async (e) => { 
        e.preventDefault(); 
        const username = document.getElementById('signup-username').value; 
        const password = document.getElementById('signup-password').value; 
        const color = document.getElementById('signup-color').value; 
        const statusEl = document.getElementById('signup-status'); 
        statusEl.textContent = ''; 
        statusEl.classList.add('hidden');
        try { 
            const response = await fetch('/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, chat_color: color }) }); 
            if (response.ok) {
                statusEl.className = 'mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg';
                statusEl.textContent = 'Account created! Logging you in...'; 
                statusEl.classList.remove('hidden');
                setTimeout(async () => {
                    const loginRes = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, client: 'web' }), credentials: 'same-origin' });
                    if (loginRes.ok) {
                        window.location.href = '/chat';
                    }
                }, 500);
            } else { 
                const data = await response.json();
                statusEl.className = 'mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg';
                statusEl.textContent = data.message || 'Signup failed.';
                statusEl.classList.remove('hidden');
            } 
        } catch (error) {
            statusEl.className = 'mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg';
            statusEl.textContent = 'Network error. Please try again.';
            statusEl.classList.remove('hidden');
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
                
                if (data.user.role === 'admin') {
                    const headerButtons = document.querySelector('.chat-header .flex.gap-2');
                    if (headerButtons && !document.getElementById('admin-menu-btn')) {
                        const adminMenuBtn = document.createElement('button');
                        adminMenuBtn.id = 'admin-menu-btn';
                        adminMenuBtn.className = 'px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded relative';
                        adminMenuBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Admin';
                        adminMenuBtn.title = 'Admin Panel';
                        
                        const adminDropdown = document.createElement('div');
                        adminDropdown.id = 'admin-dropdown';
                        adminDropdown.className = 'hidden absolute top-full right-0 mt-1 bg-white shadow-lg rounded border border-gray-200 z-50';
                        adminDropdown.innerHTML = `
                            <a href="/ban-management.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <i class="fas fa-ban text-red-500"></i> Bans
                            </a>
                            <a href="/mute-management.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <i class="fas fa-microphone-slash text-blue-500"></i> Mutes
                            </a>
                            <a href="/warning-management.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <i class="fas fa-exclamation-triangle text-yellow-500"></i> Warnings
                            </a>
                        `;
                        
                        adminMenuBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            adminDropdown.classList.toggle('hidden');
                        });
                        
                        document.addEventListener('click', () => {
                            adminDropdown.classList.add('hidden');
                        });
                        
                        adminMenuBtn.appendChild(adminDropdown);
                        headerButtons.insertBefore(adminMenuBtn, headerButtons.children[headerButtons.children.length - 1]);
                    }
                }
            } else { 
                window.location.href = '/'; 
            } 
        } catch (error) { 
            window.location.href = '/'; 
        } 
    };

    const checkModerationStatus = async () => {
        try {
            const response = await fetch('/api/moderation/check-status');
            const data = await response.json();
            
            if (data.isMuted && data.mute) {
                const messageInput = document.getElementById('message-input');
                const messageForm = document.getElementById('message-form');
                const sendButton = messageForm.querySelector('button[type="submit"]');
                
                messageInput.disabled = true;
                messageInput.classList.add('bg-gray-200', 'cursor-not-allowed');
                sendButton.disabled = true;
                sendButton.classList.add('opacity-50', 'cursor-not-allowed');
                
                const expiresAt = new Date(data.mute.expires_at);
                const now = new Date();
                const diffMs = expiresAt - now;
                const diffMinutes = Math.ceil(diffMs / (1000 * 60));
                const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                
                let timeLeft = '';
                if (diffHours > 1) {
                    timeLeft = `${diffHours} hours`;
                } else if (diffMinutes > 1) {
                    timeLeft = `${diffMinutes} minutes`;
                } else {
                    timeLeft = 'less than 1 minute';
                }
                
                messageInput.placeholder = `You are muted for ${timeLeft}. Reason: ${data.mute.reason}`;
                messageInput.title = `Muted by ${data.mute.muted_by}. Expires: ${expiresAt.toLocaleString()}`;
            }
        } catch (error) {
            console.error('Error checking moderation status:', error);
        }
    };

    const loadNotifications = async () => {
        try {
            const response = await fetch('/api/notifications');
            const data = await response.json();
            const notificationsList = document.getElementById('notifications-list');
            const notificationBadge = document.getElementById('notification-badge');
            
            const unreadCount = data.notifications.filter(n => !n.read_at).length;
            
            if (unreadCount > 0) {
                notificationBadge.textContent = unreadCount;
                notificationBadge.classList.remove('hidden');
            } else {
                notificationBadge.classList.add('hidden');
            }
            
            if (data.notifications.length === 0) {
                notificationsList.innerHTML = '<p class="text-gray-500 text-center py-8">No notifications</p>';
                return;
            }
            
            notificationsList.innerHTML = data.notifications.map(notification => {
                const createdAt = new Date(notification.created_at);
                const isUnread = !notification.read_at;
                
                return `
                    <div class="p-4 rounded-lg ${isUnread ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-gray-50 border border-gray-200'}" data-notification-id="${notification.id}">
                        <div class="flex items-start gap-3">
                            <div class="flex-shrink-0">
                                <i class="fas ${notification.type === 'warning' ? 'fa-exclamation-triangle text-yellow-500' : 'fa-info-circle text-blue-500'} text-xl"></i>
                            </div>
                            <div class="flex-1">
                                <div class="flex justify-between items-start mb-1">
                                    <span class="font-semibold text-sm ${notification.type === 'warning' ? 'text-yellow-700' : 'text-blue-700'}">${notification.type.toUpperCase()}</span>
                                    <span class="text-xs text-gray-500">${createdAt.toLocaleString()}</span>
                                </div>
                                <p class="text-gray-700 text-sm">${notification.message}</p>
                                ${isUnread ? `
                                    <button onclick="markNotificationRead(${notification.id})" class="mt-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded">
                                        Mark as Read
                                    </button>
                                ` : '<span class="text-xs text-gray-500 mt-2 inline-block">Read</span>'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading notifications:', error);
            document.getElementById('notifications-list').innerHTML = '<p class="text-red-500 text-center py-8">Failed to load notifications</p>';
        }
    };

    window.markNotificationRead = async (notificationId) => {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PUT'
            });
            if (response.ok) {
                await loadNotifications();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
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

        const renderRoomList = async () => {
            if (!roomList) return;
            try {
                const response = await fetch('/rooms');
                if (!response.ok) return;
                const data = await response.json();
                roomList.innerHTML = '';
                data.rooms.forEach(room => {
                    const item = document.createElement('li');
                    item.classList.add('px-4', 'py-2', 'cursor-pointer', 'hover:bg-gray-100', 'flex', 'justify-between', 'items-center');
                    if (room.name === currentRoom) item.classList.add('bg-blue-100');
                    
                    const roomName = document.createElement('span');
                    roomName.textContent = room.name;
                    roomName.classList.add('flex-1');
                    roomName.addEventListener('click', () => {
                        if (room.name !== currentRoom) socket.emit('switchRoom', room.name);
                    });
                    
                    item.appendChild(roomName);
                    
                    if (!room.is_default) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                        deleteBtn.classList.add('text-red-500', 'hover:text-red-700', 'text-xs', 'px-2');
                        deleteBtn.title = 'Delete room';
                        deleteBtn.onclick = async (e) => {
                            e.stopPropagation();
                            if (confirm(`Delete room ${room.name}?`)) {
                                const res = await fetch(`/rooms/${encodeURIComponent(room.name)}`, { method: 'DELETE' });
                                if (res.ok) {
                                    renderRoomList();
                                    if (currentRoom === room.name) {
                                        socket.emit('switchRoom', '#general');
                                    }
                                } else {
                                    const err = await res.json();
                                    alert(err.message || 'Failed to delete room');
                                }
                            }
                        };
                        item.appendChild(deleteBtn);
                    }
                    
                    roomList.appendChild(item);
                });
            } catch (error) {
                console.error('Failed to load rooms:', error);
            }
        };
        
        socket.on('roomList', renderRoomList);

        socket.on('chatMessage', (msg) => { 
            if (msg.user !== currentUser) {
                const audio = new Audio('/notification.mp3');
                audio.play().catch(e => console.log('Audio play failed:', e));
                
                if (window.desktopAPI) {
                    window.desktopAPI.handleNewMessage({
                        username: msg.user,
                        message: msg.text || '',
                        room: currentRoom
                    });
                }
            }
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
                const userColor = (user.color || '#EEE').replace('#', '');
                const placeholderUrl = `https://placehold.co/256x256/${userColor}/31343C?font=poppins&text=${initials}`;
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
            
            if (window.desktopAPI) {
                window.desktopAPI.handleNewPrivateMessage({
                    from: pm.from,
                    message: pm.text || ''
                });
            }
            
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
        });

        socket.on('readReceiptUpdate', ({ messageId, receipts }) => {
        });
        
        socket.on('roomCreated', (room) => {
            renderRoomList();
        });
        
        socket.on('roomDeleted', ({ name }) => {
            renderRoomList();
            if (currentRoom === name) {
                socket.emit('switchRoom', '#general');
            }
        });
        
        socket.on('error', (error) => {
            if (error.type === 'muted') {
                const expiresAt = new Date(error.mute.expires_at);
                alert(`You are muted until ${expiresAt.toLocaleString()}.\n\nReason: ${error.mute.reason}\nMuted by: ${error.mute.muted_by}`);
                checkModerationStatus();
            } else if (error.type === 'banned') {
                alert(`You have been banned from the server.\n\nReason: ${error.ban.reason}\nBanned by: ${error.ban.banned_by}`);
                window.location.href = '/ban.html';
            }
        });
    };

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    if (window.location.pathname === '/chat') {
        initializeSockets();
        checkSession();
        checkModerationStatus();
        loadNotifications();
        
        document.getElementById('logout-button')?.addEventListener('click', handleLogout);
        
        document.getElementById('notifications-button')?.addEventListener('click', () => {
            loadNotifications();
            window.openModal('notificationsModal');
        });
        
        document.getElementById('create-room-confirm-btn')?.addEventListener('click', async () => {
            const roomNameInput = document.getElementById('room-name-input');
            const messageDiv = document.getElementById('create-room-message');
            const roomName = roomNameInput.value.trim();
            
            if (!roomName) {
                messageDiv.textContent = 'Please enter a room name';
                messageDiv.className = 'text-sm mb-3 text-red-600';
                messageDiv.classList.remove('hidden');
                return;
            }
            
            try {
                const response = await fetch('/rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: roomName })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    messageDiv.textContent = 'Room created successfully!';
                    messageDiv.className = 'text-sm mb-3 text-green-600';
                    messageDiv.classList.remove('hidden');
                    roomNameInput.value = '';
                    setTimeout(() => {
                        window.closeModal('createRoomModal');
                        messageDiv.classList.add('hidden');
                    }, 1000);
                } else {
                    messageDiv.textContent = data.message || 'Failed to create room';
                    messageDiv.className = 'text-sm mb-3 text-red-600';
                    messageDiv.classList.remove('hidden');
                }
            } catch (error) {
                messageDiv.textContent = 'Error creating room';
                messageDiv.className = 'text-sm mb-3 text-red-600';
                messageDiv.classList.remove('hidden');
            }
        });
        
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
    }
});
