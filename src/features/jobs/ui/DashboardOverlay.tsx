/** @jsxImportSource @opentui/react */
import {
  type KeyEvent,
  type InputRenderable,
  type TextareaRenderable,
} from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef, useState } from 'react';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { Overlay } from '../../../shared/ui/state.js';

function isTextareaSubmitKey(key: KeyEvent): boolean {
  return key.ctrl && key.name === 'o';
}

function overlayTitle(overlay: Overlay): string {
  if (overlay === 'add-url') return 'Submit a Job Link';
  if (overlay === 'add-jd') return 'Submit your Job Description (ctrl-o)';
  return 'Choose an Intake Mode';
}

interface Props {
  theme: UiTheme;
  overlay: Overlay;
  width: number;
  height: number;
  onAddUrl: (url: string) => Promise<void>;
  onAddJd: (jd: string) => Promise<void>;
  onOverlayChange: (overlay: Overlay) => void;
  onClose: () => void;
}

export default function DashboardOverlay({
  theme,
  overlay,
  width,
  height,
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
    <box flexDirection="column" height={height} width={width} overflow="hidden">
      <text
        fg={theme.muted}
        content={
          overlay === 'add'
            ? 'Choose an intake mode. esc=back'
            : overlay === 'add-url'
              ? 'Paste a job URL and press Enter. esc=back'
              : 'Paste a job description. ctrl-o=submit, esc=back'
        }
      />
      {overlay === 'add' && (
        <select
          height={Math.max(5, height - 2)}
          width={Math.max(20, width)}
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
        <box flexDirection="column" marginTop={1} width={Math.max(20, width)}>
          <text fg={theme.heading} content="Job URL" />
          <text fg={theme.muted} content={overlayTitle(overlay)} />
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
        <box flexDirection="column" marginTop={1} overflow="hidden">
          <text fg={theme.heading} content="Job Description" />
          <text fg={theme.muted} content={overlayTitle(overlay)} />
          <textarea
            ref={jdInput}
            height={Math.max(6, height - 4)}
            initialValue={addJd}
            placeholder="Paste the job description."
            onContentChange={() => setAddJd(jdInput.current?.plainText ?? '')}
            onSubmit={() => void onAddJd(jdInput.current?.plainText ?? '')}
            focused
          />
        </box>
      )}
    </box>
  );
}
