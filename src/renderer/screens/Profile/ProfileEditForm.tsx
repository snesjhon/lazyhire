import type { Profile } from '@shared/types';
import Input from '../../components/Input';

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      marginBottom: 12,
      marginTop: 8,
      paddingBottom: 6,
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      {children}
    </div>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-primary)',
          padding: '6px 8px',
          outline: 'none',
          resize: 'vertical',
          width: '100%',
          fontFamily: 'inherit',
          fontSize: 13,
          lineHeight: 1.6,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      />
    </div>
  );
}

export default function ProfileEditForm({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  function set<K extends keyof Profile>(key: K, val: Profile[K]) {
    onChange({ ...profile, [key]: val });
  }

  function setCandidate<K extends keyof Profile['candidate']>(key: K, val: string) {
    onChange({ ...profile, candidate: { ...profile.candidate, [key]: val } });
  }

  function setTargets<K extends keyof Profile['targets']>(key: K, val: Profile['targets'][K]) {
    onChange({ ...profile, targets: { ...profile.targets, [key]: val } });
  }

  const fieldStyle: React.CSSProperties = { marginBottom: 16 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHeader>Identity</SectionHeader>
      <div style={fieldStyle}><Input label="Name" value={profile.candidate.name} onChange={(e) => setCandidate('name', e.target.value)} /></div>
      <div style={fieldStyle}><Input label="Email" value={profile.candidate.email} onChange={(e) => setCandidate('email', e.target.value)} /></div>
      <div style={fieldStyle}><Input label="Location" value={profile.candidate.location} onChange={(e) => setCandidate('location', e.target.value)} /></div>
      <div style={fieldStyle}><Input label="Website" value={profile.candidate.site} onChange={(e) => setCandidate('site', e.target.value)} /></div>
      <div style={fieldStyle}><Input label="LinkedIn" value={profile.candidate.linkedin ?? ''} onChange={(e) => setCandidate('linkedin', e.target.value)} /></div>
      <div style={{ marginBottom: 16 }}><Input label="GitHub" value={profile.candidate.github ?? ''} onChange={(e) => setCandidate('github', e.target.value)} /></div>

      <SectionHeader>Headline &amp; Summary</SectionHeader>
      <div style={fieldStyle}><Input label="Headline" value={profile.headline} onChange={(e) => set('headline', e.target.value)} /></div>
      <div style={{ marginBottom: 16 }}>
        <Textarea label="Summary" value={profile.summary} onChange={(v) => set('summary', v)} rows={4} />
      </div>

      <SectionHeader>Targets</SectionHeader>
      <div style={fieldStyle}>
        <Textarea
          label="Target roles (one per line)"
          value={profile.targets.roles.join('\n')}
          onChange={(v) => setTargets('roles', v.split('\n').filter(Boolean))}
          rows={3}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <Input
          label="Salary min"
          type="number"
          value={String(profile.targets.salaryMin)}
          onChange={(e) => setTargets('salaryMin', Number(e.target.value))}
        />
        <Input
          label="Salary max"
          type="number"
          value={String(profile.targets.salaryMax)}
          onChange={(e) => setTargets('salaryMax', Number(e.target.value))}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Textarea
          label="Deal-breakers (one per line)"
          value={profile.targets.dealBreakers.join('\n')}
          onChange={(v) => setTargets('dealBreakers', v.split('\n').filter(Boolean))}
          rows={3}
        />
      </div>

      <SectionHeader>Skills</SectionHeader>
      <div style={{ marginBottom: 16 }}>
        <Textarea
          label="Skills (one per line)"
          value={profile.skills.join('\n')}
          onChange={(v) => set('skills', v.split('\n').filter(Boolean))}
          rows={5}
        />
      </div>

      <SectionHeader>Education</SectionHeader>
      {profile.education.map((edu, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Input
            label="Institution"
            value={edu.institution}
            onChange={(e) => {
              const next = profile.education.map((x, j) => j === i ? { ...x, institution: e.target.value } : x);
              set('education', next);
            }}
          />
          <Input
            label="Degree"
            value={edu.degree}
            onChange={(e) => {
              const next = profile.education.map((x, j) => j === i ? { ...x, degree: e.target.value } : x);
              set('education', next);
            }}
          />
        </div>
      ))}
    </div>
  );
}
