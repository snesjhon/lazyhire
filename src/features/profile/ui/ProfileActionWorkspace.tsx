/** @jsxImportSource @opentui/react */
import type {
  InputRenderable,
  SelectOption,
  TextareaOptions,
  TextareaRenderable,
} from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Profile } from '../../../shared/models/types.js';
import MultiStepIndicator from '../../../shared/ui/MultiStepIndicator.js';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';

export type ProfileActionView =
  | 'candidate'
  | 'education'
  | 'roles'
  | 'categories'
  | 'focuses'
  | 'salary-min'
  | 'remote'
  | 'deal-breakers';

export type ProfileActionMode = 'edit' | 'wizard';

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

const TEXTAREA_SUBMIT_KEY_BINDINGS: NonNullable<
  TextareaOptions['keyBindings']
> = [{ name: 'o', ctrl: true, action: 'submit' }];

const WIZARD_SEQUENCE: InternalView[] = [
  'edit-name',
  'edit-email',
  'edit-location',
  'edit-site',
  'edit-headline',
  'education',
  'roles',
  'categories',
  'focuses',
  'salary-min',
  'salary-max',
  'remote',
  'deal-breakers',
];

interface Props {
  theme: UiTheme;
  profile: Profile;
  width: number;
  height: number;
  initialView: ProfileActionView;
  mode?: ProfileActionMode;
  onClose: () => void;
  onSave: (profile: Profile, message: string) => void;
}

function normalizeList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatEducationEntries(education: Profile['education']): string {
  return education
    .map((entry) =>
      [entry.institution.trim(), entry.degree.trim()].filter(Boolean).join(' | '),
    )
    .filter(Boolean)
    .join('\n');
}

function parseEducationEntries(value: string): Profile['education'] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [institutionPart, ...degreeParts] = line.split('|');
      const institution = institutionPart?.trim() ?? '';
      const degree = degreeParts.join('|').trim();
      return { institution, degree };
    })
    .filter((entry) => entry.institution || entry.degree);
}

function mapInitialViewToInternal(view: ProfileActionView): InternalView {
  if (view === 'candidate') return 'edit-name';
  return view;
}

function createDraftForView(
  view: InternalView,
  profile: Profile,
  stagedMin: number | null,
): string {
  if (view === 'edit-name') return profile.candidate.name;
  if (view === 'edit-email') return profile.candidate.email;
  if (view === 'edit-location') return profile.candidate.location;
  if (view === 'edit-site') return profile.candidate.site || '';
  if (view === 'edit-headline') return profile.headline;
  if (view === 'education') return formatEducationEntries(profile.education);
  if (view === 'roles') return profile.targets.roles.join(', ');
  if (view === 'categories') return profile.targets.categories.join(', ');
  if (view === 'focuses') return profile.targets.focuses.join(', ');
  if (view === 'salary-min')
    return String(stagedMin ?? profile.targets.salaryMin);
  if (view === 'salary-max') return String(profile.targets.salaryMax);
  if (view === 'deal-breakers') return profile.targets.dealBreakers.join(', ');
  return '';
}

function labelForView(view: InternalView): string {
  if (view === 'edit-name') return 'Candidate name';
  if (view === 'edit-email') return 'Candidate email';
  if (view === 'edit-location') return 'Candidate location';
  if (view === 'edit-site') return 'Candidate site';
  if (view === 'edit-headline') return 'Headline';
  if (view === 'education')
    return 'Education & Certifications (one per line: Institution | Credential)';
  if (view === 'roles') return 'Target roles (comma-separated)';
  if (view === 'categories') return 'Target categories (comma-separated)';
  if (view === 'focuses') return 'Target focuses (comma-separated)';
  if (view === 'salary-min') return 'Minimum salary';
  if (view === 'salary-max') return 'Maximum salary';
  if (view === 'remote') return 'Remote preference';
  return 'Deal-breakers (comma-separated)';
}

function summaryForView(view: InternalView, profile: Profile): string {
  if (view === 'edit-name') return profile.candidate.name || 'Not set';
  if (view === 'edit-email') return profile.candidate.email || 'Not set';
  if (view === 'edit-location') return profile.candidate.location || 'Not set';
  if (view === 'edit-site') return profile.candidate.site || 'No site set';
  if (view === 'edit-headline') return profile.headline || 'Not set';
  if (view === 'education')
    return profile.education.length > 0
      ? `${profile.education.length} entries`
      : 'No education added';
  if (view === 'roles')
    return profile.targets.roles.join(', ') || 'No roles added';
  if (view === 'categories')
    return profile.targets.categories.join(', ') || 'No categories added';
  if (view === 'focuses')
    return profile.targets.focuses.join(', ') || 'No focuses added';
  if (view === 'salary-min')
    return `$${profile.targets.salaryMin.toLocaleString()}`;
  if (view === 'salary-max')
    return `$${profile.targets.salaryMax.toLocaleString()}`;
  if (view === 'remote') {
    return (
      REMOTE_OPTIONS.find((option) => option.value === profile.targets.remote)
        ?.name ?? 'No preference'
    );
  }
  return profile.targets.dealBreakers.join(', ') || 'No deal-breakers';
}

function applyValueToProfile(
  profile: Profile,
  view: InternalView,
  value: string,
  stagedMin: number | null,
): { profile: Profile; stagedMin: number | null } {
  const nextProfile = { ...profile };

  if (view === 'edit-name') {
    return {
      profile: {
        ...nextProfile,
        candidate: { ...nextProfile.candidate, name: value.trim() },
      },
      stagedMin,
    };
  }

  if (view === 'edit-email') {
    return {
      profile: {
        ...nextProfile,
        candidate: { ...nextProfile.candidate, email: value.trim() },
      },
      stagedMin,
    };
  }

  if (view === 'edit-location') {
    return {
      profile: {
        ...nextProfile,
        candidate: { ...nextProfile.candidate, location: value.trim() },
      },
      stagedMin,
    };
  }

  if (view === 'edit-site') {
    return {
      profile: {
        ...nextProfile,
        candidate: { ...nextProfile.candidate, site: value.trim() },
      },
      stagedMin,
    };
  }

  if (view === 'edit-headline') {
    return {
      profile: {
        ...nextProfile,
        headline: value.trim(),
      },
      stagedMin,
    };
  }

  if (view === 'education') {
    return {
      profile: {
        ...nextProfile,
        education: parseEducationEntries(value),
      },
      stagedMin,
    };
  }

  if (view === 'roles') {
    const roles = normalizeList(value);
    return {
      profile: {
        ...nextProfile,
        targets: {
          ...nextProfile.targets,
          roles: roles.length > 0 ? roles : nextProfile.targets.roles,
        },
      },
      stagedMin,
    };
  }

  if (view === 'categories') {
    return {
      profile: {
        ...nextProfile,
        targets: {
          ...nextProfile.targets,
          categories: normalizeList(value).map((item) =>
            item.toLowerCase().replace(/[\s-]+/g, '_'),
          ),
        },
      },
      stagedMin,
    };
  }

  if (view === 'focuses') {
    return {
      profile: {
        ...nextProfile,
        targets: {
          ...nextProfile.targets,
          focuses: normalizeList(value).map((item) =>
            item.toLowerCase().replace(/[\s-]+/g, '_'),
          ),
        },
      },
      stagedMin,
    };
  }

  if (view === 'salary-min') {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return {
      profile: {
        ...nextProfile,
        targets: {
          ...nextProfile.targets,
          salaryMin: Number.isNaN(parsed)
            ? nextProfile.targets.salaryMin
            : parsed,
        },
      },
      stagedMin: Number.isNaN(parsed) ? nextProfile.targets.salaryMin : parsed,
    };
  }

  if (view === 'salary-max') {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return {
      profile: {
        ...nextProfile,
        targets: {
          ...nextProfile.targets,
          salaryMin: stagedMin ?? nextProfile.targets.salaryMin,
          salaryMax: Number.isNaN(parsed)
            ? nextProfile.targets.salaryMax
            : parsed,
        },
      },
      stagedMin,
    };
  }

  return {
    profile: {
      ...nextProfile,
      targets: {
        ...nextProfile.targets,
        dealBreakers: normalizeList(value),
      },
    },
    stagedMin,
  };
}

export default function ProfileActionWorkspace({
  theme,
  profile,
  width,
  height,
  initialView,
  mode = 'edit',
  onClose,
  onSave,
}: Props) {
  const [workingProfile, setWorkingProfile] = useState(profile);
  const [view, setView] = useState<InternalView>(
    mode === 'wizard' ? mapInitialViewToInternal(initialView) : initialView,
  );
  const [draft, setDraft] = useState(() => {
    const initialInternalView: InternalView =
      mode === 'wizard' ? mapInitialViewToInternal(initialView) : initialView;
    return createDraftForView(initialInternalView, profile, null);
  });
  const [stagedMin, setStagedMin] = useState<number | null>(null);
  const inputRef = useRef<InputRenderable>(null);
  const textareaRef = useRef<TextareaRenderable>(null);

  const wizardStepIndex = WIZARD_SEQUENCE.indexOf(view);
  const wizardSteps = useMemo(
    () =>
      WIZARD_SEQUENCE.map((step) => ({
        label: labelForView(step),
        summary: summaryForView(step, workingProfile),
      })),
    [workingProfile],
  );

  useEffect(() => {
    const nextView =
      mode === 'wizard' ? mapInitialViewToInternal(initialView) : initialView;
    setWorkingProfile(profile);
    setStagedMin(null);
    setView(nextView);
    setDraft(createDraftForView(nextView, profile, null));
  }, [initialView, mode, profile]);

  useEffect(() => {
    if (view === 'remote' || view === 'candidate') return;
    if (view === 'education') {
      textareaRef.current?.focus();
      return;
    }
    inputRef.current?.focus();
  }, [view]);

  useKeyboard((key) => {
    if (key.name !== 'escape') return;

    if (mode === 'wizard') {
      if (wizardStepIndex <= 0) {
        onClose();
        return;
      }
      const previousStep = WIZARD_SEQUENCE[wizardStepIndex - 1]!;
      setView(previousStep);
      setDraft(createDraftForView(previousStep, workingProfile, stagedMin));
      return;
    }

    if (view === 'salary-max') {
      setView('salary-min');
      setDraft(String(stagedMin ?? workingProfile.targets.salaryMin));
      return;
    }

    if (
      view === 'edit-name' ||
      view === 'edit-email' ||
      view === 'edit-location' ||
      view === 'edit-site' ||
      view === 'edit-headline'
    ) {
      setView('candidate');
      setDraft(workingProfile.candidate.name);
      return;
    }

    onClose();
  });

  function saveImmediate(nextProfile: Profile, message: string) {
    setWorkingProfile(nextProfile);
    onSave(nextProfile, message);
  }

  function submit(value: string) {
    if (mode === 'wizard') {
      const result = applyValueToProfile(workingProfile, view, value, stagedMin);
      setWorkingProfile(result.profile);
      setStagedMin(result.stagedMin);

      if (wizardStepIndex === WIZARD_SEQUENCE.length - 1) {
        onSave(result.profile, 'Profile created from manual onboarding');
        return;
      }

      const nextView = WIZARD_SEQUENCE[wizardStepIndex + 1]!;
      setView(nextView);
      setDraft(createDraftForView(nextView, result.profile, result.stagedMin));
      return;
    }

    const targets = workingProfile.targets;
    const candidate = workingProfile.candidate;

    if (view === 'edit-name') {
      saveImmediate(
        {
          ...workingProfile,
          candidate: { ...candidate, name: value.trim() },
        },
        'Updated candidate name',
      );
      return;
    }

    if (view === 'edit-email') {
      saveImmediate(
        {
          ...workingProfile,
          candidate: { ...candidate, email: value.trim() },
        },
        'Updated candidate email',
      );
      return;
    }

    if (view === 'edit-location') {
      saveImmediate(
        {
          ...workingProfile,
          candidate: { ...candidate, location: value.trim() },
        },
        'Updated candidate location',
      );
      return;
    }

    if (view === 'edit-site') {
      saveImmediate(
        {
          ...workingProfile,
          candidate: { ...candidate, site: value.trim() },
        },
        'Updated candidate site',
      );
      return;
    }

    if (view === 'edit-headline') {
      saveImmediate(
        {
          ...workingProfile,
          headline: value.trim(),
        },
        'Updated candidate headline',
      );
      return;
    }

    if (view === 'education') {
      saveImmediate(
        {
          ...workingProfile,
          education: parseEducationEntries(value),
        },
        'Updated education and certifications',
      );
      return;
    }

    if (view === 'roles') {
      const roles = normalizeList(value);
      if (roles.length === 0) return;
      saveImmediate(
        {
          ...workingProfile,
          targets: { ...targets, roles },
        },
        'Updated target roles',
      );
      return;
    }

    if (view === 'categories') {
      saveImmediate(
        {
          ...workingProfile,
          targets: {
            ...targets,
            categories: normalizeList(value).map((item) =>
              item.toLowerCase().replace(/[\s-]+/g, '_'),
            ),
          },
        },
        'Updated target categories',
      );
      return;
    }

    if (view === 'focuses') {
      saveImmediate(
        {
          ...workingProfile,
          targets: {
            ...targets,
            focuses: normalizeList(value).map((item) =>
              item.toLowerCase().replace(/[\s-]+/g, '_'),
            ),
          },
        },
        'Updated target focuses',
      );
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
      saveImmediate(
        {
          ...workingProfile,
          targets: {
            ...targets,
            salaryMin: stagedMin ?? targets.salaryMin,
            salaryMax: Number.isNaN(parsed) ? targets.salaryMax : parsed,
          },
        },
        'Updated salary range',
      );
      return;
    }

    if (view === 'deal-breakers') {
      saveImmediate(
        {
          ...workingProfile,
          targets: {
            ...targets,
            dealBreakers: normalizeList(value),
          },
        },
        'Updated deal-breakers',
      );
    }
  }

  const label = labelForView(view);
  const showWizard = mode === 'wizard';
  const remoteSelectedIndex = REMOTE_OPTIONS.findIndex(
    (option) => option.value === workingProfile.targets.remote,
  );

  return (
    <box flexDirection="column" overflow="hidden">
      {showWizard ? (
        <text fg={theme.heading} marginBottom={1}>
          <strong>Profile Details</strong>
        </text>
      ) : (
        <text
          fg={theme.heading}
          content={
            view === 'remote'
              ? 'Remote Preference'
              : view === 'candidate'
                ? 'Candidate Info'
                : labelForView(view)
          }
        />
      )}

      <box marginTop={1} height={Math.max(4, height - 5)} overflow="hidden">
        {showWizard ? (
          <box flexDirection="column" width={Math.max(20, width)}>
            <MultiStepIndicator
              theme={theme}
              steps={wizardSteps}
              activeIndex={Math.max(0, wizardStepIndex)}
            />

            {view === 'remote' ? (
              <select
                height={Math.max(8, height - 9)}
                width={Math.max(20, width)}
                focused
                options={REMOTE_OPTIONS}
                selectedIndex={remoteSelectedIndex}
                showDescription
                {...selectColors(theme)}
                onSelect={(_, option) => {
                  if (!option?.value) return;
                  const nextProfile = {
                    ...workingProfile,
                    targets: {
                      ...workingProfile.targets,
                      remote: option.value as Profile['targets']['remote'],
                    },
                  };
                  setWorkingProfile(nextProfile);
                  const nextView = WIZARD_SEQUENCE[wizardStepIndex + 1];
                  if (!nextView) {
                    onSave(nextProfile, 'Profile created from manual onboarding');
                    return;
                  }
                  setView(nextView);
                  setDraft(createDraftForView(nextView, nextProfile, stagedMin));
                }}
              />
            ) : (
              <box flexDirection="column" width={Math.max(20, width)}>
                <text fg={theme.muted} content={label} />
                {view === 'education' ? (
                  <textarea
                    ref={textareaRef}
                    focused
                    height={Math.max(8, height - 11)}
                    key={`wizard-education-${workingProfile.education.length}-${view}`}
                    initialValue={draft}
                    placeholder="Institution | Credential"
                    keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
                    onContentChange={() =>
                      setDraft(textareaRef.current?.plainText ?? '')
                    }
                    onSubmit={() => submit(textareaRef.current?.plainText ?? '')}
                  />
                ) : (
                  <input
                    ref={inputRef}
                    value={draft}
                    onInput={setDraft}
                    focused
                    onSubmit={(value: unknown) => {
                      if (typeof value === 'string') submit(value);
                    }}
                  />
                )}
              </box>
            )}
          </box>
        ) : view === 'candidate' ? (
          <select
            height={Math.max(5, height - 5)}
            width={Math.max(20, width)}
            focused
            options={[
              {
                name: 'Name',
                description: workingProfile.candidate.name,
                value: 'edit-name',
              },
              {
                name: 'Email',
                description: workingProfile.candidate.email,
                value: 'edit-email',
              },
              {
                name: 'Location',
                description: workingProfile.candidate.location,
                value: 'edit-location',
              },
              {
                name: 'Site',
                description: workingProfile.candidate.site || 'No site set',
                value: 'edit-site',
              },
              {
                name: 'Headline',
                description: workingProfile.headline,
                value: 'edit-headline',
              },
            ]}
            showDescription
            {...selectColors(theme)}
            onSelect={(_, option) => {
              const nextView = option?.value as InternalView | undefined;
              if (!nextView) return;
              setView(nextView);
              setDraft(createDraftForView(nextView, workingProfile, stagedMin));
            }}
          />
        ) : view === 'remote' ? (
          <select
            height={Math.max(4, height - 5)}
            width={Math.max(20, width)}
            focused
            options={REMOTE_OPTIONS}
            selectedIndex={remoteSelectedIndex}
            showDescription
            {...selectColors(theme)}
            onSelect={(_, option) => {
              if (!option?.value) return;
              saveImmediate(
                {
                  ...workingProfile,
                  targets: {
                    ...workingProfile.targets,
                    remote: option.value as Profile['targets']['remote'],
                  },
                },
                'Updated remote preference',
              );
            }}
          />
        ) : (
          <box flexDirection="column" width={Math.max(20, width)}>
            <text fg={theme.muted} content={label} />
            {view === 'education' ? (
              <textarea
                ref={textareaRef}
                focused
                height={Math.max(6, height - 6)}
                key={`education-${initialView}-${workingProfile.education.length}-${view}`}
                initialValue={draft}
                placeholder="Institution | Credential"
                keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
                onContentChange={() =>
                  setDraft(textareaRef.current?.plainText ?? '')
                }
                onSubmit={() => submit(textareaRef.current?.plainText ?? '')}
              />
            ) : (
              <input
                ref={inputRef}
                value={draft}
                onInput={setDraft}
                focused
                onSubmit={(value: unknown) => {
                  if (typeof value === 'string') submit(value);
                }}
              />
            )}
          </box>
        )}
      </box>
      <box flexDirection="row" columnGap={1} marginTop={1}>
        <text
          fg={theme.footer}
          content={view === 'remote' || view === 'candidate' ? 'Select: enter' : 'Submit: enter'}
        />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="Go Back: esc" />
      </box>
    </box>
  );
}
