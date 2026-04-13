/** @jsxImportSource @opentui/react */
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import App from './app.js';
import { runInstall } from './install.js';

if (process.argv[2] === 'install') {
  await runInstall();
  process.exit(0);
}

const cliRenderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(cliRenderer).render(<App />);
