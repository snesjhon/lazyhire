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
export type JobIntakeState =
  | 'none'
  | 'choose-source'
  | 'paste-url'
  | 'paste-description'
  | 'crawl-failed'
  | 'evaluating';
export type Flash = { message: string; variant: FlashVariant };
