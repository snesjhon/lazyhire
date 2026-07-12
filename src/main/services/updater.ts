import { app } from 'electron';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

export function initAutoUpdater(): void {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    console.error('Auto-update check failed', error);
  });
}
