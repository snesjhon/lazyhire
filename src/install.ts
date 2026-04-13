import { appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

export async function runInstall(): Promise<void> {
  const dest = join(homedir(), '.local', 'bin', 'lazyhire');
  mkdirSync(dirname(dest), { recursive: true });

  copyFileSync(process.execPath, dest);
  chmodSync(dest, 0o755);

  const shell = process.env.SHELL ?? '/bin/zsh';
  const configFile = shell.includes('zsh')
    ? join(homedir(), '.zshrc')
    : join(homedir(), '.bash_profile');

  if (!existsSync(configFile)) writeFileSync(configFile, '');

  const config = readFileSync(configFile, 'utf8');
  if (!config.includes('.local/bin')) {
    appendFileSync(configFile, '\nexport PATH="$HOME/.local/bin:$PATH"\n');
  }

  console.log(`✓ lazyhire installed to ${dest}`);
  console.log(`\nTo start using it, run:`);
  console.log(`  source ${configFile}`);
  console.log(`  lazyhire`);
}
