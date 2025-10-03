document.addEventListener('DOMContentLoaded', () => {
    // --- THEME TOGGLE LOGIC ---
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

    // --- APP LOGIC ---
    let currentUser = null;
    let currentRoom = '';
    const socket = io({ autoConnect: false });

    // --- UI & AUTH FUNCTIONS ---
    const showChatUI = (user) => { currentUser = user.username; if (window.location.pathname !== '/chat') window.location.href = '/chat'; else document.getElementById('app-container')?.classList.remove('hidden'); };
    const renderMessage = (msg, isPrivate = false) => { const chatWindow = document.getElementById('chat-window'); const messageContainer = document.getElementById('message-container'); if (!chatWindow || !messageContainer) return; const shouldScroll = chatWindow.scrollHeight - chatWindow.clientHeight <= chatWindow.scrollTop + 50; const item = document.createElement('li'); if (isPrivate) item.classList.add('private-message'); const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); item.innerHTML = `<span class="timestamp">[${time}]</span> <strong style="color: ${msg.color || '#000'}">${isPrivate ? `(private from ${msg.from})` : msg.user}:</strong> `; item.appendChild(document.createTextNode(msg.text)); messageContainer.appendChild(item); if (shouldScroll) chatWindow.scrollTop = chatWindow.scrollHeight; };
    const handleLogin = async (e) => { e.preventDefault(); const username = document.getElementById('login-username').value; const password = document.getElementById('login-password').value; const statusEl = document.getElementById('login-status'); statusEl.textContent = ''; try { const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); if (response.ok) { window.location.href = '/chat'; } else { const data = await response.json(); statusEl.textContent = data.message || 'Login failed.'; } } catch (error) { statusEl.textContent = 'An error occurred.'; } };
    const handleSignup = async (e) => { e.preventDefault(); const username = document.getElementById('signup-username').value; const password = document.getElementById('signup-password').value; const color = document.getElementById('signup-color').value; const statusEl = document.getElementById('signup-status'); statusEl.textContent = ''; try { const response = await fetch('/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, chat_color: color }) }); if (response.ok) { statusEl.textContent = 'Signup successful! Please log in.'; e.target.reset(); } else { const data = await response.json(); statusEl.textContent = data.message || 'Signup failed.'; } } catch (error) { statusEl.textContent = 'An error occurred.'; } };
    const handleLogout = async () => { try { await fetch('/logout', { method: 'POST' }); window.location.href = '/'; } catch (error) { console.error('Logout failed:', error); } };
    const checkSession = async () => { try { const response = await fetch('/check-session'); const data = await response.json(); if (data.loggedIn) { showChatUI(data.user); socket.connect(); } else { window.location.href = '/'; } } catch (error) { window.location.href = '/'; } };
    
    // --- SOCKET LISTENERS ---
    const initializeSockets = () => {
        const roomList = document.getElementById('room-list');
        const welcomeMessage = document.getElementById('welcome-message');
        const onlineUsersList = document.getElementById('online-users-list');
        socket.on('loadHistory', ({ room, messages }) => { currentRoom = room; if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUser}! | Room: ${room}`; document.querySelectorAll('#room-list li').forEach(li => { li.classList.toggle('active', li.textContent === room); }); document.getElementById('message-container').innerHTML = ''; messages.forEach(msg => renderMessage(msg)); });
        socket.on('roomList', (rooms) => { if (!roomList) return; roomList.innerHTML = ''; rooms.forEach(room => { const item = document.createElement('li'); item.classList.add('list-group-item'); item.textContent = room; if (room === currentRoom) item.classList.add('active'); item.addEventListener('click', () => { if (room !== currentRoom) socket.emit('switchRoom', room); }); roomList.appendChild(item); }); });
        socket.on('chatMessage', (msg) => { renderMessage(msg); });
        socket.on('updateUserList', (users) => { if (!onlineUsersList) return; onlineUsersList.innerHTML = ''; users.forEach(user => { if (user.username === currentUser) return; const item = document.createElement('li'); item.classList.add('list-group-item'); item.textContent = user.username; item.style.color = user.color; onlineUsersList.appendChild(item); }); });
        // Private message listener can be added here if you bring back the feature
    };

    // --- MAIN ROUTER ---
    if (window.location.pathname === '/') {
        document.getElementById('login-form')?.addEventListener('submit', handleLogin);
        document.getElementById('signup-form')?.addEventListener('submit', handleSignup);
    } else if (window.location.pathname === '/chat') {
        initializeSockets();
        checkSession();
        document.getElementById('logout-button')?.addEventListener('click', handleLogout);
        document.getElementById('message-form')?.addEventListener('submit', (e) => { e.preventDefault(); const input = document.getElementById('message-input'); if (input.value) { socket.emit('chatMessage', { text: input.value }); input.value = ''; } });
    }
});