/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import type { InputRenderable, SelectOption } from '@opentui/core';
import { useEffect, useRef, useState } from 'react';
import { loadProfile, saveProfile } from '../profile.js';
import type { Profile } from '../types.js';

type Section = 'none' | 'roles' | 'salary-min' | 'salary-max' | 'remote' | 'deal-breakers';

const TRANSPARENT = 'transparent';

const REMOTE_OPTIONS: SelectOption[] = [
  { name: 'Full Remote', description: 'remote only', value: 'full' },
  { name: 'Hybrid', description: 'some in-office', value: 'hybrid' },
  { name: 'Any', description: 'no preference', value: 'any' },
];

const MENU_OPTIONS: SelectOption[] = [
  { name: 'Edit target roles', description: 'Comma-separated list of role titles', value: 'roles' },
  { name: 'Edit salary range', description: 'Set minimum and maximum', value: 'salary-min' },
  { name: 'Edit remote preference', description: 'full / hybrid / any', value: 'remote' },
  { name: 'Edit deal-breakers', description: 'Comma-separated list', value: 'deal-breakers' },
];

interface Props {
  appWidth: number;
  appHeight: number;
}

export default function ProfileScreen({ appWidth, appHeight }: Props) {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [section, setSection] = useState<Section>('none');
  const [draft, setDraft] = useState('');
  const [stagedMin, setStagedMin] = useState<number | null>(null);
  const inputRef = useRef<InputRenderable>(null);

  const contentHeight = Math.max(10, appHeight - 10);
  const panelWidth = Math.max(52, Math.floor(appWidth * 0.55));

  useEffect(() => {
    if (section !== 'none' && section !== 'remote') {
      inputRef.current?.focus();
    }
  }, [section]);

  useKeyboard((key) => {
    if (key.name === 'escape' && section !== 'none') {
      setSection('none');
      setStagedMin(null);
    }
  });

  function persist(next: Profile) {
    saveProfile(next);
    setProfile(next);
  }

  function openSection(s: Section) {
    const { targets } = profile;
    if (s === 'roles') setDraft(targets.roles.join(', '));
    else if (s === 'salary-min') setDraft(String(targets.salaryMin));
    else if (s === 'deal-breakers') setDraft(targets.dealBreakers.join(', '));
    setSection(s);
  }

  function submitDraft(value: string) {
    const { targets } = profile;
    if (section === 'roles') {
      const roles = value.split(',').map((r) => r.trim()).filter(Boolean);
      if (roles.length > 0) persist({ ...profile, targets: { ...targets, roles } });
      setSection('none');
    } else if (section === 'salary-min') {
      const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
      setStagedMin(Number.isNaN(parsed) ? targets.salaryMin : parsed);
      setDraft(String(targets.salaryMax));
      setSection('salary-max');
    } else if (section === 'salary-max') {
      const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
      persist({
        ...profile,
        targets: {
          ...targets,
          salaryMin: stagedMin ?? targets.salaryMin,
          salaryMax: Number.isNaN(parsed) ? targets.salaryMax : parsed,
        },
      });
      setStagedMin(null);
      setSection('none');
    } else if (section === 'deal-breakers') {
      persist({
        ...profile,
        targets: {
          ...targets,
          dealBreakers: value.split(',').map((d) => d.trim()).filter(Boolean),
        },
      });
      setSection('none');
    }
  }

  const { targets, candidate, headline } = profile;

  const infoLines = [
    `Roles:         ${targets.roles.join(', ') || 'none'}`,
    `Salary:        $${targets.salaryMin.toLocaleString()} – $${targets.salaryMax.toLocaleString()}`,
    `Remote:        ${targets.remote}`,
    `Deal-breakers: ${targets.dealBreakers.join(', ') || 'none'}`,
  ].join('\n');

  const inputLabel =
    section === 'salary-min'
      ? 'Minimum salary'
      : section === 'salary-max'
        ? 'Maximum salary'
        : section === 'roles'
          ? 'Target roles (comma-separated)'
          : 'Deal-breakers (comma-separated)';

  return (
    <box flexDirection="column" width={appWidth} paddingX={1}>
      {/* Candidate info */}
      <box
        border
        borderColor="#868e96"
        padding={1}
        marginTop={1}
        width={panelWidth}
        flexDirection="column"
      >
        <text fg="#ffffff" content={candidate.name} />
        <text fg="#868e96" content={headline} />
      </box>

      {/* Targets summary */}
      <box
        title="Targets"
        border
        borderColor="#868e96"
        padding={1}
        marginTop={1}
        width={panelWidth}
        flexDirection="column"
      >
        <text fg="#868e96" content={infoLines} />
      </box>

      {/* Edit menu */}
      {section === 'none' && (
        <box
          title="Edit Profile"
          border
          borderColor="#4cc9f0"
          padding={1}
          marginTop={1}
          width={panelWidth}
          height={Math.min(8, contentHeight - 14)}
        >
          <select
            height={4}
            width="100%"
            options={MENU_OPTIONS}
            showDescription
            focused
            backgroundColor={TRANSPARENT}
            focusedBackgroundColor={TRANSPARENT}
            selectedBackgroundColor={TRANSPARENT}
            selectedTextColor="#4cc9f0"
            onSelect={(_, option) =>
              option?.value && openSection(option.value as Section)
            }
          />
        </box>
      )}

      {/* Edit overlay */}
      {section !== 'none' && (
        <box
          title={section === 'remote' ? 'Remote Preference' : inputLabel}
          border
          borderColor="#f5c542"
          padding={1}
          marginTop={1}
          width={panelWidth}
          height={section === 'remote' ? 7 : 5}
          flexDirection="column"
        >
          {section === 'remote' ? (
            <select
              height={5}
              focused
              options={REMOTE_OPTIONS}
              selectedIndex={REMOTE_OPTIONS.findIndex((o) => o.value === targets.remote)}
              showDescription
              backgroundColor={TRANSPARENT}
              focusedBackgroundColor={TRANSPARENT}
              selectedBackgroundColor={TRANSPARENT}
              selectedTextColor="#4cc9f0"
              onSelect={(_, option) => {
                if (option?.value) {
                  persist({
                    ...profile,
                    targets: {
                      ...targets,
                      remote: option.value as Profile['targets']['remote'],
                    },
                  });
                }
                setSection('none');
              }}
            />
          ) : (
            <box flexDirection="column">
              <text fg="#868e96" content={inputLabel} />
              <input
                ref={inputRef}
                value={draft}
                onInput={setDraft}
                focused
                onSubmit={(value: unknown) => {
                  if (typeof value === 'string') submitDraft(value);
                }}
              />
            </box>
          )}
        </box>
      )}

      <box flexDirection="row" columnGap={1} position="absolute" bottom={0}>
        <text fg="#7aa2f7" content="enter=select" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="esc=close" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="1-4=tabs" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="q=quit" />
      </box>
    </box>
  );
}
