/** @jsxImportSource @opentui/react */
import type { ReactNode } from 'react';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { FocusTarget } from '../../../shared/ui/state.js';
import type { ProfileActionView } from '../../profile/ui/ProfileActionWorkspace.js';
import { PROFILE_OPTIONS } from '../../profile/ui/ProfileDashboardDetail.js';

export interface AnswerOption {
  name: string;
  description: string;
  value: string;
}

export interface DetailPanelProps {
  theme: UiTheme;
  width: number;
  height: number;
  focus: FocusTarget;
  workspaceVisible: boolean;
  title: string;
  showProfileList: boolean;
  showAnswerList: boolean;
  profileIndex: number;
  answerIndex: number;
  answerOptions: AnswerOption[];
  detailContent: ReactNode;
  onProfileIndexChange: (index: number) => void;
  onAnswerIndexChange: (index: number) => void;
  onOpenProfileActions: (view: ProfileActionView) => void;
  onOpenSavedAnswer: (answerId: string) => void;
}

export function DetailPanel({
  theme,
  width,
  height,
  focus,
  workspaceVisible,
  title,
  showProfileList,
  showAnswerList,
  profileIndex,
  answerIndex,
  answerOptions,
  detailContent,
  onProfileIndexChange,
  onAnswerIndexChange,
  onOpenProfileActions,
  onOpenSavedAnswer,
}: DetailPanelProps) {
  const isActive = focus === 'detail' || workspaceVisible;
  const detailFocused = focus === 'detail' && !workspaceVisible;
  const listHeight = Math.max(4, height - 4);

  return (
    <box width={width} flexDirection="column" overflow="hidden">
      <box
        title={title}
        border
        borderColor={isActive ? theme.borderActive : theme.border}
        paddingX={2}
        paddingTop={1}
        height={height}
        borderStyle={isActive ? 'heavy' : 'single'}
        overflow="hidden"
      >
        {showProfileList ? (
          <select
            height={listHeight}
            width="100%"
            options={PROFILE_OPTIONS}
            selectedIndex={profileIndex}
            showDescription={false}
            {...selectColors(theme)}
            selectedTextColor={detailFocused ? theme.brand : theme.muted}
            focused={detailFocused}
            onChange={(_, option) => {
              const idx = PROFILE_OPTIONS.findIndex((o) => o.value === option?.value);
              if (idx >= 0) onProfileIndexChange(idx);
            }}
            onSelect={(_, option) => {
              const idx = PROFILE_OPTIONS.findIndex((o) => o.value === option?.value);
              if (idx >= 0) {
                onProfileIndexChange(idx);
                onOpenProfileActions(PROFILE_OPTIONS[idx]!.value);
              }
            }}
          />
        ) : showAnswerList ? (
          answerOptions.length === 0 ? (
            <text fg={theme.muted} content="No saved answers yet." />
          ) : (
            <select
              height={listHeight}
              width="100%"
              options={answerOptions}
              selectedIndex={answerIndex}
              showDescription
              {...selectColors(theme)}
              selectedTextColor={detailFocused ? theme.brand : theme.muted}
              focused={detailFocused}
              onChange={(_, option) => {
                const idx = answerOptions.findIndex((o) => o.value === option?.value);
                if (idx >= 0) onAnswerIndexChange(idx);
              }}
              onSelect={(_, option) => {
                if (option?.value) onOpenSavedAnswer(String(option.value));
              }}
            />
          )
        ) : (
          <scrollbox
            height={height - 2}
            width="100%"
            scrollX={false}
            scrollY
            focused={focus === 'detail' && !workspaceVisible}
            rootOptions={{ overflow: 'hidden' }}
            wrapperOptions={{ overflow: 'hidden' }}
            viewportOptions={{ overflow: 'hidden' }}
            contentOptions={{ overflow: 'hidden' }}
            scrollbarOptions={{ showArrows: true }}
          >
            <box
              flexDirection="column"
              width={Math.max(20, width - 6)}
              flexGrow={1}
            >
              {detailContent}
            </box>
          </scrollbox>
        )}
      </box>
    </box>
  );
}
