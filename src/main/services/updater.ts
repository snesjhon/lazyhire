import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

export function initAutoUpdater(): void {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    console.error('Auto-update check failed', error);
  });
}
