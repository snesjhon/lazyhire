import { execSync } from 'child_process';
import { accessSync, constants, existsSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { join } from 'path';
import type { Options } from '@anthropic-ai/claude-code';

const isWindows = process.platform === 'win32';
// npm/volta/etc ship Windows shims with these extensions; a bare `claude` file
// generally doesn't exist there the way it does on macOS/Linux.
const WIN_BIN_NAMES = ['claude.exe', 'claude.cmd', 'claude.bat', 'claude.ps1', 'claude'];

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

function getClaudeBinaryCandidates(): string[] {
  const binNames = isWindows ? WIN_BIN_NAMES : ['claude'];

  const pathEntries = (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((entry) => binNames.map((name) => path.join(entry, name)));

  if (isWindows) {
    const appData = process.env.APPDATA ?? '';
    const localAppData = process.env.LOCALAPPDATA ?? '';
    const home = process.env.USERPROFILE ?? '';

    const dirs = [
      path.join(process.cwd(), 'node_modules', '.bin'),
      appData ? path.join(appData, 'npm') : '',
      home ? path.join(home, '.local', 'bin') : '',
      home ? path.join(home, '.bun', 'bin') : '',
      localAppData ? path.join(localAppData, 'Volta', 'bin') : '',
      localAppData ? path.join(localAppData, 'pnpm') : '',
      localAppData ? path.join(localAppData, 'Programs', 'claude', 'bin') : '',
    ].filter(Boolean);

    const candidates = dirs.flatMap((dir) => binNames.map((name) => path.join(dir, name)));
    return [...new Set([...candidates, ...pathEntries])];
  }

  const home = process.env.HOME ?? '';
  const candidates = [
    path.join(process.cwd(), 'node_modules', '.bin', 'claude'),
    home ? path.join(home, '.local', 'bin', 'claude') : '',
    home ? path.join(home, '.npm-global', 'bin', 'claude') : '',
    home ? path.join(home, '.volta', 'bin', 'claude') : '',
    home ? path.join(home, '.bun', 'bin', 'claude') : '',
    home ? path.join(home, 'Library', 'pnpm', 'claude') : '',
    home ? path.join(home, '.nvm', 'versions', 'node', 'current', 'bin', 'claude') : '',
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    ...pathEntries,
  ];

  return [...new Set(candidates.filter(Boolean))];
}

export function findClaudeBinary(): string | undefined {
  try {
    const command = isWindows ? 'where claude' : 'which claude';
    const result = execSync(command, { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && isExecutable(line));
    if (result) return result;
  } catch {}

  return getClaudeBinaryCandidates().find(isExecutable);
}

const SETTINGS_PATH = join(homedir(), '.lazyhire', 'settings.json');
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function getModel(): string {
  try {
    if (!existsSync(SETTINGS_PATH)) return DEFAULT_MODEL;
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as { model?: string };
    return settings.model || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function getClaudeQueryOptions(
  base: { maxTurns: number; allowedTools?: string[] },
): Options {
  return {
    ...base,
    model: getModel(),
    pathToClaudeCodeExecutable: findClaudeBinary(),
    // When no native `claude` binary is found, the SDK falls back to spawning its
    // bundled cli.js via `node` on PATH. A packaged, GUI-launched Electron app gets a
    // minimal PATH (no `node`) and ships that file inside app.asar, which a plain
    // system Node process can't read. Re-spawning the Electron binary itself in
    // Node-emulation mode sidesteps both problems — this is a no-op for the
    // native-binary path, which ignores `executable`/`env`. The SDK's type only
    // declares 'node' | 'bun' | 'deno' here, but spawn() takes `executable` as a
    // literal command string, so a full path works fine at runtime.
    executable: process.execPath as Options['executable'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  };
}
