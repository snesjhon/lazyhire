/** @jsxImportSource @opentui/react */
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import App from './app.js';

const cliRenderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(cliRenderer).render(<App />);
