/** @jsxImportSource @opentui/react */
import type { FocusTarget } from '../../../shared/ui/state.js';
import { scoreDisplay } from '../../../shared/lib/utils.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import {
  DetailFields,
  DetailHeading,
  DetailList,
  DetailParagraph,
} from '../../../shared/ui/DetailBlocks.js';
import type { Job } from '../../../shared/models/types.js';
import type { DashboardScreenProps } from './DashboardScreen.js';
import { StatusDetailContent } from './StatusDetailContent.js';

function renderJobDetail(theme: UiTheme, job: Job) {
  const classification = [job.category, job.focus].filter(Boolean).join(' / ');
  const fields = [
    { label: 'Company', value: job.company || 'Unknown Company' },
    { label: 'Role', value: job.role || 'Untitled Role' },
    { label: 'Status', value: job.status },
    { label: 'Score', value: scoreDisplay(job.score) },
    ...(classification
      ? [{ label: 'Category / Focus', value: classification }]
      : []),
    ...(job.url ? [{ label: 'URL', value: job.url }] : []),
    ...(job.pdfPath ? [{ label: 'Generated CV', value: job.pdfPath }] : []),
    ...(job.coverLetterPdfPath
      ? [{ label: 'Generated Cover Letter', value: job.coverLetterPdfPath }]
      : []),
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
  filter: DashboardScreenProps['filter'],
  filters: DashboardScreenProps['filters'],
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

export function renderDashboardDetailContent({
  theme,
  activePanel,
  filter,
  filters,
  jobs,
  selectedJob,
}: {
  theme: UiTheme;
  activePanel: FocusTarget;
  filter: DashboardScreenProps['filter'];
  filters: DashboardScreenProps['filters'];
  jobs: Job[];
  selectedJob: Job | null;
}) {
  if (activePanel === 'status') {
    return (
      <StatusDetailContent
        theme={theme}
        filter={filter}
        filters={filters}
        jobs={jobs}
      />
    );
  }
  if (selectedJob) {
    return renderJobDetail(theme, selectedJob);
  }
  return (
    <box flexDirection="column" width="100%">
      <DetailHeading theme={theme}>Job Detail</DetailHeading>
      <DetailParagraph
        theme={theme}
        content="Select a job to inspect it."
        marginBottom={0}
      />
    </box>
  );
}
