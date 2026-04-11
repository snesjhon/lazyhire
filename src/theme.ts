import type { ThemeMode } from '@opentui/core';
import type { AnswerCategory, JobStatus } from './types.js';

type Palette = {
  text: string;
  heading: string;
  subtext: string;
  muted: string;
  border: string;
  borderActive: string;
  brand: string;
  brandContrast: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  accent: string;
};

export type UiTheme = Palette & {
  mode: Exclude<ThemeMode, null>;
  transparent: 'transparent';
  footer: string;
  answerCategoryColors: Record<AnswerCategory, string>;
  statusColors: Record<JobStatus, string>;
  flashColors: Record<'info' | 'success' | 'warning' | 'error', string>;
};

const LATTE: Palette = {
  text: '#4c4f69',
  heading: '#4c4f69',
  subtext: '#5c5f77',
  muted: '#7c7f93',
  border: '#9ca0b0',
  borderActive: '#1e66f5',
  brand: '#179299',
  brandContrast: '#eff1f5',
  info: '#1e66f5',
  success: '#40a02b',
  warning: '#df8e1d',
  error: '#d20f39',
  accent: '#8839ef',
};

const FRAPPE: Palette = {
  text: '#c6d0f5',
  heading: '#c6d0f5',
  subtext: '#b5bfe2',
  muted: '#949cbb',
  border: '#737994',
  borderActive: '#8caaee',
  brand: '#81c8be',
  brandContrast: '#232634',
  info: '#8caaee',
  success: '#a6d189',
  warning: '#e5c890',
  error: '#e78284',
  accent: '#ca9ee6',
};

export function resolveUiTheme(themeMode: ThemeMode | null | undefined): UiTheme {
  const mode = themeMode === 'light' ? 'light' : 'dark';
  const palette = mode === 'light' ? LATTE : FRAPPE;

  return {
    ...palette,
    mode,
    transparent: 'transparent',
    footer: palette.info,
    answerCategoryColors: {
      identity: palette.accent,
      motivation: palette.brand,
      behavioral: palette.warning,
      strengths: palette.success,
      vision: palette.info,
      culture: palette.brand,
      situational: palette.error,
      other: palette.muted,
    },
    statusColors: {
      Pending: palette.warning,
      Evaluated: palette.brand,
      Applied: palette.info,
      Interview: palette.accent,
      Offer: palette.success,
      Rejected: palette.error,
      Discarded: palette.muted,
    },
    flashColors: {
      info: palette.info,
      success: palette.success,
      warning: palette.warning,
      error: palette.error,
    },
  };
}
