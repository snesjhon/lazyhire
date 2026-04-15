/** @jsxImportSource @opentui/react */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { FocusTarget, JobIntakeState } from '../../../shared/ui/state.js';
import { clip, scoreDisplay } from '../../../shared/lib/utils.js';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type {
  AnswerEntry,
  Job,
  Profile,
} from '../../../shared/models/types.js';
import type { ProfileActionView } from '../../profile/ui/ProfileActionWorkspace.js';
import { renderAnswerDashboardDetail } from '../../answers/ui/AnswerDashboardDetail.js';
import {
  PROFILE_OPTIONS,
  renderProfileDashboardDetail,
} from '../../profile/ui/ProfileDashboardDetail.js';
import { renderDashboardDetailContent } from './DashboardDetailContent.js';

const LEFT_PANEL_ORDER: FocusTarget[] = [
  'status',
  'jobs',
  'profile',
  'answers',
];

type LibraryTab = 'profile' | 'answers';

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
  profile: Profile;
  selectedJob: Job | null;
  selectedIndex: number;
  focus: FocusTarget;
  detailSource: 'status' | 'jobs' | 'profile' | 'answers';
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
    | null;
  onFilterChange: (filter: DashboardScreenProps['filter']) => void;
  onCycleFilter: (direction: -1 | 1) => void;
  onJobSelect: (jobId: string) => void;
  onOpenActions: () => void;
  onOpenProfileActions: (view: ProfileActionView) => void;
  onOpenSavedAnswer: (answerId: string) => void;
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
  detailPane,
  onFilterChange,
  onCycleFilter,
  onJobSelect,
  onOpenActions,
  onOpenProfileActions,
  onOpenSavedAnswer,
}: DashboardScreenProps) {
  const [profileIndex, setProfileIndex] = useState(0);
  const [answerIndex, setAnswerIndex] = useState(0);

  const workspaceVisible = Boolean(detailPane);
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
      description: `${answer.category} · ${answer.originJobId ? `#${answer.originJobId}` : answer.company || 'General'} · ${answer.revised}`,
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
  const jobsFocused = focus === 'jobs' && !workspaceVisible;
  const libraryFocused =
    (focus === 'profile' || focus === 'answers') && !workspaceVisible;
  const detailBoxTitle = `[0] ${detailPaneTitle(detailPane)}`;
  const detailContent = detailPane
    ? detailPane.render({
        width: Math.max(20, detailWidth - 6),
        height: detailHeight - 2,
      })
    : activePanel === 'profile'
      ? renderProfileDashboardDetail(theme, profile, selectedProfileOption)
      : activePanel === 'answers'
        ? renderAnswerDashboardDetail(theme, selectedAnswer)
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
            title="[1] Status"
            border
            borderColor={focus === 'status' ? theme.borderActive : theme.border}
            borderStyle={focus === 'status' ? 'heavy' : 'single'}
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
            title="[3] User"
            border
            borderColor={libraryFocused ? theme.borderActive : theme.border}
            borderStyle={libraryFocused ? 'heavy' : 'single'}
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
                  <u>
                    <strong>Profile</strong>
                  </u>
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
                  <u>
                    <strong>Answers</strong>
                  </u>
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
                {...selectColors(theme)}
                selectedTextColor={libraryFocused ? theme.brand : theme.muted}
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
                  if (nextIndex >= 0) {
                    setAnswerIndex(nextIndex);
                    onOpenSavedAnswer(String(option?.value));
                  }
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
            paddingX={2}
            paddingTop={1}
            height={detailHeight}
            borderStyle={
              focus === 'detail' || workspaceVisible ? 'heavy' : 'single'
            }
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
              <box flexDirection="column" width={Math.max(20, detailWidth - 6)}>
                {detailContent}
              </box>
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
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="Answers: enter to open" />
      </box>
    </>
  );
}
