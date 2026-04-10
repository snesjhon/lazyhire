import type { FlashVariant } from './utils.js';

export type Screen = 'dashboard' | 'scan' | 'profile' | 'answers';
export type FocusTarget = 'tabs' | 'jobs' | 'detail' | 'modal';
export type Overlay =
  | 'none'
  | 'actions'
  | 'add'
  | 'add-url'
  | 'add-jd'
  | 'edit-jd'
  | 'status'
  | 'delete'
  | 'generate-cv';
export type Flash = { message: string; variant: FlashVariant };
export type JobAction =
  | 'detail'
  | 'evaluate'
  | 'generate-cv'
  | 'edit-jd'
  | 'status'
  | 'open-cv'
  | 'open-link'
  | 'delete'
  | 'cancel';
