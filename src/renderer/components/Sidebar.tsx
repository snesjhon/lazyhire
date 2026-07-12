import Icon from './Icon';

type Screen = 'jobs' | 'docs' | 'answers' | 'scan' | 'profile' | 'settings';

interface SidebarProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
  onCollapse: () => void;
  jobsCount: number;
  docsCount: number;
  answersCount: number;
  candidateName?: string;
  candidateTitle?: string;
}

const MAIN_NAV: { id: Screen; label: string; icon: 'jobs' | 'docs' | 'answers' }[] = [
  { id: 'jobs',    label: 'Jobs',      icon: 'jobs' },
  { id: 'docs',    label: 'Documents', icon: 'docs' },
  { id: 'answers', label: 'Answers',   icon: 'answers' },
];

const SEC_NAV: { id: Screen; label: string; icon: 'scan' | 'profile' | 'settings' }[] = [
  { id: 'scan',     label: 'Discover',  icon: 'scan' },
  { id: 'profile',  label: 'Profile',   icon: 'profile' },
  { id: 'settings', label: 'Settings',  icon: 'settings' },
];

function getInitials(name?: string) {
  if (!name) return 'ME';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

export default function Sidebar({
  active,
  onNavigate,
  theme,
  onThemeChange,
  onCollapse,
  jobsCount,
  docsCount,
  answersCount,
  candidateName,
  candidateTitle,
}: SidebarProps) {
  const counts: Record<Screen, number | undefined> = {
    jobs: jobsCount,
    docs: docsCount,
    answers: answersCount,
    scan: undefined,
    profile: undefined,
    settings: undefined,
  };

  return (
    <aside className="sidebar">
      {/* Traffic lights + collapse */}
      <div className="sidebar-top">
        <div className="lights">
          <span className="light r" />
          <span className="light y" />
          <span className="light g" />
        </div>
        <button className="collapse-btn" onClick={onCollapse} title="Hide sidebar">
          <Icon name="sidebarToggle" size={17} />
        </button>
      </div>

      {/* Brand */}
      <div className="brand">
        <div className="brand-mark">⌁</div>
        <div className="brand-name">
          <span className="lazy">lazy</span>hire
        </div>
      </div>

      {/* Main nav */}
      <nav className="nav">
        {MAIN_NAV.map(({ id, label, icon }) => (
          <button
            key={id}
            className={'nav-item' + (active === id ? ' active' : '')}
            onClick={() => onNavigate(id)}
          >
            <Icon name={icon} size={17} />
            <span>{label}</span>
            {counts[id] !== undefined && (
              <span className="nav-count">{counts[id]}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="nav-divider" style={{ margin: '8px 0' }} />

      {/* Secondary nav */}
      <nav className="nav">
        {SEC_NAV.map(({ id, label, icon }) => (
          <button
            key={id}
            className={'nav-item' + (active === id ? ' active' : '')}
            onClick={() => onNavigate(id)}
          >
            <Icon name={icon} size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      {/* Candidate card */}
      <div className="candidate">
        <div className="avatar">{getInitials(candidateName)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="c-name">{candidateName || 'Your Profile'}</div>
          <div className="c-role">{candidateTitle || 'Set up your profile'}</div>
        </div>
      </div>

      {/* Theme toggle */}
      <div className="theme-toggle">
        <button className={theme === 'light' ? 'on' : ''} onClick={() => onThemeChange('light')}>
          <Icon name="sun" size={14} /> Light
        </button>
        <button className={theme === 'dark' ? 'on' : ''} onClick={() => onThemeChange('dark')}>
          <Icon name="moon" size={14} /> Dark
        </button>
      </div>
    </aside>
  );
}

export type { Screen };
