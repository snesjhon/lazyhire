import { useState, useEffect, Fragment } from 'react';
import { IPC } from '@shared/ipc-channels';
import type { Profile } from '@shared/types';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Input from '../../components/Input';
import Spinner from '../../components/Spinner';
import ProfileSetup from './ProfileSetup';
import { Textarea } from './ProfileEditForm';

// ── Profile view (read-only + inline section editing) ─────────────

type EditSection = 'identity' | 'targets' | 'summary' | 'education' | 'skills' | null;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
    <div className="main">
      <div className="view-head">
        <div>
          <div className="view-title-row">
            <div className="view-title">Profile</div>
          </div>
          <div className="view-sub">The details behind every tailored resume, cover letter, and answer</div>
        </div>
      </div>

      <div className="profile-body">
        {/* Side rail — identity card, contact, skills */}
        <aside className="profile-side">
          <div className="pc-avatar">{getInitials(p.candidate.name)}</div>
          <div className="pc-name">{p.candidate.name}</div>
          <div className="pc-headline">{p.headline}</div>

          <div style={{ height: 26 }} />

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
              <div className="id-rail">
                <div className="id-row"><Icon name="mail" size={15} /><span>{p.candidate.email || '—'}</span></div>
                <div className="id-row"><Icon name="pin" size={15} /><span>{p.candidate.location || '—'}</span></div>
                <div className="id-row"><Icon name="open" size={15} /><span>{p.candidate.site || '—'}</span></div>
                <div className="id-row"><Icon name="open" size={15} /><span>{p.candidate.linkedin || '—'}</span></div>
                <div className="id-row"><Icon name="open" size={15} /><span>{p.candidate.github || '—'}</span></div>
              </div>
            )}
          </ProfileSection>

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
                rows={8}
              />
            ) : (
              <div className="skill-cloud">
                {p.skills.map((s) => (
                  <span key={s} className="skill-tag">{s}</span>
                ))}
              </div>
            )}
          </ProfileSection>
        </aside>

        {/* Main column — summary, targets, history */}
        <div className="profile-main">
          <div className="profile-main-inner">
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
                p.summary
              )}
            </ProfileSection>

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
                <div>
                  {p.education.map((edu, i) => (
                    <div key={i} className="edu-row">
                      <div className="edu-inst">{edu.institution}</div>
                      <div className="edu-degree">{edu.degree}</div>
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            {/* Experience (read-only) */}
            <ProfileSection title="Experience" editing={false} onEdit={() => {}} onSave={async () => {}} onCancel={() => {}} saving={false} hideEditButton>
              <div>
                {p.experiences.map((exp, i) => (
                  <div key={i} className="exp-row">
                    <div className="exp-role">
                      {exp.role} <span className="exp-company">at {exp.company}</span>
                    </div>
                    <div className="exp-period">{exp.period.start} – {exp.period.end}</div>
                    <ul className="exp-bullets">
                      {exp.bullets.slice(0, 3).map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ProfileSection>
          </div>
        </div>
      </div>
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
    <div className="profile-section">
      <div className="ps-head">
        <span className="ps-label">{title}</span>
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
      <div className="ps-body">{children}</div>
    </div>
  );
}

function Fields({ items }: { items: [string, string][] }) {
  return (
    <div className="profile-fields">
      {items.map(([label, value]) => (
        <Fragment key={label}>
          <span className="pf-label">{label}</span>
          <span className="pf-val">{value || '—'}</span>
        </Fragment>
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
      <div className="main" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Spinner size={14} />
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="main" style={{ padding: 40 }}>
        <ProfileSetup
          variant="embedded"
          onComplete={(p) => {
            setProfile(p);
            setHasProfile(true);
          }}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="main" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Spinner size={14} />
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Loading profile…</span>
        </div>
      </div>
    );
  }

  return (
    <ProfileView
      profile={profile}
      onUpdate={(p) => setProfile(p)}
    />
  );
}
