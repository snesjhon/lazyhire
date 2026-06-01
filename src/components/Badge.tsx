import type { JobStatus } from '@shared/types';

type BadgeVariant = JobStatus | 'default';

const variantMap: Record<BadgeVariant, { bg: string; color: string }> = {
  Pending:   { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
  Evaluated: { bg: 'var(--accent-dim)',      color: 'var(--accent)' },
  Applied:   { bg: 'var(--accent-dim)',      color: 'var(--accent)' },
  Interview: { bg: 'var(--yellow-dim)',      color: 'var(--yellow)' },
  Offer:     { bg: 'var(--green-dim)',       color: 'var(--green)' },
  Rejected:  { bg: 'var(--red-dim)',         color: 'var(--red)' },
  Discarded: { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' },
  default:   { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
};

interface BadgeProps {
  status: BadgeVariant;
  label?: string;
}

export default function Badge({ status, label }: BadgeProps) {
  const { bg, color } = variantMap[status] ?? variantMap.default;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: bg,
        color,
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? status}
    </span>
  );
}
