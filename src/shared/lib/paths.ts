import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const LOCAL_DATA_DIR = join(process.cwd(), '.lazyhire');
const GLOBAL_DATA_DIR = join(homedir(), '.lazyhire');

export const DATA_DIR = existsSync(LOCAL_DATA_DIR) ? LOCAL_DATA_DIR : GLOBAL_DATA_DIR;
