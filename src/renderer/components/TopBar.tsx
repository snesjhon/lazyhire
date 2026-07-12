import type { ReactNode } from 'react';

interface TopBarProps {
  title: string;
  actions?: ReactNode;
}

export default function TopBar({ title, actions }: TopBarProps) {
  return (
    <div
      style={{
        height: 44,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        background: 'var(--bg-elevated)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontWeight: 600,
          fontSize: 13,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </span>
      {actions && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
