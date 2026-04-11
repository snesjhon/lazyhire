import type { JobStatus } from '../models/types.js';
import type { UiTheme } from '../ui/theme.js';

export type FlashVariant = 'info' | 'success' | 'warning' | 'error';

export function clip(value: string, max: number): string {
  if (max <= 1) return value.slice(0, max);
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function scoreDisplay(score: number | null): string {
  return score === null ? '—' : score.toFixed(1);
}

export function statusColor(status: JobStatus, theme: UiTheme): string {
  return theme.statusColors[status];
}

export function flashColor(variant: FlashVariant, theme: UiTheme): string {
  return theme.flashColors[variant];
}
