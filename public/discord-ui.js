// Discord-Style UI Handler for Vybez Phase 2
// Manages server switcher, channels sidebar, and server settings

(function() {
    'use strict';

    // Check if client bridge is available
    if (!window.vybezClientBridge) {
        console.error('Discord UI: Client bridge not available, skipping initialization');
        return;
    }

    // Get bridge helpers
    const { getSocket, getCurrentRoom, setCurrentRoom, openModal, closeModal } = window.vybezClientBridge;

    // Server State
    let currentServerId = null;
    let currentServerData = null;
    let channels = [];
    let roles = [];

    // Initialize when DOM is ready
    function initDiscordUI() {
        renderServerList();
        setupEventListeners();
        loadServerData();
        
        // Listen for room changes from client.js
        window.addEventListener('vybez:room-changed', (e) => {
            renderChannels(); // Re-render to update active state
        });
    }

    // Render Server List (left sidebar)
    async function renderServerList() {
        const serverList = document.getElementById('server-list');
        if (!serverList) return;

        try {
            // Fetch user's servers
            const response = await fetch('/servers');
            const servers = response.ok ? await response.json() : [];
            
            serverList.innerHTML = `
                ${servers.map(server => {
                    const serverId = String(server.id);
                    return `
                    <div class="server-icon ${serverId === currentServerId ? 'active' : ''}" data-server-id="${serverId}" title="${server.name}">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 via-magenta-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg hover:rounded-2xl transition-all duration-200 cursor-pointer">
                            ${server.name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    `;
                }).join('')}
                <div class="add-server-btn mt-2">
                    <div class="w-12 h-12 rounded-full bg-midnight-lighter hover:bg-violet-600 flex items-center justify-center text-green-400 hover:text-white font-bold text-2xl shadow-lg hover:rounded-2xl transition-all duration-200 cursor-pointer" title="Add a Server">
                        <i class="fas fa-plus"></i>
                    </div>
                </div>
            `;

            // Server icon click handlers
            serverList.querySelectorAll('.server-icon').forEach(icon => {
                icon.addEventListener('click', function() {
                    const serverId = String(this.dataset.serverId);
                    switchServer(serverId);
                });
            });

            // Add server button handler
            const addServerBtn = serverList.querySelector('.add-server-btn');
            if (addServerBtn) {
                addServerBtn.addEventListener('click', () => {
                    openModal('createServerModal');
                });
            }
            
            // Set default server if none selected
            if (!currentServerId && servers.length > 0) {
                currentServerId = String(servers[0].id);
                loadServerData();
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
        }
    }

    // Switch to a different server
    function switchServer(serverId) {
        currentServerId = String(serverId);
        
        // Update active state
        document.querySelectorAll('.server-icon').forEach(icon => {
            icon.classList.toggle('active', String(icon.dataset.serverId) === currentServerId);
        });

        // Clear current room to force re-join when loading new server
        if (typeof setCurrentRoom === 'function') {
            setCurrentRoom('');
        }

        loadServerData();
    }

    // Load server data and render channels
    async function loadServerData() {
        try {
            if (!currentServerId) {
                channels = [];
                renderChannels();
                return;
            }
            
            const response = await fetch(`/servers/${currentServerId}/channels`);
            if (response.ok) {
                const data = await response.json();
                channels = data.map(ch => {
                    const channelName = ch.name.startsWith('#') ? ch.name.substring(1) : ch.name;
                    return {
                        id: ch.id,
                        name: channelName,
                        server_id: ch.server_id,
                        type: ch.type,
                        description: ch.description,
                        is_default: ch.name === 'general' || channelName === 'general'
                    };
                });
                
                // Auto-join first channel if available
                if (channels.length > 0 && (!getCurrentRoom() || getCurrentRoom() === '')) {
                    getSocket().emit('switchRoom', '#' + channels[0].name);
                }
            } else {
                // Fallback for backward compatibility
                const fallbackResponse = await fetch('/rooms');
                if (fallbackResponse.ok) {
                    const data = await fallbackResponse.json();
                    channels = data.rooms || [];
                } else {
                    channels = [];
                }
            }
            
            renderChannels();
        } catch (error) {
            console.error('Failed to load server data:', error);
            channels = [];
            renderChannels();
        }
    }

    // Render channels in the sidebar
    function renderChannels() {
        const container = document.getElementById('channels-container');
        if (!container) return;

        // Group channels by category (for now, all in "TEXT CHANNELS")
        const currentRoom = getCurrentRoom();
        const currentRoomClean = currentRoom ? currentRoom.replace('#', '') : '';
        
        container.innerHTML = `
            <div class="channel-category mb-2">
                <div class="flex items-center justify-between px-2 py-1 text-gray-400 hover:text-gray-200 cursor-pointer text-xs font-semibold uppercase">
                    <span><i class="fas fa-chevron-down mr-1"></i> Text Channels</span>
                </div>
                <div class="channel-list">
                    ${channels.map(channel => {
                        const isActive = channel.name === currentRoomClean;
                        return `
                        <div class="channel-item flex items-center justify-between px-2 py-1.5 mx-1 rounded text-gray-300 hover:bg-midnight-lighter hover:text-white cursor-pointer group ${isActive ? 'bg-midnight-lighter text-white' : ''}" data-channel="${channel.name}">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-hashtag text-xs"></i>
                                <span class="text-sm">${channel.name}</span>
                            </div>
                            ${!channel.is_default ? `
                                <div class="channel-actions opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button class="delete-channel-btn text-red-400 hover:text-red-300 text-xs" data-channel="${channel.name}" title="Delete Channel">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Channel click handlers
        container.querySelectorAll('.channel-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.delete-channel-btn')) return;
                
                const channelName = this.dataset.channel;
                const currentRoomClean = getCurrentRoom() ? getCurrentRoom().replace('#', '') : '';
                if (channelName !== currentRoomClean) {
                    getSocket().emit('switchRoom', '#' + channelName);
                }
            });
        });

        // Delete channel handlers
        container.querySelectorAll('.delete-channel-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const channelName = this.dataset.channel;
                
                if (!confirm(`Are you sure you want to delete ${channelName}?`)) return;

                try {
                    const response = await fetch(`/rooms/${encodeURIComponent(channelName)}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        loadServerData(); // Reload channels
                        if (getCurrentRoom() === channelName) {
                            getSocket().emit('switchRoom', '#general');
                        }
                    } else {
                        const error = await response.json();
                        alert(error.message || 'Failed to delete channel');
                    }
                } catch (error) {
                    console.error('Error deleting channel:', error);
                    alert('Failed to delete channel');
                }
            });
        });
    }

    // Setup Event Listeners
    function setupEventListeners() {
        // Create Server Button
        const createServerBtn = document.getElementById('create-server-btn');
        if (createServerBtn) {
            createServerBtn.addEventListener('click', () => {
                alert('Server creation feature coming soon! For now, you can create channels in the Vybez Community server.');
            });
        }

        // Server Settings Button
        const serverSettingsBtn = document.getElementById('server-settings-btn');
        if (serverSettingsBtn) {
            serverSettingsBtn.addEventListener('click', () => {
                openModal('serverSettingsModal');
                loadServerSettings();
            });
        }

        // Create Channel Button
        const createChannelBtn = document.getElementById('create-channel-btn');
        if (createChannelBtn) {
            createChannelBtn.addEventListener('click', () => {
                openModal('createChannelModal');
            });
        }

        // Close modals
        document.querySelectorAll('.close-server-settings-modal').forEach(btn => {
            btn.addEventListener('click', () => closeModal('serverSettingsModal'));
        });

        document.querySelectorAll('.close-create-channel-modal').forEach(btn => {
            btn.addEventListener('click', () => closeModal('createChannelModal'));
        });

        document.querySelectorAll('.close-create-server-modal').forEach(btn => {
            btn.addEventListener('click', () => closeModal('createServerModal'));
        });

        document.querySelectorAll('.close-edit-role-modal').forEach(btn => {
            btn.addEventListener('click', () => closeModal('editRoleModal'));
        });

        document.querySelectorAll('.close-manage-roles-modal').forEach(btn => {
            btn.addEventListener('click', () => closeModal('manageMemberRolesModal'));
        });

        // Settings tabs
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tab = this.dataset.tab;
                switchSettingsTab(tab);
            });
        });

        // Create Channel Confirm
        const createChannelConfirmBtn = document.getElementById('create-channel-confirm-btn');
        if (createChannelConfirmBtn) {
            createChannelConfirmBtn.addEventListener('click', handleCreateChannel);
        }

        // Create Server Confirm
        const createServerConfirmBtn = document.getElementById('create-server-confirm-btn');
        if (createServerConfirmBtn) {
            createServerConfirmBtn.addEventListener('click', handleCreateServer);
        }

        // Create Invite Button
        const createInviteBtn = document.getElementById('create-invite-btn');
        if (createInviteBtn) {
            createInviteBtn.addEventListener('click', handleCreateInvite);
        }

        // Save Role Button
        const saveRoleBtn = document.getElementById('save-role-btn');
        if (saveRoleBtn) {
            saveRoleBtn.addEventListener('click', handleSaveRole);
        }
    }

    // Switch Settings Tab
    function switchSettingsTab(tabName) {
        // Update button states
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
            if (btn.dataset.tab === tabName) {
                btn.classList.add('bg-violet-100', 'text-violet-700');
            } else {
                btn.classList.remove('bg-violet-100', 'text-violet-700');
            }
        });

        // Show/hide content
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.toggle('hidden', !content.id.includes(tabName));
        });

        // Load tab-specific data
        if (tabName === 'roles') loadRoles();
        if (tabName === 'members') loadServerMembers();
        if (tabName === 'channels') loadServerChannels();
        if (tabName === 'invites') loadServerInvites();
    }

    // Load Server Settings
    async function loadServerSettings() {
        // Load server info (for now, use default)
        const serverNameInput = document.getElementById('server-name-input');
        const serverDescInput = document.getElementById('server-description-input');
        
        if (serverNameInput) serverNameInput.value = 'Vybez Community';
        if (serverDescInput) serverDescInput.value = 'Welcome to Vybez Community!';
    }

    // Load Roles
    async function loadRoles() {
        const rolesList = document.getElementById('roles-list');
        if (!rolesList || !currentServerId) return;

        try {
            const response = await fetch(`/servers/${currentServerId}/roles`);
            if (!response.ok) throw new Error('Failed to load roles');
            
            roles = await response.json();
            
            rolesList.innerHTML = roles.map(role => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded border mb-2" data-role-id="${role.id}">
                    <div class="flex items-center gap-3">
                        <div class="w-4 h-4 rounded" style="background-color: ${role.color}"></div>
                        <span class="font-medium">${role.name}</span>
                        <span class="text-xs text-gray-500">${JSON.parse(role.permission_list).length} permissions</span>
                    </div>
                    ${role.name !== 'everyone' ? `
                        <div class="flex gap-2">
                            <button class="edit-role-btn px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded" data-role-id="${role.id}">
                                Edit
                            </button>
                            <button class="delete-role-btn px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded" data-role-id="${role.id}">
                                Delete
                            </button>
                        </div>
                    ` : '<span class="text-xs text-gray-400">Default role</span>'}
                </div>
            `).join('');
            
            // Attach event listeners
            rolesList.querySelectorAll('.delete-role-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const roleId = this.dataset.roleId;
                    if (confirm('Are you sure you want to delete this role?')) {
                        await deleteRole(roleId);
                    }
                });
            });
            
            rolesList.querySelectorAll('.edit-role-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const roleId = this.dataset.roleId;
                    openEditRoleModal(roleId);
                });
            });
        } catch (error) {
            console.error('Error loading roles:', error);
            rolesList.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load roles</p>';
        }
    }

    async function deleteRole(roleId) {
        try {
            const response = await fetch(`/roles/${roleId}`, { method: 'DELETE' });
            if (response.ok) {
                await loadRoles();
            } else {
                alert('Failed to delete role');
            }
        } catch (error) {
            console.error('Error deleting role:', error);
        }
    }

    function openEditRoleModal(roleId) {
        const role = roles.find(r => r.id === parseInt(roleId));
        if (!role) return;
        
        // Set role data in modal
        document.getElementById('role-name-input').value = role.name;
        document.getElementById('role-color-input').value = role.color;
        document.getElementById('edit-role-id').value = role.id;
        
        // Set permissions
        const permissions = JSON.parse(role.permission_list);
        document.querySelectorAll('.role-permission-checkbox').forEach(checkbox => {
            checkbox.checked = permissions.includes(checkbox.dataset.permission);
        });
        
        openModal('editRoleModal');
    }

    async function handleSaveRole() {
        const roleId = document.getElementById('edit-role-id').value;
        const roleName = document.getElementById('role-name-input').value.trim();
        const roleColor = document.getElementById('role-color-input').value;
        
        if (!roleName) {
            alert('Please enter a role name');
            return;
        }
        
        // Get selected permissions
        const selectedPermissions = [];
        document.querySelectorAll('.role-permission-checkbox:checked').forEach(checkbox => {
            selectedPermissions.push(checkbox.dataset.permission);
        });
        
        try {
            // Update role name and color
            const updateResponse = await fetch(`/roles/${roleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: roleName, color: roleColor })
            });
            
            if (!updateResponse.ok) {
                throw new Error('Failed to update role');
            }
            
            // Update permissions
            const permResponse = await fetch(`/roles/${roleId}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: selectedPermissions })
            });
            
            if (!permResponse.ok) {
                throw new Error('Failed to update permissions');
            }
            
            closeModal('editRoleModal');
            await loadRoles();
        } catch (error) {
            console.error('Error saving role:', error);
            alert('Failed to save role changes');
        }
    }

    // Load Server Members
    async function loadServerMembers() {
        const membersList = document.getElementById('server-members-list');
        if (!membersList || !currentServerId) return;

        try {
            const response = await fetch(`/servers/${currentServerId}/members`);
            if (!response.ok) throw new Error('Failed to load members');
            
            const members = await response.json();
            
            membersList.innerHTML = members.map(member => {
                const memberRoles = JSON.parse(member.roles || '[]');
                return `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded border mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                            ${member.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-medium">${member.username}</div>
                            <div class="text-xs text-gray-500">${memberRoles.length > 0 ? memberRoles.map(r => r.name).join(', ') : 'No roles'}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="manage-roles-btn px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded" data-username="${member.username}">
                            Roles
                        </button>
                        <button class="kick-member-btn px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded" data-username="${member.username}">
                            Kick
                        </button>
                    </div>
                </div>
                `;
            }).join('');
            
            // Attach kick handlers
            membersList.querySelectorAll('.kick-member-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const username = this.dataset.username;
                    if (confirm(`Are you sure you want to kick ${username}?`)) {
                        await kickMember(username);
                    }
                });
            });
            
            // Attach manage roles handlers
            membersList.querySelectorAll('.manage-roles-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const username = this.dataset.username;
                    await openManageMemberRolesModal(username);
                });
            });
        } catch (error) {
            console.error('Error loading members:', error);
            membersList.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load members</p>';
        }
    }

    async function openManageMemberRolesModal(username) {
        document.getElementById('manage-member-username').textContent = username;
        document.getElementById('manage-member-username-hidden').value = username;
        
        const memberRolesList = document.getElementById('member-roles-list');
        if (!memberRolesList || !currentServerId) return;
        
        try {
            // Get all server roles
            const rolesResponse = await fetch(`/servers/${currentServerId}/roles`);
            if (!rolesResponse.ok) throw new Error('Failed to load roles');
            const allRoles = await rolesResponse.json();
            
            // Get member's current roles
            const membersResponse = await fetch(`/servers/${currentServerId}/members`);
            if (!membersResponse.ok) throw new Error('Failed to load members');
            const members = await membersResponse.json();
            const member = members.find(m => m.username === username);
            const memberRoles = member ? JSON.parse(member.roles || '[]') : [];
            const memberRoleIds = memberRoles.map(r => r.id);
            
            // Render roles with checkboxes
            memberRolesList.innerHTML = allRoles.filter(r => r.name !== 'everyone').map(role => {
                const hasRole = memberRoleIds.includes(role.id);
                return `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded border">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded" style="background-color: ${role.color}"></div>
                        <span class="text-sm font-medium">${role.name}</span>
                    </div>
                    <button class="toggle-member-role-btn px-2 py-1 text-xs ${hasRole ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded" 
                            data-role-id="${role.id}" 
                            data-has-role="${hasRole}">
                        ${hasRole ? 'Remove' : 'Add'}
                    </button>
                </div>
                `;
            }).join('');
            
            // Attach toggle handlers
            memberRolesList.querySelectorAll('.toggle-member-role-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const roleId = this.dataset.roleId;
                    const hasRole = this.dataset.hasRole === 'true';
                    await toggleMemberRole(username, roleId, hasRole);
                });
            });
            
            openModal('manageMemberRolesModal');
        } catch (error) {
            console.error('Error loading member roles:', error);
            alert('Failed to load roles');
        }
    }

    async function toggleMemberRole(username, roleId, hasRole) {
        try {
            const method = hasRole ? 'DELETE' : 'POST';
            const response = await fetch(`/members/${username}/roles/${roleId}`, { method });
            
            if (response.ok) {
                await openManageMemberRolesModal(username);
                await loadServerMembers();
            } else {
                alert(`Failed to ${hasRole ? 'remove' : 'assign'} role`);
            }
        } catch (error) {
            console.error('Error toggling member role:', error);
        }
    }

    async function kickMember(username) {
        try {
            const response = await fetch(`/servers/${currentServerId}/members/${username}`, { method: 'DELETE' });
            if (response.ok) {
                await loadServerMembers();
            } else {
                alert('Failed to kick member');
            }
        } catch (error) {
            console.error('Error kicking member:', error);
        }
    }

    // Load Server Channels
    async function loadServerChannels() {
        const channelsList = document.getElementById('server-channels-list');
        if (!channelsList) return;

        channelsList.innerHTML = channels.map(channel => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded border mb-2">
                <div class="flex items-center gap-2">
                    <i class="fas fa-hashtag text-gray-500"></i>
                    <span class="font-medium">${channel.name}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">${channel.type || 'text'}</span>
                    ${!channel.is_default ? `
                        <button class="delete-channel-settings-btn px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded" data-channel-id="${channel.id}" data-channel-name="${channel.name}">
                            Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // Attach delete handlers
        channelsList.querySelectorAll('.delete-channel-settings-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const channelName = this.dataset.channelName;
                if (confirm(`Are you sure you want to delete #${channelName}?`)) {
                    await deleteChannelFromSettings(channelName);
                }
            });
        });
    }

    async function deleteChannelFromSettings(channelName) {
        try {
            const response = await fetch(`/rooms/${encodeURIComponent(channelName)}`, { method: 'DELETE' });
            if (response.ok) {
                await loadServerData();
                await loadServerChannels();
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to delete channel');
            }
        } catch (error) {
            console.error('Error deleting channel:', error);
            alert('Failed to delete channel');
        }
    }

    // Load Server Invites
    async function loadServerInvites() {
        const invitesList = document.getElementById('server-invites-list');
        if (!invitesList || !currentServerId) return;

        try {
            const response = await fetch(`/servers/${currentServerId}/invites`);
            if (!response.ok) throw new Error('Failed to load invites');
            
            const invites = await response.json();
            
            if (invites.length === 0) {
                invitesList.innerHTML = '<p class="text-gray-500 text-center py-4">No active invites. Create one to invite others!</p>';
                return;
            }
            
            invitesList.innerHTML = invites.map(invite => {
                const expiresText = invite.expires_at 
                    ? new Date(invite.expires_at).toLocaleDateString() 
                    : 'Never';
                const usesText = invite.max_uses 
                    ? `${invite.uses}/${invite.max_uses}` 
                    : `${invite.uses} (Unlimited)`;
                
                return `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded border mb-2">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <code class="px-2 py-1 bg-gray-200 rounded text-sm font-mono">${invite.code}</code>
                            <button class="copy-invite-btn text-xs text-violet-600 hover:text-violet-700" data-code="${invite.code}">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                        <div class="text-xs text-gray-500">
                            Uses: ${usesText} • Expires: ${expiresText} • Created by ${invite.created_by}
                        </div>
                    </div>
                    <button class="delete-invite-btn px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded" data-invite-id="${invite.id}">
                        Delete
                    </button>
                </div>
                `;
            }).join('');
            
            // Attach copy handlers
            invitesList.querySelectorAll('.copy-invite-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const code = this.dataset.code;
                    const inviteUrl = `${window.location.origin}/invite/${code}`;
                    navigator.clipboard.writeText(inviteUrl).then(() => {
                        this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                        setTimeout(() => {
                            this.innerHTML = '<i class="fas fa-copy"></i> Copy';
                        }, 2000);
                    });
                });
            });
            
            // Attach delete handlers
            invitesList.querySelectorAll('.delete-invite-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const inviteId = this.dataset.inviteId;
                    if (confirm('Are you sure you want to delete this invite?')) {
                        await deleteInvite(inviteId);
                    }
                });
            });
        } catch (error) {
            console.error('Error loading invites:', error);
            invitesList.innerHTML = '<p class="text-red-500 text-center py-4">Failed to load invites</p>';
        }
    }

    async function deleteInvite(inviteId) {
        try {
            const response = await fetch(`/invites/${inviteId}`, { method: 'DELETE' });
            if (response.ok) {
                await loadServerInvites();
            } else {
                alert('Failed to delete invite');
            }
        } catch (error) {
            console.error('Error deleting invite:', error);
        }
    }

    async function handleCreateInvite() {
        if (!currentServerId) return;
        
        const expiresIn = prompt('Expires in hours (leave empty for never):');
        const maxUses = prompt('Maximum uses (leave empty for unlimited):');
        
        try {
            const response = await fetch(`/servers/${currentServerId}/invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    expiresInHours: expiresIn ? parseInt(expiresIn) : null,
                    maxUses: maxUses ? parseInt(maxUses) : null
                })
            });
            
            if (response.ok) {
                const invite = await response.json();
                alert(`Invite created! Code: ${invite.code}`);
                await loadServerInvites();
            } else {
                alert('Failed to create invite');
            }
        } catch (error) {
            console.error('Error creating invite:', error);
            alert('Failed to create invite');
        }
    }

    // Handle Create Channel
    async function handleCreateChannel() {
        const nameInput = document.getElementById('channel-name-input');
        const typeSelect = document.getElementById('channel-type-select');
        const topicInput = document.getElementById('channel-topic-input');
        const messageDiv = document.getElementById('create-channel-message');

        const name = nameInput.value.trim();
        const type = typeSelect.value;
        const topic = topicInput.value.trim();

        if (!name) {
            messageDiv.textContent = 'Please enter a channel name';
            messageDiv.className = 'text-sm mb-3 mt-4 text-red-500';
            messageDiv.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                messageDiv.textContent = 'Channel created successfully!';
                messageDiv.className = 'text-sm mb-3 mt-4 text-green-500';
                messageDiv.classList.remove('hidden');
                
                setTimeout(() => {
                    closeModal('createChannelModal');
                    nameInput.value = '';
                    topicInput.value = '';
                    messageDiv.classList.add('hidden');
                    loadServerData();
                }, 1000);
            } else {
                const error = await response.json();
                messageDiv.textContent = error.message || 'Failed to create channel';
                messageDiv.className = 'text-sm mb-3 mt-4 text-red-500';
                messageDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error creating channel:', error);
            messageDiv.textContent = 'An error occurred';
            messageDiv.className = 'text-sm mb-3 mt-4 text-red-500';
            messageDiv.classList.remove('hidden');
        }
    }

    // Handle Create Server
    async function handleCreateServer() {
        const nameInput = document.getElementById('server-name-input-create');
        const descInput = document.getElementById('server-description-input-create');
        const messageDiv = document.getElementById('create-server-message');

        const name = nameInput.value.trim();
        const description = descInput.value.trim();

        if (!name) {
            messageDiv.textContent = 'Please enter a server name';
            messageDiv.className = 'text-sm mb-3 mt-4 text-red-500';
            messageDiv.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (response.ok) {
                const server = await response.json();
                messageDiv.textContent = 'Server created successfully!';
                messageDiv.className = 'text-sm mb-3 mt-4 text-green-500';
                messageDiv.classList.remove('hidden');
                
                setTimeout(async () => {
                    closeModal('createServerModal');
                    nameInput.value = '';
                    descInput.value = '';
                    messageDiv.classList.add('hidden');
                    
                    // Set current server BEFORE rendering list
                    currentServerId = String(server.id);
                    await renderServerList();
                    switchServer(currentServerId);
                }, 1000);
            } else {
                const error = await response.json();
                messageDiv.textContent = error.message || 'Failed to create server';
                messageDiv.className = 'text-sm mb-3 mt-4 text-red-500';
                messageDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error creating server:', error);
            messageDiv.textContent = 'An error occurred';
            messageDiv.className = 'text-sm mb-3 mt-4 text-red-500';
            messageDiv.classList.remove('hidden');
        }
    }

    // Listen for socket events to update UI
    const socket = getSocket();
    if (socket) {
        socket.on('roomCreated', () => {
            loadServerData();
        });

        socket.on('roomDeleted', () => {
            loadServerData();
        });

        socket.on('roomList', () => {
            loadServerData();
        });
    }

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDiscordUI);
    } else {
        initDiscordUI();
    }

    // Expose to window for debugging
    window.discordUI = {
        loadServerData,
        renderChannels,
        switchServer
    };
})();
