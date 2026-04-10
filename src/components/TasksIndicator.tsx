/** @jsxImportSource @opentui/react */

interface Props {
  tasks: string[];
}

export default function TasksIndicator({ tasks }: Props) {
  if (tasks.length === 0) return null;
  return (
    <box border borderColor="#f5c542" marginTop={1} paddingX={1}>
      <text
        fg="#f5c542"
        content={`${tasks[0]}${tasks.length > 1 ? ` (+${tasks.length - 1} more)` : ''}`}
      />
    </box>
  );
}
