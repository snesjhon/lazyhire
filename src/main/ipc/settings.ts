import { ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { IPC } from '@shared/ipc-channels';

const SETTINGS_DIR = join(homedir(), '.lazyhire');
const SETTINGS_PATH = join(SETTINGS_DIR, 'settings.json');
const DEFAULT_SETTINGS = { model: 'claude-sonnet-4-6' };

function readSettings(): { model: string } {
  try {
    if (!existsSync(SETTINGS_PATH)) return { ...DEFAULT_SETTINGS };
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as { model?: string };
    return { model: raw.model || DEFAULT_SETTINGS.model };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings: { model: string }): void {
  mkdirSync(SETTINGS_DIR, { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_READ, () => {
    return readSettings();
  });

  ipcMain.handle(IPC.SETTINGS_SAVE, (_event, settings: { model: string }) => {
    writeSettings(settings);
  });
}
