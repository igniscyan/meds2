import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import express from 'express';
import { AddressInfo } from 'net';
import { WebSocket, WebSocketServer } from 'ws';
import fs from 'fs';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let pocketbaseProcess: ChildProcess | null = null;
const expressApp = express();
const PORT = 3000;

// Keep track of connected clients
const connectedClients = new Set<WebSocket>();

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

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
expressApp.use(express.static(path.join(__dirname, '..', 'dist')));

// Handle all routes for client-side routing
expressApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const server = expressApp.listen(PORT, '0.0.0.0', () => {
  const address = server.address() as AddressInfo;
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
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'pocketbase_data');
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return dataDir;
}

function getPocketBasePath() {
  const platform = process.platform;
  const isWSL = platform === 'linux' && process.env.WSL_DISTRO_NAME;
  
  // Base paths for development and production
  const basePath = isDev 
    ? path.join(__dirname, '..', 'pocketbase')
    : path.join(process.resourcesPath, 'pocketbase');

  // Windows executable path
  const winPath = path.join(basePath, 'pocketbase.exe');
  // Linux executable path
  const linuxPath = path.join(basePath, 'linux', 'pocketbase');

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
    } catch (error) {
      console.error('Error making PocketBase executable:', error);
    }
  }

  console.log('Starting PocketBase from:', pocketbasePath);
  console.log('Data directory:', dataDir);
  console.log('Platform:', process.platform);
  console.log('WSL:', process.env.WSL_DISTRO_NAME || 'No');
  
  // Start PocketBase with the data directory specified
  pocketbaseProcess = spawn(pocketbasePath, [
    'serve',
    '--http=0.0.0.0:8090',
    '--dir', dataDir
  ]);

  function setupProcessHandlers(process: any) {
    process.stdout.on('data', (data: any) => {
      console.log(`PocketBase: ${data}`);
    });

    process.stderr.on('data', (data: any) => {
      console.error(`PocketBase Error: ${data}`);
    });

    process.on('exit', (code: number) => {
      console.log(`PocketBase process exited with code ${code}`);
      pocketbaseProcess = null;
    });
  }

  setupProcessHandlers(pocketbaseProcess);

  pocketbaseProcess.on('error', (error: any) => {
    console.error('Failed to start PocketBase:', error);
    // Try alternative executable if primary fails
    if (process.platform === 'linux' && pocketbasePath.includes('pocketbase.exe')) {
      console.log('Falling back to Linux executable...');
      const linuxPath = path.join(isDev ? path.join(__dirname, '..', 'pocketbase', 'linux', 'pocketbase')
                                      : path.join(process.resourcesPath, 'pocketbase', 'linux', 'pocketbase'));
      if (require('fs').existsSync(linuxPath)) {
        try {
          require('fs').chmodSync(linuxPath, '755');
          pocketbaseProcess = spawn(linuxPath, [
            'serve',
            '--http=0.0.0.0:8090',
            '--dir', dataDir
          ]);
          setupProcessHandlers(pocketbaseProcess);
        } catch (fallbackError) {
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
    ? path.join(__dirname, '..', 'pocketbase', 'migrations')
    : path.join(process.resourcesPath, 'pocketbase', 'migrations');

  if (fs.existsSync(sourceDir)) {
    const targetDir = path.join(userDataDir, 'migrations');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      // Copy migration files
      fs.readdirSync(sourceDir).forEach(file => {
        fs.copyFileSync(
          path.join(sourceDir, file),
          path.join(targetDir, file)
        );
      });
    }
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
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
      ? path.join(__dirname, 'admin.html')
      : path.join(process.resourcesPath, 'app', 'dist-electron', 'admin.html');
    
    console.log('Loading admin interface from:', adminPath);
    
    if (!fs.existsSync(adminPath)) {
      console.error('Admin file not found at:', adminPath);
      throw new Error('Admin file not found');
    }

    await mainWindow.loadFile(adminPath);
    mainWindow.webContents.openDevTools(); // Open DevTools for debugging
  } catch (error) {
    console.error('Error loading admin interface:', error);
  }
}

app.whenReady().then(() => {
  copyInitialMigrations();
  startPocketBase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  
  // Close all WebSocket connections
  for (const client of connectedClients) {
    client.close();
  }
  connectedClients.clear();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (pocketbaseProcess) {
    pocketbaseProcess.kill();
  }
});