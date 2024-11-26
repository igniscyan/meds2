"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const fs_1 = __importDefault(require("fs"));
const isDev = !electron_1.app.isPackaged;
let mainWindow = null;
let pocketbaseProcess = null;
const expressApp = (0, express_1.default)();
const PORT = 3000;
// Keep track of connected clients
const connectedClients = new Set();
// Create WebSocket server
const wss = new ws_1.WebSocketServer({ noServer: true });
wss.on('connection', (ws) => {
    connectedClients.add(ws);
    broadcastConnectedUsers();
    ws.on('close', () => {
        connectedClients.delete(ws);
        broadcastConnectedUsers();
    });
});
function broadcastConnectedUsers() {
    const message = JSON.stringify({
        connectedUsers: connectedClients.size
    });
    for (const client of connectedClients) {
        client.send(message);
    }
}
// Serve static files from the dist directory
expressApp.use(express_1.default.static(path_1.default.join(__dirname, '..', 'dist')));
// Handle all routes for client-side routing
expressApp.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'dist', 'index.html'));
});
const server = expressApp.listen(PORT, '0.0.0.0', () => {
    const address = server.address();
    console.log(`Server running at http://localhost:${address.port}`);
});
// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
function getDataDirectory() {
    // Get the appropriate data directory based on the platform
    const userDataPath = electron_1.app.getPath('userData');
    const dataDir = path_1.default.join(userDataPath, 'pocketbase_data');
    // Create the directory if it doesn't exist
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
}
function getPocketBasePath() {
    const platform = process.platform;
    const isWSL = platform === 'linux' && process.env.WSL_DISTRO_NAME;
    // Base paths for development and production
    const basePath = isDev
        ? path_1.default.join(__dirname, '..', 'pocketbase')
        : path_1.default.join(process.resourcesPath, 'pocketbase');
    // Windows executable path
    const winPath = path_1.default.join(basePath, 'pocketbase.exe');
    // Linux executable path
    const linuxPath = path_1.default.join(basePath, 'linux', 'pocketbase');
    // If running in WSL but the Windows executable exists, prefer that
    if (isWSL && require('fs').existsSync(winPath)) {
        return winPath;
    }
    // Otherwise use platform-specific path
    return platform === 'win32' ? winPath : linuxPath;
}
function startPocketBase() {
    const pocketbasePath = getPocketBasePath();
    const dataDir = getDataDirectory();
    // Make the Linux binary executable if on Linux/WSL
    if (process.platform !== 'win32') {
        try {
            require('fs').chmodSync(pocketbasePath, '755');
        }
        catch (error) {
            console.error('Error making PocketBase executable:', error);
        }
    }
    console.log('Starting PocketBase from:', pocketbasePath);
    console.log('Data directory:', dataDir);
    console.log('Platform:', process.platform);
    console.log('WSL:', process.env.WSL_DISTRO_NAME || 'No');
    // Start PocketBase with the data directory specified
    pocketbaseProcess = (0, child_process_1.spawn)(pocketbasePath, [
        'serve',
        '--http=0.0.0.0:8090',
        '--dir', dataDir
    ]);
    function setupProcessHandlers(process) {
        process.stdout.on('data', (data) => {
            console.log(`PocketBase: ${data}`);
        });
        process.stderr.on('data', (data) => {
            console.error(`PocketBase Error: ${data}`);
        });
        process.on('exit', (code) => {
            console.log(`PocketBase process exited with code ${code}`);
            pocketbaseProcess = null;
        });
    }
    setupProcessHandlers(pocketbaseProcess);
    pocketbaseProcess.on('error', (error) => {
        console.error('Failed to start PocketBase:', error);
        // Try alternative executable if primary fails
        if (process.platform === 'linux' && pocketbasePath.includes('pocketbase.exe')) {
            console.log('Falling back to Linux executable...');
            const linuxPath = path_1.default.join(isDev ? path_1.default.join(__dirname, '..', 'pocketbase', 'linux', 'pocketbase')
                : path_1.default.join(process.resourcesPath, 'pocketbase', 'linux', 'pocketbase'));
            if (require('fs').existsSync(linuxPath)) {
                try {
                    require('fs').chmodSync(linuxPath, '755');
                    pocketbaseProcess = (0, child_process_1.spawn)(linuxPath, [
                        'serve',
                        '--http=0.0.0.0:8090',
                        '--dir', dataDir
                    ]);
                    setupProcessHandlers(pocketbaseProcess);
                }
                catch (fallbackError) {
                    console.error('Fallback attempt failed:', fallbackError);
                }
            }
        }
    });
}
// Copy initial migration files if they exist
function copyInitialMigrations() {
    const userDataDir = getDataDirectory();
    const sourceDir = isDev
        ? path_1.default.join(__dirname, '..', 'pocketbase', 'migrations')
        : path_1.default.join(process.resourcesPath, 'pocketbase', 'migrations');
    if (fs_1.default.existsSync(sourceDir)) {
        const targetDir = path_1.default.join(userDataDir, 'migrations');
        if (!fs_1.default.existsSync(targetDir)) {
            fs_1.default.mkdirSync(targetDir, { recursive: true });
            // Copy migration files
            fs_1.default.readdirSync(sourceDir).forEach(file => {
                fs_1.default.copyFileSync(path_1.default.join(sourceDir, file), path_1.default.join(targetDir, file));
            });
        }
    }
}
async function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false // Allow loading local resources
        }
    });
    // Load the admin interface
    try {
        const adminPath = isDev
            ? path_1.default.join(__dirname, 'admin.html')
            : path_1.default.join(process.resourcesPath, 'app', 'dist-electron', 'admin.html');
        console.log('Loading admin interface from:', adminPath);
        if (!fs_1.default.existsSync(adminPath)) {
            console.error('Admin file not found at:', adminPath);
            throw new Error('Admin file not found');
        }
        await mainWindow.loadFile(adminPath);
        mainWindow.webContents.openDevTools(); // Open DevTools for debugging
    }
    catch (error) {
        console.error('Error loading admin interface:', error);
    }
}
electron_1.app.whenReady().then(() => {
    copyInitialMigrations();
    startPocketBase();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
    // Close all WebSocket connections
    for (const client of connectedClients) {
        client.close();
    }
    connectedClients.clear();
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
