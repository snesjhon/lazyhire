/** @jsxImportSource @opentui/react */
import type { UiTheme } from './theme.js';

export function DetailHeading({
  theme,
  children,
}: {
  theme: UiTheme;
  children: string;
}) {
  return (
    <text fg={theme.heading} marginBottom={1}>
      <strong>{children}</strong>
    </text>
  );
}

export function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <text>
      <strong>{label}:</strong> {value}
    </text>
  );
}

export function DetailParagraph({
  theme,
  content,
  muted = false,
  marginBottom = 1,
}: {
  theme: UiTheme;
  content: string;
  muted?: boolean;
  marginBottom?: number;
}) {
  return (
    <text
      fg={muted ? theme.muted : theme.text}
      content={content}
      marginBottom={marginBottom}
    />
  );
}

export function DetailList({
  theme,
  items,
  marginBottom = 1,
}: {
  theme: UiTheme;
  items: string[];
  marginBottom?: number;
}) {
  return (
    <box flexDirection="column" marginBottom={marginBottom}>
      {items.map((item, index) => (
        <text key={`${item}-${index}`} fg={theme.text} content={`- ${item}`} />
      ))}
    </box>
  );
}

export function DetailFields({
  fields,
  marginBottom = 1,
}: {
  fields: Array<{ label: string; value: string }>;
  marginBottom?: number;
}) {
  return (
    <box flexDirection="column" marginBottom={marginBottom}>
      {fields.map((field) => (
        <DetailField
          key={field.label}
          label={field.label}
          value={field.value}
        />
      ))}
    </box>
  );
}
