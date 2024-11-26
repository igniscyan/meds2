import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let pocketbaseProcess: any = null;

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
    } catch (error) {
      console.error('Error loading dev server:', error);
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  copyInitialMigrations();
  startPocketBase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pocketbaseProcess) {
      pocketbaseProcess.kill();
    }
    app.quit();
  }
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