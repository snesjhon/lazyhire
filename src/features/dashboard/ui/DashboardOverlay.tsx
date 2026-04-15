/** @jsxImportSource @opentui/react */
import {
  type KeyEvent,
  type InputRenderable,
  type TextareaRenderable,
} from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useEffect, useRef, useState } from 'react';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { JobIntakeState } from '../../../shared/ui/state.js';
import Spinner from '../../../shared/ui/Spinner.js';

function isTextareaSubmitKey(key: KeyEvent): boolean {
  return key.ctrl && key.name === 'o';
}

function jobIntakeTitle(jobIntakeState: JobIntakeState): string {
  if (jobIntakeState === 'paste-url') return 'Submit a Job Link';
  if (jobIntakeState === 'paste-description')
    return 'Submit your Job Description (ctrl-o)';
  if (jobIntakeState === 'crawl-failed') return 'Could Not Crawl Job';
  if (jobIntakeState === 'evaluating') return 'Evaluating Job';
  return 'Choose an Intake Mode';
}

interface Props {
  theme: UiTheme;
  jobIntakeState: JobIntakeState;
  width: number;
  height: number;
  evaluatingMessage?: string | null;
  addUrlFailureMessage?: string | null;
  onAddUrl: (url: string) => Promise<void>;
  onAddJd: (jd: string) => Promise<void>;
  onRetryAddManually: () => void;
  onJobIntakeStateChange: (state: JobIntakeState) => void;
  onClose: () => void;
}

export default function DashboardOverlay({
  theme,
  jobIntakeState,
  width,
  height,
  evaluatingMessage,
  addUrlFailureMessage,
  onAddUrl,
  onAddJd,
  onRetryAddManually,
  onJobIntakeStateChange,
  onClose,
}: Props) {
  const [addUrl, setAddUrl] = useState('');
  const [addJd, setAddJd] = useState('');

  const urlInput = useRef<InputRenderable>(null);
  const jdInput = useRef<TextareaRenderable>(null);

  useEffect(() => {
    if (jobIntakeState === 'paste-url') {
      setAddUrl('');
      urlInput.current?.focus();
    }
    if (jobIntakeState === 'paste-description') {
      setAddJd('');
      jdInput.current?.focus();
    }
  }, [jobIntakeState]);

  useKeyboard((key) => {
    if (jobIntakeState === 'evaluating') return;
    if (!isTextareaSubmitKey(key)) return;

    if (jobIntakeState === 'paste-description') {
      void onAddJd(jdInput.current?.plainText ?? '');
    }
  });

  return (
    <box flexDirection="column" height={height} width={width} overflow="hidden">
      <text
        fg={theme.muted}
        content={
          jobIntakeState === 'choose-source'
            ? 'Choose an intake mode. esc=back'
            : jobIntakeState === 'paste-url'
              ? 'Paste a job URL and press Enter. esc=back'
              : jobIntakeState === 'paste-description'
                ? 'Paste a job description. ctrl-o=submit, esc=back'
                : jobIntakeState === 'crawl-failed'
                  ? 'We could not crawl that job page. Choose the next step. esc=back'
                  : 'Please wait while the job is evaluated.'
        }
      />
      {jobIntakeState === 'choose-source' && (
        <select
          height={Math.max(5, height - 2)}
          width={Math.max(20, width)}
          focused
          showDescription
          itemSpacing={1}
          options={[
            {
              name: 'Paste job link',
              description: 'Hydrate and evaluate a URL',
              value: 'paste-url',
            },
            {
              name: 'Paste job description',
              description: 'Save full text, summarize, and evaluate',
              value: 'paste-description',
            },
            {
              name: 'Cancel',
              description: 'Close this menu',
              value: 'none',
            },
          ]}
          {...selectColors(theme)}
          onSelect={(_, option) =>
            onJobIntakeStateChange(
              (option?.value as JobIntakeState | undefined) ?? 'none',
            )
          }
        />
      )}

      {jobIntakeState === 'paste-url' && (
        <box flexDirection="column" marginTop={1} width={Math.max(20, width)}>
          <text fg={theme.heading} content="Job URL" />
          <text fg={theme.muted} content={jobIntakeTitle(jobIntakeState)} />
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

      {jobIntakeState === 'paste-description' && (
        <box flexDirection="column" marginTop={1} overflow="hidden">
          <text fg={theme.heading} content="Job Description" />
          <text fg={theme.muted} content={jobIntakeTitle(jobIntakeState)} />
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

      {jobIntakeState === 'crawl-failed' && (
        <box
          flexDirection="column"
          marginTop={1}
          width={Math.max(20, width)}
          rowGap={1}
        >
          <text fg={theme.heading} content="Could not crawl this job page" />
          <text
            fg={theme.muted}
            content={
              addUrlFailureMessage ??
              "We couldn't extract enough job details from that site."
            }
          />
          <select
            height={6}
            width={Math.max(20, width)}
            focused
            showDescription
            itemSpacing={1}
            options={[
              {
                name: 'Paste job description',
                description: 'Add the job manually instead',
                value: 'manual',
              },
              {
                name: 'Back to add menu',
                description: 'Try another link or cancel',
                value: 'choose-source',
              },
            ]}
            {...selectColors(theme)}
            onSelect={(_, option) => {
              if (option?.value === 'manual') {
                onRetryAddManually();
                return;
              }
              onJobIntakeStateChange('choose-source');
            }}
          />
        </box>
      )}

      {jobIntakeState === 'evaluating' && (
        <box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          height={Math.max(6, height - 2)}
          rowGap={1}
        >
          <Spinner color={theme.warning} name="dots" />
          <text fg={theme.heading} content="Evaluating job" />
          <text
            fg={theme.muted}
            content={
              evaluatingMessage ?? 'Please wait while the job is evaluated.'
            }
          />
          <text
            fg={theme.muted}
            content="The item will open once evaluation finishes."
          />
        </box>
      )}
    </box>
  );
}
