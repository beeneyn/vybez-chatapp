if (typeof window.electronAPI !== 'undefined' && window.electronAPI.isStoreApp) {
    console.log('🏪 Running from Microsoft Store - hiding external download links');
    
    document.addEventListener('DOMContentLoaded', () => {
        const downloadLinks = document.querySelectorAll('a[href*="downloads.html"], a[href*="/downloads"]');
        downloadLinks.forEach(link => {
            link.style.display = 'none';
        });
        
        const navDownloadItems = document.querySelectorAll('nav a[href*="downloads"], li a[href*="downloads"]');
        navDownloadItems.forEach(item => {
            const parent = item.closest('li');
            if (parent) {
                parent.style.display = 'none';
            } else {
                item.style.display = 'none';
            }
        });
        
        const downloadButtons = document.querySelectorAll('button[onclick*="downloads"], a[id*="download"]');
        downloadButtons.forEach(btn => {
            btn.style.display = 'none';
        });
    });
    
    const style = document.createElement('style');
    style.textContent = `
        .store-app-hide,
        a[href*="downloads.html"],
        a[href*="/downloads"],
        #os-download-btn {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}
