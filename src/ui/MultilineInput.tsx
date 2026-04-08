import React from 'react';
import { Box, Text } from 'ink';
import { useFocusNode, useKeybindings } from 'giggles';

interface Props {
  label: string;
  hint?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit: (value: string) => void;
  focusKey?: string;
}

export default function MultilineInput({
  label,
  hint,
  value,
  onChange,
  onSubmit,
  focusKey,
}: Props) {
  const focus = useFocusNode({ focusKey });
  const [internalValue, setInternalValue] = React.useState('');
  const currentValue = value ?? internalValue;
  const setValue = onChange ?? setInternalValue;
  const lines = currentValue.split('\n');

  useKeybindings(
    focus,
    {
      enter: () => {
        onSubmit(currentValue.trim());
        if (!onChange) setInternalValue('');
      },
      backspace: () => setValue(currentValue.slice(0, -1)),
      delete: () => setValue(currentValue.slice(0, -1)),
    },
    {
      bubble: ['escape', 'tab'],
      fallback: (input, key) => {
        if (key.ctrl && input === '\u000e') {
          setValue(`${currentValue}\n`);
          return;
        }

        if (key.ctrl || key.meta || input.length === 0) return;
        setValue(`${currentValue}${input}`);
      },
    },
  );

  return (
    <Box flexDirection="column">
      <Text bold>{label}</Text>
      <Text dimColor>{hint ?? 'Enter to submit, Ctrl+N for a new line'}</Text>
      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="single"
        borderColor={focus.hasFocus ? 'cyan' : 'gray'}
        paddingX={1}
      >
        {lines.map((line, index) => (
          <Text key={index}>
            {line}
            {index === lines.length - 1 ? '█' : ''}
          </Text>
        ))}
      </Box>
      <Text dimColor>{currentValue.length} chars</Text>
    </Box>
  );
}
