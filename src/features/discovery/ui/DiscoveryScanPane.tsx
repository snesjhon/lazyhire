/** @jsxImportSource @opentui/react */
import { useState } from 'react';
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
  onScanJobs?: () => void;
  onReSource?: () => void;
  onEvaluatePending?: () => void;
  onReScan?: () => void;
}

const STEPS_BY_MODE: Record<'source' | 'scan', { name: DiscoveryStepName; label: string; unit: string }[]> = {
  source: [
    { name: 'cc-greenhouse', label: 'Fetch Greenhouse slugs', unit: 'companies' },
    { name: 'cc-ashby',      label: 'Fetch Ashby slugs',      unit: 'companies' },
  ],
  scan: [
    { name: 'scan-greenhouse', label: 'Scan Greenhouse', unit: 'jobs' },
    { name: 'scan-ashby',      label: 'Scan Ashby',      unit: 'jobs' },
    { name: 'classify',        label: 'Classify',         unit: 'matched' },
  ],
};

const SOURCE_DONE_ACTIONS = [
  { label: 'Scan Jobs', key: 'scan' },
  { label: 'Re-source companies', key: 'source' },
  { label: 'Close', key: 'close' },
] as const;

const SCAN_DONE_ACTIONS = (count: number) => [
  { label: `Evaluate ${count} pending job${count === 1 ? '' : 's'}`, key: 'evaluate' },
  { label: 'ReScan Jobs', key: 'rescan' },
  { label: 'Close', key: 'close' },
] as const;

export default function DiscoveryScanPane({
  theme,
  width: _width,
  mode,
  progress,
  onClose,
  onScanJobs,
  onReSource,
  onEvaluatePending,
  onReScan,
}: Props) {
  const [actionIndex, setActionIndex] = useState(0);
  const STEPS = STEPS_BY_MODE[mode];
  const latest = progress[progress.length - 1];
  const isDone = latest?.step === 'done' && latest.status === 'done';
  const isFailed = progress.some((p) => p.status === 'failed');
  const showSourceMenu = isDone && mode === 'source';
  const showScanMenu = isDone && mode === 'scan';
  const showActionMenu = showSourceMenu || showScanMenu;

  const stepMap = new Map<DiscoveryStepName, DiscoveryProgress>();
  for (const p of progress) stepMap.set(p.step, p);

  const doneStep = stepMap.get('done');
  const pendingCount = doneStep?.count ?? 0;
  const scanActions = SCAN_DONE_ACTIONS(pendingCount);

  const activeActions: ReadonlyArray<{ label: string; key: string }> = showSourceMenu
    ? SOURCE_DONE_ACTIONS
    : scanActions;

  useKeyboard((key) => {
    if (showActionMenu) {
      if (key.name === 'j' || key.name === 'down')
        setActionIndex((i: number) => (i + 1) % activeActions.length);
      if (key.name === 'k' || key.name === 'up')
        setActionIndex((i: number) => (i + activeActions.length - 1) % activeActions.length);
      if (key.name === 'return') {
        const action = activeActions[actionIndex].key;
        if (action === 'scan') onScanJobs?.();
        else if (action === 'source') onReSource?.();
        else if (action === 'evaluate') onEvaluatePending?.();
        else if (action === 'rescan') onReScan?.();
        else onClose();
      }
      if (key.name === 'escape') onClose();
      return;
    }
    if (key.name === 'escape' || (key.name === 'return' && (isDone || isFailed))) {
      onClose();
    }
  });

  return (
    <box flexDirection="column">
      {STEPS.map(({ name, label, unit }) => {
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
                <text fg={theme.muted} content={`(${p.count} ${unit})`} />
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

      {doneStep && !showActionMenu && (
        <box flexDirection="column" marginTop={1}>
          <box flexDirection="row" columnGap={1}>
            <text fg={theme.success} content="✓" />
            <text fg={theme.success} content={`${doneStep.count ?? 0} new choices ready`} />
          </box>
        </box>
      )}

      {showActionMenu && (
        <box flexDirection="column" marginTop={1}>
          {activeActions.map(({ label, key }, i) => (
            <box key={key} flexDirection="row" columnGap={1}>
              <text fg={actionIndex === i ? theme.brand : theme.muted} content={actionIndex === i ? '>' : ' '} />
              <text fg={actionIndex === i ? theme.text : theme.muted} content={label} />
            </box>
          ))}
        </box>
      )}

      {progress.length === 0 && (
        <box flexDirection="row" columnGap={1}>
          <Spinner color={theme.warning} />
          <text fg={theme.warning} content="Starting…" />
        </box>
      )}

      <box flexDirection="row" columnGap={1} marginTop={1}>
        {showActionMenu ? (
          <text fg={theme.footer} content="j/k=select · enter=confirm · esc=close" />
        ) : isDone || isFailed ? (
          <text fg={theme.footer} content="enter/esc=back" />
        ) : (
          <text fg={theme.muted} content="esc=cancel" />
        )}
      </box>
    </box>
  );
}
