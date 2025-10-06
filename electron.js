const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

const isDev = process.env.NODE_ENV === 'development';
const serverUrl = isDev ? 'http://localhost:5000' : 'https://YOUR_DEPLOYED_URL.replit.app';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        icon: path.join(__dirname, 'public', 'vybez.svg'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        },
        title: 'Vybez Chat',
        backgroundColor: '#f3f4f6',
        show: false
    });

    mainWindow.loadURL(serverUrl);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    if (isDev) {
        menuTemplate[2].submenu.push(
            { type: 'separator' },
            { role: 'toggleDevTools' }
        );
    }

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    setTimeout(createWindow, 400);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
