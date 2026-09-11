import { useState, useEffect, Fragment } from 'react';
import { IPC } from '@shared/ipc-channels';
import type { Experience, Profile } from '@shared/types';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Input from '../../components/Input';
import Spinner from '../../components/Spinner';
import ProfileSetup from './ProfileSetup';
import { ListTextarea, Textarea } from './ProfileEditForm';

// ── Profile view (read-only + inline section editing) ─────────────

type EditSection = 'identity' | 'targets' | 'summary' | 'education' | 'skills' | 'experiences' | null;

const BLANK_EXPERIENCE: Experience = {
  company: '',
  role: '',
  period: { start: '', end: '' },
  tags: [],
  bullets: [],
  narrative: '',
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ProfileView({ profile, onUpdate, collapsed, onExpand }: { profile: Profile; onUpdate: (p: Profile) => void; collapsed: boolean; onExpand: () => void }) {
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
      <div className={'view-head' + (collapsed ? ' collapsed' : '')}>
        <div>
          <div className="view-title-row">
            {collapsed && (
              <button className="expand-btn" onClick={onExpand} title="Show sidebar">
                <Icon name="sidebarToggle" size={17} />
              </button>
            )}
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
              <ListTextarea
                label="Skills (one per line)"
                items={draft.skills}
                onChange={(items) => setDraft({ ...draft, skills: items })}
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
                  <ListTextarea
                    label="Target roles (one per line)"
                    items={draft.targets.roles}
                    onChange={(items) => setDraft({ ...draft, targets: { ...draft.targets, roles: items } })}
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
                  <ListTextarea
                    label="Deal-breakers (one per line)"
                    items={draft.targets.dealBreakers}
                    onChange={(items) => setDraft({ ...draft, targets: { ...draft.targets, dealBreakers: items } })}
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
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDraft({ ...draft, education: draft.education.filter((_, j) => j !== i) })}
                        title="Remove education"
                      >
                        <Icon name="trash" size={14} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDraft({ ...draft, education: [...draft.education, { institution: '', degree: '' }] })}
                  >
                    <Icon name="plus" size={13} /> Add education
                  </Button>
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

            <ProfileSection
              title="Experience"
              editing={editing === 'experiences'}
              onEdit={() => { setDraft(profile); setEditing('experiences'); }}
              onSave={handleSave}
              onCancel={cancelEdit}
              saving={saving}
            >
              {editing === 'experiences' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {draft.experiences.map((exp, i) => {
                    function updateExp(patch: Partial<Experience>) {
                      const next = draft.experiences.map((x, j) => j === i ? { ...x, ...patch } : x);
                      setDraft({ ...draft, experiences: next });
                    }
                    return (
                      <div
                        key={i}
                        style={{
                          border: '1px solid var(--border-soft, var(--border))',
                          borderRadius: 'var(--r-md, var(--radius))',
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDraft({ ...draft, experiences: draft.experiences.filter((_, j) => j !== i) })}
                            title="Remove experience"
                          >
                            <Icon name="trash" size={14} />
                          </Button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <Input label="Company" value={exp.company} onChange={(e) => updateExp({ company: e.target.value })} />
                          <Input label="Role" value={exp.role} onChange={(e) => updateExp({ role: e.target.value })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <Input
                            label="Start"
                            value={exp.period.start}
                            onChange={(e) => updateExp({ period: { ...exp.period, start: e.target.value } })}
                          />
                          <Input
                            label="End"
                            value={exp.period.end}
                            onChange={(e) => updateExp({ period: { ...exp.period, end: e.target.value } })}
                          />
                        </div>
                        <ListTextarea
                          label="Tags (one per line)"
                          items={exp.tags}
                          onChange={(items) => updateExp({ tags: items })}
                          rows={2}
                        />
                        <ListTextarea
                          label="Bullets (one per line)"
                          items={exp.bullets}
                          onChange={(items) => updateExp({ bullets: items })}
                          rows={4}
                        />
                        <Textarea
                          label="Narrative"
                          value={exp.narrative}
                          onChange={(v) => updateExp({ narrative: v })}
                          rows={3}
                        />
                      </div>
                    );
                  })}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDraft({ ...draft, experiences: [...draft.experiences, BLANK_EXPERIENCE] })}
                  >
                    <Icon name="plus" size={13} /> Add experience
                  </Button>
                </div>
              ) : (
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
              )}
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

export default function Profile({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
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
      collapsed={collapsed}
      onExpand={onExpand}
    />
  );
}
