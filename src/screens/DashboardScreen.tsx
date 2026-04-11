/** @jsxImportSource @opentui/react */
import { SyntaxStyle } from '@opentui/core';
import { useEffect, useMemo, useState } from 'react';
import type { FocusTarget, Overlay } from '../ui.js';
import { clip, scoreDisplay } from '../lib/utils.js';
import type { UiTheme } from '../theme.js';
import type { AnswerEntry, Job, JobStatus, Profile } from '../types.js';
import AnswerWorkspace from '../components/AnswerWorkspace.js';
import DashboardOverlay from '../components/DashboardOverlay.js';
import JobActionWorkspace, {
  type JobActionView,
} from '../components/JobActionWorkspace.js';
import ProfileActionWorkspace, {
  type ProfileActionView,
} from '../components/ProfileActionWorkspace.js';

const syntaxStyle = SyntaxStyle.fromStyles({
  'markup.heading.1': { bold: true },
  'markup.heading.2': { bold: true },
  'markup.strong': { bold: true },
});

const LEFT_PANEL_ORDER: FocusTarget[] = [
  'status',
  'jobs',
  'profile',
  'answers',
];

type LibraryTab = 'profile' | 'answers';

const PROFILE_OPTIONS: Array<{
  name: string;
  description: string;
  value: ProfileActionView;
}> = [
  {
    name: 'Candidate',
    description: 'Identity and contact details',
    value: 'candidate',
  },
  {
    name: 'Target Roles',
    description: 'Comma-separated role titles',
    value: 'roles',
  },
  {
    name: 'Categories',
    description: 'Broad role families',
    value: 'categories',
  },
  {
    name: 'Focuses',
    description: 'Narrower specializations',
    value: 'focuses',
  },
  {
    name: 'Salary Range',
    description: 'Minimum and maximum target comp',
    value: 'salary-min',
  },
  {
    name: 'Remote Preference',
    description: 'Full remote, hybrid, or any',
    value: 'remote',
  },
  {
    name: 'Deal-Breakers',
    description: 'Things to avoid',
    value: 'deal-breakers',
  },
];

function jobDetailMarkdown(job: Job): string {
  const classification = [job.category, job.focus].filter(Boolean).join(' / ');
  const rows = [
    `**Job:** #${job.id}`,
    `**Company:** ${job.company || 'Unknown Company'}`,
    `**Role:** ${job.role || 'Untitled Role'}`,
    `**Status:** ${job.status}`,
    `**Score:** ${scoreDisplay(job.score)}`,
    classification ? `**Category / Focus:** ${classification}` : '',
    job.url ? `**URL:** ${job.url}` : '',
    job.pdfPath ? `**Generated CV:** ${job.pdfPath}` : '',
    job.coverLetterPdfPath
      ? `**Generated Cover Letter:** ${job.coverLetterPdfPath}`
      : '',
    job.notes ? `**Notes:** ${job.notes}` : '',
  ].filter(Boolean);

  return [
    rows.join('\n'),
    job.jdSummary ||
      job.jd ||
      '## Job Description Summary\nNo job description saved.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function statusDetailMarkdown(
  filter: Props['filter'],
  filters: Props['filters'],
  jobs: Job[],
): string {
  const counts = filters.map((item) => {
    const count = jobs.filter((job) => {
      if (item === 'Queue') {
        return job.status === 'Pending' || job.status === 'Evaluated';
      }
      return job.status === item;
    }).length;
    return `- ${item}: ${count}`;
  });

  return [
    '## Pipeline Status',
    `**Active filter:** ${filter}`,
    `**Total jobs:** ${jobs.length}`,
    '',
    '### Buckets',
    counts.join('\n'),
    '',
    '### Keys',
    '- `0`: focus the main detail view',
    '- `1-3`: jump to left panels',
    '- `Tab` / `Shift+Tab`: cycle status, jobs, and config',
    '- `[` / `]`: cycle the active panel filter or config tab',
    '- `Enter` on Jobs or Config > Profile: open an action workspace in the detail pane',
  ].join('\n');
}

function profileDetailMarkdown(
  profile: Profile,
  activeOption: (typeof PROFILE_OPTIONS)[number] | null,
): string {
  if (!activeOption) return '## Profile\nSelect a profile item.';

  if (activeOption.value === 'candidate') {
    return [
      '## Candidate',
      `**Name:** ${profile.candidate.name}`,
      `**Headline:** ${profile.headline}`,
      `**Email:** ${profile.candidate.email}`,
      `**Location:** ${profile.candidate.location}`,
      profile.candidate.site ? `**Site:** ${profile.candidate.site}` : '',
      '',
      'This section controls the candidate identity used across generated answers and application materials.',
      '',
      'Press `Enter` in the Profile panel to edit name, email, location, site, or headline.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (activeOption.value === 'roles') {
    return [
      '## Target Roles',
      `**Current Value:** ${profile.targets.roles.join(', ') || 'none'}`,
      '',
      'These titles define the roles you want to be matched against during discovery and evaluation.',
      '',
      'Press `Enter` to update the comma-separated role list.',
    ].join('\n\n');
  }

  if (activeOption.value === 'categories') {
    return [
      '## Categories',
      `**Current Value:** ${profile.targets.categories.join(', ') || 'none'}`,
      '',
      'Broad job families used to classify roles and improve ranking.',
      '',
      'Press `Enter` to update the preferred categories.',
    ].join('\n\n');
  }

  if (activeOption.value === 'focuses') {
    return [
      '## Focuses',
      `**Current Value:** ${profile.targets.focuses.join(', ') || 'none'}`,
      '',
      'Narrower specialties that indicate the strongest fit areas within a category.',
      '',
      'Press `Enter` to update the preferred focuses.',
    ].join('\n\n');
  }

  if (activeOption.value === 'salary-min') {
    return [
      '## Salary Range',
      `**Current Value:** $${profile.targets.salaryMin.toLocaleString()} - $${profile.targets.salaryMax.toLocaleString()}`,
      '',
      'This compensation band is used when evaluating whether a role meets your expectations.',
      '',
      'Press `Enter` to update the minimum and maximum range.',
    ].join('\n\n');
  }

  if (activeOption.value === 'remote') {
    return [
      '## Remote Preference',
      `**Current Value:** ${profile.targets.remote}`,
      '',
      'This setting influences search relevance and job evaluation.',
      '',
      'Press `Enter` to switch between full remote, hybrid, or any.',
    ].join('\n\n');
  }

  return [
    '## Deal-Breakers',
    `**Current Value:** ${profile.targets.dealBreakers.join(', ') || 'none'}`,
    '',
    'These constraints should lower confidence in roles that do not match your requirements.',
    '',
    'Press `Enter` to update the deal-breaker list.',
  ].join('\n\n');
}

function answerDetailMarkdown(answer: AnswerEntry | null): string {
  if (!answer) return '## Answers\nNo saved answers yet.';

  return [
    `## ${answer.question}`,
    `**Category:** ${answer.category}`,
    `**Company:** ${answer.company || 'General'}`,
    `**Role:** ${answer.role || 'General'}`,
    `**Tone:** ${answer.tone || 'none'}`,
    `**Added:** ${answer.added}`,
    `**Revised:** ${answer.revised}`,
    answer.context ? `**Context:** ${answer.context}` : '',
    '',
    answer.answer,
  ]
    .filter(Boolean)
    .join('\n\n');
}

interface Props {
  theme: UiTheme;
  contentHeight: number;
  queueWidth: number;
  detailWidth: number;
  filter:
    | 'Queue'
    | 'Applied'
    | 'Interview'
    | 'Offer'
    | 'Rejected'
    | 'Discarded';
  filters: ReadonlyArray<
    'Queue' | 'Applied' | 'Interview' | 'Offer' | 'Rejected' | 'Discarded'
  >;
  jobs: Job[];
  filteredJobs: Job[];
  answers: AnswerEntry[];
  profile: Profile;
  selectedJob: Job | null;
  selectedIndex: number;
  focus: FocusTarget;
  detailSource: 'status' | 'jobs' | 'profile' | 'answers';
  overlay: Overlay;
  isAnswering: boolean;
  jobActionView: JobActionView | null;
  profileActionView: ProfileActionView | null;
  onFilterChange: (filter: Props['filter']) => void;
  onCycleFilter: (direction: -1 | 1) => void;
  onJobSelect: (jobId: string) => void;
  onOpenActions: () => void;
  onCloseAnswer: () => void;
  onAnswerSaved: (message: string) => void;
  onCloseJobActions: () => void;
  onStartAnswer: () => void;
  onEvaluateJob: () => void;
  onOpenJobLink: () => void;
  onOpenGeneratedCv: () => void;
  onOpenGeneratedCoverLetter: () => void;
  onSaveMetadata: (
    patch: Partial<Pick<Job, 'company' | 'role' | 'url' | 'notes'>>,
  ) => void;
  onSaveEditJd: (jd: string) => void;
  onSaveStatus: (status: JobStatus) => void;
  onDeleteJob: () => void;
  onGenerateCv: (guidance: string) => Promise<Job>;
  onGenerateCoverLetter: (guidance: string) => Promise<Job>;
  onOpenProfileActions: (view: ProfileActionView) => void;
  onCloseProfileActions: () => void;
  onSaveProfile: (profile: Profile, message: string) => void;
  onAddUrl: (url: string) => Promise<void>;
  onAddJd: (jd: string) => Promise<void>;
  onOverlayChange: (overlay: Overlay) => void;
  onCloseOverlay: () => void;
}

export default function DashboardScreen({
  theme,
  contentHeight,
  queueWidth,
  detailWidth,
  filter,
  filters,
  jobs,
  filteredJobs,
  answers,
  profile,
  selectedJob,
  selectedIndex,
  focus,
  detailSource,
  overlay,
  isAnswering,
  jobActionView,
  profileActionView,
  onFilterChange,
  onCycleFilter,
  onJobSelect,
  onOpenActions,
  onCloseAnswer,
  onAnswerSaved,
  onCloseJobActions,
  onStartAnswer,
  onEvaluateJob,
  onOpenJobLink,
  onOpenGeneratedCv,
  onOpenGeneratedCoverLetter,
  onSaveMetadata,
  onSaveEditJd,
  onSaveStatus,
  onDeleteJob,
  onGenerateCv,
  onGenerateCoverLetter,
  onOpenProfileActions,
  onCloseProfileActions,
  onSaveProfile,
  onAddUrl,
  onAddJd,
  onOverlayChange,
  onCloseOverlay,
}: Props) {
  const [profileIndex, setProfileIndex] = useState(0);
  const [answerIndex, setAnswerIndex] = useState(0);

  const workspaceVisible =
    overlay !== 'none' ||
    Boolean(selectedJob && (isAnswering || jobActionView)) ||
    Boolean(profileActionView);
  const detailHeight = Math.max(8, contentHeight);
  const statusHeight = 5;
  const libraryHeight = 12;
  const jobsHeight = Math.max(12, contentHeight - statusHeight - libraryHeight);

  const companyWidth = Math.max(10, Math.floor((queueWidth - 12) * 0.34));
  const roleWidth = Math.max(12, queueWidth - companyWidth - 18);

  const jobOptions = filteredJobs.map((job) => ({
    name: `${clip(job.company || 'Unknown', companyWidth).padEnd(companyWidth)} ${clip(job.role || 'Untitled', roleWidth).padEnd(roleWidth)} ${scoreDisplay(job.score).padStart(4)}`,
    description: `${job.status} · ${job.category ?? 'uncategorized'}${job.focus ? ` / ${job.focus}` : ''}`,
    value: job.id,
  }));

  const answerOptions = answers
    .slice()
    .reverse()
    .map((answer) => ({
      name: clip(answer.question, Math.max(14, queueWidth - 12)),
      description: `${answer.category} · ${answer.company || 'General'} · ${answer.revised}`,
      value: answer.id,
    }));

  useEffect(() => {
    if (profileIndex >= PROFILE_OPTIONS.length) setProfileIndex(0);
  }, [profileIndex]);

  useEffect(() => {
    if (answerIndex >= answerOptions.length) setAnswerIndex(0);
  }, [answerIndex, answerOptions.length]);

  const selectedProfileOption =
    PROFILE_OPTIONS[profileIndex] ?? PROFILE_OPTIONS[0] ?? null;
  const selectedAnswer = answers.slice().reverse()[answerIndex] ?? null;
  const activePanel = LEFT_PANEL_ORDER.includes(focus) ? focus : detailSource;
  const activeLibraryTab: LibraryTab =
    activePanel === 'answers' ? 'answers' : 'profile';
  const libraryOptions =
    activeLibraryTab === 'profile' ? PROFILE_OPTIONS : answerOptions;
  const librarySelectedIndex =
    activeLibraryTab === 'profile' ? profileIndex : answerIndex;
  const libraryListHeight = Math.max(3, libraryHeight - 5);
  const jobsFocused =
    focus === 'jobs' && overlay === 'none' && !workspaceVisible;
  const libraryFocused =
    (focus === 'profile' || focus === 'answers') &&
    overlay === 'none' &&
    !workspaceVisible;

  const detailTitle =
    overlay !== 'none'
      ? overlay === 'add'
        ? 'Add Job'
        : overlay === 'add-url'
          ? 'Paste Job Link'
          : 'Paste Job Description'
      : selectedJob && isAnswering
        ? `Answer #${selectedJob.id}`
        : selectedJob && jobActionView
          ? `Job Actions #${selectedJob.id}`
          : profileActionView
            ? 'Profile Actions'
            : activePanel === 'status'
              ? 'Status'
              : activePanel === 'profile'
                ? 'Profile'
                : activePanel === 'answers'
                  ? 'Answer'
                  : selectedJob
                    ? `Job #${selectedJob.id}`
                    : 'Detail';

  const detailContent =
    activePanel === 'status'
      ? statusDetailMarkdown(filter, filters, jobs)
      : activePanel === 'profile'
        ? profileDetailMarkdown(profile, selectedProfileOption)
        : activePanel === 'answers'
          ? answerDetailMarkdown(selectedAnswer)
          : selectedJob
            ? jobDetailMarkdown(selectedJob)
            : '## Job Detail\nSelect a job to inspect it.';

  return (
    <>
      <box flexDirection="row" columnGap={1} height={contentHeight}>
        <box width={queueWidth} flexDirection="column" overflow="hidden">
          <box
            title="[1] Status"
            border
            borderColor={focus === 'status' ? theme.borderActive : theme.border}
            borderStyle="rounded"
            paddingX={1}
            overflow="hidden"
          >
            <box flexDirection="column">
              <text fg={theme.heading} content={`${jobs.length} jobs`} />
            </box>
          </box>

          <box
            title="[2] Jobs"
            border
            borderColor={focus === 'jobs' ? theme.borderActive : theme.border}
            paddingX={1}
            height={jobsHeight + 2}
            overflow="hidden"
            flexDirection="column"
          >
            <box
              flexDirection="row"
              columnGap={1}
              paddingX={1}
              marginBottom={2}
            >
              {filters.map((item) => (
                <text
                  key={item}
                  fg={
                    item === filter && jobsFocused ? theme.brand : theme.muted
                  }
                >
                  {item === filter ? <u><strong>{item}</strong></u> : item}
                </text>
              ))}
            </box>
            {jobOptions.length > 0 ? (
              <select
                height={jobsHeight - 1}
                width="100%"
                options={jobOptions}
                selectedIndex={selectedIndex}
                showDescription
                showScrollIndicator
                itemSpacing={1}
                backgroundColor={theme.transparent}
                focusedBackgroundColor={theme.transparent}
                selectedBackgroundColor={theme.transparent}
                selectedTextColor={jobsFocused ? theme.brand : theme.text}
                selectedDescriptionColor={theme.muted}
                focused={jobsFocused}
                onChange={(_, option) => {
                  if (option?.value) onJobSelect(String(option.value));
                }}
                onSelect={(_, option) => {
                  if (option?.value) onJobSelect(String(option.value));
                  onOpenActions();
                }}
              />
            ) : (
              <text
                fg={theme.muted}
                content="No jobs yet. Press a to add one."
              />
            )}
          </box>

          <box
            title="[3] User"
            border
            borderColor={
              focus === 'profile' || focus === 'answers'
                ? theme.borderActive
                : theme.border
            }
            paddingX={1}
            height={libraryHeight}
            overflow="hidden"
            flexDirection="column"
          >
            <box
              flexDirection="row"
              columnGap={1}
              paddingX={1}
              marginBottom={1}
            >
              <text
                fg={
                  activeLibraryTab === 'profile' && libraryFocused
                    ? theme.brand
                    : theme.muted
                }
              >
                {activeLibraryTab === 'profile' ? (
                  <u><strong>Profile</strong></u>
                ) : (
                  'Profile'
                )}
              </text>

              <text
                fg={
                  activeLibraryTab === 'answers' && libraryFocused
                    ? theme.brand
                    : theme.muted
                }
              >
                {activeLibraryTab === 'answers' ? (
                  <u><strong>Answers</strong></u>
                ) : (
                  'Answers'
                )}
              </text>
            </box>
            {activeLibraryTab === 'answers' && answerOptions.length === 0 ? (
              <text fg={theme.muted} content="No saved answers yet." />
            ) : (
              <select
                height={libraryListHeight}
                width="100%"
                options={libraryOptions}
                selectedIndex={librarySelectedIndex}
                showDescription={false}
                backgroundColor={theme.transparent}
                focusedBackgroundColor={theme.transparent}
                selectedBackgroundColor={theme.transparent}
                selectedTextColor={libraryFocused ? theme.brand : theme.text}
                selectedDescriptionColor={theme.muted}
                // itemSpacing={1}
                focused={libraryFocused}
                onChange={(_, option) => {
                  if (activeLibraryTab === 'profile') {
                    const nextIndex = PROFILE_OPTIONS.findIndex(
                      (item) => item.value === option?.value,
                    );
                    if (nextIndex >= 0) setProfileIndex(nextIndex);
                    return;
                  }
                  const nextIndex = answerOptions.findIndex(
                    (item) => item.value === option?.value,
                  );
                  if (nextIndex >= 0) setAnswerIndex(nextIndex);
                }}
                onSelect={(_, option) => {
                  if (activeLibraryTab === 'profile') {
                    const nextIndex = PROFILE_OPTIONS.findIndex(
                      (item) => item.value === option?.value,
                    );
                    if (nextIndex >= 0) {
                      setProfileIndex(nextIndex);
                      onOpenProfileActions(PROFILE_OPTIONS[nextIndex]!.value);
                    }
                    return;
                  }
                  const nextIndex = answerOptions.findIndex(
                    (item) => item.value === option?.value,
                  );
                  if (nextIndex >= 0) setAnswerIndex(nextIndex);
                }}
              />
            )}
          </box>
        </box>

        <box width={detailWidth} flexDirection="column" overflow="hidden">
          <box
            title={`[0] ${detailTitle}`}
            border
            borderColor={
              focus === 'detail' || workspaceVisible
                ? theme.borderActive
                : theme.border
            }
            padding={1}
            height={detailHeight}
            overflow="hidden"
          >
            <scrollbox
              height={detailHeight - 2}
              width="100%"
              scrollX={false}
              scrollY
              focused={focus === 'detail' && !workspaceVisible}
              rootOptions={{ overflow: 'hidden' }}
              wrapperOptions={{ overflow: 'hidden' }}
              viewportOptions={{ overflow: 'hidden' }}
              contentOptions={{ overflow: 'hidden' }}
              scrollbarOptions={{ showArrows: true }}
            >
              {overlay !== 'none' ? (
                <DashboardOverlay
                  theme={theme}
                  overlay={overlay}
                  width={Math.max(20, detailWidth - 6)}
                  height={detailHeight - 2}
                  onAddUrl={onAddUrl}
                  onAddJd={onAddJd}
                  onOverlayChange={onOverlayChange}
                  onClose={onCloseOverlay}
                />
              ) : selectedJob && isAnswering ? (
                <AnswerWorkspace
                  theme={theme}
                  job={selectedJob}
                  width={Math.max(20, detailWidth - 6)}
                  height={detailHeight - 2}
                  onClose={onCloseAnswer}
                  onSaved={onAnswerSaved}
                />
              ) : selectedJob && jobActionView ? (
                <JobActionWorkspace
                  theme={theme}
                  job={selectedJob}
                  width={Math.max(20, detailWidth - 6)}
                  height={detailHeight - 2}
                  initialView={jobActionView}
                  onClose={onCloseJobActions}
                  onStartAnswer={onStartAnswer}
                  onEvaluate={onEvaluateJob}
                  onOpenLink={onOpenJobLink}
                  onOpenCv={onOpenGeneratedCv}
                  onOpenCoverLetter={onOpenGeneratedCoverLetter}
                  onSaveMetadata={onSaveMetadata}
                  onSaveEditJd={onSaveEditJd}
                  onSaveStatus={onSaveStatus}
                  onDelete={onDeleteJob}
                  onGenerateCv={onGenerateCv}
                  onGenerateCoverLetter={onGenerateCoverLetter}
                />
              ) : profileActionView ? (
                <ProfileActionWorkspace
                  theme={theme}
                  profile={profile}
                  width={Math.max(20, detailWidth - 6)}
                  height={detailHeight - 2}
                  initialView={profileActionView}
                  onClose={onCloseProfileActions}
                  onSave={onSaveProfile}
                />
              ) : (
                <box
                  flexDirection="column"
                  width={Math.max(20, detailWidth - 6)}
                >
                  <markdown
                    width={Math.max(20, detailWidth - 6)}
                    content={detailContent}
                    syntaxStyle={syntaxStyle}
                    conceal
                  />
                </box>
              )}
            </scrollbox>
          </box>
        </box>
      </box>

      <box
        flexDirection="row"
        columnGap={1}
        flexWrap="wrap"
        position="absolute"
        bottom={0}
      >
        <text fg={theme.footer} content="Actions: <enter>" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="Move: j / k" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="Add Job: a" />
      </box>
    </>
  );
}
