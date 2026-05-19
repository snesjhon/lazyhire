/** @jsxImportSource @opentui/react */
import type { ReactNode } from 'react';
import type { FocusTarget, JobIntakeState } from '../../../shared/ui/state.js';
import { clip, scoreDisplay } from '../../../shared/lib/utils.js';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type {
  AnswerEntry,
  Job,
} from '../../../shared/models/types.js';
import type { ProfileActionView } from '../../profile/ui/ProfileActionWorkspace.js';
import {
  PROFILE_OPTIONS,
} from '../../profile/ui/ProfileDashboardDetail.js';
import { renderDashboardDetailContent } from './DashboardDetailContent.js';

const LEFT_PANEL_ORDER: FocusTarget[] = [
  'status',
  'jobs',
  'profile',
  'answers',
  'discovery',
];


function detailPaneTitle(
  detailPane: DashboardScreenProps['detailPane'],
): string {
  if (!detailPane) return 'Detail';
  if (detailPane.kind === 'job-intake') {
    if (detailPane.state === 'choose-source') return 'Add Job';
    if (detailPane.state === 'paste-url') return 'Paste Job Link';
    if (detailPane.state === 'paste-description')
      return 'Paste Job Description';
    if (detailPane.state === 'crawl-failed') return 'Crawl Failed';
    return 'Evaluating Job';
  }
  if (detailPane.kind === 'answer') {
    return 'Job Answer';
  }
  if (detailPane.kind === 'saved-answer') {
    return 'Saved Answer';
  }
  if (detailPane.kind === 'company-answers') {
    return 'Previous Answers';
  }
  if (detailPane.kind === 'job-saved-answers') {
    return 'Saved Answers';
  }
  if (detailPane.kind === 'job-actions') {
    return 'Job Actions';
  }
  if (detailPane.kind === 'discovery-choices') {
    return 'Discovery Choices';
  }
  if (detailPane.kind === 'discovery-scan') {
    return 'Scanning Sources';
  }
  return 'Profile Actions';
}

export interface DashboardScreenProps {
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
  selectedJob: Job | null;
  selectedIndex: number;
  focus: FocusTarget;
  detailSource: 'status' | 'jobs' | 'profile' | 'answers';
  discoveryMenuIndex: number;
  detailPane?:
    | {
        kind: 'job-intake';
        state: JobIntakeState;
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | {
        kind: 'answer';
        jobId: string;
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | {
        kind: 'company-answers';
        jobId: string;
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | {
        kind: 'job-saved-answers';
        jobId: string;
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | {
        kind: 'saved-answer';
        answerId: string;
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | {
        kind: 'job-actions';
        jobId: string;
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | {
        kind: 'profile-actions';
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | {
        kind: 'discovery-choices';
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | {
        kind: 'discovery-scan';
        render: (args: { width: number; height: number }) => ReactNode;
      }
    | null;
  profileIndex: number;
  answerIndex: number;
  onProfileIndexChange: (index: number) => void;
  onAnswerIndexChange: (index: number) => void;
  onOpenProfileActions: (view: ProfileActionView) => void;
  onOpenSavedAnswer: (answerId: string) => void;
  onFilterChange: (filter: DashboardScreenProps['filter']) => void;
  onCycleFilter: (direction: -1 | 1) => void;
  onJobSelect: (jobId: string) => void;
  onOpenActions: () => void;
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
  selectedJob,
  selectedIndex,
  focus,
  detailSource,
  detailPane,
  discoveryMenuIndex,
  profileIndex,
  answerIndex,
  onProfileIndexChange,
  onAnswerIndexChange,
  onOpenProfileActions,
  onOpenSavedAnswer,
  onFilterChange,
  onCycleFilter,
  onJobSelect,
  onOpenActions,
}: DashboardScreenProps) {
  const workspaceVisible = Boolean(detailPane);
  const detailHeight = Math.max(8, contentHeight);
  const aboutHeight = 3;
  const discoveryHeight = 8;
  const jobsHeight = Math.max(12, contentHeight - aboutHeight - discoveryHeight - 2);

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
      name: clip(answer.question, Math.max(14, detailWidth - 8)),
      description: `${answer.category} · ${answer.originJobId ? `#${answer.originJobId}` : answer.company || 'General'} · ${answer.revised}`,
      value: answer.id,
    }));

  const activePanel = LEFT_PANEL_ORDER.includes(focus) ? focus : detailSource;
  const activeAboutTab: 'status' | 'profile' | 'answers' =
    activePanel === 'answers'
      ? 'answers'
      : activePanel === 'profile'
        ? 'profile'
        : 'status';
  const jobsFocused = focus === 'jobs' && !workspaceVisible;
  const aboutFocused =
    (focus === 'status' || focus === 'profile' || focus === 'answers') &&
    !workspaceVisible;
  const discoveryFocused = focus === 'discovery' && !workspaceVisible;
  const detailFocused = focus === 'detail' && !workspaceVisible;
  const detailBoxTitle = `[0] ${detailPaneTitle(detailPane)}`;
  const detailListHeight = Math.max(4, detailHeight - 4);
  const showProfileList = !detailPane && activePanel === 'profile';
  const showAnswerList = !detailPane && activePanel === 'answers';
  const detailContent =
    detailPane
      ? detailPane.render({
          width: Math.max(20, detailWidth - 6),
          height: detailHeight - 2,
        })
      : renderDashboardDetailContent({
          theme,
          activePanel,
          filter,
          filters,
          jobs,
          selectedJob,
        });

  return (
    <>
      <box flexDirection="row" height={contentHeight}>
        <box width={queueWidth} flexDirection="column" overflow="hidden">
          <box
            title="[1] About"
            border
            borderColor={aboutFocused ? theme.borderActive : theme.border}
            borderStyle={aboutFocused ? 'heavy' : 'single'}
            paddingX={1}
            height={aboutHeight}
            overflow="hidden"
            flexDirection="column"
          >
            <box flexDirection="row" columnGap={1} paddingX={1}>
              {(['status', 'profile', 'answers'] as const).map((tab) => {
                const label =
                  tab === 'status'
                    ? 'Status'
                    : tab === 'profile'
                      ? 'Profile'
                      : 'Answers';
                const isActive = activeAboutTab === tab;
                return (
                  <text
                    key={tab}
                    fg={isActive && aboutFocused ? theme.brand : theme.muted}
                  >
                    {isActive ? (
                      <u>
                        <strong>{label}</strong>
                      </u>
                    ) : (
                      label
                    )}
                  </text>
                );
              })}
            </box>
          </box>

          <box
            title="[2] Jobs"
            border
            borderColor={jobsFocused ? theme.borderActive : theme.border}
            paddingX={1}
            height={jobsHeight + 2}
            borderStyle={jobsFocused ? 'heavy' : 'single'}
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
                  {item === filter ? (
                    <u>
                      <strong>{item}</strong>
                    </u>
                  ) : (
                    item
                  )}
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
                {...selectColors(theme)}
                selectedTextColor={jobsFocused ? theme.brand : theme.muted}
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
            title="[3] Discovery"
            border
            borderColor={
              discoveryFocused ? theme.borderActive : theme.border
            }
            borderStyle={discoveryFocused ? 'heavy' : 'single'}
            paddingX={1}
            height={discoveryHeight}
            overflow="hidden"
            flexDirection="column"
          >
            {(['Source Companies', 'Scan Jobs', 'Add to Queue'] as const).map(
              (label, i) => {
                const isSelected = discoveryMenuIndex === i;
                return (
                  <text
                    key={label}
                    fg={isSelected && discoveryFocused ? theme.brand : theme.muted}
                  >
                    {isSelected ? (
                      <u>
                        <strong>{`> ${label}`}</strong>
                      </u>
                    ) : (
                      `  ${label}`
                    )}
                  </text>
                );
              },
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
            paddingX={2}
            paddingTop={1}
            height={detailHeight}
            borderStyle={
              focus === 'detail' || workspaceVisible ? 'heavy' : 'single'
            }
            overflow="hidden"
          >
            {showProfileList ? (
              <select
                height={detailListHeight}
                width="100%"
                options={PROFILE_OPTIONS}
                selectedIndex={profileIndex}
                showDescription={false}
                {...selectColors(theme)}
                selectedTextColor={detailFocused ? theme.brand : theme.muted}
                focused={detailFocused}
                onChange={(_, option) => {
                  const idx = PROFILE_OPTIONS.findIndex(
                    (o) => o.value === option?.value,
                  );
                  if (idx >= 0) onProfileIndexChange(idx);
                }}
                onSelect={(_, option) => {
                  const idx = PROFILE_OPTIONS.findIndex(
                    (o) => o.value === option?.value,
                  );
                  if (idx >= 0) {
                    onProfileIndexChange(idx);
                    onOpenProfileActions(PROFILE_OPTIONS[idx]!.value);
                  }
                }}
              />
            ) : showAnswerList ? (
              answerOptions.length === 0 ? (
                <text fg={theme.muted} content="No saved answers yet." />
              ) : (
                <select
                  height={detailListHeight}
                  width="100%"
                  options={answerOptions}
                  selectedIndex={answerIndex}
                  showDescription
                  {...selectColors(theme)}
                  selectedTextColor={detailFocused ? theme.brand : theme.muted}
                  focused={detailFocused}
                  onChange={(_, option) => {
                    const idx = answerOptions.findIndex(
                      (o) => o.value === option?.value,
                    );
                    if (idx >= 0) onAnswerIndexChange(idx);
                  }}
                  onSelect={(_, option) => {
                    if (option?.value) onOpenSavedAnswer(String(option.value));
                  }}
                />
              )
            ) : (
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
                <box
                  flexDirection="column"
                  width={Math.max(20, detailWidth - 6)}
                  flexGrow={1}
                >
                  {detailContent}
                </box>
              </scrollbox>
            )}
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
        <text fg={theme.footer} content="Add job: a" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="Panels: tab" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="Filters: [ / ]" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="Jump: 1 2 3" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="Quit: ctrl-q" />
      </box>
    </>
  );
}
