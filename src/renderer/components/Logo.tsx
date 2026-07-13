import type { CSSProperties } from 'react';

interface LogoProps {
  size?: number;
  textSize?: number;
  gap?: number;
  style?: CSSProperties;
}

export default function Logo({ size = 28, textSize = 17, gap, style }: LogoProps) {
  return (
    <div className="logo-mark" style={{ gap: gap ?? size * 0.34, ...style }}>
      <svg width={size} height={size} viewBox="0 0 150 150" aria-hidden="true">
        <rect x="3" y="3" width="144" height="144" rx="34" fill="var(--brand-icon-bg)" />
        <rect
          x="40" y="52" width="58" height="58" rx="18"
          fill="var(--brand-icon-mid)" opacity="0.55"
          transform="rotate(-8 69 81)"
        />
        <rect x="58" y="46" width="52" height="52" rx="16" fill="var(--brand-icon-fg)" />
      </svg>
      <span className="logo-text" style={{ fontSize: textSize }}>LazyHire</span>
    </div>
  );
}
