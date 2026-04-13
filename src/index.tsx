/** @jsxImportSource @opentui/react */
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import App from './app.js';
import { runInstall, runUninstall } from './install.js';
import { checkForUpdate, runUpdate } from './shared/lib/updater.js';

if (process.argv[2] === 'install') {
  await runInstall();
  process.exit(0);
}

if (process.argv[2] === 'uninstall') {
  await runUninstall();
  process.exit(0);
}

if (process.argv[2] === 'update') {
  await runUpdate();
  process.exit(0);
}

await checkForUpdate();

const cliRenderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(cliRenderer).render(<App />);
