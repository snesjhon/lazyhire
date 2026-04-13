/** @jsxImportSource @opentui/react */
import { useEffect, useState } from 'react';
import type { FocusTarget, Overlay } from '../../../shared/ui/state.js';
import { clip, scoreDisplay } from '../../../shared/lib/utils.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { AnswerEntry, Job, JobStatus, Profile } from '../../../shared/models/types.js';
import {
  DEFAULT_CV_BULLET_WORD_RANGE,
  DEFAULT_CV_TEXT_SIZE_SCALE,
  type CvBulletWordRange,
  type CvTextSizeScale,
} from '../services/generate.js';
import {
  DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT,
  type CoverLetterTotalWordCount,
} from '../services/cover-letter.js';
import AnswerWorkspace from '../../answers/ui/AnswerWorkspace.js';
import type { AnswerDraft } from '../../answers/ui/AnswerWorkspace.js';
import DashboardOverlay from './DashboardOverlay.js';
import JobActionWorkspace, {
  type GenerateCoverLetterDraft,
  type GenerateCvDraft,
  type JobActionView,
} from './JobActionWorkspace.js';
import ProfileActionWorkspace, {
  type ProfileActionView,
} from '../../profile/ui/ProfileActionWorkspace.js';
import InitWorkspace from '../../init/ui/InitWorkspace.js';

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
    name: 'Education & Certifications',
    description: 'ATS-safe resume entries',
    value: 'education',
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

function DetailHeading({ theme, children }: { theme: UiTheme; children: string }) {
  return (
    <text fg={theme.heading} marginBottom={1}>
      <strong>{children}</strong>
    </text>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <text>
      <strong>{label}:</strong> {value}
    </text>
  );
}

function DetailParagraph({
  theme,
  content,
  muted = false,
  marginBottom = 1,
}: {
  theme: UiTheme;
  content: string;
  muted?: boolean;
  marginBottom?: number;
}) {
  return (
    <text fg={muted ? theme.muted : theme.text} content={content} marginBottom={marginBottom} />
  );
}

function DetailList({
  theme,
  items,
  marginBottom = 1,
}: {
  theme: UiTheme;
  items: string[];
  marginBottom?: number;
}) {
  return (
    <box flexDirection="column" marginBottom={marginBottom}>
      {items.map((item, index) => (
        <text key={`${item}-${index}`} fg={theme.text} content={`- ${item}`} />
      ))}
    </box>
  );
}

function DetailFields({
  fields,
  marginBottom = 1,
}: {
  fields: Array<{ label: string; value: string }>;
  marginBottom?: number;
}) {
  return (
    <box flexDirection="column" marginBottom={marginBottom}>
      {fields.map((field) => (
        <DetailField key={field.label} label={field.label} value={field.value} />
      ))}
    </box>
  );
}

function renderJobDetail(theme: UiTheme, job: Job) {
  const classification = [job.category, job.focus].filter(Boolean).join(' / ');
  const fields = [
    { label: 'Job', value: `#${job.id}` },
    { label: 'Company', value: job.company || 'Unknown Company' },
    { label: 'Role', value: job.role || 'Untitled Role' },
    { label: 'Status', value: job.status },
    { label: 'Score', value: scoreDisplay(job.score) },
    ...(classification ? [{ label: 'Category / Focus', value: classification }] : []),
    ...(job.url ? [{ label: 'URL', value: job.url }] : []),
    ...(job.pdfPath ? [{ label: 'Generated CV', value: job.pdfPath }] : []),
    ...(job.coverLetterPdfPath ? [{ label: 'Generated Cover Letter', value: job.coverLetterPdfPath }] : []),
    ...(job.notes ? [{ label: 'Notes', value: job.notes }] : []),
  ];
  const summary = job.jdSummary || job.jd || 'No job description saved.';

  return (
    <box flexDirection="column" width="100%">
      <DetailFields fields={fields} marginBottom={1} />
      <DetailHeading theme={theme}>Job Description Summary</DetailHeading>
      <DetailParagraph theme={theme} content={summary} marginBottom={0} />
    </box>
  );
}

function renderStatusDetail(
  theme: UiTheme,
  filter: Props['filter'],
  filters: Props['filters'],
  jobs: Job[],
) {
  const counts = filters.map((item) => {
    const count = jobs.filter((job) => {
      if (item === 'Queue') {
        return job.status === 'Evaluated';
      }
      return job.status === item;
    }).length;
    return `${item}: ${count}`;
  });

  return (
    <box flexDirection="column" width="100%">
      <DetailHeading theme={theme}>Pipeline Status</DetailHeading>
      <DetailFields
        fields={[
          { label: 'Active filter', value: filter },
          { label: 'Total jobs', value: String(jobs.length) },
        ]}
      />
      <DetailHeading theme={theme}>Buckets</DetailHeading>
      <DetailList theme={theme} items={counts} />
      <DetailHeading theme={theme}>Keys</DetailHeading>
      <DetailList
        theme={theme}
        marginBottom={0}
        items={[
          '0: focus the main detail view',
          '1-3: jump to left panels',
          'Tab / Shift+Tab: cycle status, jobs, and config',
          '[ / ]: cycle the active panel filter or config tab',
          'Enter on Jobs or Config > Profile: open an action workspace in the detail pane',
        ]}
      />
    </box>
  );
}

function renderProfileDetail(
  theme: UiTheme,
  profile: Profile,
  activeOption: (typeof PROFILE_OPTIONS)[number] | null,
) {
  if (!activeOption) {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Profile</DetailHeading>
        <DetailParagraph theme={theme} content="Select a profile item." marginBottom={0} />
      </box>
    );
  }

  if (activeOption.value === 'candidate') {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Candidate</DetailHeading>
        <DetailFields
          fields={[
            { label: 'Name', value: profile.candidate.name },
            { label: 'Headline', value: profile.headline },
            { label: 'Email', value: profile.candidate.email },
            { label: 'Location', value: profile.candidate.location },
            ...(profile.candidate.site ? [{ label: 'Site', value: profile.candidate.site }] : []),
          ]}
        />
        <DetailParagraph
          theme={theme}
          content="This section controls the candidate identity used across generated answers and application materials."
        />
        <DetailParagraph
          theme={theme}
          content="Press Enter in the Profile panel to edit name, email, location, site, or headline."
          muted
          marginBottom={0}
        />
      </box>
    );
  }

  if (activeOption.value === 'roles') {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Target Roles</DetailHeading>
        <DetailFields fields={[{ label: 'Current Value', value: profile.targets.roles.join(', ') || 'none' }]} />
        <DetailParagraph
          theme={theme}
          content="These titles define the roles you want to be matched against during discovery and evaluation."
        />
        <DetailParagraph theme={theme} content="Press Enter to update the comma-separated role list." muted marginBottom={0} />
      </box>
    );
  }

  if (activeOption.value === 'education') {
    const currentValue = profile.education.length > 0
      ? profile.education.map((entry) => [entry.institution, entry.degree].filter(Boolean).join(' | '))
      : ['none'];

    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Education & Certifications</DetailHeading>
        <DetailHeading theme={theme}>Current Value</DetailHeading>
        <DetailList theme={theme} items={currentValue} />
        <DetailParagraph
          theme={theme}
          content="Each entry should stay on one ATS-safe line so the institution and credential are parsed together."
        />
        <DetailParagraph
          theme={theme}
          content="Press Enter to edit one entry per line using Institution | Credential."
          muted
          marginBottom={0}
        />
      </box>
    );
  }

  if (activeOption.value === 'categories') {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Categories</DetailHeading>
        <DetailFields fields={[{ label: 'Current Value', value: profile.targets.categories.join(', ') || 'none' }]} />
        <DetailParagraph theme={theme} content="Broad job families used to classify roles and improve ranking." />
        <DetailParagraph theme={theme} content="Press Enter to update the preferred categories." muted marginBottom={0} />
      </box>
    );
  }

  if (activeOption.value === 'focuses') {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Focuses</DetailHeading>
        <DetailFields fields={[{ label: 'Current Value', value: profile.targets.focuses.join(', ') || 'none' }]} />
        <DetailParagraph
          theme={theme}
          content="Narrower specialties that indicate the strongest fit areas within a category."
        />
        <DetailParagraph theme={theme} content="Press Enter to update the preferred focuses." muted marginBottom={0} />
      </box>
    );
  }

  if (activeOption.value === 'salary-min') {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Salary Range</DetailHeading>
        <DetailFields
          fields={[
            {
              label: 'Current Value',
              value: `$${profile.targets.salaryMin.toLocaleString()} - $${profile.targets.salaryMax.toLocaleString()}`,
            },
          ]}
        />
        <DetailParagraph
          theme={theme}
          content="This compensation band is used when evaluating whether a role meets your expectations."
        />
        <DetailParagraph
          theme={theme}
          content="Press Enter to update the minimum and maximum range."
          muted
          marginBottom={0}
        />
      </box>
    );
  }

  if (activeOption.value === 'remote') {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Remote Preference</DetailHeading>
        <DetailFields fields={[{ label: 'Current Value', value: profile.targets.remote }]} />
        <DetailParagraph theme={theme} content="This setting influences search relevance and job evaluation." />
        <DetailParagraph
          theme={theme}
          content="Press Enter to switch between full remote, hybrid, or any."
          muted
          marginBottom={0}
        />
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%">
      <DetailHeading theme={theme}>Deal-Breakers</DetailHeading>
      <DetailFields fields={[{ label: 'Current Value', value: profile.targets.dealBreakers.join(', ') || 'none' }]} />
      <DetailParagraph
        theme={theme}
        content="These constraints should lower confidence in roles that do not match your requirements."
      />
      <DetailParagraph theme={theme} content="Press Enter to update the deal-breaker list." muted marginBottom={0} />
    </box>
  );
}

function renderAnswerDetail(theme: UiTheme, answer: AnswerEntry | null) {
  if (!answer) {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Answers</DetailHeading>
        <DetailParagraph theme={theme} content="No saved answers yet." marginBottom={0} />
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%">
      <DetailHeading theme={theme}>{answer.question}</DetailHeading>
      <DetailFields
        fields={[
          { label: 'Category', value: answer.category },
          { label: 'Company', value: answer.company || 'General' },
          { label: 'Role', value: answer.role || 'General' },
          { label: 'Tone', value: answer.tone || 'none' },
          { label: 'Added', value: answer.added },
          { label: 'Revised', value: answer.revised },
          ...(answer.context ? [{ label: 'Context', value: answer.context }] : []),
        ]}
      />
      <DetailParagraph theme={theme} content={answer.answer} marginBottom={0} />
    </box>
  );
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
  showInitWizard: boolean;
  evaluatingMessage: string | null;
  onFilterChange: (filter: Props['filter']) => void;
  onCycleFilter: (direction: -1 | 1) => void;
  onJobSelect: (jobId: string) => void;
  onOpenActions: () => void;
  onCloseAnswer: () => void;
  onAnswerSaved: (message: string) => void;
  answerDraft: AnswerDraft | null;
  onAnswerDraftChange: (draft: AnswerDraft) => void;
  onCloseJobActions: () => void;
  onStartAnswer: () => void;
  generateCvDraft: GenerateCvDraft | null;
  onGenerateCvDraftChange: (draft: GenerateCvDraft) => void;
  generateCoverLetterDraft: GenerateCoverLetterDraft | null;
  onGenerateCoverLetterDraftChange: (draft: GenerateCoverLetterDraft) => void;
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
  onGenerateCv: (
    guidance: string,
    bulletWordRange: CvBulletWordRange,
    textSizeScale: CvTextSizeScale,
  ) => Promise<Job>;
  onGenerateCoverLetter: (
    guidance: string,
    totalWordCount: CoverLetterTotalWordCount,
  ) => Promise<Job>;
  onOpenProfileActions: (view: ProfileActionView) => void;
  onCloseProfileActions: () => void;
  onSaveProfile: (profile: Profile, message: string) => void;
  onCompleteInit: (profile: Profile, message: string) => void;
  onChooseManualOnboarding: () => void;
  onAddUrl: (url: string) => Promise<void>;
  onAddJd: (jd: string) => Promise<void>;
  addUrlFailureMessage?: string | null;
  onRetryAddManually: () => void;
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
  showInitWizard,
  evaluatingMessage,
  onFilterChange,
  onCycleFilter,
  onJobSelect,
  onOpenActions,
  onCloseAnswer,
  onAnswerSaved,
  answerDraft,
  onAnswerDraftChange,
  onCloseJobActions,
  onStartAnswer,
  generateCvDraft,
  onGenerateCvDraftChange,
  generateCoverLetterDraft,
  onGenerateCoverLetterDraftChange,
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
  onCompleteInit,
  onChooseManualOnboarding,
  onAddUrl,
  onAddJd,
  addUrlFailureMessage,
  onRetryAddManually,
  onOverlayChange,
  onCloseOverlay,
}: Props) {
  const [profileIndex, setProfileIndex] = useState(0);
  const [answerIndex, setAnswerIndex] = useState(0);

  const workspaceVisible =
    overlay !== 'none' ||
    showInitWizard ||
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
          : overlay === 'add-jd'
            ? 'Paste Job Description'
            : overlay === 'add-crawl-failed'
              ? 'Crawl Failed'
            : 'Evaluating Job'
      : selectedJob && isAnswering
        ? `Answer #${selectedJob.id}`
          : selectedJob && jobActionView
            ? `Job Actions #${selectedJob.id}`
            : showInitWizard
              ? 'Init Wizard'
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
  const detailBoxTitle = showInitWizard ? '' : `[0] ${detailTitle}`;

  const detailContent =
    activePanel === 'status'
      ? renderStatusDetail(theme, filter, filters, jobs)
      : activePanel === 'profile'
        ? renderProfileDetail(theme, profile, selectedProfileOption)
        : activePanel === 'answers'
          ? renderAnswerDetail(theme, selectedAnswer)
          : selectedJob
            ? renderJobDetail(theme, selectedJob)
            : (
              <box flexDirection="column" width="100%">
                <DetailHeading theme={theme}>Job Detail</DetailHeading>
                <DetailParagraph theme={theme} content="Select a job to inspect it." marginBottom={0} />
              </box>
            );

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
            title={detailBoxTitle}
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
                  evaluatingMessage={evaluatingMessage}
                  addUrlFailureMessage={addUrlFailureMessage}
                  onAddUrl={onAddUrl}
                  onAddJd={onAddJd}
                  onRetryAddManually={onRetryAddManually}
                  onOverlayChange={onOverlayChange}
                  onClose={onCloseOverlay}
                />
              ) : selectedJob && isAnswering ? (
                <AnswerWorkspace
                  theme={theme}
                  job={selectedJob}
                  width={Math.max(20, detailWidth - 6)}
                  height={detailHeight - 2}
                  draft={answerDraft ?? {
                    step: 'ask-question',
                    question: '',
                    questionDraft: '',
                    category: 'other',
                    tone: '',
                    contextDraft: '',
                    refineDraft: '',
                    generatedAnswer: '',
                    statusLine: `Write a question for ${selectedJob.company || 'this company'}.`,
                  }}
                  onDraftChange={onAnswerDraftChange}
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
                  generateCvDraft={generateCvDraft ?? {
                    guidance: '',
                    bulletWordRange: DEFAULT_CV_BULLET_WORD_RANGE,
                    textSizeScale: DEFAULT_CV_TEXT_SIZE_SCALE,
                    selectedBulletPresetId: 'balanced',
                    selectedTextSizePresetId: 'balanced',
                    phase: 'bullet-preset',
                  }}
                  onGenerateCvDraftChange={onGenerateCvDraftChange}
                  generateCoverLetterDraft={generateCoverLetterDraft ?? {
                    guidance: '',
                    totalWordCount: DEFAULT_COVER_LETTER_TOTAL_WORD_COUNT,
                    selectedLengthPresetId: 'balanced',
                    phase: 'length-preset',
                  }}
                  onGenerateCoverLetterDraftChange={onGenerateCoverLetterDraftChange}
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
              ) : showInitWizard ? (
                <InitWorkspace
                  theme={theme}
                  width={Math.max(20, detailWidth - 6)}
                  height={detailHeight - 2}
                  onComplete={onCompleteInit}
                  onChooseManual={onChooseManualOnboarding}
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
                  {detailContent}
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
