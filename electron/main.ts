import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
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
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
    },
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
