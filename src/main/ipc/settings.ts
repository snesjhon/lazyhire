import { BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { IPC } from '@shared/ipc-channels';
import { DATA_DIR } from '../services/paths.js';

const SETTINGS_DIR = join(homedir(), '.lazyhire');
const SETTINGS_PATH = join(SETTINGS_DIR, 'settings.json');
const DEFAULT_OUTPUT_DIR = join(DATA_DIR, 'output');

interface Settings {
  model: string;
  outputDir: string | null;
}

const DEFAULT_SETTINGS: Settings = { model: 'claude-sonnet-4-6', outputDir: null };

function readSettings(): Settings {
  try {
    if (!existsSync(SETTINGS_PATH)) return { ...DEFAULT_SETTINGS };
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(partial: Partial<Settings>): Settings {
  const merged = { ...readSettings(), ...partial };
  mkdirSync(SETTINGS_DIR, { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

/** Resolves the effective document output directory, creating it if needed. */
export function getOutputDir(): string {
  const dir = readSettings().outputDir || DEFAULT_OUTPUT_DIR;
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_READ, () => {
    getOutputDir(); // ensure the effective output dir exists so it can be opened/browsed
    return { ...readSettings(), defaultOutputDir: DEFAULT_OUTPUT_DIR };
  });

  ipcMain.handle(IPC.SETTINGS_SAVE, (_event, settings: Partial<Settings>) => {
    return writeSettings(settings);
  });

  ipcMain.handle(IPC.SETTINGS_CHOOSE_OUTPUT_DIR, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getOutputDir(),
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return { ...writeSettings({ outputDir: result.filePaths[0] }), defaultOutputDir: DEFAULT_OUTPUT_DIR };
  });
}
