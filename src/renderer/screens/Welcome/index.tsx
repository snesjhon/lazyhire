import type { Profile } from '@shared/types';
import Logo from '../../components/Logo';
import ProfileSetup from '../Profile/ProfileSetup';

export default function Welcome({ onComplete }: { onComplete: (p: Profile) => void }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      overflow: 'auto',
      minHeight: 0,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
        <Logo size={48} textSize={28} style={{ marginBottom: 16 }} />
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
          Build your profile once. Upload a resume or paste a link to one, and everything else draws from it.
        </p>
      </div>

      <ProfileSetup variant="full" onComplete={onComplete} />
    </div>
  );
}
