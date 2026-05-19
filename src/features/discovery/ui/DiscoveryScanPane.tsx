/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import Spinner from '../../../shared/ui/Spinner.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { DiscoveryProgress, DiscoveryStepName } from '../../scan/discover.js';

interface Props {
  theme: UiTheme;
  width: number;
  mode: 'source' | 'scan';
  progress: DiscoveryProgress[];
  onClose: () => void;
}

const STEPS_BY_MODE: Record<'source' | 'scan', { name: DiscoveryStepName; label: string }[]> = {
  source: [
    { name: 'cc-greenhouse', label: 'Fetch Greenhouse slugs' },
    { name: 'cc-ashby',      label: 'Fetch Ashby slugs' },
  ],
  scan: [
    { name: 'scan-greenhouse', label: 'Scan Greenhouse' },
    { name: 'scan-ashby',      label: 'Scan Ashby' },
    { name: 'classify',        label: 'Classify companies' },
  ],
};

export default function DiscoveryScanPane({
  theme,
  width: _width,
  mode,
  progress,
  onClose,
}: Props) {
  const STEPS = STEPS_BY_MODE[mode];
  const latest = progress[progress.length - 1];
  const isDone = latest?.step === 'done' && latest.status === 'done';
  const isFailed = progress.some((p) => p.status === 'failed');

  const stepMap = new Map<DiscoveryStepName, DiscoveryProgress>();
  for (const p of progress) stepMap.set(p.step, p);

  useKeyboard((key) => {
    if (key.name === 'escape' || (key.name === 'return' && (isDone || isFailed))) {
      onClose();
    }
  });

  const doneStep = stepMap.get('done');

  return (
    <box flexDirection="column">
      {STEPS.map(({ name, label }) => {
        const p = stepMap.get(name);
        const status = p?.status ?? 'pending';
        const isRunning = status === 'running';
        const isFinished = status === 'done' || status === 'cached';

        const isFailed = status === 'failed';

        return (
          <box key={name} flexDirection="column" marginBottom={isFailed ? 1 : 0}>
            <box flexDirection="row" columnGap={1}>
              {isRunning ? (
                <Spinner color={theme.warning} />
              ) : isFinished ? (
                <text fg={theme.success} content="✓" />
              ) : isFailed ? (
                <text fg={theme.error} content="✗" />
              ) : (
                <text fg={theme.muted} content="·" />
              )}
              <text
                fg={isRunning ? theme.warning : isFinished ? theme.text : isFailed ? theme.error : theme.muted}
                content={label}
              />
              {isFinished && p?.count !== undefined && (
                <text fg={theme.muted} content={`(${p.count})`} />
              )}
              {status === 'cached' && (
                <text fg={theme.muted} content="cached" />
              )}
            </box>
            {isFailed && p?.error && (
              <text fg={theme.error} content={`  ${p.error}`} />
            )}
          </box>
        );
      })}

      {doneStep && (
        <box flexDirection="column" marginTop={1}>
          <box flexDirection="row" columnGap={1}>
            <text fg={theme.success} content="✓" />
            <text fg={theme.success} content={`${doneStep.count ?? 0} new choices ready`} />
          </box>
        </box>
      )}

      {progress.length === 0 && (
        <box flexDirection="row" columnGap={1}>
          <Spinner color={theme.warning} />
          <text fg={theme.warning} content="Starting…" />
        </box>
      )}

      <box flexDirection="row" columnGap={1} marginTop={1}>
        {isDone || isFailed ? (
          <text fg={theme.footer} content="enter/esc=back" />
        ) : (
          <text fg={theme.muted} content="esc=cancel" />
        )}
      </box>
    </box>
  );
}
