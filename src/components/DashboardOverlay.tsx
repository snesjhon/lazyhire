/** @jsxImportSource @opentui/react */
import {
  type KeyEvent,
  type InputRenderable,
  type TextareaRenderable,
} from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef, useState } from 'react';
import type { UiTheme } from '../theme.js';
import type { Overlay } from '../ui.js';

function isTextareaSubmitKey(key: KeyEvent): boolean {
  return key.ctrl && key.name === 'o';
}

function overlayTitle(overlay: Overlay): string {
  if (overlay === 'add-jd') return 'Submit your Job Description (ctrl-o)';
  return 'Action';
}

interface Props {
  theme: UiTheme;
  overlay: Overlay;
  onAddUrl: (url: string) => Promise<void>;
  onAddJd: (jd: string) => Promise<void>;
  onOverlayChange: (overlay: Overlay) => void;
  onClose: () => void;
}

export default function DashboardOverlay({
  theme,
  overlay,
  onAddUrl,
  onAddJd,
  onOverlayChange,
  onClose,
}: Props) {
  const [addUrl, setAddUrl] = useState('');
  const [addJd, setAddJd] = useState('');

  const urlInput = useRef<InputRenderable>(null);
  const jdInput = useRef<TextareaRenderable>(null);

  useEffect(() => {
    if (overlay === 'add-url') { setAddUrl(''); urlInput.current?.focus(); }
    if (overlay === 'add-jd') { setAddJd(''); jdInput.current?.focus(); }
  }, [overlay]);

  useKeyboard((key) => {
    if (!isTextareaSubmitKey(key)) return;

    if (overlay === 'add-jd') {
      void onAddJd(jdInput.current?.plainText ?? '');
    }
  });

  return (
    <box
      title={overlayTitle(overlay)}
      border
      borderColor={theme.warning}
      marginTop={1}
      padding={1}
      height={9}
      flexDirection="column"
    >
      {overlay === 'add' && (
        <select
          height={5}
          focused
          options={[
            {
              name: 'Paste job link',
              description: 'Hydrate and evaluate a URL',
              value: 'add-url',
            },
            {
              name: 'Paste job description',
              description: 'Save full text, summarize, and evaluate',
              value: 'add-jd',
            },
            {
              name: 'Cancel',
              description: 'Close this menu',
              value: 'none',
            },
          ]}
          backgroundColor={theme.transparent}
          focusedBackgroundColor={theme.transparent}
          selectedBackgroundColor={theme.transparent}
          onSelect={(_, option) =>
            onOverlayChange((option?.value as Overlay | undefined) ?? 'none')
          }
        />
      )}

      {overlay === 'add-url' && (
        <box flexDirection="column">
          <text fg={theme.muted} content="Job URL" />
          <input
            ref={urlInput}
            value={addUrl}
            placeholder="https://company.example/jobs/123"
            onInput={setAddUrl}
            onSubmit={(value: unknown) => {
              if (typeof value === 'string') void onAddUrl(value);
            }}
            focused
          />
        </box>
      )}

      {overlay === 'add-jd' && (
        <textarea
          ref={jdInput}
          height={7}
          initialValue={addJd}
          placeholder="Paste the job description."
          onContentChange={() => setAddJd(jdInput.current?.plainText ?? '')}
          onSubmit={() => void onAddJd(jdInput.current?.plainText ?? '')}
          focused
        />
      )}
    </box>
  );
}
