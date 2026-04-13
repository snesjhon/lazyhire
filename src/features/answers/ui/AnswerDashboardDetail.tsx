/** @jsxImportSource @opentui/react */
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { AnswerEntry } from '../../../shared/models/types.js';
import {
  DetailFields,
  DetailHeading,
  DetailParagraph,
} from '../../../shared/ui/DetailBlocks.js';

export function renderAnswerDashboardDetail(
  theme: UiTheme,
  answer: AnswerEntry | null,
) {
  if (!answer) {
    return (
      <box flexDirection="column" width="100%">
        <DetailHeading theme={theme}>Answers</DetailHeading>
        <DetailParagraph
          theme={theme}
          content="No saved answers yet."
          marginBottom={0}
        />
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%">
      <DetailHeading theme={theme}>{answer.question}</DetailHeading>
      <DetailFields
        fields={[
          { label: 'Category', value: answer.category },
          { label: 'Company', value: answer.company || 'General' },
          { label: 'Role', value: answer.role || 'General' },
          { label: 'Tone', value: answer.tone || 'none' },
          { label: 'Added', value: answer.added },
          { label: 'Revised', value: answer.revised },
          ...(answer.context
            ? [{ label: 'Context', value: answer.context }]
            : []),
        ]}
      />
      <DetailParagraph theme={theme} content={answer.answer} marginBottom={0} />
    </box>
  );
}
