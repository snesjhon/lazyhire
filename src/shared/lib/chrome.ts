import { existsSync } from 'fs';

export function findChrome(): string {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    'Chrome not found. Install Google Chrome at https://www.google.com/chrome/ to use lazyhire.',
  );
}
