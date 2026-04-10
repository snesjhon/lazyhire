import type { JobStatus } from '../types.js';

export type FlashVariant = 'info' | 'success' | 'warning' | 'error';

export function clip(value: string, max: number): string {
  if (max <= 1) return value.slice(0, max);
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function scoreDisplay(score: number | null): string {
  return score === null ? '—' : score.toFixed(1);
}

export function statusColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    Pending: '#f5c542',
    Evaluated: '#4cc9f0',
    Applied: '#7aa2f7',
    Interview: '#c77dff',
    Offer: '#57cc99',
    Rejected: '#ff6b6b',
    Discarded: '#868e96',
  };
  return colors[status];
}

export function flashColor(variant: FlashVariant): string {
  const colors: Record<FlashVariant, string> = {
    info: '#7aa2f7',
    success: '#57cc99',
    warning: '#f5c542',
    error: '#ff6b6b',
  };
  return colors[variant];
}
