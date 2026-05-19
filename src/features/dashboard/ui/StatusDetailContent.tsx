/** @jsxImportSource @opentui/react */
import type { UiTheme } from '../../../shared/ui/theme.js';
import { DetailHeading, DetailList } from '../../../shared/ui/DetailBlocks.js';
import type { Job } from '../../../shared/models/types.js';
import type { DashboardScreenProps } from './DashboardScreen.js';

const SMALL_LOGO = [
  '██╗      █████╗ ███████╗██╗   ██╗██╗  ██╗██╗██████╗ ███████╗',
  '██║     ██╔══██╗╚══███╔╝╚██╗ ██╔╝██║  ██║██║██╔══██╗██╔════╝',
  '██║     ███████║  ███╔╝  ╚████╔╝ ███████║██║██████╔╝█████╗  ',
  '██║     ██╔══██║ ███╔╝    ╚██╔╝  ██╔══██║██║██╔══██╗██╔══╝  ',
  '███████╗██║  ██║███████╗   ██║   ██║  ██║██║██║  ██║███████╗',
  '╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝',
] as const;

const FEATURE_BULLETS = [
  'Generate tailored CVs and cover letters with AI',
  'Evaluate and track opportunities across your pipeline',
  'Store answers to application questions for reuse',
  'Discover jobs via GitHub, Ashby, HN Hiring, and more',
  'Manage your profile and target roles in one place',
];

interface Props {
  theme: UiTheme;
  filters: DashboardScreenProps['filters'];
  jobs: Job[];
  candidateName?: string;
}

export function StatusDetailContent({
  theme,
  filters,
  jobs,
  candidateName,
}: Props) {
  const counts = filters.map((item) => {
    const count = jobs.filter((job) => {
      if (item === 'Queue') {
        return job.status === 'Evaluated';
      }
      return job.status === item;
    }).length;
    return `${item}: ${count}`;
  });

  const firstName = candidateName ? candidateName.split(' ')[0] : '';

  return (
    <box flexDirection="column" width="100%">
      <text fg={theme.info} content={SMALL_LOGO.join('\n')} />
      <text content="Copyright 2026 | Jhonatan Salazar" marginTop={1} />
      {firstName ? (
        <text fg={theme.heading} marginTop={1} marginBottom={1}>
          <strong>{`Welcome, ${firstName}!`}</strong>
        </text>
      ) : (
        <text marginTop={1} marginBottom={1} content="Welcome to LazyHire!" />
      )}
      <DetailList theme={theme} items={FEATURE_BULLETS} marginBottom={1} />
      <DetailHeading
        theme={theme}
      >{`Total jobs: ${String(jobs.length)}`}</DetailHeading>
      <DetailList theme={theme} items={counts} />
    </box>
  );
}
