import { chmodSync, existsSync, renameSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';

const REPO = 'snesjhon/lazyhire';
const GH_BASE = `https://github.com/${REPO}/releases`;
const binaryName = process.platform === 'win32' ? 'lazyhire.exe' : 'lazyhire';
export const INSTALLED_PATH = join(homedir(), '.local', 'bin', binaryName);

function platformKey(): string {
  if (process.platform === 'win32') return 'windows-x64';
  return 'darwin-arm64';
}

declare const __LAZYHIRE_VERSION__: string | undefined;
export const CURRENT_VERSION =
  typeof __LAZYHIRE_VERSION__ !== 'undefined' ? __LAZYHIRE_VERSION__ : 'dev';

async function fetchLatestVersion(): Promise<string | null> {
  try {
    return await fetch(`${GH_BASE}/latest/download/latest.txt`)
      .then((r) => r.text())
      .then((t) => t.trim());
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<void> {
  if (CURRENT_VERSION === 'dev') return;
  if (!existsSync(INSTALLED_PATH)) return;

  const latestVersion = await fetchLatestVersion();
  if (latestVersion && latestVersion !== CURRENT_VERSION) {
    console.log(`\nNew version available: ${latestVersion}. Run \`lazyhire update\` to upgrade.\n`);
  }
}

export async function runUpdate(): Promise<void> {
  const latestVersion = await fetchLatestVersion();
  if (!latestVersion) {
    console.error('Could not fetch latest version.');
    return;
  }

  if (latestVersion === CURRENT_VERSION) {
    console.log(`Already on the latest version (${CURRENT_VERSION}).`);
    return;
  }

  console.log(`Updating lazyhire ${CURRENT_VERSION} → ${latestVersion}...`);

  try {
    const manifest = await fetch(`${GH_BASE}/download/${latestVersion}/manifest.json`)
      .then((r) => r.json()) as { platforms: Record<string, { url: string; sha256: string }> };

    const platform = manifest.platforms?.[platformKey()];
    if (!platform?.url) {
      console.error('No binary available for this platform.');
      return;
    }

    const bytes = await fetch(platform.url).then((r) => r.bytes());

    const hash = createHash('sha256').update(bytes as unknown as Buffer).digest('hex');
    if (hash !== platform.sha256) {
      console.error('Checksum verification failed, aborting.');
      return;
    }

    const tmp = join(homedir(), '.local', 'bin', `.lazyhire-update-${Date.now()}${process.platform === 'win32' ? '.exe' : ''}`);
    writeFileSync(tmp, bytes);
    chmodSync(tmp, 0o755);
    renameSync(tmp, INSTALLED_PATH);

    console.log(`✓ Updated to ${latestVersion}. Run \`lazyhire\` to start.`);
  } catch (err) {
    console.error(`Update failed: ${err instanceof Error ? err.message : err}`);
  }
}
