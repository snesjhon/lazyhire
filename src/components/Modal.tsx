import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export default function Modal({ open, title, onClose, children, width = 480 }: ModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
    </div>
  );
}
