import { execSync } from 'child_process';
import { accessSync, constants, statSync } from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    // On Windows, X_OK is treated the same as F_OK (existence-only), so also
    // confirm it's a file and not a directory that merely happens to exist.
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function getPathCommandCandidates(): string[] {
  const names = isWindows
    ? ['chrome.exe', 'chromium.exe', 'msedge.exe', 'brave.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'];

  return (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((entry) => names.map((name) => path.join(entry, name)));
}

function getWindowsChromeCandidates(): string[] {
  const programFiles = process.env['PROGRAMFILES'] ?? 'C:\\Program Files';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
  const localAppData = process.env.LOCALAPPDATA ?? '';

  return [
    process.env.CHROME_PATH ?? '',
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
    localAppData ? path.join(localAppData, 'Chromium', 'Application', 'chrome.exe') : '',
    path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    localAppData ? path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') : '',
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    localAppData ? path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : '',
    ...getPathCommandCandidates(),
  ];
}

function getChromeCandidates(): string[] {
  if (isWindows) return [...new Set(getWindowsChromeCandidates().filter(Boolean))];

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
    const command = isWindows
      ? 'where chrome.exe || where msedge.exe || where chromium.exe || where brave.exe'
      : 'which google-chrome || which google-chrome-stable || which chromium || which chromium-browser || which chrome';
    const result = execSync(command, { encoding: 'utf8' })
      .split(/\r?\n/)
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
