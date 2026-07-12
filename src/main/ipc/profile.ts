import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels';
import { hasProfile, loadProfile, saveProfile } from '../services/profile.js';
import type { Profile } from '@shared/types';

export function registerProfileHandlers(): void {
  ipcMain.handle(IPC.PROFILE_READ, () => {
    return loadProfile();
  });

  ipcMain.handle(IPC.PROFILE_SAVE, (_event, profile: Profile) => {
    saveProfile(profile);
  });

  ipcMain.handle(IPC.PROFILE_HAS, () => {
    return hasProfile();
  });
}
