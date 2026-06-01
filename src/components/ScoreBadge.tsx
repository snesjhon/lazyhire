interface ScoreBadgeProps {
  score: number | null;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 18,
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        —
      </span>
    );
  }

  const color = score > 7 ? 'var(--green)' : score >= 5 ? 'var(--yellow)' : 'var(--red)';
  const bg = score > 7 ? 'var(--green-dim)' : score >= 5 ? 'var(--yellow-dim)' : 'var(--red-dim)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 18,
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color,
        background: bg,
      }}
    >
      {score}
    </span>
  );
}
