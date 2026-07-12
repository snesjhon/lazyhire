import { app } from 'electron';

// electron-builder never sets NODE_ENV=production at runtime, so app.isPackaged
// is the only reliable signal that this is a real, installed build rather than
// `electron-vite dev` or a raw `electron .` launch against build output.
export function isMockDiscoverEnabled(): boolean {
  if (app.isPackaged) return false;
  return process.env.MOCK_DISCOVER !== '0';
}
