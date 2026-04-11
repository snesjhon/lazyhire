/** @jsxImportSource @opentui/react */
import { type TabSelectRenderable } from '@opentui/core';
import { useEffect, useRef } from 'react';
import type { Flash, FocusTarget, Overlay, Screen } from '../ui.js';
import { clip, flashColor } from '../lib/utils.js';
import type { UiTheme } from '../theme.js';

const TAB_OPTIONS = [
  { name: 'Jobs', description: 'Job pipeline', value: 'dashboard' as Screen },
  { name: 'Profile', description: 'Candidate data', value: 'profile' as Screen },
  { name: 'Answers', description: 'Saved replies', value: 'answers' as Screen },
  { name: 'Scan', description: 'Find roles', value: 'scan' as Screen, hidden: true },
];

const VISIBLE_TAB_OPTIONS = TAB_OPTIONS.filter((option) => !option.hidden);

function screenIndex(screen: Screen): number {
  return Math.max(0, VISIBLE_TAB_OPTIONS.findIndex((o) => o.value === screen));
}

interface Props {
  appWidth: number;
  theme: UiTheme;
  screen: Screen;
  focus: FocusTarget;
  overlay: Overlay;
  flash: Flash | null;
  jobCount: number;
  onScreenChange: (screen: Screen) => void;
  onFocusChange: (focus: FocusTarget) => void;
}

export default function Header({
  appWidth,
  theme,
  screen,
  focus,
  overlay,
  flash,
  jobCount,
  onScreenChange,
  onFocusChange,
}: Props) {
  const tabs = useRef<TabSelectRenderable>(null);

  useEffect(() => {
    tabs.current?.setSelectedIndex(screenIndex(screen));
  }, [screen]);

  return (
    <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
      <text fg={theme.brand} content="lazyhire" />
      <tab-select
        ref={tabs}
        width={60}
        height={2}
        tabWidth={10}
        options={VISIBLE_TAB_OPTIONS}
        selectedTextColor={theme.brandContrast}
        selectedBackgroundColor={theme.brand}
        backgroundColor={theme.transparent}
        focusedBackgroundColor={theme.transparent}
        showDescription={false}
        showUnderline={false}
        focused={focus === 'tabs' && overlay === 'none' && screen === 'dashboard'}
        onSelect={(_, option) => {
          if (option?.value) onScreenChange(option.value as Screen);
          onFocusChange('jobs');
        }}
      />
      {flash ? (
        <text
          fg={flashColor(flash.variant, theme)}
          content={clip(flash.message, Math.max(24, appWidth - 40))}
        />
      ) : (
        <text fg={theme.muted} content={`${jobCount} jobs`} />
      )}
    </box>
  );
}

export { TAB_OPTIONS };
