/** @jsxImportSource @opentui/react */
import type { UiTheme } from './theme.js';

export interface MultiStepItem {
  label: string;
  summary: string;
}

interface Props {
  theme: UiTheme;
  steps: MultiStepItem[];
  activeIndex: number;
  windowSize?: number;
  marginBottom?: number;
}

export default function MultiStepIndicator({
  theme,
  steps,
  activeIndex,
  windowSize,
  marginBottom = 1,
}: Props) {
  const totalSteps = steps.length;
  const clampedIndex = Math.max(0, Math.min(activeIndex, totalSteps - 1));

  let start = 0;
  let end = totalSteps;

  if (windowSize && windowSize > 0 && windowSize < totalSteps) {
    const halfWindow = Math.floor(windowSize / 2);
    start = Math.max(0, clampedIndex - halfWindow);
    end = Math.min(totalSteps, start + windowSize);
    start = Math.max(0, end - windowSize);
  }

  const visibleSteps = steps.slice(start, end);
  const hasLeadingGap = start > 0;
  const hasTrailingGap = end < totalSteps;

  return (
    <box flexDirection="column" marginBottom={marginBottom}>
      {hasLeadingGap ? (
        <text fg={theme.muted} content="..." />
      ) : null}

      {visibleSteps.map((step, index) => {
        const stepIndex = start + index;
        return (
          <text
            key={`${step.label}-${stepIndex}`}
            fg={stepIndex === clampedIndex ? theme.brand : theme.text}
            content={`${stepIndex + 1}. ${step.label.padEnd(16, ' ')} ${step.summary}`}
          />
        );
      })}

      {hasTrailingGap ? (
        <text fg={theme.muted} content="..." />
      ) : null}
    </box>
  );
}
