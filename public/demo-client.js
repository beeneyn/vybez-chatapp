let demoData = null;
let currentRoom = 'general';

async function loadDemoData() {
    try {
        const response = await fetch('/demo-data');
        demoData = await response.json();
        initializeDemo();
    } catch (err) {
        console.error('Error loading demo data:', err);
    }
}

function initializeDemo() {
    renderRooms();
    renderOnlineUsers();
    switchRoom('general');
}

function renderRooms() {
    const roomList = document.getElementById('room-list');
    roomList.innerHTML = '';
    
    demoData.rooms.forEach(room => {
        const li = document.createElement('li');
        li.className = 'px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors';
        if (room.name === currentRoom) {
            li.classList.add('bg-blue-50');
        }
        
        li.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-medium">#${room.name}</span>
                ${room.is_default ? '<i class="fas fa-star text-yellow-500 text-xs"></i>' : ''}
            </div>
        `;
        
        li.addEventListener('click', () => switchRoom(room.name));
        roomList.appendChild(li);
    });
}

function renderOnlineUsers() {
    const usersList = document.getElementById('online-users-list');
    usersList.innerHTML = '';
    
    demoData.users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'px-4 py-3 hover:bg-gray-50 transition-colors';
        
        const colorDot = `<span class="inline-block w-3 h-3 rounded-full mr-2" style="background-color: ${user.chat_color}"></span>`;
        const statusIcon = user.status === 'online' ? '<i class="fas fa-circle text-green-500 text-xs"></i>' : '<i class="fas fa-circle text-gray-400 text-xs"></i>';
        
        li.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    ${colorDot}
                    <span class="font-medium">${user.username}</span>
                </div>
                ${statusIcon}
            </div>
            ${user.bio ? `<div class="text-xs text-gray-500 mt-1 ml-5">${user.bio}</div>` : ''}
        `;
        
        usersList.appendChild(li);
    });
    
    const demoUserLi = document.createElement('li');
    demoUserLi.className = 'px-4 py-3 bg-blue-50';
    demoUserLi.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <span class="inline-block w-3 h-3 rounded-full mr-2" style="background-color: #ffb347"></span>
                <span class="font-medium">DemoUser (You)</span>
            </div>
            <i class="fas fa-circle text-green-500 text-xs"></i>
        </div>
        <div class="text-xs text-gray-500 mt-1 ml-5">Viewing demo</div>
    `;
    usersList.appendChild(demoUserLi);
}

function switchRoom(roomName) {
    currentRoom = roomName;
    renderRooms();
    renderMessages();
    document.getElementById('welcome-message').textContent = `#${roomName}`;
}

function renderMessages() {
    const messageContainer = document.getElementById('message-container');
    messageContainer.innerHTML = '';
    
    const roomMessages = demoData.messages.filter(msg => msg.room === currentRoom);
    
    if (roomMessages.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'text-center text-gray-500 py-8';
        emptyMessage.textContent = 'No messages in this room yet';
        messageContainer.appendChild(emptyMessage);
        return;
    }
    
    roomMessages.forEach(msg => {
        const li = document.createElement('li');
        li.className = 'message-item';
        
        const timestamp = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        const colorStyle = msg.chat_color ? `color: ${msg.chat_color}` : '';
        
        let messageContent = `
            <div class="flex items-start gap-2">
                <div class="flex-1">
                    <div class="flex items-baseline gap-2">
                        <span class="font-bold" style="${colorStyle}">${msg.username}</span>
                        <span class="text-xs text-gray-500">${timestamp}</span>
                    </div>
                    <div class="text-gray-800 mt-1">${escapeHtml(msg.message_text)}</div>
        `;
        
        if (msg.file_url) {
            if (msg.file_type === 'image') {
                messageContent += `
                    <div class="mt-2">
                        <img src="${msg.file_url}" alt="Shared image" class="max-w-xs rounded-lg border cursor-pointer hover:opacity-90" style="max-height: 300px;">
                    </div>
                `;
            } else if (msg.file_type === 'document') {
                messageContent += `
                    <div class="mt-2">
                        <div class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                            <i class="fas fa-file-pdf text-red-500"></i>
                            <span class="text-sm">${msg.file_url.split('/').pop()}</span>
                        </div>
                    </div>
                `;
            } else if (msg.file_type === 'audio') {
                messageContent += `
                    <div class="mt-2">
                        <div class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                            <i class="fas fa-music text-purple-500"></i>
                            <span class="text-sm">${msg.file_url.split('/').pop()}</span>
                        </div>
                    </div>
                `;
            }
        }
        
        if (msg.reactions && msg.reactions.length > 0) {
            messageContent += '<div class="flex gap-1 mt-2">';
            const reactionCounts = {};
            msg.reactions.forEach(reaction => {
                reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
            });
            
            Object.entries(reactionCounts).forEach(([emoji, count]) => {
                messageContent += `
                    <span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm">
                        <span>${emoji}</span>
                        <span class="text-xs text-gray-600">${count}</span>
                    </span>
                `;
            });
            messageContent += '</div>';
        }
        
        messageContent += `
                </div>
            </div>
        `;
        
        li.innerHTML = messageContent;
        messageContainer.appendChild(li);
    });
    
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', loadDemoData);
