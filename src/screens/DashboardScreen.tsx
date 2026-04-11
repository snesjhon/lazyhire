/** @jsxImportSource @opentui/react */
import { SyntaxStyle } from '@opentui/core';
import type { Job, JobStatus } from '../types.js';
import type { FocusTarget, Overlay } from '../ui.js';
import { clip, scoreDisplay } from '../lib/utils.js';
import type { UiTheme } from '../theme.js';
import AnswerWorkspace from '../components/AnswerWorkspace.js';
import JobActionWorkspace, {
  type JobActionView,
} from '../components/JobActionWorkspace.js';

// const syntaxStyle = SyntaxStyle.create();
const syntaxStyle = SyntaxStyle.fromStyles({
  'markup.heading.1': { bold: true },
  'markup.heading.2': { bold: true },
  'markup.strong': { bold: true },
});

function jobDetailMarkdown(job: Job): string {
  const classification = [job.category, job.focus].filter(Boolean).join(' / ');
  const rows = [
    `**Company:** ${job.company || 'Unknown Company'}`,
    `**Role:** ${job.role || 'Untitled Role'}`,
    `**Status:** ${job.status}`,
    `**Score:** ${scoreDisplay(job.score)}`,
    classification ? `**Category / Focus:** ${classification}` : '',
    job.url ? `**URL:** ${job.url}` : '',
    job.pdfPath ? `**Generated CV:** ${job.pdfPath}` : '',
    job.coverLetterPdfPath ? `**Generated Cover Letter:** ${job.coverLetterPdfPath}` : '',
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

interface Props {
  theme: UiTheme;
  contentHeight: number;
  queueWidth: number;
  detailWidth: number;
  detailHeight: number;
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
  filteredJobs: Job[];
  selectedJob: Job | null;
  selectedIndex: number;
  focus: FocusTarget;
  overlay: Overlay;
  isAnswering: boolean;
  jobActionView: JobActionView | null;
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
}

export default function DashboardScreen({
  theme,
  contentHeight,
  queueWidth,
  detailWidth,
  detailHeight,
  filter,
  filters,
  filteredJobs,
  selectedJob,
  selectedIndex,
  focus,
  overlay,
  isAnswering,
  jobActionView,
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
}: Props) {
  const companyWidth = Math.max(10, Math.floor((queueWidth - 14) * 0.38));
  const roleWidth = Math.max(12, queueWidth - companyWidth - 20);

  const jobOptions = filteredJobs.map((job) => ({
    name: `${clip(job.company || 'Unknown', companyWidth).padEnd(companyWidth)} ${clip(job.role || 'Untitled', roleWidth).padEnd(roleWidth)} ${scoreDisplay(job.score).padStart(4)}`,
    description: `${clip(job.status || 'Unknown', companyWidth).padEnd(companyWidth)} ${job.category ? job.category : ''} ${job.focus ? ` / ${job.focus}` : ''} · ${job.added}`,
    value: job.id,
  }));

  return (
    <>
      {/* Filter bar */}
      <box flexDirection="row" marginY={1} columnGap={1}>
        {filters.map((item) => (
          <text
            key={item}
            fg={item === filter ? theme.brandContrast : theme.muted}
            bg={item === filter ? theme.brand : undefined}
            content={item === filter ? ` ${item} ` : item}
          />
        ))}
      </box>

      {/* Queue + Detail */}
      <box flexDirection="row" columnGap={1} height={contentHeight}>
        <box
          title={filter}
          border
          borderColor={focus === 'jobs' ? theme.borderActive : theme.border}
          width={queueWidth}
          padding={1}
          overflow="hidden"
        >
          {jobOptions.length > 0 ? (
            <select
              height={contentHeight - 2}
              width="100%"
              options={jobOptions}
              selectedIndex={selectedIndex}
              showDescription
              showScrollIndicator
              itemSpacing={1}
              backgroundColor={theme.transparent}
              focusedBackgroundColor={theme.transparent}
              selectedBackgroundColor={theme.transparent}
              selectedTextColor={theme.brand}
              selectedDescriptionColor={theme.muted}
              focused={focus === 'jobs' && overlay === 'none'}
              onChange={(_, option) => {
                if (option?.value) onJobSelect(String(option.value));
              }}
              onSelect={(_, option) => {
                if (option?.value) onJobSelect(String(option.value));
                onOpenActions();
              }}
            />
          ) : (
            <text fg={theme.muted} content="No jobs yet. Press a to add one." />
          )}
        </box>

        <box
          title="Detail"
          border
          borderColor={focus === 'detail' ? theme.borderActive : theme.border}
          width={detailWidth}
          padding={1}
          flexDirection="column"
          overflow="hidden"
        >
          {selectedJob && isAnswering ? (
            <AnswerWorkspace
              theme={theme}
              job={selectedJob}
              width={Math.max(20, detailWidth - 4)}
              height={detailHeight + 1}
              onClose={onCloseAnswer}
              onSaved={onAnswerSaved}
            />
          ) : selectedJob && jobActionView ? (
            <JobActionWorkspace
              theme={theme}
              job={selectedJob}
              width={Math.max(20, detailWidth - 4)}
              height={detailHeight + 1}
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
          ) : selectedJob ? (
            <scrollbox
              height={detailHeight + 3}
              width="100%"
              scrollX={false}
              scrollY
              focused={focus === 'detail' && overlay === 'none'}
              rootOptions={{ overflow: 'hidden' }}
              wrapperOptions={{ overflow: 'hidden' }}
              viewportOptions={{ overflow: 'hidden' }}
              contentOptions={{ overflow: 'hidden' }}
              scrollbarOptions={{ showArrows: true }}
            >
              <box flexDirection="column" width={Math.max(20, detailWidth - 6)}>
                <markdown
                  width={Math.max(20, detailWidth - 6)}
                  content={jobDetailMarkdown(selectedJob)}
                  syntaxStyle={syntaxStyle}
                  conceal
                />
              </box>
            </scrollbox>
          ) : (
            <text fg={theme.muted} content="Select a job to inspect it." />
          )}
        </box>
      </box>

      {/* Footer */}
      <box
        flexDirection="row"
        columnGap={1}
        flexWrap="wrap"
        position="absolute"
        bottom={0}
      >
        <text fg={theme.footer} content="1-3=tabs" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="tab=filter" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="h/l=panes" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="j/k=move" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="enter=job actions" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="a=add" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="e=evaluate" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="g=cv" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="c=cover" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="w=answer" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="esc=close" />
        <text fg={theme.muted} content="|" />
        <text fg={theme.footer} content="q=quit" />
      </box>
    </>
  );
}
