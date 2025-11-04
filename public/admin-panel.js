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

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadUsers();
    
    setInterval(loadStats, 30000);
});
