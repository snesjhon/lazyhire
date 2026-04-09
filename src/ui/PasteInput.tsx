import React from 'react';
import { Box, Text } from 'ink';
import { useFocusNode, useKeybindings } from 'giggles';

interface Props {
  label: string;
  hint?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  focusKey?: string;
  placeholder?: string;
  multiline?: boolean;
}

function normalizeInput(input: string, multiline: boolean): string {
  if (input.length === 0) return '';

  const withoutBracketedPaste = input.replace(/\u001b\[200~|\u001b\[201~/g, '');
  return multiline ? withoutBracketedPaste : withoutBracketedPaste.replace(/\r?\n/g, '');
}

function cursorPosition(value: string, index: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(index, value.length));
  const before = value.slice(0, clamped).split('\n');
  return {
    line: before.length - 1,
    column: before[before.length - 1]?.length ?? 0,
  };
}

export default function PasteInput({
  label,
  hint,
  value,
  onChange,
  onSubmit,
  focusKey,
  placeholder,
  multiline = false,
}: Props) {
  const focus = useFocusNode({ focusKey });
  const [internalValue, setInternalValue] = React.useState('');
  const cursorRef = React.useRef((value ?? internalValue).length);
  const [, forceRender] = React.useReducer((count) => count + 1, 0);

  const currentValue = value ?? internalValue;
  const setValue = onChange ?? setInternalValue;
  const lines = (currentValue.length > 0 ? currentValue : '').split('\n');
  const displayLines =
    currentValue.length > 0
      ? lines
      : [focus.hasFocus ? '' : placeholder ?? ''];
  const isPlaceholder = currentValue.length === 0 && !!placeholder;
  const cursorIndex = Math.max(0, Math.min(cursorRef.current, currentValue.length));

  cursorRef.current = cursorIndex;

  function replaceValue(nextValue: string, nextCursor = nextValue.length) {
    cursorRef.current = Math.max(0, Math.min(nextCursor, nextValue.length));
    setValue(nextValue);
  }

  function insertAtCursor(inserted: string) {
    if (inserted.length === 0) return;
    const nextValue =
      currentValue.slice(0, cursorIndex) + inserted + currentValue.slice(cursorIndex);
    replaceValue(nextValue, cursorIndex + inserted.length);
  }

  function moveHorizontal(delta: number) {
    cursorRef.current = Math.max(0, Math.min(cursorIndex + delta, currentValue.length));
    forceRender();
  }

  function moveBoundary(direction: 'home' | 'end') {
    const position = cursorPosition(currentValue, cursorIndex);
    const line = currentValue.split('\n')[position.line] ?? '';
    const start = cursorIndex - position.column;
    cursorRef.current = direction === 'home' ? start : start + line.length;
    forceRender();
  }

  useKeybindings(
    focus,
    {
      left: () => moveHorizontal(-1),
      right: () => moveHorizontal(1),
      home: () => moveBoundary('home'),
      end: () => moveBoundary('end'),
      backspace: () => {
        if (cursorIndex === 0) return;
        replaceValue(
          currentValue.slice(0, cursorIndex - 1) + currentValue.slice(cursorIndex),
          cursorIndex - 1,
        );
      },
      delete: () => {
        if (cursorIndex >= currentValue.length) return;
        replaceValue(
          currentValue.slice(0, cursorIndex) + currentValue.slice(cursorIndex + 1),
          cursorIndex,
        );
      },
      ...(onSubmit
        ? {
            enter: () => {
              onSubmit(multiline ? currentValue.trim() : currentValue);
              if (!onChange) replaceValue('', 0);
            },
          }
        : {}),
    },
    {
      bubble: ['escape', 'tab'],
      fallback: (input, key) => {
        if (multiline && key.ctrl && input === '\u000e') {
          insertAtCursor('\n');
          return;
        }

        if (key.ctrl || input.length === 0) return;

        const normalized = normalizeInput(input, multiline);
        if (normalized.length === 0) return;

        insertAtCursor(normalized);
      },
    },
  );

  const activePosition = cursorPosition(currentValue, cursorIndex);

  return (
    <Box flexDirection="column">
      <Text bold>{label}</Text>
      <Text dimColor>
        {hint ??
          (multiline
            ? 'Enter submits, Ctrl+N inserts a new line'
            : 'Type or paste, then press Enter to submit')}
      </Text>
      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="single"
        borderColor={focus.hasFocus ? 'cyan' : 'gray'}
        paddingX={1}
      >
        {displayLines.map((line, index) => {
          const hasCursor = focus.hasFocus && index === activePosition.line;
          const lineValue = isPlaceholder ? displayLines[index] ?? '' : line;
          const before = hasCursor ? lineValue.slice(0, activePosition.column) : lineValue;
          const cursorChar = hasCursor ? lineValue[activePosition.column] ?? ' ' : '';
          const after = hasCursor ? lineValue.slice(activePosition.column + 1) : '';

          return (
            <Text key={index} dimColor={isPlaceholder}>
              {hasCursor ? (
                <>
                  {before}
                  <Text inverse>{cursorChar}</Text>
                  {after}
                </>
              ) : (
                lineValue
              )}
            </Text>
          );
        })}
      </Box>
      <Text dimColor>{currentValue.length} chars</Text>
    </Box>
  );
}
