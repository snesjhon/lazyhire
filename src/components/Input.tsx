import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export default function Input({ label, error, helper, style, ...rest }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <input
        {...rest}
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          color: 'var(--text-primary)',
          padding: '5px 8px',
          outline: 'none',
          transition: 'border-color var(--transition)',
          width: '100%',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--red)' : 'var(--accent)';
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--red)' : 'var(--border)';
          rest.onBlur?.(e);
        }}
      />
      {error && <span style={{ fontSize: '11px', color: 'var(--red)' }}>{error}</span>}
      {!error && helper && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{helper}</span>}
    </div>
  );
}
