import type { FlashVariant } from '../lib/utils.js';

export type Screen = 'dashboard' | 'scan';
export type FocusTarget =
  | 'status'
  | 'jobs'
  | 'profile'
  | 'answers'
  | 'detail';
export type JobIntakeState =
  | 'none'
  | 'choose-source'
  | 'paste-url'
  | 'paste-description'
  | 'crawl-failed'
  | 'evaluating';
export type Flash = { message: string; variant: FlashVariant };
