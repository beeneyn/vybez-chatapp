const {
    app,
    BrowserWindow,
    Menu,
    Tray,
    nativeImage,
    ipcMain,
    globalShortcut,
    nativeTheme,
    dialog,
    Notification,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const AutoLaunch = require("auto-launch");
const Store = require("electron-store");
const path = require("path");

let mainWindow;
let tray;
let isQuitting = false;

const isDev = process.env.NODE_ENV === "development";
const baseUrl = isDev ? "http://localhost:5000" : "https://www.vybez.page";
const serverUrl = `${baseUrl}/desktop-login`;

const store = new Store({
    defaults: {
        alwaysOnTop: false,
        autoLaunch: false,
        windowBounds: { x: undefined, y: undefined, width: 1400, height: 900 },
    },
});

const vybezAutoLauncher = new AutoLaunch({
    name: "Vybez Chat",
    path: app.getPath("exe"),
});

function createTray() {
    const iconPath = path.join(__dirname, "build", "icon.png");
    const trayIcon = nativeImage
        .createFromPath(iconPath)
        .resize({ width: 16, height: 16 });

    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Show Vybez",
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
                }
            },
        },
        {
            label: "Always on Top",
            type: "checkbox",
            checked: store.get("alwaysOnTop"),
            click: (menuItem) => {
                toggleAlwaysOnTop();
            },
        },
        { type: "separator" },
        {
            label: "Auto-launch on Startup",
            type: "checkbox",
            checked: store.get("autoLaunch"),
            click: async (menuItem) => {
                const enabled = menuItem.checked;
                store.set("autoLaunch", enabled);
                try {
                    if (enabled) {
                        await vybezAutoLauncher.enable();
                    } else {
                        await vybezAutoLauncher.disable();
                    }
                } catch (err) {
                    console.error("Auto-launch error:", err);
                }
            },
        },
        { type: "separator" },
        {
            label: "Check for Updates",
            click: () => {
                if (!isDev) {
                    autoUpdater.checkForUpdates();
                }
            },
        },
        { type: "separator" },
        {
            label: "Quit",
            click: () => {
                isQuitting = true;
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip("Vybez Chat");

    tray.on("click", () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

function toggleAlwaysOnTop() {
    if (!mainWindow) return;

    const currentState = store.get("alwaysOnTop");
    const newState = !currentState;

    store.set("alwaysOnTop", newState);
    mainWindow.setAlwaysOnTop(newState);

    if (mainWindow.webContents) {
        mainWindow.webContents.send("always-on-top-changed", newState);
    }

    if (tray) {
        const contextMenu = tray.getContextMenu();
        if (contextMenu) {
            const alwaysOnTopItem = contextMenu.items.find(
                (item) => item.label === "Always on Top",
            );
            if (alwaysOnTopItem) {
                alwaysOnTopItem.checked = newState;
            }
        }
    }
}

function createWindow() {
    const savedBounds = store.get("windowBounds");

    const windowOptions = {
        width: savedBounds.width,
        height: savedBounds.height,
        minWidth: 1000,
        minHeight: 700,
        icon: path.join(__dirname, "build", "icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, "preload.js"),
        },
        title: "Vybez Chat",
        backgroundColor: "#1a1a2e",
        show: false,
        frame: false,
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 10, y: 10 },
    };

    if (savedBounds.x !== undefined && savedBounds.y !== undefined) {
        windowOptions.x = savedBounds.x;
        windowOptions.y = savedBounds.y;
    }

    mainWindow = new BrowserWindow(windowOptions);

    const alwaysOnTop = store.get("alwaysOnTop");
    mainWindow.setAlwaysOnTop(alwaysOnTop);

    mainWindow.loadURL(serverUrl);

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();

        if (mainWindow.webContents) {
            mainWindow.webContents.send(
                "theme-changed",
                nativeTheme.shouldUseDarkColors ? "dark" : "light",
            );
        }
    });

    const menuTemplate = [
        {
            label: "File",
            submenu: [
                {
                    label: "Always on Top",
                    type: "checkbox",
                    checked: alwaysOnTop,
                    accelerator: "CmdOrCtrl+T",
                    click: () => toggleAlwaysOnTop(),
                },
                { type: "separator" },
                {
                    label: "Quit",
                    accelerator: "CmdOrCtrl+Q",
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    },
                },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "selectAll" },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
            ],
        },
        {
            label: "Window",
            submenu: [
                { role: "minimize" },
                { role: "zoom" },
                { type: "separator" },
                {
                    label: "Hide to Tray",
                    accelerator: "CmdOrCtrl+H",
                    click: () => {
                        if (mainWindow) mainWindow.hide();
                    },
                },
            ],
        },
    ];

    if (isDev) {
        menuTemplate[2].submenu.push(
            { type: "separator" },
            { role: "toggleDevTools" },
        );
    }

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    mainWindow.on("close", (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();

            if (process.platform === "darwin") {
                app.dock.hide();
            }

            return false;
        }
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    const saveBounds = () => {
        if (
            mainWindow &&
            !mainWindow.isMaximized() &&
            !mainWindow.isMinimized()
        ) {
            const bounds = mainWindow.getBounds();
            store.set("windowBounds", {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
            });
        }
    };

    mainWindow.on("resize", saveBounds);
    mainWindow.on("move", saveBounds);

    mainWindow.webContents.on("did-fail-load", () => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("online-status-changed", false);
        }
    });

    mainWindow.webContents.on("did-finish-load", () => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("online-status-changed", true);
        }
    });

    mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
        const allowedPaths = ["/desktop-login", "/chat", "/demo-chat"];
        const url = new URL(navigationUrl);
        
        if (!allowedPaths.includes(url.pathname)) {
            event.preventDefault();
            console.log(`Blocked navigation to: ${navigationUrl}`);
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const allowedPaths = ["/desktop-login", "/chat", "/demo-chat"];
        const urlObj = new URL(url);
        
        if (!allowedPaths.includes(urlObj.pathname)) {
            console.log(`Blocked window.open to: ${url}`);
            return { action: "deny" };
        }
        return { action: "allow" };
    });
}

function setupAutoUpdater() {
    if (isDev) return;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("update-available", info);
        }
        autoUpdater.downloadUpdate();
    });

    autoUpdater.on("update-downloaded", (info) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("update-downloaded", info);
        }
    });

    autoUpdater.on("error", (err) => {
        console.error("Update error:", err);
    });

    setTimeout(() => {
        autoUpdater.checkForUpdates();
    }, 5000);

    setInterval(
        () => {
            autoUpdater.checkForUpdates();
        },
        1000 * 60 * 60,
    );
}

function setupGlobalShortcuts() {
    globalShortcut.register("CommandOrControl+Shift+V", () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

async function setupAutoLaunch() {
    const shouldAutoLaunch = store.get("autoLaunch");
    if (shouldAutoLaunch) {
        try {
            const isEnabled = await vybezAutoLauncher.isEnabled();
            if (!isEnabled) {
                await vybezAutoLauncher.enable();
            }
        } catch (err) {
            console.error("Auto-launch setup error:", err);
        }
    }
}

ipcMain.on("show-notification", (event, { title, body, tag }) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title: title,
            body: body,
            icon: path.join(__dirname, "build", "icon.png"),
            tag: tag,
            silent: false,
        });

        notification.on("click", () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });

        notification.show();
    }
});

ipcMain.on("set-badge-count", (event, count) => {
    if (process.platform === "darwin" || process.platform === "linux") {
        app.setBadgeCount(count);
    }

    if (process.platform === "win32" && mainWindow) {
        if (count > 0) {
            const iconPath = path.join(__dirname, "build", "icon.png");
            const overlayIcon = nativeImage.createFromPath(iconPath);
            mainWindow.setOverlayIcon(overlayIcon, `${count} unread messages`);
        } else {
            mainWindow.setOverlayIcon(null, "");
        }
    }
});

ipcMain.handle("open-file-picker", async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [
            { name: "Images", extensions: ["jpg", "jpeg", "png", "gif"] },
            { name: "Documents", extensions: ["pdf", "doc", "docx", "txt"] },
            { name: "Videos", extensions: ["mp4", "webm"] },
            { name: "All Files", extensions: ["*"] },
        ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }

    return null;
});

ipcMain.on("toggle-always-on-top", () => {
    toggleAlwaysOnTop();
});

ipcMain.handle("get-auto-launch-status", async () => {
    return store.get("autoLaunch");
});

ipcMain.handle("set-auto-launch", async (event, enabled) => {
    store.set("autoLaunch", enabled);
    try {
        if (enabled) {
            await vybezAutoLauncher.enable();
        } else {
            await vybezAutoLauncher.disable();
        }
        return true;
    } catch (err) {
        console.error("Auto-launch error:", err);
        return false;
    }
});

ipcMain.on("check-for-updates", () => {
    if (!isDev) {
        autoUpdater.checkForUpdates();
    }
});

ipcMain.on("install-update", () => {
    if (!isDev) {
        autoUpdater.quitAndInstall();
    }
});

nativeTheme.on("updated", () => {
    if (mainWindow && mainWindow.webContents) {
        const theme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
        mainWindow.webContents.send("theme-changed", theme);
    }
});

// Window control IPC handlers for custom title bar
ipcMain.on("window-minimize", () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on("window-maximize", () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on("window-close", () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

ipcMain.handle("is-maximized", () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

app.on("ready", () => {
    setTimeout(() => {
        createWindow();
        createTray();
        setupGlobalShortcuts();
        setupAutoUpdater();
        setupAutoLaunch();
    }, 400);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
        if (process.platform === "darwin") {
            app.dock.show();
        }
    }
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

app.on("before-quit", () => {
    isQuitting = true;
});
