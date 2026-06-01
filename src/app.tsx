import { useState } from 'react';
import './styles/globals.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './screens/Dashboard';
import Scan from './screens/Scan';
import Profile from './screens/Profile';
import Answers from './screens/Answers';
import Settings from './screens/Settings';

type Screen = 'dashboard' | 'scan' | 'profile' | 'answers' | 'settings';

const SCREEN_TITLES: Record<Screen, string> = {
  dashboard: 'Dashboard',
  scan: 'Scan',
  profile: 'Profile',
  answers: 'Answers',
  settings: 'Settings',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar active={screen} onNavigate={setScreen} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar title={SCREEN_TITLES[screen]} />
        <main style={{ flex: 1, overflow: 'hidden' }}>
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'scan' && <Scan />}
          {screen === 'profile' && <Profile />}
          {screen === 'answers' && <Answers />}
          {screen === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
