interface SpinnerProps {
  size?: number;
  color?: string;
}

export default function Spinner({ size = 14, color = 'var(--text-muted)' }: SpinnerProps) {
  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .lh-spinner {
          animation: spin 0.7s linear infinite;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
      `}</style>
      <span
        className="lh-spinner"
        style={{
          width: size,
          height: size,
          border: `2px solid transparent`,
          borderTopColor: color,
          borderRightColor: color,
        }}
      />
    </>
  );
}
