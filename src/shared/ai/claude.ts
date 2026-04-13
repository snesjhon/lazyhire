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

export function getClaudeQueryOptions(
  base: { maxTurns: number; allowedTools?: string[] },
  extra?: { stderr?: (data: string) => void },
): {
  maxTurns: number;
  allowedTools?: string[];
  pathToClaudeCodeExecutable?: string;
  stderr?: (data: string) => void;
} {
  return {
    ...base,
    pathToClaudeCodeExecutable: findClaudeBinary(),
    ...(extra?.stderr ? { stderr: extra.stderr } : {}),
  };
}
