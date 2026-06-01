interface DonutProps {
  score: number | null;
  reco: 'apply' | 'consider' | 'skip' | 'pending';
  size?: number;
  stroke?: number;
}

export default function Donut({ score, reco, size = 120, stroke = 10 }: DonutProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score !== null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const color = reco === 'pending' ? 'var(--text-3)' : `var(--state-${reco})`;

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--track)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="d-center">
        <div className="d-num" style={{ color, fontSize: score !== null ? undefined : 18 }}>
          {score !== null ? score : '—'}
        </div>
        <div className="d-label">{score !== null ? 'FIT' : 'SCORE'}</div>
      </div>
    </div>
  );
}
