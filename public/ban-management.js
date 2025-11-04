document.addEventListener('DOMContentLoaded', () => {
    const banTypeSelect = document.getElementById('ban-type');
    const durationContainer = document.getElementById('duration-container');
    const createBanBtn = document.getElementById('create-ban-btn');
    const refreshBansBtn = document.getElementById('refresh-bans-btn');
    const bansTable = document.getElementById('bans-table');
    const banMessage = document.getElementById('ban-message');

    banTypeSelect.addEventListener('change', () => {
        if (banTypeSelect.value === 'permanent' || banTypeSelect.value === 'termination') {
            durationContainer.classList.add('hidden');
        } else {
            durationContainer.classList.remove('hidden');
        }
    });

    const loadBans = async () => {
        try {
            const response = await fetch('/api/moderation/bans?active=true');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load bans');
            }

            bansTable.innerHTML = '';
            
            if (data.bans.length === 0) {
                bansTable.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No active bans</td></tr>';
                return;
            }

            data.bans.forEach(ban => {
                const isTermination = ban.reason && ban.reason.toLowerCase().includes('[termination]');
                const displayReason = ban.reason.replace('[TERMINATION]', '').replace('[termination]', '').trim();
                const emailDisplay = ban.user_email || '<span class="text-gray-400 italic">No email</span>';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${ban.username}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${emailDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${ban.banned_by}</td>
                    <td class="px-6 py-4 text-sm">${displayReason}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${isTermination ? '<span class="px-2 py-1 bg-black text-white text-xs rounded">Terminated</span>' : ban.is_permanent ? '<span class="px-2 py-1 bg-red-500 text-white text-xs rounded">Permanent</span>' : '<span class="px-2 py-1 bg-orange-500 text-white text-xs rounded">Temporary</span>'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${ban.is_permanent ? 'N/A' : new Date(ban.expires_at).toLocaleString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${new Date(ban.created_at).toLocaleString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs" onclick="removeBan(${ban.id})">
                            <i class="fas fa-times"></i> Remove
                        </button>
                    </td>
                `;
                bansTable.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading bans:', error);
            bansTable.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        }
    };

    createBanBtn.addEventListener('click', async () => {
        const username = document.getElementById('ban-username').value.trim();
        let reason = document.getElementById('ban-reason').value.trim();
        const banType = banTypeSelect.value;
        const isTermination = banType === 'termination';
        const isPermanent = banType === 'permanent' || isTermination;
        const durationDays = isPermanent ? null : parseInt(document.getElementById('ban-duration').value);

        if (!username || !reason) {
            showMessage('Username and reason are required', 'error');
            return;
        }

        if (isTermination) {
            reason = `[TERMINATION] ${reason}`;
        }

        try {
            const response = await fetch('/api/moderation/bans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, reason, isPermanent, durationDays })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Ban created successfully', 'success');
                document.getElementById('ban-username').value = '';
                document.getElementById('ban-reason').value = '';
                loadBans();
            } else {
                showMessage(data.message || 'Failed to create ban', 'error');
            }
        } catch (error) {
            console.error('Error creating ban:', error);
            showMessage('Failed to create ban', 'error');
        }
    });

    window.removeBan = async (id) => {
        if (!confirm('Remove this ban?')) return;

        try {
            const response = await fetch(`/api/moderation/bans/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Ban removed successfully', 'success');
                loadBans();
            } else {
                showMessage(data.message || 'Failed to remove ban', 'error');
            }
        } catch (error) {
            console.error('Error removing ban:', error);
            showMessage('Failed to remove ban', 'error');
        }
    };

    refreshBansBtn.addEventListener('click', loadBans);

    const showMessage = (message, type) => {
        banMessage.textContent = message;
        banMessage.className = `alert ${type === 'success' ? 'alert-success' : 'alert-danger'}`;
        banMessage.classList.remove('hidden');
        setTimeout(() => banMessage.classList.add('hidden'), 3000);
    };

    loadBans();
});
