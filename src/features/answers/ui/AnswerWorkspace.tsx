/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import type {
  InputRenderable,
  SelectOption,
  TextareaOptions,
  TextareaRenderable,
} from '@opentui/core';
import { execSync } from 'child_process';
import { useEffect, useRef, useState } from 'react';
import { answersDb } from '../../../shared/data/db.js';
import { clip } from '../../../shared/lib/utils.js';
import { loadProfile } from '../../../shared/models/profile.js';
import Spinner from '../../../shared/ui/Spinner.js';
import {
  TONE_OPTIONS,
  detectCategory,
  generateAnswer,
  refineAnswer,
} from '../services/answers.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { AnswerCategory, Job } from '../../../shared/models/types.js';

export type AnswerStep =
  | 'ask-question'
  | 'detecting'
  | 'ask-tone'
  | 'ask-context'
  | 'generating'
  | 'review'
  | 'ask-refine'
  | 'refining';

export interface AnswerDraft {
  step: AnswerStep;
  question: string;
  questionDraft: string;
  category: AnswerCategory;
  tone: string;
  contextDraft: string;
  refineDraft: string;
  generatedAnswer: string;
  statusLine: string;
}

const TEXTAREA_SUBMIT_KEY_BINDINGS: NonNullable<
  TextareaOptions['keyBindings']
> = [{ name: 'o', ctrl: true, action: 'submit' }];

const CATEGORY_LABEL: Record<AnswerCategory, string> = {
  identity: 'Identity',
  motivation: 'Motivation',
  behavioral: 'Behavioral',
  strengths: 'Strengths',
  vision: 'Vision',
  culture: 'Culture',
  situational: 'Situational',
  other: 'Other',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  theme: UiTheme;
  job: Job;
  width: number;
  height: number;
  draft: AnswerDraft;
  onDraftChange: (draft: AnswerDraft) => void;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function AnswerWorkspace({
  theme,
  job,
  width,
  height,
  draft,
  onDraftChange,
  onClose,
  onSaved,
}: Props) {
  const [copyFlash, setCopyFlash] = useState(false);

  const questionInputRef = useRef<InputRenderable>(null);
  const contextInputRef = useRef<TextareaRenderable>(null);
  const refineInputRef = useRef<InputRenderable>(null);

  const isInputStep =
    draft.step === 'ask-question' ||
    draft.step === 'ask-context' ||
    draft.step === 'ask-refine';
  const isSpinning =
    draft.step === 'detecting' ||
    draft.step === 'generating' ||
    draft.step === 'refining';
  const scrollHeight = Math.max(6, height - 10);

  function updateDraft(patch: Partial<AnswerDraft>) {
    onDraftChange({
      ...draft,
      ...patch,
    });
  }

  useEffect(() => {
    if (draft.step === 'ask-question') questionInputRef.current?.focus();
    if (draft.step === 'ask-context') contextInputRef.current?.focus();
    if (draft.step === 'ask-refine') refineInputRef.current?.focus();
  }, [draft.step]);

  function copyToClipboard(text: string) {
    try {
      execSync('pbcopy', { input: text });
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1500);
    } catch {
      // pbcopy unavailable
    }
  }

  async function handleQuestionSubmit(value: string) {
    const nextQuestion = value.trim();
    if (!nextQuestion) return;
    updateDraft({
      question: nextQuestion,
      questionDraft: nextQuestion,
      statusLine: `Detecting category for: "${clip(nextQuestion, 50)}"...`,
      step: 'detecting',
    });

    try {
      const detected = await detectCategory(nextQuestion);
      updateDraft({
        category: detected,
        statusLine: `Categorized as ${CATEGORY_LABEL[detected]}. What tone would you like?`,
        step: 'ask-tone',
      });
    } catch {
      updateDraft({
        category: 'other',
        statusLine: 'What tone would you like?',
        step: 'ask-tone',
      });
    }
  }

  function handleToneSelect(selected: string) {
    updateDraft({
      tone: selected,
      statusLine:
        `Any extra angle to include? Ctrl+O skips. ${job.company || ''}`.trim(),
      step: 'ask-context',
    });
  }

  async function handleContextSubmit(value: string) {
    const context = value.trim();
    updateDraft({
      contextDraft: context,
      statusLine: 'Generating your answer...',
      step: 'generating',
    });

    try {
      const profile = loadProfile();
      const answer = await generateAnswer(
        draft.question,
        draft.category,
        draft.tone,
        context,
        profile,
        job,
      );
      updateDraft({
        contextDraft: context,
        generatedAnswer: answer,
        statusLine:
          'Answer ready. s=save  r=refine  c=copy  1-4=jump  esc=close',
        step: 'review',
      });
    } catch (error) {
      updateDraft({
        statusLine: `Generation failed: ${String(error)}. 1-3=edit  esc=close`,
        step: 'ask-context',
      });
    }
  }

  async function handleRefineSubmit(value: string) {
    const request = value.trim();
    if (!request) return;
    updateDraft({
      refineDraft: request,
      statusLine: 'Refining...',
      step: 'refining',
    });

    try {
      const profile = loadProfile();
      const refined = await refineAnswer(
        draft.question,
        draft.generatedAnswer,
        request,
        profile,
        job,
      );
      updateDraft({
        refineDraft: '',
        generatedAnswer: refined,
        statusLine:
          'Refined. s=save  r=refine again  c=copy  1-4=jump  esc=close',
        step: 'review',
      });
    } catch (error) {
      updateDraft({
        statusLine: `Refinement failed: ${String(error)}.`,
        step: 'ask-refine',
      });
    }
  }

  function handleSave() {
    const id = answersDb.nextAnswerId();
    answersDb.addAnswer({
      id,
      question: draft.question,
      category: draft.category,
      answer: draft.generatedAnswer,
      tone: draft.tone,
      context: draft.contextDraft,
      originJobId: job.id,
      company: job.company || null,
      role: job.role || null,
      added: today(),
      revised: today(),
    });
    onSaved(`Saved answer for #${job.id} to your library.`);
    onClose();
  }

  useKeyboard((key) => {
    if (isSpinning) return;

    if (key.name === 'escape') {
      if (draft.step === 'ask-refine') {
        updateDraft({ step: 'review', refineDraft: '' });
        return;
      }
      if (draft.step === 'ask-context') {
        updateDraft({ step: 'ask-tone' });
        return;
      }
      if (draft.step === 'ask-tone') {
        updateDraft({
          step: 'ask-question',
          statusLine: `Write a question for ${job.company || 'this company'}.`,
        });
        return;
      }
      onClose();
      return;
    }

    if (key.name === '1') {
      updateDraft({
        step: 'ask-question',
        statusLine: `Write a question for ${job.company || 'this company'}.`,
      });
      return;
    }
    if (key.name === '2' && draft.question.trim()) {
      updateDraft({
        step: 'ask-tone',
        statusLine: 'What tone would you like?',
      });
      return;
    }
    if (key.name === '3' && draft.question.trim() && draft.tone.trim()) {
      updateDraft({
        step: 'ask-context',
        statusLine:
          `Any extra angle to include? Ctrl+O skips. ${job.company || ''}`.trim(),
      });
      return;
    }
    if (key.name === '4' && draft.generatedAnswer.trim()) {
      updateDraft({
        step: 'review',
        statusLine:
          'Answer ready. s=save  r=refine  c=copy  1-4=jump  esc=close',
      });
      return;
    }

    if (draft.step === 'review') {
      if (key.name === 's') handleSave();
      if (key.name === 'r') {
        updateDraft({
          refineDraft: '',
          statusLine: 'How should this be refined?',
          step: 'ask-refine',
        });
      }
      if (key.name === 'c') copyToClipboard(draft.generatedAnswer);
    }
  });

  const toneOptions: SelectOption[] = TONE_OPTIONS.map((item) => ({
    name: item,
    description: '',
    value: item,
  }));

  const spinnerLabel =
    draft.step === 'detecting'
      ? 'Detecting category...'
      : draft.step === 'generating'
        ? 'Generating answer...'
        : 'Refining...';

  return (
    <box flexDirection="column" overflow="hidden">
      <text
        fg={theme.brand}
        content={`${job.company || 'Unknown Company'} · ${job.role || 'Untitled Role'}`}
      />
      {draft.statusLine ? (
        <text fg={theme.muted} content={draft.statusLine} />
      ) : null}
      <box flexDirection="column" marginTop={1}>
        <text
          fg={
            draft.step === 'ask-question' || draft.step === 'detecting'
              ? theme.brand
              : theme.text
          }
          content={`1. Question   ${draft.question.trim() ? clip(draft.question, width - 18) : 'Not set'}`}
        />
        <text
          fg={draft.step === 'ask-tone' ? theme.brand : theme.text}
          content={`2. Tone       ${draft.tone || 'Not set'}`}
        />
        <text
          fg={
            draft.step === 'ask-context' || draft.step === 'generating'
              ? theme.brand
              : theme.text
          }
          content={`3. Context    ${draft.contextDraft.trim() ? 'Custom notes added' : 'No extra notes'}`}
        />
        <text
          fg={
            draft.step === 'review' ||
            draft.step === 'ask-refine' ||
            draft.step === 'refining'
              ? theme.brand
              : theme.text
          }
          content={`4. Answer     ${draft.generatedAnswer.trim() ? 'Generated' : 'Not generated'}`}
        />
      </box>
      {draft.question && draft.step !== 'ask-question' ? (
        <text
          fg={theme.answerCategoryColors[draft.category]}
          content={`Question: ${clip(draft.question, width - 6)}`}
        />
      ) : null}

      {draft.step === 'review' && draft.generatedAnswer ? (
        <scrollbox
          height={scrollHeight}
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
            content={draft.generatedAnswer}
          />
        </scrollbox>
      ) : null}

      {isSpinning ? (
        <box flexDirection="row" columnGap={1}>
          <Spinner color={theme.warning} />
          <text fg={theme.warning} content={spinnerLabel} />
        </box>
      ) : null}

      {draft.step === 'ask-question' ? (
        <box flexDirection="column" marginTop={1}>
          <text fg={theme.heading} content="Question" />
          <input
            ref={questionInputRef}
            value={draft.questionDraft}
            placeholder="e.g. Why do you want to work here?"
            onInput={(value) => updateDraft({ questionDraft: value })}
            focused
            onSubmit={(value: unknown) => {
              if (typeof value === 'string') void handleQuestionSubmit(value);
            }}
          />
        </box>
      ) : null}

      {draft.step === 'ask-tone' ? (
        <box flexDirection="column" marginTop={1}>
          <select
            height={Math.min(5, TONE_OPTIONS.length + 1)}
            width="100%"
            options={toneOptions}
            selectedIndex={Math.max(
              0,
              TONE_OPTIONS.indexOf(draft.tone as (typeof TONE_OPTIONS)[number]),
            )}
            focused
            backgroundColor={theme.transparent}
            focusedBackgroundColor={theme.transparent}
            selectedBackgroundColor={theme.transparent}
            selectedTextColor={theme.brand}
            onSelect={(_, option) => {
              if (option?.value) handleToneSelect(String(option.value));
            }}
          />
        </box>
      ) : null}

      {draft.step === 'ask-context' ? (
        <box flexDirection="column" marginTop={1}>
          <text fg={theme.heading} content="Context (optional)" />
          <textarea
            ref={contextInputRef}
            height={4}
            initialValue={draft.contextDraft}
            placeholder="Company values, examples, or the angle to emphasize..."
            keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
            onContentChange={() =>
              updateDraft({
                contextDraft: contextInputRef.current?.plainText ?? '',
              })
            }
            onSubmit={() =>
              void handleContextSubmit(contextInputRef.current?.plainText ?? '')
            }
            focused
          />
        </box>
      ) : null}

      {draft.step === 'ask-refine' ? (
        <box flexDirection="column" marginTop={1}>
          <text fg={theme.heading} content="Refinement request" />
          <input
            ref={refineInputRef}
            value={draft.refineDraft}
            placeholder="e.g. Make it shorter and more specific."
            onInput={(value) => updateDraft({ refineDraft: value })}
            focused
            onSubmit={(value: unknown) => {
              if (typeof value === 'string') void handleRefineSubmit(value);
            }}
          />
        </box>
      ) : null}

      <box flexDirection="row" columnGap={1} marginTop={1}>
        {copyFlash ? (
          <text fg={theme.success} content="Copied!" />
        ) : (
          <>
            {draft.step === 'review' ? (
              <text fg={theme.footer} content="s=save" />
            ) : null}
            {draft.step === 'review' ? (
              <text fg={theme.muted} content="|" />
            ) : null}
            {draft.step === 'review' ? (
              <text fg={theme.footer} content="r=refine" />
            ) : null}
            {draft.step === 'review' ? (
              <text fg={theme.muted} content="|" />
            ) : null}
            {draft.step === 'review' ? (
              <text fg={theme.footer} content="c=copy" />
            ) : null}
            {draft.step === 'review' ? (
              <text fg={theme.muted} content="|" />
            ) : null}
            <text fg={theme.footer} content="1-4=jump" />
            <text fg={theme.muted} content="|" />
            <text fg={theme.footer} content="esc=back" />
          </>
        )}
      </box>
    </box>
  );
}
