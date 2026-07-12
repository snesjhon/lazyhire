import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export default function Drawer({ open, title, onClose, children, width = 380 }: DrawerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width,
        maxWidth: 'calc(100vw - 24px)',
        background: 'var(--bg-elevated)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {title && (
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            marginLeft: 'auto',
            padding: '2px 4px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>{children}</div>
    </div>
  );
}
