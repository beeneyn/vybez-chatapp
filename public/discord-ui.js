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
    function renderServerList() {
        const serverList = document.getElementById('server-list');
        if (!serverList) return;

        // For now, just render the default server icon
        serverList.innerHTML = `
            <div class="server-icon active" data-server-id="default" title="Vybez Community">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 via-magenta-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg hover:rounded-2xl transition-all duration-200 cursor-pointer">
                    V
                </div>
            </div>
        `;

        // Server icon click handler
        serverList.querySelectorAll('.server-icon').forEach(icon => {
            icon.addEventListener('click', function() {
                const serverId = this.dataset.serverId;
                switchServer(serverId);
            });
        });
    }

    // Switch to a different server
    function switchServer(serverId) {
        currentServerId = serverId;
        
        // Update active state
        document.querySelectorAll('.server-icon').forEach(icon => {
            icon.classList.toggle('active', icon.dataset.serverId === serverId);
        });

        loadServerData();
    }

    // Load server data and render channels
    async function loadServerData() {
        try {
            const response = await fetch('/rooms');
            if (!response.ok) throw new Error('Failed to load channels');
            
            const data = await response.json();
            channels = data.rooms || [];
            
            renderChannels();
        } catch (error) {
            console.error('Failed to load server data:', error);
        }
    }

    // Render channels in the sidebar
    function renderChannels() {
        const container = document.getElementById('channels-container');
        if (!container) return;

        // Group channels by category (for now, all in "TEXT CHANNELS")
        container.innerHTML = `
            <div class="channel-category mb-2">
                <div class="flex items-center justify-between px-2 py-1 text-gray-400 hover:text-gray-200 cursor-pointer text-xs font-semibold uppercase">
                    <span><i class="fas fa-chevron-down mr-1"></i> Text Channels</span>
                </div>
                <div class="channel-list">
                    ${channels.map(channel => `
                        <div class="channel-item flex items-center justify-between px-2 py-1.5 mx-1 rounded text-gray-300 hover:bg-midnight-lighter hover:text-white cursor-pointer group ${channel.name === getCurrentRoom() ? 'bg-midnight-lighter text-white' : ''}" data-channel="${channel.name}">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-hashtag text-xs"></i>
                                <span class="text-sm">${channel.name.replace('#', '')}</span>
                            </div>
                            ${!channel.is_default ? `
                                <div class="channel-actions opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button class="delete-channel-btn text-red-400 hover:text-red-300 text-xs" data-channel="${channel.name}" title="Delete Channel">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Channel click handlers
        container.querySelectorAll('.channel-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.delete-channel-btn')) return;
                
                const channelName = this.dataset.channel;
                if (channelName !== getCurrentRoom()) {
                    getSocket().emit('switchRoom', channelName);
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
        if (!rolesList) return;

        rolesList.innerHTML = '<p class="text-gray-500 text-center py-4">Role management coming soon!</p>';
    }

    // Load Server Members
    async function loadServerMembers() {
        const membersList = document.getElementById('server-members-list');
        if (!membersList) return;

        membersList.innerHTML = '<p class="text-gray-500 text-center py-4">Member management coming soon!</p>';
    }

    // Load Server Channels
    async function loadServerChannels() {
        const channelsList = document.getElementById('server-channels-list');
        if (!channelsList) return;

        channelsList.innerHTML = channels.map(channel => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div class="flex items-center gap-2">
                    <i class="fas fa-hashtag text-gray-500"></i>
                    <span class="font-medium">${channel.name}</span>
                </div>
                <span class="text-xs text-gray-500">${channel.type || 'text'}</span>
            </div>
        `).join('');
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
