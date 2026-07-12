import { app } from 'electron';
import { homedir } from 'os';
import { join } from 'path';

export const DATA_DIR = app.isPackaged
  ? join(homedir(), '.lazyhire')
  : join(homedir(), '.lazyhire-dev');
