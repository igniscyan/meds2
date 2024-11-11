import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let pocketbaseProcess: any = null;

function startPocketBase() {
  const platform = process.platform;
  const pocketbasePath = isDev 
    ? path.join(__dirname, '..', 'pocketbase', platform === 'win32' ? 'pocketbase.exe' : 'pocketbase')
    : path.join(process.resourcesPath, 'pocketbase', platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');

  pocketbaseProcess = spawn(pocketbasePath, ['serve', '--http=127.0.0.1:8090']);

  pocketbaseProcess.stdout.on('data', (data: any) => {
    console.log(`PocketBase: ${data}`);
  });

  pocketbaseProcess.stderr.on('data', (data: any) => {
    console.error(`PocketBase Error: ${data}`);
  });
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
  startPocketBase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
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