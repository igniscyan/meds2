"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const isDev = !electron_1.app.isPackaged;
let mainWindow = null;
let pocketbaseProcess = null;
function startPocketBase() {
    const platform = process.platform;
    const pocketbasePath = isDev
        ? path_1.default.join(__dirname, '..', 'pocketbase', platform === 'win32' ? 'pocketbase.exe' : 'pocketbase')
        : path_1.default.join(process.resourcesPath, 'pocketbase', platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
    pocketbaseProcess = (0, child_process_1.spawn)(pocketbasePath, ['serve', '--http=127.0.0.1:8090']);
    pocketbaseProcess.stdout.on('data', (data) => {
        console.log(`PocketBase: ${data}`);
    });
    pocketbaseProcess.stderr.on('data', (data) => {
        console.error(`PocketBase Error: ${data}`);
    });
}
async function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    if (isDev) {
        try {
            await mainWindow.loadURL('http://localhost:5173');
            mainWindow.webContents.openDevTools();
            mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                console.error('Failed to load:', errorDescription);
                setTimeout(() => {
                    if (mainWindow) {
                        mainWindow.loadURL('http://localhost:5173');
                    }
                }, 1000);
            });
        }
        catch (error) {
            console.error('Error loading dev server:', error);
        }
    }
    else {
        await mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    startPocketBase();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.app.on('before-quit', () => {
    if (pocketbaseProcess) {
        pocketbaseProcess.kill();
    }
});
