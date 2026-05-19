/** @jsxImportSource @opentui/react */
import type { ReactNode } from 'react';
import type { FocusTarget, JobIntakeState } from '../../../shared/ui/state.js';
import { clip, scoreDisplay } from '../../../shared/lib/utils.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { AnswerEntry, Job } from '../../../shared/models/types.js';
import type { ProfileActionView } from '../../profile/ui/ProfileActionWorkspace.js';
import { renderDashboardDetailContent } from './DashboardDetailContent.js';
import { AboutPanel } from './AboutPanel.js';
import { JobsPanel } from './JobsPanel.js';
import { DiscoveryPanel } from './DiscoveryPanel.js';
import { DetailPanel } from './DetailPanel.js';

const LEFT_PANEL_ORDER: FocusTarget[] = [
  'status',
  'jobs',
  'profile',
  'answers',
  'discovery',
];

function detailPaneTitle(detailPane: DashboardScreenProps['detailPane']): string {
  if (!detailPane) return 'Detail';
  if (detailPane.kind === 'job-intake') {
    if (detailPane.state === 'choose-source') return 'Add Job';
    if (detailPane.state === 'paste-url') return 'Paste Job Link';
    if (detailPane.state === 'paste-description') return 'Paste Job Description';
    if (detailPane.state === 'crawl-failed') return 'Crawl Failed';
    return 'Evaluating Job';
  }
  if (detailPane.kind === 'answer') return 'Job Answer';
  if (detailPane.kind === 'saved-answer') return 'Saved Answer';
  if (detailPane.kind === 'company-answers') return 'Previous Answers';
  if (detailPane.kind === 'job-saved-answers') return 'Saved Answers';
  if (detailPane.kind === 'job-actions') return 'Job Actions';
  if (detailPane.kind === 'discovery-choices') return 'Discovery Choices';
  if (detailPane.kind === 'discovery-scan') return 'Scanning Sources';
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
  hasSourcedCompanies: boolean;
  pendingDiscoveredCount: number;
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
  candidateName?: string;
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
  hasSourcedCompanies,
  pendingDiscoveredCount,
  profileIndex,
  answerIndex,
  candidateName,
  onProfileIndexChange,
  onAnswerIndexChange,
  onOpenProfileActions,
  onOpenSavedAnswer,
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

  const activePanel = LEFT_PANEL_ORDER.includes(focus) ? focus : detailSource;
  const activeAboutTab: 'status' | 'profile' | 'answers' =
    activePanel === 'answers' ? 'answers' : activePanel === 'profile' ? 'profile' : 'status';

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

  const detailContent = detailPane
    ? detailPane.render({
        width: Math.max(20, detailWidth - 6),
        height: detailHeight - 2,
      })
    : renderDashboardDetailContent({
        theme,
        activePanel,
        filters,
        jobs,
        selectedJob,
        candidateName,
      });

  return (
    <>
      <box flexDirection="row" height={contentHeight}>
        <box width={queueWidth} flexDirection="column" overflow="hidden">
          <AboutPanel
            theme={theme}
            height={aboutHeight}
            focused={(focus === 'status' || focus === 'profile' || focus === 'answers') && !workspaceVisible}
            activeTab={activeAboutTab}
          />
          <JobsPanel
            theme={theme}
            height={jobsHeight}
            focused={focus === 'jobs' && !workspaceVisible}
            filter={filter}
            filters={filters}
            jobOptions={jobOptions}
            selectedIndex={selectedIndex}
            onJobSelect={onJobSelect}
            onOpenActions={onOpenActions}
          />
          <DiscoveryPanel
            theme={theme}
            height={discoveryHeight}
            focused={focus === 'discovery' && !workspaceVisible}
            menuIndex={discoveryMenuIndex}
            hasSourcedCompanies={hasSourcedCompanies}
            pendingJobCount={pendingDiscoveredCount}
          />
        </box>

        <DetailPanel
          theme={theme}
          width={detailWidth}
          height={detailHeight}
          focus={focus}
          workspaceVisible={workspaceVisible}
          title={`[0] ${detailPaneTitle(detailPane)}`}
          showProfileList={!detailPane && activePanel === 'profile'}
          showAnswerList={!detailPane && activePanel === 'answers'}
          profileIndex={profileIndex}
          answerIndex={answerIndex}
          answerOptions={answerOptions}
          detailContent={detailContent}
          onProfileIndexChange={onProfileIndexChange}
          onAnswerIndexChange={onAnswerIndexChange}
          onOpenProfileActions={onOpenProfileActions}
          onOpenSavedAnswer={onOpenSavedAnswer}
        />
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
