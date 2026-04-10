/** @jsxImportSource @opentui/react */
import { type TabSelectRenderable } from '@opentui/core';
import { useEffect, useRef } from 'react';
import type { Flash, FocusTarget, Overlay, Screen } from '../ui.js';
import { clip, flashColor } from '../lib/utils.js';

const TRANSPARENT_BACKGROUND = 'transparent';

const TAB_OPTIONS = [
  { name: 'Queue', description: 'Job pipeline', value: 'dashboard' as Screen },
  { name: 'Scan', description: 'Find roles', value: 'scan' as Screen },
  { name: 'Profile', description: 'Candidate data', value: 'profile' as Screen },
  { name: 'Answers', description: 'Saved replies', value: 'answers' as Screen },
];

function screenIndex(screen: Screen): number {
  return Math.max(0, TAB_OPTIONS.findIndex((o) => o.value === screen));
}

interface Props {
  appWidth: number;
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
      <text fg="#4cc9f0" content="lazyhire" />
      <tab-select
        ref={tabs}
        width={60}
        height={2}
        tabWidth={10}
        options={TAB_OPTIONS}
        selectedTextColor="#050505"
        selectedBackgroundColor="#4cc9f0"
        backgroundColor={TRANSPARENT_BACKGROUND}
        focusedBackgroundColor={TRANSPARENT_BACKGROUND}
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
          fg={flashColor(flash.variant)}
          content={clip(flash.message, Math.max(24, appWidth - 40))}
        />
      ) : (
        <text fg="#868e96" content={`${jobCount} jobs`} />
      )}
    </box>
  );
}

export { TAB_OPTIONS };
