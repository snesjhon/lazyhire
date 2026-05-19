/** @jsxImportSource @opentui/react */
import type { UiTheme } from '../../../shared/ui/theme.js';

export interface AboutPanelProps {
  theme: UiTheme;
  height: number;
  focused: boolean;
  activeTab: 'status' | 'profile' | 'answers';
}

export function AboutPanel({ theme, height, focused, activeTab }: AboutPanelProps) {
  return (
    <box
      title="[1] About"
      border
      borderColor={focused ? theme.borderActive : theme.border}
      borderStyle={focused ? 'heavy' : 'single'}
      paddingX={1}
      height={height}
      overflow="hidden"
      flexDirection="column"
    >
      <box flexDirection="row" columnGap={1} paddingX={1}>
        {(['status', 'profile', 'answers'] as const).map((tab) => {
          const label =
            tab === 'status' ? 'Status' : tab === 'profile' ? 'Profile' : 'Answers';
          const isActive = activeTab === tab;
          return (
            <text key={tab} fg={isActive && focused ? theme.brand : theme.muted}>
              {isActive ? (
                <u>
                  <strong>{label}</strong>
                </u>
              ) : (
                label
              )}
            </text>
          );
        })}
      </box>
    </box>
  );
}
