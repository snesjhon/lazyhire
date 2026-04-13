import type { FlashVariant } from '../lib/utils.js';

export type Screen = 'dashboard' | 'scan' | 'profile' | 'answers';
export type FocusTarget =
  | 'tabs'
  | 'status'
  | 'jobs'
  | 'profile'
  | 'answers'
  | 'detail'
  | 'modal';
export type Overlay =
  | 'none'
  | 'add'
  | 'add-url'
  | 'add-jd'
  | 'add-crawl-failed'
  | 'add-evaluating';
export type Flash = { message: string; variant: FlashVariant };
