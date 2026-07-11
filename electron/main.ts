import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { IPC } from '@shared/ipc-channels';
import { registerJobsHandlers } from './ipc/jobs.js';
import { registerProfileHandlers } from './ipc/profile.js';
import { registerSettingsHandlers } from './ipc/settings.js';
import { registerScanHandlers } from './ipc/scan.js';
import { registerAiHandlers } from './ipc/ai.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    if (process.platform === 'darwin') {
      app.focus({ steal: true });
    }
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (process.env['NODE_ENV'] === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.show();
  }

  ipcMain.handle(IPC.SHELL_OPEN_PATH, (_event, filePath: string) => shell.openPath(filePath));

  registerJobsHandlers();
  registerProfileHandlers();
  registerSettingsHandlers();
  registerScanHandlers();
  registerAiHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
