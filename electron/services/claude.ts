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
  extra?: { stderr?: (data: string) => void },
): {
  maxTurns: number;
  allowedTools?: string[];
  pathToClaudeCodeExecutable?: string;
  model?: string;
  stderr?: (data: string) => void;
} {
  return {
    ...base,
    model: getModel(),
    pathToClaudeCodeExecutable: findClaudeBinary(),
    ...(extra?.stderr ? { stderr: extra.stderr } : {}),
  };
}
