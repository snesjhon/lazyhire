/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import type { InputRenderable } from '@opentui/core';
import { execSync } from 'child_process';
import { useEffect, useRef, useState } from 'react';
import { answersDb } from '../../../shared/data/db.js';
import { loadProfile } from '../../../shared/models/profile.js';
import type { AnswerEntry } from '../../../shared/models/types.js';
import Spinner from '../../../shared/ui/Spinner.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import { clip } from '../../../shared/lib/utils.js';
import { refineAnswer } from '../services/answers.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  theme: UiTheme;
  answer: AnswerEntry;
  width: number;
  height: number;
  onClose: () => void;
  onSaved: (message: string) => void;
  onDeleted: (message: string) => void;
}

export default function SavedAnswerWorkspace({
  theme,
  answer,
  width,
  height,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [copyFlash, setCopyFlash] = useState(false);
  const [step, setStep] = useState<'view' | 'ask-refine' | 'refining'>('view');
  const [refineDraft, setRefineDraft] = useState('');
  const [generatedAnswer, setGeneratedAnswer] = useState(answer.answer);
  const refineInputRef = useRef<InputRenderable>(null);
  // height is used only to size the scrollbox viewport — layout is flex-based
  const scrollHeight = Math.max(6, height - 6);

  useEffect(() => {
    setStep('view');
    setRefineDraft('');
    setGeneratedAnswer(answer.answer);
  }, [answer.id, answer.answer]);

  useEffect(() => {
    if (step === 'ask-refine') refineInputRef.current?.focus();
  }, [step]);

  function copyToClipboard(text: string) {
    try {
      execSync('pbcopy', { input: text });
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1500);
    } catch {
      // pbcopy unavailable
    }
  }

  async function handleRefineSubmit(value: string) {
    const request = value.trim();
    if (!request) return;
    setRefineDraft(request);
    setStep('refining');

    try {
      const profile = loadProfile();
      const refined = await refineAnswer(
        answer.question,
        generatedAnswer,
        request,
        profile,
      );
      answersDb.updateAnswer(answer.id, {
        answer: refined,
        revised: today(),
      });
      setGeneratedAnswer(refined);
      setRefineDraft('');
      setStep('view');
      onSaved(`Updated saved answer #${answer.id}.`);
    } catch (error) {
      setStep('ask-refine');
      onSaved(`Refinement failed: ${String(error)}`);
    }
  }

  function handleDelete() {
    answersDb.removeAnswer(answer.id);
    onDeleted(`Deleted saved answer #${answer.id}.`);
  }

  useKeyboard((key) => {
    if (step === 'refining') return;
    if (step === 'ask-refine') {
      if (key.name === 'escape') {
        setRefineDraft('');
        setStep('view');
      }
      return;
    }
    if (key.name === 'escape') {
      onClose();
      return;
    }
    if (key.name === 'r') {
      setRefineDraft('');
      setStep('ask-refine');
    }
    if (key.name === 'c') copyToClipboard(generatedAnswer);
    if (key.name === 'd') handleDelete();
  });

  return (
    <box flexDirection="column" overflow="hidden" flexGrow={1}>
      <text
        fg={theme.brand}
        content={`${answer.originJobId ? `Application #${answer.company}` : 'Saved answer'}`}
      />
      <text
        fg={theme.answerCategoryColors[answer.category]}
        content={`${answer.category} · ${answer.tone || 'No tone'}`}
        paddingBottom={1}
      />
      <text fg={theme.heading} paddingBottom={1}>
        <strong>{clip(answer.question, width - 4)}</strong>
      </text>
      {step === 'view' ? (
        <scrollbox
          height={scrollHeight - 4}
          width="100%"
          scrollX={false}
          scrollY
          focused
          rootOptions={{ overflow: 'hidden' }}
          wrapperOptions={{ overflow: 'hidden' }}
          viewportOptions={{ overflow: 'hidden' }}
          contentOptions={{ overflow: 'hidden' }}
          scrollbarOptions={{ showArrows: true }}
        >
          <text
            width={Math.max(20, width - 4)}
            maxWidth={Math.max(20, width - 4)}
            wrapMode="char"
            content={generatedAnswer}
          />
        </scrollbox>
      ) : null}

      {answer.context ? (
        <text
          fg={theme.muted}
          content={`Context: ${clip(answer.context, width - 12)}`}
          marginY={1}
        />
      ) : null}

      {step === 'ask-refine' ? (
        <box flexDirection="column" marginTop={1}>
          <text fg={theme.heading} content="Refinement request" />
          <input
            ref={refineInputRef}
            value={refineDraft}
            placeholder="e.g. Make it sharper and more specific."
            onInput={setRefineDraft}
            focused
            onSubmit={(value: unknown) => {
              if (typeof value === 'string') void handleRefineSubmit(value);
            }}
          />
        </box>
      ) : null}

      {step === 'refining' ? (
        <box flexDirection="row" columnGap={1} marginTop={1}>
          <Spinner color={theme.warning} />
          <text fg={theme.warning} content="Refining saved answer..." />
        </box>
      ) : null}

      <box flexDirection="row" columnGap={1}>
        {copyFlash ? (
          <text fg={theme.success} content="Copied!" />
        ) : (
          <>
            <text fg={theme.footer} content="r=refine" />
            <text fg={theme.muted} content="|" />
            <text fg={theme.footer} content="c=copy" />
            <text fg={theme.muted} content="|" />
            <text fg={theme.footer} content="d=delete" />
            <text fg={theme.muted} content="|" />
            <text fg={theme.footer} content="esc=back" />
          </>
        )}
      </box>
    </box>
  );
}
