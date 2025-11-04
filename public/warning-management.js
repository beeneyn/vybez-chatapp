document.addEventListener('DOMContentLoaded', () => {
    const createWarningBtn = document.getElementById('create-warning-btn');
    const refreshWarningsBtn = document.getElementById('refresh-warnings-btn');
    const warningsTable = document.getElementById('warnings-table');
    const warningMessage = document.getElementById('warning-message');

    const loadWarnings = async () => {
        try {
            const response = await fetch('/api/moderation/warnings');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load warnings');
            }

            warningsTable.innerHTML = '';
            
            if (data.warnings.length === 0) {
                warningsTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No warnings</td></tr>';
                return;
            }

            data.warnings.forEach(warning => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${warning.username}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${warning.warned_by}</td>
                    <td class="px-6 py-4 text-sm">${warning.reason}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${new Date(warning.created_at).toLocaleString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs" onclick="deleteWarning(${warning.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                `;
                warningsTable.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading warnings:', error);
            warningsTable.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        }
    };

    createWarningBtn.addEventListener('click', async () => {
        const username = document.getElementById('warning-username').value.trim();
        const reason = document.getElementById('warning-reason').value.trim();

        if (!username || !reason) {
            showMessage('Username and reason are required', 'error');
            return;
        }

        try {
            const response = await fetch('/api/moderation/warnings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, reason })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Warning created successfully', 'success');
                document.getElementById('warning-username').value = '';
                document.getElementById('warning-reason').value = '';
                loadWarnings();
            } else {
                showMessage(data.message || 'Failed to create warning', 'error');
            }
        } catch (error) {
            console.error('Error creating warning:', error);
            showMessage('Failed to create warning', 'error');
        }
    });

    window.deleteWarning = async (id) => {
        if (!confirm('Delete this warning?')) return;

        try {
            const response = await fetch(`/api/moderation/warnings/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Warning deleted successfully', 'success');
                loadWarnings();
            } else {
                showMessage(data.message || 'Failed to delete warning', 'error');
            }
        } catch (error) {
            console.error('Error deleting warning:', error);
            showMessage('Failed to delete warning', 'error');
        }
    };

    refreshWarningsBtn.addEventListener('click', loadWarnings);

    const showMessage = (message, type) => {
        warningMessage.textContent = message;
        warningMessage.className = `alert ${type === 'success' ? 'alert-success' : 'alert-danger'}`;
        warningMessage.classList.remove('hidden');
        setTimeout(() => warningMessage.classList.add('hidden'), 3000);
    };

    loadWarnings();
});
