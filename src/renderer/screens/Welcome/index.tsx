import type { Profile } from '@shared/types';
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
        <div className="brand-mark" style={{ width: 44, height: 44, borderRadius: 12, fontSize: 20, marginBottom: 16 }}>⌁</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>lazy</span>hire
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
          Build your profile once. Upload a resume or paste a link to one, and everything else draws from it.
        </p>
      </div>

      <ProfileSetup variant="full" onComplete={onComplete} />
    </div>
  );
}
