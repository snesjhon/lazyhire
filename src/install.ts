import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
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

export async function runUninstall(): Promise<void> {
  const dest = join(homedir(), '.local', 'bin', 'lazyhire');

  if (existsSync(dest)) {
    rmSync(dest);
    console.log(`✓ Removed ${dest}`);
  } else {
    console.log(`lazyhire binary not found at ${dest}`);
  }

  const shell = process.env.SHELL ?? '/bin/zsh';
  const configFile = shell.includes('zsh')
    ? join(homedir(), '.zshrc')
    : join(homedir(), '.bash_profile');

  if (existsSync(configFile)) {
    const config = readFileSync(configFile, 'utf8');
    const cleaned = config.replace(
      /\nexport PATH="\$HOME\/.local\/bin:\$PATH"\n/g,
      '\n',
    );
    if (cleaned !== config) {
      writeFileSync(configFile, cleaned, 'utf8');
      console.log(`✓ Removed PATH entry from ${configFile}`);
    }
  }

  console.log(`\nYour data at ~/.lazyhire/ was not removed.`);
  console.log(`To delete it run:  rm -rf ~/.lazyhire/`);
}
