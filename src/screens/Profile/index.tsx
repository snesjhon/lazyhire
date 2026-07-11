import { useState, useEffect } from 'react';
import { IPC } from '@shared/ipc-channels';
import type { Profile } from '@shared/types';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Spinner from '../../components/Spinner';
import ProfileSetup from './ProfileSetup';
import { Textarea } from './ProfileEditForm';

// ── Profile view (read-only + inline section editing) ─────────────

type EditSection = 'identity' | 'targets' | 'summary' | 'education' | 'skills' | null;

function ProfileView({ profile, onUpdate }: { profile: Profile; onUpdate: (p: Profile) => void }) {
  const [editing, setEditing] = useState<EditSection>(null);
  const [draft, setDraft] = useState<Profile>(profile);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await window.api.invoke(IPC.PROFILE_SAVE, draft);
      onUpdate(draft);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setDraft(profile);
    setEditing(null);
  }

  const p = editing ? draft : profile;

  return (
    <div style={{ padding: 32, maxWidth: 680, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{profile.candidate.name}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{profile.headline}</p>
      </div>

      {/* Identity */}
      <ProfileSection
        title="Identity"
        editing={editing === 'identity'}
        onEdit={() => { setDraft(profile); setEditing('identity'); }}
        onSave={handleSave}
        onCancel={cancelEdit}
        saving={saving}
      >
        {editing === 'identity' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['name', 'email', 'location', 'site', 'linkedin', 'github'] as const).map((key) => (
              <Input
                key={key}
                label={key.charAt(0).toUpperCase() + key.slice(1)}
                value={(draft.candidate[key] as string) ?? ''}
                onChange={(e) => setDraft({ ...draft, candidate: { ...draft.candidate, [key]: e.target.value } })}
              />
            ))}
          </div>
        ) : (
          <Fields items={[
            ['Name', p.candidate.name],
            ['Email', p.candidate.email],
            ['Location', p.candidate.location],
            ['Website', p.candidate.site],
            ['LinkedIn', p.candidate.linkedin ?? '—'],
            ['GitHub', p.candidate.github ?? '—'],
          ]} />
        )}
      </ProfileSection>

      {/* Summary */}
      <ProfileSection
        title="Summary"
        editing={editing === 'summary'}
        onEdit={() => { setDraft(profile); setEditing('summary'); }}
        onSave={handleSave}
        onCancel={cancelEdit}
        saving={saving}
      >
        {editing === 'summary' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Headline" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
            <Textarea label="Summary" value={draft.summary} onChange={(v) => setDraft({ ...draft, summary: v })} rows={5} />
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{p.summary}</p>
        )}
      </ProfileSection>

      {/* Targets */}
      <ProfileSection
        title="Targets"
        editing={editing === 'targets'}
        onEdit={() => { setDraft(profile); setEditing('targets'); }}
        onSave={handleSave}
        onCancel={cancelEdit}
        saving={saving}
      >
        {editing === 'targets' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Textarea
              label="Target roles (one per line)"
              value={draft.targets.roles.join('\n')}
              onChange={(v) => setDraft({ ...draft, targets: { ...draft.targets, roles: v.split('\n').filter(Boolean) } })}
              rows={3}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="Salary min"
                type="number"
                value={String(draft.targets.salaryMin)}
                onChange={(e) => setDraft({ ...draft, targets: { ...draft.targets, salaryMin: Number(e.target.value) } })}
              />
              <Input
                label="Salary max"
                type="number"
                value={String(draft.targets.salaryMax)}
                onChange={(e) => setDraft({ ...draft, targets: { ...draft.targets, salaryMax: Number(e.target.value) } })}
              />
            </div>
            <Textarea
              label="Deal-breakers (one per line)"
              value={draft.targets.dealBreakers.join('\n')}
              onChange={(v) => setDraft({ ...draft, targets: { ...draft.targets, dealBreakers: v.split('\n').filter(Boolean) } })}
              rows={3}
            />
          </div>
        ) : (
          <Fields items={[
            ['Roles', p.targets.roles.join(', ') || '—'],
            ['Salary', p.targets.salaryMin || p.targets.salaryMax ? `$${p.targets.salaryMin.toLocaleString()} – $${p.targets.salaryMax.toLocaleString()}` : '—'],
            ['Remote', p.targets.remote],
            ['Deal-breakers', p.targets.dealBreakers.join(', ') || '—'],
          ]} />
        )}
      </ProfileSection>

      {/* Skills */}
      <ProfileSection
        title="Skills"
        editing={editing === 'skills'}
        onEdit={() => { setDraft(profile); setEditing('skills'); }}
        onSave={handleSave}
        onCancel={cancelEdit}
        saving={saving}
      >
        {editing === 'skills' ? (
          <Textarea
            label="Skills (one per line)"
            value={draft.skills.join('\n')}
            onChange={(v) => setDraft({ ...draft, skills: v.split('\n').filter(Boolean) })}
            rows={6}
          />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {p.skills.map((s) => (
              <span key={s} style={{
                padding: '2px 8px',
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
              }}>{s}</span>
            ))}
          </div>
        )}
      </ProfileSection>

      {/* Education */}
      <ProfileSection
        title="Education"
        editing={editing === 'education'}
        onEdit={() => { setDraft(profile); setEditing('education'); }}
        onSave={handleSave}
        onCancel={cancelEdit}
        saving={saving}
      >
        {editing === 'education' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {draft.education.map((edu, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input
                  label="Institution"
                  value={edu.institution}
                  onChange={(e) => {
                    const next = draft.education.map((x, j) => j === i ? { ...x, institution: e.target.value } : x);
                    setDraft({ ...draft, education: next });
                  }}
                />
                <Input
                  label="Degree"
                  value={edu.degree}
                  onChange={(e) => {
                    const next = draft.education.map((x, j) => j === i ? { ...x, degree: e.target.value } : x);
                    setDraft({ ...draft, education: next });
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.education.map((edu, i) => (
              <div key={i}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{edu.institution}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{edu.degree}</span>
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      {/* Experience (read-only) */}
      <ProfileSection title="Experience" editing={false} onEdit={() => {}} onSave={async () => {}} onCancel={() => {}} saving={false} hideEditButton>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {p.experiences.map((exp, i) => (
            <div key={i}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {exp.role} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>at {exp.company}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                {exp.period.start} – {exp.period.end}
              </div>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {exp.bullets.slice(0, 3).map((b, j) => (
                  <li key={j} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2, lineHeight: 1.5 }}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ProfileSection>
    </div>
  );
}

// ── Shared subcomponents ──────────────────────────────────────────

function ProfileSection({
  title,
  editing,
  onEdit,
  onSave,
  onCancel,
  saving,
  hideEditButton,
  children,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  hideEditButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          {title}
        </span>
        {!hideEditButton && (
          editing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" variant="primary" onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
          )
        )}
      </div>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        {children}
      </div>
    </div>
  );
}

function Fields({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 6 }}>
      {items.map(([label, value]) => (
        <>
          <span key={label + '_k'} style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
          <span key={label + '_v'} style={{ fontSize: 12, color: 'var(--text-primary)' }}>{value || '—'}</span>
        </>
      ))}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────

export default function Profile() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const has = await window.api.invoke(IPC.PROFILE_HAS) as boolean;
        if (has) {
          const p = await window.api.invoke(IPC.PROFILE_READ) as Profile;
          setProfile(p);
        }
        setHasProfile(has);
      } catch {
        setHasProfile(false);
      }
    }
    void load();
  }, []);

  if (hasProfile === null) {
    return (
      <div style={{ padding: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Spinner size={14} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Loading…</span>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <ProfileSetup
        variant="embedded"
        onComplete={(p) => {
          setProfile(p);
          setHasProfile(true);
        }}
      />
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Spinner size={14} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Loading profile…</span>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <ProfileView
        profile={profile}
        onUpdate={(p) => setProfile(p)}
      />
    </div>
  );
}
