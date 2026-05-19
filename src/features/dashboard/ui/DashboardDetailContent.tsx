/** @jsxImportSource @opentui/react */
import type { FocusTarget } from '../../../shared/ui/state.js';
import { scoreDisplay } from '../../../shared/lib/utils.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import {
  DetailFields,
  DetailHeading,
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

export function renderDashboardDetailContent({
  theme,
  activePanel,
  filters,
  jobs,
  selectedJob,
  candidateName,
}: {
  theme: UiTheme;
  activePanel: FocusTarget;
  filters: DashboardScreenProps['filters'];
  jobs: Job[];
  selectedJob: Job | null;
  candidateName?: string;
}) {
  if (activePanel === 'status') {
    return (
      <StatusDetailContent
        theme={theme}
        filters={filters}
        jobs={jobs}
        candidateName={candidateName}
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
