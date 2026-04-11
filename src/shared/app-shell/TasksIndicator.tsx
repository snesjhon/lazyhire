/** @jsxImportSource @opentui/react */
import type { UiTheme } from '../ui/theme.js';

interface Props {
  tasks: string[];
  theme: UiTheme;
}

export default function TasksIndicator({ tasks, theme }: Props) {
  if (tasks.length === 0) return null;
  return (
    <box border borderColor={theme.warning} marginTop={1} paddingX={1}>
      <text
        fg={theme.warning}
        content={`${tasks[0]}${tasks.length > 1 ? ` (+${tasks.length - 1} more)` : ''}`}
      />
    </box>
  );
}
