import { execSync } from 'child_process';
import { accessSync, constants, existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { join } from 'path';

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getClaudeBinaryCandidates(): string[] {
  const home = process.env.HOME ?? '';
  const pathEntries = (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .map((entry) => path.join(entry, 'claude'));

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
    const result = execSync('which claude', { encoding: 'utf8' }).trim();
    if (result && isExecutable(result)) return result;
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
): {
  maxTurns: number;
  allowedTools?: string[];
  pathToClaudeCodeExecutable?: string;
  model?: string;
  executable: string;
  env: NodeJS.ProcessEnv;
} {
  return {
    ...base,
    model: getModel(),
    pathToClaudeCodeExecutable: findClaudeBinary(),
    // When no native `claude` binary is found, the SDK falls back to spawning its
    // bundled cli.js via `node` on PATH. A packaged, GUI-launched Electron app gets a
    // minimal PATH (no `node`) and ships that file inside app.asar, which a plain
    // system Node process can't read. Re-spawning the Electron binary itself in
    // Node-emulation mode sidesteps both problems — this is a no-op for the
    // native-binary path, which ignores `executable`/`env`.
    executable: process.execPath,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  };
}
