type Screen = 'dashboard' | 'scan' | 'profile' | 'answers' | 'settings';

interface NavItem {
  id: Screen;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'scan',      label: 'Scan',      icon: '⊙' },
  { id: 'profile',   label: 'Profile',   icon: '◯' },
  { id: 'answers',   label: 'Answers',   icon: '▦' },
  { id: 'settings',  label: 'Settings',  icon: '⚙' },
];

interface SidebarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
}

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        height: '100vh',
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 13,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          lazyhire
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          v2
        </span>
      </div>

      <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '6px 10px',
                borderRadius: 'var(--radius)',
                border: 'none',
                background: isActive ? 'var(--bg-overlay)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 500 : 400,
                fontSize: 13,
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                transition: 'background var(--transition), color var(--transition)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.6, width: 14, textAlign: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
              {isActive && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
