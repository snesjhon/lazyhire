import { execSync } from 'child_process';
import { accessSync, constants } from 'fs';
import path from 'path';

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getPathCommandCandidates(): string[] {
  const names = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    'chrome',
  ];

  return (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((entry) => names.map((name) => path.join(entry, name)));
}

function getChromeCandidates(): string[] {
  const home = process.env.HOME ?? '';

  const candidates = [
    process.env.CHROME_PATH ?? '',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    home ? path.join(home, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome') : '',
    home ? path.join(home, 'Applications', 'Google Chrome Canary.app', 'Contents', 'MacOS', 'Google Chrome Canary') : '',
    home ? path.join(home, 'Applications', 'Chromium.app', 'Contents', 'MacOS', 'Chromium') : '',
    home ? path.join(home, 'Applications', 'Brave Browser.app', 'Contents', 'MacOS', 'Brave Browser') : '',
    home ? path.join(home, 'Applications', 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge') : '',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    ...getPathCommandCandidates(),
  ];

  return [...new Set(candidates.filter(Boolean))];
}

export function findChrome(): string {
  try {
    const result = execSync('which google-chrome || which google-chrome-stable || which chromium || which chromium-browser || which chrome', {
      encoding: 'utf8',
    })
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);

    if (result && isExecutable(result)) return result;
  } catch {}

  const resolved = getChromeCandidates().find(isExecutable);
  if (resolved) return resolved;

  throw new Error(
    'Chrome not found. Install Google Chrome or set CHROME_PATH to a Chromium-based browser executable.',
  );
}
