const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendNotification: (title, body, tag) => {
        ipcRenderer.send('show-notification', { title, body, tag });
    },
    
    setBadgeCount: (count) => {
        ipcRenderer.send('set-badge-count', count);
    },
    
    openFilePicker: () => {
        return ipcRenderer.invoke('open-file-picker');
    },
    
    toggleAlwaysOnTop: () => {
        ipcRenderer.send('toggle-always-on-top');
    },
    
    onAlwaysOnTopChanged: (callback) => {
        ipcRenderer.on('always-on-top-changed', (event, isOnTop) => callback(isOnTop));
    },
    
    onThemeChanged: (callback) => {
        ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
    },
    
    onOnlineStatusChanged: (callback) => {
        ipcRenderer.on('online-status-changed', (event, isOnline) => callback(isOnline));
    },

    getAutoLaunchStatus: () => {
        return ipcRenderer.invoke('get-auto-launch-status');
    },

    setAutoLaunch: (enabled) => {
        return ipcRenderer.invoke('set-auto-launch', enabled);
    },

    checkForUpdates: () => {
        ipcRenderer.send('check-for-updates');
    },

    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', (event, info) => callback(info));
    },

    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update-downloaded', (event, info) => callback(info));
    },

    installUpdate: () => {
        ipcRenderer.send('install-update');
    }
});
