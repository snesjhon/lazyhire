/** @jsxImportSource @opentui/react */
import type { UiTheme } from '../../../shared/ui/theme.js';
import {
  DetailFields,
  DetailHeading,
  DetailList,
} from '../../../shared/ui/DetailBlocks.js';
import type { Job } from '../../../shared/models/types.js';
import type { DashboardScreenProps } from './DashboardScreen.js';
import BrandLogo from '../../../shared/app-shell/BrandLogo.js';

interface Props {
  theme: UiTheme;
  filter: DashboardScreenProps['filter'];
  filters: DashboardScreenProps['filters'];
  jobs: Job[];
}

export function StatusDetailContent({ theme, filter, filters, jobs }: Props) {
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
      <BrandLogo theme={theme} variant="hero" width={35} />
      <text
        content="Copyright 2026 | Jhonatan Salazar"
        marginTop={1}
        paddingBottom={2}
      />
      <DetailHeading
        theme={theme}
      >{`Total jobs: ${String(jobs.length)}`}</DetailHeading>
      <DetailList theme={theme} items={counts} />
    </box>
  );
}
