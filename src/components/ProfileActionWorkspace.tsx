/** @jsxImportSource @opentui/react */
import type { InputRenderable, SelectOption } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef, useState } from 'react';
import type { UiTheme } from '../theme.js';
import type { Profile } from '../types.js';

export type ProfileActionView =
  | 'candidate'
  | 'roles'
  | 'categories'
  | 'focuses'
  | 'salary-min'
  | 'remote'
  | 'deal-breakers';

type InternalView =
  | ProfileActionView
  | 'salary-max'
  | 'edit-name'
  | 'edit-email'
  | 'edit-location'
  | 'edit-site'
  | 'edit-headline';

const REMOTE_OPTIONS: SelectOption[] = [
  { name: 'Full Remote', description: 'Remote only', value: 'full' },
  { name: 'Hybrid', description: 'Some in-office', value: 'hybrid' },
  { name: 'Any', description: 'No preference', value: 'any' },
];

interface Props {
  theme: UiTheme;
  profile: Profile;
  width: number;
  height: number;
  initialView: ProfileActionView;
  onClose: () => void;
  onSave: (profile: Profile, message: string) => void;
}

function normalizeList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfileActionWorkspace({
  theme,
  profile,
  width,
  height,
  initialView,
  onClose,
  onSave,
}: Props) {
  const [view, setView] = useState<InternalView>(initialView);
  const [draft, setDraft] = useState('');
  const [stagedMin, setStagedMin] = useState<number | null>(null);
  const inputRef = useRef<InputRenderable>(null);

  useEffect(() => {
    setView(initialView);
    setStagedMin(null);
    if (initialView === 'candidate') setDraft(profile.candidate.name);
    if (initialView === 'roles') setDraft(profile.targets.roles.join(', '));
    if (initialView === 'categories') setDraft(profile.targets.categories.join(', '));
    if (initialView === 'focuses') setDraft(profile.targets.focuses.join(', '));
    if (initialView === 'salary-min') setDraft(String(profile.targets.salaryMin));
    if (initialView === 'deal-breakers') setDraft(profile.targets.dealBreakers.join(', '));
  }, [initialView, profile]);

  useEffect(() => {
    if (view !== 'remote' && view !== 'candidate') inputRef.current?.focus();
  }, [view]);

  useKeyboard((key) => {
    if (key.name === 'escape') onClose();
  });

  function submit(value: string) {
    const targets = profile.targets;
    const candidate = profile.candidate;

    if (view === 'edit-name') {
      onSave({ ...profile, candidate: { ...candidate, name: value.trim() } }, 'Updated candidate name');
      return;
    }

    if (view === 'edit-email') {
      onSave({ ...profile, candidate: { ...candidate, email: value.trim() } }, 'Updated candidate email');
      return;
    }

    if (view === 'edit-location') {
      onSave({ ...profile, candidate: { ...candidate, location: value.trim() } }, 'Updated candidate location');
      return;
    }

    if (view === 'edit-site') {
      onSave({ ...profile, candidate: { ...candidate, site: value.trim() } }, 'Updated candidate site');
      return;
    }

    if (view === 'edit-headline') {
      onSave({ ...profile, headline: value.trim() }, 'Updated candidate headline');
      return;
    }

    if (view === 'roles') {
      const roles = normalizeList(value);
      if (roles.length === 0) return;
      onSave({ ...profile, targets: { ...targets, roles } }, 'Updated target roles');
      return;
    }

    if (view === 'categories') {
      const categories = normalizeList(value).map((item) =>
        item.toLowerCase().replace(/[\s-]+/g, '_'),
      );
      onSave({ ...profile, targets: { ...targets, categories } }, 'Updated target categories');
      return;
    }

    if (view === 'focuses') {
      const focuses = normalizeList(value).map((item) =>
        item.toLowerCase().replace(/[\s-]+/g, '_'),
      );
      onSave({ ...profile, targets: { ...targets, focuses } }, 'Updated target focuses');
      return;
    }

    if (view === 'salary-min') {
      const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
      setStagedMin(Number.isNaN(parsed) ? targets.salaryMin : parsed);
      setDraft(String(targets.salaryMax));
      setView('salary-max');
      return;
    }

    if (view === 'salary-max') {
      const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
      onSave({
        ...profile,
        targets: {
          ...targets,
          salaryMin: stagedMin ?? targets.salaryMin,
          salaryMax: Number.isNaN(parsed) ? targets.salaryMax : parsed,
        },
      }, 'Updated salary range');
      return;
    }

    if (view === 'deal-breakers') {
      const dealBreakers = normalizeList(value);
      onSave({ ...profile, targets: { ...targets, dealBreakers } }, 'Updated deal-breakers');
    }
  }

  const label =
    view === 'edit-name'
      ? 'Candidate name'
      : view === 'edit-email'
        ? 'Candidate email'
        : view === 'edit-location'
          ? 'Candidate location'
          : view === 'edit-site'
            ? 'Candidate site'
            : view === 'edit-headline'
              ? 'Headline'
      : view === 'roles'
      ? 'Target roles (comma-separated)'
      : view === 'categories'
        ? 'Target categories (comma-separated)'
        : view === 'focuses'
          ? 'Target focuses (comma-separated)'
          : view === 'salary-min'
            ? 'Minimum salary'
            : view === 'salary-max'
              ? 'Maximum salary'
              : 'Deal-breakers (comma-separated)';

  return (
    <box flexDirection="column" overflow="hidden">
      <text
        fg={theme.muted}
        content={view === 'remote' ? 'Select remote preference. esc=close' : 'Enter to save, esc=close'}
      />

      <box marginTop={1} height={Math.max(4, height - 3)} overflow="hidden">
        {view === 'candidate' ? (
          <select
            height={Math.max(5, height - 3)}
            width={Math.max(20, width)}
            focused
            options={[
              {
                name: 'Name',
                description: profile.candidate.name,
                value: 'edit-name',
              },
              {
                name: 'Email',
                description: profile.candidate.email,
                value: 'edit-email',
              },
              {
                name: 'Location',
                description: profile.candidate.location,
                value: 'edit-location',
              },
              {
                name: 'Site',
                description: profile.candidate.site || 'No site set',
                value: 'edit-site',
              },
              {
                name: 'Headline',
                description: profile.headline,
                value: 'edit-headline',
              },
            ]}
            showDescription
            backgroundColor={theme.transparent}
            focusedBackgroundColor={theme.transparent}
            selectedBackgroundColor={theme.transparent}
            selectedTextColor={theme.brand}
            onSelect={(_, option) => {
              const nextView = option?.value as InternalView | undefined;
              if (!nextView) return;
              setView(nextView);
              if (nextView === 'edit-name') setDraft(profile.candidate.name);
              if (nextView === 'edit-email') setDraft(profile.candidate.email);
              if (nextView === 'edit-location') setDraft(profile.candidate.location);
              if (nextView === 'edit-site') setDraft(profile.candidate.site || '');
              if (nextView === 'edit-headline') setDraft(profile.headline);
            }}
          />
        ) : view === 'remote' ? (
          <select
            height={Math.max(4, height - 3)}
            width={Math.max(20, width)}
            focused
            options={REMOTE_OPTIONS}
            selectedIndex={REMOTE_OPTIONS.findIndex((option) => option.value === profile.targets.remote)}
            showDescription
            backgroundColor={theme.transparent}
            focusedBackgroundColor={theme.transparent}
            selectedBackgroundColor={theme.transparent}
            selectedTextColor={theme.brand}
            onSelect={(_, option) => {
              if (!option?.value) return;
              onSave({
                ...profile,
                targets: {
                  ...profile.targets,
                  remote: option.value as Profile['targets']['remote'],
                },
              }, 'Updated remote preference');
            }}
          />
        ) : (
          <box flexDirection="column" width={Math.max(20, width)}>
            <text fg={theme.muted} content={label} />
            <input
              ref={inputRef}
              value={draft}
              onInput={setDraft}
              focused
              onSubmit={(value: unknown) => {
                if (typeof value === 'string') submit(value);
              }}
            />
          </box>
        )}
      </box>
    </box>
  );
}
