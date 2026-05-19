/** @jsxImportSource @opentui/react */
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';

export interface DiscoveryPanelProps {
  theme: UiTheme;
  height: number;
  focused: boolean;
  menuIndex: number;
  hasSourcedCompanies: boolean;
  pendingJobCount: number;
}

export function DiscoveryPanel({
  theme,
  height,
  focused,
  menuIndex,
  hasSourcedCompanies,
  pendingJobCount,
}: DiscoveryPanelProps) {
  const listHeight = height - 2;

  const options = [
    {
      name: 'Source Companies',
      description: 'Run first · refreshes company list',
      value: 'source',
    },
    {
      name: `Scan Jobs${!hasSourcedCompanies ? ' [locked]' : ''}`,
      description: hasSourcedCompanies
        ? 'Find new openings at tracked companies'
        : 'Run Source Companies first',
      value: 'scan',
    },
    ...(pendingJobCount > 0
      ? [
          {
            name: `${pendingJobCount} pending job${pendingJobCount === 1 ? '' : 's'} to evaluate`,
            description: 'Review discovered jobs · add to queue',
            value: 'queue',
          },
        ]
      : []),
  ];

  return (
    <box
      title="[3] Discovery"
      border
      borderColor={focused ? theme.borderActive : theme.border}
      borderStyle={focused ? 'heavy' : 'single'}
      paddingX={1}
      height={height}
      overflow="hidden"
      flexDirection="column"
    >
      <select
        height={listHeight}
        width="100%"
        options={options}
        selectedIndex={menuIndex}
        showDescription
        showScrollIndicator
        {...selectColors(theme)}
        selectedTextColor={focused ? theme.brand : theme.muted}
        focused={focused}
      />
    </box>
  );
}
