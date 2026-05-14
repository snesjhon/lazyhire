import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { DATA_DIR } from '../lib/paths.js';

const DISMISSED_PATH = join(DATA_DIR, 'dismissed.json');

function readDismissed(): string[] {
  if (!existsSync(DISMISSED_PATH)) return [];
  try {
    const data = JSON.parse(readFileSync(DISMISSED_PATH, 'utf8')) as { urls?: string[] };
    return data.urls ?? [];
  } catch {
    return [];
  }
}

function writeDismissed(urls: string[]): void {
  mkdirSync(dirname(DISMISSED_PATH), { recursive: true });
  writeFileSync(DISMISSED_PATH, JSON.stringify({ urls }, null, 2), 'utf8');
}

function addDismissed(url: string): void {
  const urls = readDismissed();
  if (!urls.includes(url)) {
    urls.push(url);
    writeDismissed(urls);
  }
}

function isDismissed(url: string): boolean {
  return readDismissed().includes(url);
}

export const dismissedDb = { readDismissed, writeDismissed, addDismissed, isDismissed };
