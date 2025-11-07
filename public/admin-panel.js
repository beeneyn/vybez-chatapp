let currentTab = 'users';

async function logout() {
    try {
        await fetch('/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.href = '/';
    }
}

function showAlert(message, type = 'success') {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `p-4 rounded-lg mb-4 ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
    alert.classList.remove('hidden');
    setTimeout(() => alert.classList.add('hidden'), 3000);
}

function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-purple-500', 'text-white');
        btn.classList.add('border-transparent', 'text-gray-400');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    document.getElementById(`tab-${tab}`).classList.add('border-purple-500', 'text-white');
    document.getElementById(`tab-${tab}`).classList.remove('border-transparent', 'text-gray-400');
    document.getElementById(`content-${tab}`).classList.remove('hidden');
    
    switch(tab) {
        case 'users':
            loadUsers();
            break;
        case 'rooms':
            loadRooms();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'files':
            loadFiles();
            break;
        case 'tickets':
            loadTickets();
            break;
        case 'announcements':
            loadAnnouncements();
            break;
        case 'apikeys':
            loadAPIKeys();
            break;
        case 'apilogs':
            loadAPILogs();
            break;
        case 'serverlogs':
            loadServerLogs();
            break;
        case 'maintenance':
            loadMaintenanceStatus();
            break;
        case 'database':
            loadDatabaseStats();
            break;
        case 'activity':
            loadActivityGraphs();
            break;
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        if (!response.ok) {
            throw new Error('Failed to load stats');
        }
        const data = await response.json();
        
        document.getElementById('stat-users').textContent = data.totalUsers || 0;
        document.getElementById('stat-rooms').textContent = data.totalRooms || 0;
        document.getElementById('stat-messages').textContent = data.totalMessages || 0;
        document.getElementById('stat-bans').textContent = data.activeBans || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadUsers() {
    const tbody = document.getElementById('users-table');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>';
    
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        const data = await response.json();
        
        tbody.innerHTML = '';
        
        if (data.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400">No users found</td></tr>';
            return;
        }
        
        data.users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-800 transition';
            
            const emailDisplay = user.email || '<span class="text-gray-500 italic">No email</span>';
            const roleDisplay = user.role === 'admin' 
                ? '<span class="px-2 py-1 bg-purple-500 text-white rounded text-xs">Admin</span>' 
                : '<span class="px-2 py-1 bg-gray-600 text-white rounded text-xs">User</span>';
            
            const statusDisplay = user.is_banned 
                ? '<span class="px-2 py-1 bg-red-500 text-white rounded text-xs">Banned</span>'
                : user.is_muted
                ? '<span class="px-2 py-1 bg-yellow-500 text-white rounded text-xs">Muted</span>'
                : '<span class="px-2 py-1 bg-green-500 text-white rounded text-xs">Active</span>';
            
            row.innerHTML = `
                <td class="py-3 px-4">
                    <div class="flex items-center">
                        <img src="${user.avatar_url || 'https://placehold.co/32x32/5b2bff/ffffff?text=' + user.username.substring(0, 2).toUpperCase()}" 
                             class="w-8 h-8 rounded-full mr-2 object-cover" alt="${user.username}">
                        <span style="color: ${user.chat_color || '#fff'}">${user.username}</span>
                    </div>
                </td>
                <td class="py-3 px-4">${emailDisplay}</td>
                <td class="py-3 px-4">${roleDisplay}</td>
                <td class="py-3 px-4">${statusDisplay}</td>
                <td class="py-3 px-4">
                    <div class="flex gap-2">
                        <button onclick="openModView('${user.username}')" class="px-2 py-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded text-xs" title="View Profile">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${user.role !== 'admin' ? 
                            `<button onclick="toggleAdmin('${user.username}', true)" class="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs" title="Promote to Admin">
                                <i class="fas fa-arrow-up"></i>
                            </button>` :
                            `<button onclick="toggleAdmin('${user.username}', false)" class="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs" title="Demote from Admin">
                                <i class="fas fa-arrow-down"></i>
                            </button>`
                        }
                        <a href="/ban-management.html" class="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs" title="Ban User">
                            <i class="fas fa-ban"></i>
                        </a>
                        <button onclick="deleteUser('${user.username}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-400">Error: ${error.message}</td></tr>`;
    }
}

async function loadRooms() {
    const tbody = document.getElementById('rooms-table');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading...</td></tr>';
    
    try {
        const response = await fetch('/api/admin/rooms');
        if (!response.ok) {
            throw new Error('Failed to load rooms');
        }
        const data = await response.json();
        
        tbody.innerHTML = '';
        
        if (data.rooms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400">No rooms found</td></tr>';
            return;
        }
        
        data.rooms.forEach(room => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-800 transition';
            
            const typeDisplay = room.is_default 
                ? '<span class="px-2 py-1 bg-blue-500 text-white rounded text-xs">Default</span>' 
                : '<span class="px-2 py-1 bg-cyan-500 text-white rounded text-xs">Custom</span>';
            
            const createdDate = new Date(room.created_at).toLocaleString();
            
            row.innerHTML = `
                <td class="py-3 px-4 font-semibold">${room.name}</td>
                <td class="py-3 px-4">${room.created_by || 'System'}</td>
                <td class="py-3 px-4">${createdDate}</td>
                <td class="py-3 px-4">${typeDisplay}</td>
                <td class="py-3 px-4">
                    ${!room.is_default ? 
                        `<button onclick="deleteRoom('${room.name}')" class="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs">
                            <i class="fas fa-trash"></i> Delete
                        </button>` :
                        '<span class="text-gray-500 italic text-xs">Protected</span>'
                    }
                </td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading rooms:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-400">Error: ${error.message}</td></tr>`;
    }
}

async function loadMessages() {
    const container = document.getElementById('messages-list');
    container.innerHTML = '<p class="text-gray-400 text-center py-4">Loading...</p>';
    
    try {
        const response = await fetch('/api/admin/messages');
        if (!response.ok) {
            throw new Error('Failed to load messages');
        }
        const data = await response.json();
        
        container.innerHTML = '';
        
        if (data.messages.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center py-4">No messages found</p>';
            return;
        }
        
        data.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'p-4 bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700';
            
            const timestamp = new Date(msg.timestamp).toLocaleString();
            const messageText = msg.message_text || '<em class="text-gray-500">[File only]</em>';
            
            messageDiv.innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <img src="${msg.avatar_url || 'https://placehold.co/24x24/5b2bff/ffffff?text=' + msg.username.substring(0, 2).toUpperCase()}" 
                             class="w-6 h-6 rounded-full object-cover" alt="${msg.username}">
                        <span class="font-semibold" style="color: ${msg.chat_color || '#fff'}">${msg.username}</span>
                        <span class="text-xs text-gray-500">in ${msg.room}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">${timestamp}</span>
                        <span class="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">ID: ${msg.id}</span>
                    </div>
                </div>
                <p class="text-gray-300 text-sm">${messageText}</p>
                ${msg.file_url ? `<div class="mt-2"><i class="fas fa-paperclip text-cyan-400"></i> <a href="${msg.file_url}" target="_blank" class="text-cyan-400 hover:text-cyan-300 text-sm">View File</a></div>` : ''}
            `;
            
            container.appendChild(messageDiv);
        });
    } catch (error) {
        console.error('Error loading messages:', error);
        container.innerHTML = `<p class="text-red-400 text-center py-4">Error: ${error.message}</p>`;
    }
}

async function loadFiles() {
    const tbody = document.getElementById('files-table');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading...</td></tr>';
    
    try {
        const response = await fetch('/api/admin/files');
        if (!response.ok) {
            throw new Error('Failed to load files');
        }
        const data = await response.json();
        
        tbody.innerHTML = '';
        
        if (data.files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400">No files found</td></tr>';
            return;
        }
        
        data.files.forEach(file => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-800 transition';
            
            const fileName = file.file_url.split('/').pop();
            const fileIcon = file.file_type?.startsWith('image/') ? 'fa-image' : 'fa-file';
            const uploadedDate = new Date(file.timestamp).toLocaleString();
            
            row.innerHTML = `
                <td class="py-3 px-4">
                    <a href="${file.file_url}" target="_blank" class="text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
                        <i class="fas ${fileIcon}"></i>
                        ${fileName}
                    </a>
                </td>
                <td class="py-3 px-4">${file.username}</td>
                <td class="py-3 px-4">${file.room}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 bg-gray-600 text-white rounded text-xs">${file.file_type || 'Unknown'}</span>
                </td>
                <td class="py-3 px-4">${uploadedDate}</td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading files:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-400">Error: ${error.message}</td></tr>`;
    }
}

async function toggleAdmin(username, promote) {
    if (!confirm(`Are you sure you want to ${promote ? 'promote' : 'demote'} ${username}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/toggle-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, promote })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update user role');
        }
        
        showAlert(`Successfully ${promote ? 'promoted' : 'demoted'} ${username}`, 'success');
        loadUsers();
        loadStats();
    } catch (error) {
        console.error('Error toggling admin:', error);
        showAlert(error.message, 'error');
    }
}

async function deleteRoom(roomName) {
    if (!confirm(`Are you sure you want to delete the room "${roomName}"? This will delete all messages in this room.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/rooms/${encodeURIComponent(roomName)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete room');
        }
        
        showAlert(`Successfully deleted room "${roomName}"`, 'success');
        loadRooms();
        loadStats();
    } catch (error) {
        console.error('Error deleting room:', error);
        showAlert(error.message, 'error');
    }
}

async function loadTickets() {
    const container = document.getElementById('tickets-list');
    const status = document.getElementById('ticket-filter').value;
    container.innerHTML = '<p class="text-gray-400 text-center py-4">Loading...</p>';
    
    try {
        const response = await fetch(`/api/support/tickets?status=${status}`);
        if (!response.ok) {
            throw new Error('Failed to load tickets');
        }
        const data = await response.json();
        
        container.innerHTML = '';
        
        if (data.tickets.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center py-4">No tickets found</p>';
            return;
        }
        
        data.tickets.forEach(ticket => {
            const ticketDiv = document.createElement('div');
            ticketDiv.className = 'p-4 bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700';
            
            const priorityColors = {
                low: 'bg-gray-500',
                normal: 'bg-blue-500',
                high: 'bg-orange-500',
                urgent: 'bg-red-500'
            };
            
            const statusColors = {
                open: 'bg-green-500',
                in_progress: 'bg-yellow-500',
                resolved: 'bg-blue-500',
                closed: 'bg-gray-500'
            };
            
            const createdDate = new Date(ticket.created_at).toLocaleString();
            
            ticketDiv.innerHTML = `
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 ${priorityColors[ticket.priority]} text-white rounded text-xs font-semibold">${ticket.priority.toUpperCase()}</span>
                        <span class="px-2 py-1 ${statusColors[ticket.status]} text-white rounded text-xs">${ticket.status.replace('_', ' ').toUpperCase()}</span>
                        <span class="text-xs text-gray-500">ID: ${ticket.id}</span>
                    </div>
                    <span class="text-xs text-gray-500">${createdDate}</span>
                </div>
                <div class="mb-2">
                    <p class="text-white font-semibold mb-1">
                        <i class="fas fa-user text-purple-400"></i> ${ticket.username}
                        ${ticket.email ? `<span class="text-gray-400 text-sm ml-2"><i class="fas fa-envelope"></i> ${ticket.email}</span>` : ''}
                    </p>
                    <p class="text-lg text-white font-semibold">${ticket.subject}</p>
                </div>
                <p class="text-gray-300 mb-3">${ticket.message}</p>
                ${ticket.admin_response ? `
                    <div class="bg-blue-900 bg-opacity-30 p-3 rounded border border-blue-500 mb-3">
                        <p class="text-xs text-blue-300 mb-1"><i class="fas fa-reply"></i> Response from ${ticket.responded_by}</p>
                        <p class="text-white">${ticket.admin_response}</p>
                    </div>
                ` : ''}
                <div class="flex gap-2">
                    ${ticket.status !== 'closed' ? `
                        <select onchange="updateTicketStatus(${ticket.id}, this.value)" class="px-3 py-1 bg-gray-700 border border-gray-600 text-white rounded text-sm">
                            <option value="">Change Status...</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Close</option>
                        </select>
                        <button onclick="respondToTicket(${ticket.id})" class="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded text-sm">
                            <i class="fas fa-reply"></i> Respond
                        </button>
                    ` : '<span class="text-gray-500 italic text-sm">Ticket Closed</span>'}
                </div>
            `;
            
            container.appendChild(ticketDiv);
        });
    } catch (error) {
        console.error('Error loading tickets:', error);
        container.innerHTML = `<p class="text-red-400 text-center py-4">Error: ${error.message}</p>`;
    }
}

async function updateTicketStatus(ticketId, status) {
    if (!status) return;
    
    try {
        const response = await fetch(`/api/support/tickets/${ticketId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update ticket');
        }
        
        showAlert(`Ticket #${ticketId} status updated to ${status}`, 'success');
        loadTickets();
    } catch (error) {
        console.error('Error updating ticket:', error);
        showAlert(error.message, 'error');
    }
}

async function respondToTicket(ticketId) {
    const response = prompt('Enter your response to this ticket:');
    if (!response) return;
    
    try {
        const res = await fetch(`/api/support/tickets/${ticketId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminResponse: response, status: 'in_progress' })
        });
        
        if (!res.ok) {
            throw new Error('Failed to respond to ticket');
        }
        
        showAlert(`Response sent to ticket #${ticketId}`, 'success');
        loadTickets();
    } catch (error) {
        console.error('Error responding to ticket:', error);
        showAlert(error.message, 'error');
    }
}

async function openModView(username) {
    const modal = document.getElementById('modview-modal');
    const content = document.getElementById('modview-content');
    
    modal.classList.remove('hidden');
    content.innerHTML = '<p class="text-center text-gray-400">Loading...</p>';
    
    try {
        const response = await fetch(`/api/admin/user-modview/${username}`);
        if (!response.ok) {
            throw new Error('Failed to load user data');
        }
        const data = await response.json();
        
        const { user, activity, moderation } = data;
        
        content.innerHTML = `
            <div class="mb-6">
                <div class="flex items-center gap-4 mb-4">
                    <img src="${user.avatar_url || 'https://placehold.co/64x64/5b2bff/ffffff?text=' + user.username.substring(0, 2).toUpperCase()}" 
                         class="w-16 h-16 rounded-full object-cover" alt="${user.username}">
                    <div>
                        <h3 class="text-2xl font-bold" style="color: ${user.chat_color || '#fff'}">${user.username}</h3>
                        <p class="text-gray-400">${user.email || 'No email provided'}</p>
                        <span class="px-2 py-1 ${user.role === 'admin' ? 'bg-purple-500' : 'bg-gray-600'} text-white rounded text-xs">${user.role.toUpperCase()}</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div class="p-3 bg-gray-800 rounded">
                        <p class="text-gray-400 text-sm">Bio</p>
                        <p class="text-white">${user.bio || 'No bio'}</p>
                    </div>
                    <div class="p-3 bg-gray-800 rounded">
                        <p class="text-gray-400 text-sm">Status</p>
                        <p class="text-white">${user.status || 'Online'}</p>
                    </div>
                </div>
            </div>

            <div class="mb-6">
                <h3 class="text-xl font-bold text-white mb-3"><i class="fas fa-chart-line text-cyan-400"></i> Activity Stats</h3>
                <div class="grid grid-cols-3 gap-3">
                    <div class="p-4 bg-gray-800 rounded text-center">
                        <i class="fas fa-comments text-3xl text-purple-400 mb-2"></i>
                        <p class="text-2xl font-bold text-white">${activity.messages}</p>
                        <p class="text-sm text-gray-400">Messages</p>
                    </div>
                    <div class="p-4 bg-gray-800 rounded text-center">
                        <i class="fas fa-file text-3xl text-cyan-400 mb-2"></i>
                        <p class="text-2xl font-bold text-white">${activity.files}</p>
                        <p class="text-sm text-gray-400">Files Uploaded</p>
                    </div>
                    <div class="p-4 bg-gray-800 rounded text-center">
                        <i class="fas fa-ticket-alt text-3xl text-orange-400 mb-2"></i>
                        <p class="text-2xl font-bold text-white">${activity.supportTickets}</p>
                        <p class="text-sm text-gray-400">Support Tickets</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 class="text-xl font-bold text-white mb-3"><i class="fas fa-gavel text-yellow-400"></i> Moderation History</h3>
                
                <div class="mb-4">
                    <h4 class="text-sm font-semibold text-yellow-300 mb-2">
                        <i class="fas fa-exclamation-triangle"></i> Warnings (${moderation.warnings.length})
                    </h4>
                    ${moderation.warnings.length > 0 ? `
                        <div class="space-y-2">
                            ${moderation.warnings.slice(0, 5).map(w => `
                                <div class="p-2 bg-yellow-900 bg-opacity-30 rounded border border-yellow-600 text-sm">
                                    <p class="text-white">${w.reason}</p>
                                    <p class="text-xs text-gray-400">By ${w.warned_by} on ${new Date(w.created_at).toLocaleString()}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-gray-500 text-sm italic">No warnings</p>'}
                </div>

                <div class="mb-4">
                    <h4 class="text-sm font-semibold text-blue-300 mb-2">
                        <i class="fas fa-microphone-slash"></i> Mutes (${moderation.mutes.length})
                    </h4>
                    ${moderation.mutes.length > 0 ? `
                        <div class="space-y-2">
                            ${moderation.mutes.slice(0, 5).map(m => `
                                <div class="p-2 bg-blue-900 bg-opacity-30 rounded border border-blue-600 text-sm">
                                    <p class="text-white">${m.reason}</p>
                                    <p class="text-xs text-gray-400">By ${m.muted_by} for ${m.duration_minutes} mins on ${new Date(m.created_at).toLocaleString()}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-gray-500 text-sm italic">No mutes</p>'}
                </div>

                <div>
                    <h4 class="text-sm font-semibold text-red-300 mb-2">
                        <i class="fas fa-ban"></i> Bans (${moderation.bans.length})
                    </h4>
                    ${moderation.bans.length > 0 ? `
                        <div class="space-y-2">
                            ${moderation.bans.slice(0, 5).map(b => `
                                <div class="p-2 bg-red-900 bg-opacity-30 rounded border border-red-600 text-sm">
                                    <p class="text-white">${b.reason}</p>
                                    <p class="text-xs text-gray-400">By ${b.banned_by} on ${new Date(b.created_at).toLocaleString()}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-gray-500 text-sm italic">No bans</p>'}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading mod view:', error);
        content.innerHTML = `<p class="text-red-400 text-center">Error: ${error.message}</p>`;
    }
}

function closeModView() {
    document.getElementById('modview-modal').classList.add('hidden');
}

async function deleteUser(username) {
    if (!confirm(`Are you sure you want to permanently delete the user "${username}"?\n\nThis will delete:\n- Their account and profile\n- All messages and files\n- All moderation history\n- Support tickets\n- API keys\n\nThis action cannot be undone!`)) {
        return;
    }
    
    const confirmText = prompt(`To confirm deletion, please type the username: ${username}`);
    if (confirmText !== username) {
        showAlert('Username confirmation does not match. Deletion cancelled.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete user');
        }
        
        showAlert(`User "${username}" has been permanently deleted`, 'success');
        loadUsers();
        loadStats();
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert(error.message, 'error');
    }
}

async function loadAPIKeys() {
    try {
        const response = await fetch('/api/developer/admin/all-keys');
        const data = await response.json();
        
        const list = document.getElementById('apikeys-list');
        if (data.keys && data.keys.length > 0) {
            list.innerHTML = data.keys.map(key => `
                <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-semibold text-white">${escapeHtml(key.name || key.app_name)}</h4>
                            <p class="text-sm text-gray-400">User: ${escapeHtml(key.username)} | App: ${escapeHtml(key.app_name)}</p>
                            <p class="text-xs text-gray-500 mt-1">
                                Created: ${new Date(key.created_at).toLocaleDateString()} | 
                                Last Used: ${key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                            </p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs ${key.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}">
                            ${key.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="text-gray-400 text-center py-4">No API keys found</p>';
        }
    } catch (error) {
        console.error('Error loading API keys:', error);
        document.getElementById('apikeys-list').innerHTML = '<p class="text-red-400 text-center">Error loading API keys</p>';
    }
}

async function loadAPILogs() {
    try {
        const search = document.getElementById('apilogs-search').value;
        const url = `/api/developer/admin/logs?limit=100${search ? `&username=${encodeURIComponent(search)}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        const table = document.getElementById('apilogs-table');
        if (data.logs && data.logs.length > 0) {
            table.innerHTML = data.logs.map(log => `
                <tr class="border-b border-gray-700">
                    <td class="py-2 px-4 text-sm">${new Date(log.created_at).toLocaleString()}</td>
                    <td class="py-2 px-4">${escapeHtml(log.username)}</td>
                    <td class="py-2 px-4 text-sm">${escapeHtml(log.app_name || 'N/A')}</td>
                    <td class="py-2 px-4 text-xs font-mono">${escapeHtml(log.route)}</td>
                    <td class="py-2 px-4"><span class="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">${log.method}</span></td>
                    <td class="py-2 px-4"><span class="px-2 py-1 ${log.status_code < 400 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} rounded text-xs">${log.status_code}</span></td>
                    <td class="py-2 px-4 text-sm">${log.latency_ms}ms</td>
                </tr>
            `).join('');
        } else {
            table.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-400">No logs found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading API logs:', error);
        document.getElementById('apilogs-table').innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-400">Error loading logs</td></tr>';
    }
}

async function loadServerLogs() {
    try {
        const level = document.getElementById('serverlogs-level').value;
        const category = document.getElementById('serverlogs-category').value;
        const url = `/api/developer/admin/server-logs?limit=100${level ? `&level=${level}` : ''}${category ? `&category=${category}` : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        const list = document.getElementById('serverlogs-list');
        if (data.logs && data.logs.length > 0) {
            list.innerHTML = data.logs.map(log => {
                const levelColors = {
                    error: 'bg-red-500/20 text-red-300 border-red-500',
                    warn: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
                    info: 'bg-blue-500/20 text-blue-300 border-blue-500',
                    debug: 'bg-gray-500/20 text-gray-300 border-gray-500'
                };
                const color = levelColors[log.level] || levelColors.info;
                return `
                    <div class="bg-gray-800/50 rounded p-3 border-l-4 ${color}">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-mono text-xs text-gray-400">${new Date(log.created_at).toLocaleString()}</span>
                            <span class="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">${log.category}</span>
                        </div>
                        <p class="text-white text-sm">${escapeHtml(log.message)}</p>
                        ${Object.keys(log.metadata || {}).length > 0 ? `<pre class="text-xs text-gray-400 mt-2 overflow-x-auto">${JSON.stringify(log.metadata, null, 2)}</pre>` : ''}
                    </div>
                `;
            }).join('');
        } else {
            list.innerHTML = '<p class="text-gray-400 text-center py-4">No logs found</p>';
        }
    } catch (error) {
        console.error('Error loading server logs:', error);
        document.getElementById('serverlogs-list').innerHTML = '<p class="text-red-400 text-center">Error loading logs</p>';
    }
}

async function loadMaintenanceStatus() {
    try {
        const response = await fetch('/api/admin/maintenance');
        const data = await response.json();
        
        const statusText = document.getElementById('maintenance-status-text');
        const toggleBtn = document.getElementById('maintenance-toggle-btn');
        
        if (data.maintenanceMode) {
            statusText.textContent = 'Maintenance mode is currently ENABLED';
            statusText.className = 'text-yellow-300 text-sm font-semibold';
            toggleBtn.innerHTML = '<i class="fas fa-toggle-on mr-2"></i> Disable Maintenance';
            toggleBtn.className = 'px-6 py-3 rounded-lg font-semibold transition bg-yellow-600 hover:bg-yellow-700 text-white';
        } else {
            statusText.textContent = 'Maintenance mode is currently DISABLED';
            statusText.className = 'text-green-300 text-sm font-semibold';
            toggleBtn.innerHTML = '<i class="fas fa-toggle-off mr-2"></i> Enable Maintenance';
            toggleBtn.className = 'px-6 py-3 rounded-lg font-semibold transition bg-green-600 hover:bg-green-700 text-white';
        }
    } catch (error) {
        console.error('Error loading maintenance status:', error);
    }
}

async function toggleMaintenance() {
    try {
        const response = await fetch('/api/admin/maintenance');
        const currentStatus = await response.json();
        
        const newStatus = !currentStatus.maintenanceMode;
        const confirmMsg = newStatus 
            ? 'Are you sure you want to enable maintenance mode? The /health endpoint will return 503 status.'
            : 'Disable maintenance mode?';
        
        if (!confirm(confirmMsg)) return;
        
        const updateResponse = await fetch('/api/admin/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: newStatus })
        });
        
        if (updateResponse.ok) {
            showAlert(`Maintenance mode ${newStatus ? 'enabled' : 'disabled'}`, 'success');
            loadMaintenanceStatus();
        } else {
            throw new Error('Failed to toggle maintenance mode');
        }
    } catch (error) {
        console.error('Error toggling maintenance:', error);
        showAlert('Failed to toggle maintenance mode', 'error');
    }
}

async function loadAnnouncements() {
    try {
        const response = await fetch('/api/admin/announcements');
        if (!response.ok) throw new Error('Failed to load announcements');
        
        const data = await response.json();
        const list = document.getElementById('announcements-list');
        
        if (data.announcements.length === 0) {
            list.innerHTML = '<p class="text-gray-400 text-center py-8">No announcements yet. Create your first announcement!</p>';
            return;
        }
        
        list.innerHTML = data.announcements.map(announcement => `
            <div class="bg-gray-800 bg-opacity-50 rounded-lg p-4 border ${announcement.is_pinned ? 'border-yellow-500' : 'border-gray-700'}">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            ${announcement.is_pinned ? '<i class="fas fa-thumbtack text-yellow-400"></i>' : ''}
                            <h4 class="text-lg font-bold text-white">${escapeHtml(announcement.title)}</h4>
                        </div>
                        <p class="text-gray-300 whitespace-pre-wrap">${escapeHtml(announcement.content)}</p>
                    </div>
                    <div class="flex gap-2 ml-4">
                        <button onclick="togglePinAnnouncement(${announcement.id})" 
                                class="px-3 py-1 ${announcement.is_pinned ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-600 hover:bg-gray-700'} text-white rounded transition text-sm"
                                title="${announcement.is_pinned ? 'Unpin' : 'Pin'}">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <button onclick="deleteAnnouncement(${announcement.id})" 
                                class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition text-sm"
                                title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="text-xs text-gray-500 mt-2">
                    Posted by ${escapeHtml(announcement.posted_by)} on ${new Date(announcement.created_at).toLocaleString()}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading announcements:', error);
        document.getElementById('announcements-list').innerHTML = 
            '<p class="text-red-400 text-center py-4">Failed to load announcements</p>';
    }
}

function showNewAnnouncementForm() {
    document.getElementById('new-announcement-form').classList.remove('hidden');
    document.getElementById('announcement-title').value = '';
    document.getElementById('announcement-content').value = '';
}

function hideNewAnnouncementForm() {
    document.getElementById('new-announcement-form').classList.add('hidden');
}

async function createAnnouncement() {
    const title = document.getElementById('announcement-title').value.trim();
    const content = document.getElementById('announcement-content').value.trim();
    
    if (!title || !content) {
        showAlert('Please fill in both title and content', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        
        if (!response.ok) throw new Error('Failed to create announcement');
        
        showAlert('Announcement posted successfully!', 'success');
        hideNewAnnouncementForm();
        loadAnnouncements();
    } catch (error) {
        console.error('Error creating announcement:', error);
        showAlert('Failed to post announcement', 'error');
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
        const response = await fetch(`/api/admin/announcements/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete announcement');
        
        showAlert('Announcement deleted successfully', 'success');
        loadAnnouncements();
    } catch (error) {
        console.error('Error deleting announcement:', error);
        showAlert('Failed to delete announcement', 'error');
    }
}

async function togglePinAnnouncement(id) {
    try {
        const response = await fetch(`/api/admin/announcements/${id}/pin`, {
            method: 'PATCH'
        });
        
        if (!response.ok) throw new Error('Failed to toggle pin');
        
        const data = await response.json();
        showAlert(`Announcement ${data.announcement.is_pinned ? 'pinned' : 'unpinned'}`, 'success');
        loadAnnouncements();
    } catch (error) {
        console.error('Error toggling pin:', error);
        showAlert('Failed to toggle pin', 'error');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

let activityCharts = {};

async function loadDatabaseStats() {
    try {
        const response = await fetch('/api/admin/database-stats');
        if (!response.ok) throw new Error('Failed to load database stats');
        
        const data = await response.json();
        
        document.getElementById('db-size').textContent = data.databaseSize.database_size;
        document.getElementById('db-tables').textContent = data.tables.length;
        
        const totalRecords = data.rowCounts.reduce((sum, table) => sum + parseInt(table.row_count), 0);
        document.getElementById('db-records').textContent = totalRecords.toLocaleString();
        
        const tablesHtml = data.tables.map(table => {
            const fullTableName = `${table.schemaname}.${table.tablename}`;
            const rowData = data.rowCounts.find(r => r.table_name === fullTableName);
            const rowCount = rowData ? parseInt(rowData.row_count).toLocaleString() : '0';
            return `
                <tr class="border-b border-gray-700 hover:bg-gray-800/30">
                    <td class="py-3 px-4 font-mono text-cyan-400">${escapeHtml(table.tablename)}</td>
                    <td class="py-3 px-4">${rowCount}</td>
                    <td class="py-3 px-4">${table.column_count}</td>
                    <td class="py-3 px-4 text-purple-400">${table.size}</td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('db-tables-list').innerHTML = tablesHtml;
        
        const indexesHtml = data.indexes.map(index => `
            <tr class="border-b border-gray-700 hover:bg-gray-800/30">
                <td class="py-3 px-4 font-mono text-cyan-400">${escapeHtml(index.tablename)}</td>
                <td class="py-3 px-4 text-yellow-400">${escapeHtml(index.indexname)}</td>
                <td class="py-3 px-4 text-purple-400">${index.index_size}</td>
            </tr>
        `).join('');
        
        document.getElementById('db-indexes-list').innerHTML = indexesHtml || '<tr><td colspan="3" class="text-center py-4 text-gray-400">No indexes found</td></tr>';
    } catch (error) {
        console.error('Error loading database stats:', error);
        showAlert('Failed to load database statistics', 'error');
    }
}

async function loadActivityGraphs() {
    try {
        const days = document.getElementById('activity-timeframe').value;
        const [activityResponse, healthResponse] = await Promise.all([
            fetch(`/api/admin/activity-data?days=${days}`),
            fetch(`/api/admin/health-check-data?days=${days}`)
        ]);
        
        if (!activityResponse.ok || !healthResponse.ok) throw new Error('Failed to load activity data');
        
        const data = await activityResponse.json();
        const healthData = await healthResponse.json();
        
        document.getElementById('activity-total-users').textContent = data.totalUsers.toLocaleString();
        
        Object.values(activityCharts).forEach(chart => chart.destroy());
        activityCharts = {};
        
        const chartConfig = {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9ca3af',
                            precision: 0
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        };
        
        function createChart(canvasId, data, label, borderColor, backgroundColor) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            
            const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            const values = data.map(d => parseInt(d.count));
            
            activityCharts[canvasId] = new Chart(ctx, {
                ...chartConfig,
                data: {
                    labels: labels,
                    datasets: [{
                        label: label,
                        data: values,
                        borderColor: borderColor,
                        backgroundColor: backgroundColor,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                }
            });
        }
        
        function createHealthChart(canvasId, healthData) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return;
            
            const labels = healthData.map(h => new Date(h.checked_at).toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            }));
            const values = healthData.map(h => parseInt(h.response_time_ms));
            
            activityCharts[canvasId] = new Chart(ctx, {
                type: 'line',
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.parsed.y + ' ms';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#9ca3af',
                                callback: function(value) {
                                    return value + ' ms';
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#9ca3af',
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        }
                    }
                },
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Response Time',
                        data: values,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                }
            });
        }
        
        createHealthChart('chart-health', healthData.healthChecks);
        createChart('chart-messages', data.messages, 'Messages', '#06b6d4', 'rgba(6, 182, 212, 0.1)');
        createChart('chart-pms', data.privateMessages, 'Private Messages', '#e94eff', 'rgba(233, 78, 255, 0.1)');
        createChart('chart-rooms', data.roomsCreated, 'Rooms Created', '#10b981', 'rgba(16, 185, 129, 0.1)');
        createChart('chart-tickets', data.supportTickets, 'Support Tickets', '#eab308', 'rgba(234, 179, 8, 0.1)');
        createChart('chart-api', data.apiRequests, 'API Requests', '#3b82f6', 'rgba(59, 130, 246, 0.1)');
        
    } catch (error) {
        console.error('Error loading activity graphs:', error);
        showAlert('Failed to load activity data', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadUsers();
    
    setInterval(loadStats, 30000);
});
