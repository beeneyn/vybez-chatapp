document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    try {
        const response = await fetch('/check-session');
        if (response.ok) {
            const data = await response.json();
            if (data.loggedIn) {
                document.getElementById('username-display').textContent = data.user.username;
                loadApiKeys();
            } else {
                window.location.href = '/';
            }
        } else {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Session check failed:', error);
        window.location.href = '/';
    }
});

async function loadApiKeys() {
    try {
        const response = await fetch('/api/developer/keys');
        if (response.ok) {
            const data = await response.json();
            renderApiKeys(data.keys);
        } else {
            document.getElementById('api-keys-list').innerHTML = '<p class="text-center text-red-600 py-8">Failed to load API keys.</p>';
        }
    } catch (error) {
        console.error('Failed to load API keys:', error);
        document.getElementById('api-keys-list').innerHTML = '<p class="text-center text-red-600 py-8">Error loading API keys.</p>';
    }
}

function renderApiKeys(keys) {
    const container = document.getElementById('api-keys-list');
    
    if (keys.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-key text-gray-300 text-6xl mb-4"></i>
                <p class="text-gray-500 text-lg mb-2">No API keys yet</p>
                <p class="text-gray-400 text-sm">Create your first API key to get started with the Vybez API</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    keys.forEach(key => {
        const card = document.createElement('div');
        card.className = 'api-key-card bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-violet-300';
        
        const lastUsed = key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never';
        const created = new Date(key.created_at).toLocaleDateString();
        
        // Create elements using DOM APIs to prevent XSS
        const flexContainer = document.createElement('div');
        flexContainer.className = 'flex items-start justify-between mb-3';
        
        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex-1';
        
        // Header with app name and status badge
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex items-center gap-2 mb-1';
        const appNameH3 = document.createElement('h3');
        appNameH3.className = 'font-bold text-gray-800';
        appNameH3.textContent = key.app_name;
        
        // Create status badge using DOM APIs
        const statusBadge = document.createElement('span');
        statusBadge.className = key.is_active 
            ? 'px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded'
            : 'px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded';
        statusBadge.textContent = key.is_active ? 'Active' : 'Inactive';
        
        headerDiv.appendChild(appNameH3);
        headerDiv.appendChild(statusBadge);
        
        // Description
        const descP = document.createElement('p');
        descP.className = 'text-sm text-gray-600 mb-2';
        descP.textContent = key.description || 'No description provided';
        
        // Metadata grid
        const metaGrid = document.createElement('div');
        metaGrid.className = 'grid grid-cols-2 gap-4 text-xs text-gray-500';
        metaGrid.innerHTML = `
            <div>
                <i class="fas fa-calendar-alt mr-1"></i>
                Created: ${created}
            </div>
            <div>
                <i class="fas fa-clock mr-1"></i>
                Last used: ${lastUsed}
            </div>
            <div>
                <i class="fas fa-tachometer-alt mr-1"></i>
                Rate limit: ${key.rate_limit} req/min
            </div>
        `;
        
        leftDiv.appendChild(headerDiv);
        leftDiv.appendChild(descP);
        leftDiv.appendChild(metaGrid);
        
        // Action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex gap-2 ml-4';
        
        if (key.is_active) {
            const deactivateBtn = document.createElement('button');
            deactivateBtn.className = 'px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded transition';
            deactivateBtn.title = 'Deactivate';
            deactivateBtn.innerHTML = '<i class="fas fa-pause"></i>';
            deactivateBtn.onclick = () => deactivateKey(key.id);
            actionsDiv.appendChild(deactivateBtn);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.onclick = () => deleteKey(key.id, key.app_name);
        actionsDiv.appendChild(deleteBtn);
        
        flexContainer.appendChild(leftDiv);
        flexContainer.appendChild(actionsDiv);
        card.appendChild(flexContainer);
        
        container.appendChild(card);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openCreateKeyModal() {
    document.getElementById('createKeyModal').classList.remove('hidden');
    document.getElementById('app-name-input').value = '';
    document.getElementById('app-description-input').value = '';
    document.getElementById('create-key-error').classList.add('hidden');
}

function closeCreateKeyModal() {
    document.getElementById('createKeyModal').classList.add('hidden');
}

async function createApiKey() {
    const appName = document.getElementById('app-name-input').value.trim();
    const description = document.getElementById('app-description-input').value.trim();
    const errorDiv = document.getElementById('create-key-error');
    
    if (!appName) {
        errorDiv.textContent = 'Application name is required';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    try {
        const response = await fetch('/api/developer/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName, description })
        });
        
        if (response.ok) {
            const data = await response.json();
            closeCreateKeyModal();
            showKeyRevealModal(data.apiKey);
            loadApiKeys();
        } else {
            const data = await response.json();
            errorDiv.textContent = data.message || 'Failed to create API key';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to create API key:', error);
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

function showKeyRevealModal(apiKey) {
    document.getElementById('revealed-api-key').textContent = apiKey;
    document.getElementById('keyRevealModal').classList.remove('hidden');
}

function closeKeyRevealModal() {
    document.getElementById('keyRevealModal').classList.add('hidden');
}

function copyApiKey() {
    const apiKey = document.getElementById('revealed-api-key').textContent;
    navigator.clipboard.writeText(apiKey).then(() => {
        // Visual feedback
        const button = event.target.closest('button');
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('bg-green-500');
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('bg-green-500');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}

async function deactivateKey(keyId) {
    if (!confirm('Are you sure you want to deactivate this API key? It will stop working immediately.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/developer/keys/${keyId}/deactivate`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadApiKeys();
        } else {
            const data = await response.json();
            alert(data.message || 'Failed to deactivate API key');
        }
    } catch (error) {
        console.error('Failed to deactivate API key:', error);
        alert('An error occurred');
    }
}

async function deleteKey(keyId, appName) {
    if (!confirm(`Are you sure you want to permanently delete the API key for "${appName}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/developer/keys/${keyId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadApiKeys();
        } else {
            const data = await response.json();
            alert(data.message || 'Failed to delete API key');
        }
    } catch (error) {
        console.error('Failed to delete API key:', error);
        alert('An error occurred');
    }
}
