document.addEventListener('DOMContentLoaded', () => {
    const muteDurationSelect = document.getElementById('mute-duration');
    const customDurationContainer = document.getElementById('custom-duration-container');
    const createMuteBtn = document.getElementById('create-mute-btn');
    const refreshMutesBtn = document.getElementById('refresh-mutes-btn');
    const mutesTable = document.getElementById('mutes-table');
    const muteMessage = document.getElementById('mute-message');

    muteDurationSelect.addEventListener('change', () => {
        if (muteDurationSelect.value === 'custom') {
            customDurationContainer.classList.remove('hidden');
        } else {
            customDurationContainer.classList.add('hidden');
        }
    });

    const loadMutes = async () => {
        try {
            const response = await fetch('/api/moderation/mutes?active=true');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load mutes');
            }

            mutesTable.innerHTML = '';
            
            if (data.mutes.length === 0) {
                mutesTable.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No active mutes</td></tr>';
                return;
            }

            data.mutes.forEach(mute => {
                const row = document.createElement('tr');
                const minutesRemaining = Math.max(0, Math.floor((new Date(mute.expires_at) - Date.now()) / 60000));
                const emailDisplay = mute.user_email || '<span class="text-gray-400 italic">No email</span>';
                
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${mute.username}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${emailDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${mute.muted_by}</td>
                    <td class="px-6 py-4 text-sm">${mute.reason}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${mute.duration_minutes} min${mute.duration_minutes !== 1 ? 's' : ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${new Date(mute.expires_at).toLocaleString()}
                        <br><span class="text-xs text-gray-500">(${minutesRemaining} min${minutesRemaining !== 1 ? 's' : ''} left)</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${new Date(mute.created_at).toLocaleString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs" onclick="removeMute(${mute.id})">
                            <i class="fas fa-times"></i> Remove
                        </button>
                    </td>
                `;
                mutesTable.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading mutes:', error);
            mutesTable.innerHTML = `<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        }
    };

    createMuteBtn.addEventListener('click', async () => {
        const username = document.getElementById('mute-username').value.trim();
        const reason = document.getElementById('mute-reason').value.trim();
        let durationMinutes;

        if (muteDurationSelect.value === 'custom') {
            durationMinutes = parseInt(document.getElementById('mute-custom-duration').value);
        } else {
            durationMinutes = parseInt(muteDurationSelect.value);
        }

        if (!username || !reason || !durationMinutes) {
            showMessage('Username, reason, and duration are required', 'error');
            return;
        }

        try {
            const response = await fetch('/api/moderation/mutes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, reason, durationMinutes })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Mute created successfully', 'success');
                document.getElementById('mute-username').value = '';
                document.getElementById('mute-reason').value = '';
                loadMutes();
            } else {
                showMessage(data.message || 'Failed to create mute', 'error');
            }
        } catch (error) {
            console.error('Error creating mute:', error);
            showMessage('Failed to create mute', 'error');
        }
    });

    window.removeMute = async (id) => {
        if (!confirm('Remove this mute?')) return;

        try {
            const response = await fetch(`/api/moderation/mutes/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Mute removed successfully', 'success');
                loadMutes();
            } else {
                showMessage(data.message || 'Failed to remove mute', 'error');
            }
        } catch (error) {
            console.error('Error removing mute:', error);
            showMessage('Failed to remove mute', 'error');
        }
    };

    refreshMutesBtn.addEventListener('click', loadMutes);

    const showMessage = (message, type) => {
        muteMessage.textContent = message;
        muteMessage.className = `alert ${type === 'success' ? 'alert-success' : 'alert-danger'}`;
        muteMessage.classList.remove('hidden');
        setTimeout(() => muteMessage.classList.add('hidden'), 3000);
    };

    loadMutes();
});
