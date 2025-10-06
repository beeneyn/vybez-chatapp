const isDesktopApp = typeof window.electronAPI !== 'undefined';

let unreadCount = 0;
let lastMessageTimestamp = Date.now();

function updateBadgeCount(count) {
    unreadCount = count;
    if (isDesktopApp) {
        window.electronAPI.setBadgeCount(count);
    }
}

function showDesktopNotification(title, body, tag) {
    if (isDesktopApp) {
        window.electronAPI.sendNotification(title, body, tag || 'vybez-message');
    }
}

function handleNewMessage(data) {
    if (!document.hasFocus() && isDesktopApp) {
        const username = data.username || 'Someone';
        const message = data.message || data.messageText || '';
        const room = data.room || 'Vybez';
        
        showDesktopNotification(
            `${username} in #${room}`,
            message.length > 100 ? message.substring(0, 100) + '...' : message,
            `message-${Date.now()}`
        );
        
        unreadCount++;
        updateBadgeCount(unreadCount);
    }
}

function handleNewPrivateMessage(data) {
    if (!document.hasFocus() && isDesktopApp) {
        const from = data.from || data.fromUser || 'Someone';
        const message = data.message || data.messageText || '';
        
        showDesktopNotification(
            `Private message from ${from}`,
            message.length > 100 ? message.substring(0, 100) + '...' : message,
            `pm-${Date.now()}`
        );
        
        unreadCount++;
        updateBadgeCount(unreadCount);
    }
}

window.addEventListener('focus', () => {
    unreadCount = 0;
    updateBadgeCount(0);
});

if (isDesktopApp) {
    console.log('🖥️ Running in Vybez Desktop App');
    
    window.electronAPI.onThemeChanged((theme) => {
        console.log('🎨 System theme changed to:', theme);
        document.documentElement.setAttribute('data-theme', theme);
    });
    
    window.electronAPI.onAlwaysOnTopChanged((isOnTop) => {
        console.log('📌 Always on top:', isOnTop);
    });
    
    window.electronAPI.onOnlineStatusChanged((isOnline) => {
        console.log('🌐 Online status:', isOnline);
        const existingBanner = document.getElementById('offline-banner');
        
        if (!isOnline && !existingBanner) {
            const banner = document.createElement('div');
            banner.id = 'offline-banner';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
                padding: 12px;
                text-align: center;
                font-weight: bold;
                z-index: 99999;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            `;
            banner.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                You are offline. Trying to reconnect...
            `;
            document.body.insertBefore(banner, document.body.firstChild);
        } else if (isOnline && existingBanner) {
            existingBanner.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            existingBanner.innerHTML = `
                <i class="fas fa-check-circle"></i>
                Back online!
            `;
            setTimeout(() => {
                existingBanner.remove();
            }, 2000);
        }
    });
    
    window.electronAPI.onUpdateAvailable((info) => {
        console.log('🔄 Update available:', info.version);
        const updateBanner = document.createElement('div');
        updateBanner.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            z-index: 99999;
            max-width: 350px;
        `;
        updateBanner.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">
                <i class="fas fa-sparkles"></i> Update Available!
            </div>
            <div style="font-size: 14px; margin-bottom: 12px;">
                Version ${info.version} is ready to download
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
            ">Dismiss</button>
        `;
        document.body.appendChild(updateBanner);
    });
    
    window.electronAPI.onUpdateDownloaded((info) => {
        console.log('✅ Update downloaded:', info.version);
        const updateBanner = document.createElement('div');
        updateBanner.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            z-index: 99999;
            max-width: 350px;
        `;
        updateBanner.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">
                <i class="fas fa-check-circle"></i> Update Ready!
            </div>
            <div style="font-size: 14px; margin-bottom: 12px;">
                Restart to install version ${info.version}
            </div>
            <button onclick="window.electronAPI.installUpdate()" style="
                background: white;
                border: none;
                color: #059669;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
                margin-right: 8px;
            ">Restart Now</button>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
            ">Later</button>
        `;
        document.body.appendChild(updateBanner);
    });
    
    window.desktopAPI = {
        showNotification: showDesktopNotification,
        updateBadgeCount: updateBadgeCount,
        handleNewMessage: handleNewMessage,
        handleNewPrivateMessage: handleNewPrivateMessage,
        isDesktop: true
    };
} else {
    console.log('🌐 Running in Web Browser');
    
    window.desktopAPI = {
        showNotification: () => {},
        updateBadgeCount: () => {},
        handleNewMessage: () => {},
        handleNewPrivateMessage: () => {},
        isDesktop: false
    };
}
