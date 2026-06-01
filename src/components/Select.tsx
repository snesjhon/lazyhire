import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
}

export default function Select({ label, options, style, ...rest }: SelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <select
        {...rest}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-primary)',
          padding: '5px 8px',
          outline: 'none',
          cursor: 'pointer',
          width: '100%',
          ...style,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
