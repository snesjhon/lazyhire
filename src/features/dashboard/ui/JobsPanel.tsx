/** @jsxImportSource @opentui/react */
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';

export interface JobOption {
  name: string;
  description: string;
  value: string;
}

export interface JobsPanelProps {
  theme: UiTheme;
  height: number;
  focused: boolean;
  filter: string;
  filters: ReadonlyArray<string>;
  jobOptions: JobOption[];
  selectedIndex: number;
  onJobSelect: (jobId: string) => void;
  onOpenActions: () => void;
}

export function JobsPanel({
  theme,
  height,
  focused,
  filter,
  filters,
  jobOptions,
  selectedIndex,
  onJobSelect,
  onOpenActions,
}: JobsPanelProps) {
  const listHeight = height - 1;

  return (
    <box
      title="[2] Jobs"
      border
      borderColor={focused ? theme.borderActive : theme.border}
      paddingX={1}
      height={height + 2}
      borderStyle={focused ? 'heavy' : 'single'}
      overflow="hidden"
      flexDirection="column"
    >
      <box flexDirection="row" columnGap={1} paddingX={1} marginBottom={2}>
        {filters.map((item) => (
          <text key={item} fg={item === filter && focused ? theme.brand : theme.muted}>
            {item === filter ? (
              <u>
                <strong>{item}</strong>
              </u>
            ) : (
              item
            )}
          </text>
        ))}
      </box>
      {jobOptions.length > 0 ? (
        <select
          height={listHeight}
          width="100%"
          options={jobOptions}
          selectedIndex={selectedIndex}
          showDescription
          showScrollIndicator
          itemSpacing={1}
          {...selectColors(theme)}
          selectedTextColor={focused ? theme.brand : theme.muted}
          focused={focused}
          onChange={(_, option) => {
            if (option?.value) onJobSelect(String(option.value));
          }}
          onSelect={(_, option) => {
            if (option?.value) onJobSelect(String(option.value));
            onOpenActions();
          }}
        />
      ) : (
        <text fg={theme.muted} content="No jobs yet. Press a to add one." />
      )}
    </box>
  );
}
