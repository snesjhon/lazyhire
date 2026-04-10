/** @jsxImportSource @opentui/react */
import { SyntaxStyle } from '@opentui/core';
import type { Job, JobStatus } from '../types.js';
import type { FocusTarget, Overlay } from '../ui.js';
import { clip, scoreDisplay } from '../lib/utils.js';

// const syntaxStyle = SyntaxStyle.create();
const syntaxStyle = SyntaxStyle.fromStyles({
  'markup.heading.1': { bold: true },
  'markup.heading.2': { bold: true },
  'markup.strong': { bold: true },
});

const TRANSPARENT_BACKGROUND = 'transparent';

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
  contentHeight: number;
  queueWidth: number;
  detailWidth: number;
  detailHeight: number;
  filter: 'All' | JobStatus;
  filters: Array<'All' | JobStatus>;
  filteredJobs: Job[];
  selectedJob: Job | null;
  selectedIndex: number;
  focus: FocusTarget;
  overlay: Overlay;
  onJobSelect: (jobId: string) => void;
  onOpenActions: () => void;
}

export default function DashboardScreen({
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
  onJobSelect,
  onOpenActions,
}: Props) {
  const companyWidth = Math.max(10, Math.floor((queueWidth - 14) * 0.38));
  const roleWidth = Math.max(12, queueWidth - companyWidth - 20);

  const jobOptions = filteredJobs.map((job) => ({
    name: `${job.id} ${clip(job.company || 'Unknown', companyWidth).padEnd(companyWidth)} ${clip(job.role || 'Untitled', roleWidth).padEnd(roleWidth)} ${scoreDisplay(job.score).padStart(4)}`,
    description: `${job.status} · ${job.added}${job.category ? ` · ${job.category}` : ''}${job.focus ? ` / ${job.focus}` : ''}`,
    value: job.id,
  }));

  return (
    <>
      {/* Filter bar */}
      <box flexDirection="row" marginY={1} columnGap={1}>
        {filters.map((item) => (
          <text
            key={item}
            fg={item === filter ? '#050505' : '#868e96'}
            bg={item === filter ? '#4cc9f0' : undefined}
            content={item === filter ? ` ${item} ` : item}
          />
        ))}
      </box>

      {/* Queue + Detail */}
      <box flexDirection="row" columnGap={1} height={contentHeight}>
        <box
          title={`Queue ${filter === 'All' ? '' : `· ${filter}`}`.trim()}
          border
          borderColor={focus === 'jobs' ? '#57cc99' : '#868e96'}
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
              backgroundColor={TRANSPARENT_BACKGROUND}
              focusedBackgroundColor={TRANSPARENT_BACKGROUND}
              selectedBackgroundColor={TRANSPARENT_BACKGROUND}
              selectedTextColor="#4cc9f0"
              selectedDescriptionColor="#868e96"
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
            <text fg="#868e96" content="No jobs yet. Press a to add one." />
          )}
        </box>

        <box
          title="Detail"
          border
          borderColor={focus === 'detail' ? '#57cc99' : '#868e96'}
          width={detailWidth}
          padding={1}
          flexDirection="column"
          overflow="hidden"
        >
          {selectedJob ? (
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
            <text fg="#868e96" content="Select a job to inspect it." />
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
        <text fg="#7aa2f7" content="1-3=tabs" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="tab=filter" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="h/l=panes" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="j/k=move" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="enter=actions" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="a=add" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="e=evaluate" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="g=cv" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="esc=close" />
        <text fg="#868e96" content="|" />
        <text fg="#7aa2f7" content="q=quit" />
      </box>
    </>
  );
}
