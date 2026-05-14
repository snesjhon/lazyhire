import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { DATA_DIR } from '../lib/paths.js';
import type { DiscoveredStore } from '../models/types.js';

const DISCOVERED_PATH = join(DATA_DIR, 'discovered.json');

const EMPTY_STORE: DiscoveredStore = {
  batch: [],
  batchOffset: 0,
  queue: [],
  cursor: { greenhouse: 0, ashby: 0 },
  lastSourcedAt: '',
};

function readDiscovered(): DiscoveredStore {
  if (!existsSync(DISCOVERED_PATH)) return { ...EMPTY_STORE };
  try {
    return JSON.parse(readFileSync(DISCOVERED_PATH, 'utf8')) as DiscoveredStore;
  } catch {
    return { ...EMPTY_STORE };
  }
}

function writeDiscovered(store: DiscoveredStore): void {
  mkdirSync(dirname(DISCOVERED_PATH), { recursive: true });
  writeFileSync(DISCOVERED_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export const discoveredDb = { readDiscovered, writeDiscovered };
