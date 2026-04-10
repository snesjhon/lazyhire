import type { FlashVariant } from './lib/utils.js';

export type Screen = 'dashboard' | 'scan' | 'profile' | 'answers';
export type FocusTarget = 'tabs' | 'jobs' | 'detail' | 'modal';
export type Overlay =
  | 'none'
  | 'add'
  | 'add-url'
  | 'add-jd';
export type Flash = { message: string; variant: FlashVariant };
