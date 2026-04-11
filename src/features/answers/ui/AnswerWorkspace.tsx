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

type Step =
  | 'ask-question'
  | 'detecting'
  | 'ask-tone'
  | 'ask-context'
  | 'generating'
  | 'review'
  | 'ask-refine'
  | 'refining';

const TEXTAREA_SUBMIT_KEY_BINDINGS: NonNullable<TextareaOptions['keyBindings']> = [
  { name: 'o', ctrl: true, action: 'submit' },
];

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
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function AnswerWorkspace({
  theme,
  job,
  width,
  height,
  onClose,
  onSaved,
}: Props) {
  const [step, setStep] = useState<Step>('ask-question');
  const [copyFlash, setCopyFlash] = useState(false);
  const [question, setQuestion] = useState('');
  const [questionDraft, setQuestionDraft] = useState('');
  const [category, setCategory] = useState<AnswerCategory>('other');
  const [tone, setTone] = useState('');
  const [contextDraft, setContextDraft] = useState('');
  const [refineDraft, setRefineDraft] = useState('');
  const [generatedAnswer, setGeneratedAnswer] = useState('');
  const [statusLine, setStatusLine] = useState(
    `Write a question for ${job.company || 'this company'}.`,
  );

  const questionInputRef = useRef<InputRenderable>(null);
  const contextInputRef = useRef<TextareaRenderable>(null);
  const refineInputRef = useRef<InputRenderable>(null);

  const isInputStep = step === 'ask-question' || step === 'ask-context' || step === 'ask-refine';
  const isSpinning = step === 'detecting' || step === 'generating' || step === 'refining';
  const scrollHeight = Math.max(6, height - 10);

  useEffect(() => {
    setStep('ask-question');
    setQuestion('');
    setQuestionDraft('');
    setCategory('other');
    setTone('');
    setContextDraft('');
    setRefineDraft('');
    setGeneratedAnswer('');
    setStatusLine(`Write a question for ${job.company || 'this company'}.`);
  }, [job.id, job.company]);

  useEffect(() => {
    if (step === 'ask-question') questionInputRef.current?.focus();
    if (step === 'ask-context') contextInputRef.current?.focus();
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

  async function handleQuestionSubmit(value: string) {
    const nextQuestion = value.trim();
    if (!nextQuestion) return;
    setQuestion(nextQuestion);
    setQuestionDraft('');
    setStatusLine(`Detecting category for: "${clip(nextQuestion, 50)}"...`);
    setStep('detecting');

    try {
      const detected = await detectCategory(nextQuestion);
      setCategory(detected);
      setStatusLine(`Categorized as ${CATEGORY_LABEL[detected]}. What tone would you like?`);
    } catch {
      setCategory('other');
      setStatusLine('What tone would you like?');
    }

    setStep('ask-tone');
  }

  function handleToneSelect(selected: string) {
    setTone(selected);
    setContextDraft('');
    setStatusLine(`Any extra angle to include? Ctrl+O skips. ${job.company || ''}`.trim());
    setStep('ask-context');
  }

  async function handleContextSubmit(value: string) {
    const context = value.trim();
    setContextDraft(context);
    setStatusLine('Generating your answer...');
    setStep('generating');

    try {
      const profile = loadProfile();
      const answer = await generateAnswer(question, category, tone, context, profile, job);
      setGeneratedAnswer(answer);
      setStatusLine('Answer ready. s=save  r=refine  c=copy  esc=discard');
      setStep('review');
    } catch (error) {
      setStatusLine(`Generation failed: ${String(error)}. Esc to exit.`);
      setStep('ask-question');
    }
  }

  async function handleRefineSubmit(value: string) {
    const request = value.trim();
    if (!request) return;
    setRefineDraft('');
    setStatusLine('Refining...');
    setStep('refining');

    try {
      const profile = loadProfile();
      const refined = await refineAnswer(question, generatedAnswer, request, profile, job);
      setGeneratedAnswer(refined);
      setStatusLine('Refined. s=save  r=refine again  c=copy  esc=discard');
      setStep('review');
    } catch (error) {
      setStatusLine(`Refinement failed: ${String(error)}.`);
      setStep('review');
    }
  }

  function handleSave() {
    const id = answersDb.nextAnswerId();
    answersDb.addAnswer({
      id,
      question,
      category,
      answer: generatedAnswer,
      tone,
      context: contextDraft,
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

    if (isInputStep || step === 'ask-tone') {
      if (key.name === 'escape') onClose();
      return;
    }

    if (key.name === 'escape') {
      onClose();
      return;
    }

    if (step === 'review') {
      if (key.name === 's') handleSave();
      if (key.name === 'r') {
        setRefineDraft('');
        setStatusLine('How should this be refined?');
        setStep('ask-refine');
      }
      if (key.name === 'c') copyToClipboard(generatedAnswer);
    }
  });

  const toneOptions: SelectOption[] = TONE_OPTIONS.map((item) => ({
    name: item,
    description: '',
    value: item,
  }));

  const spinnerLabel =
    step === 'detecting'
      ? 'Detecting category...'
      : step === 'generating'
        ? 'Generating answer...'
        : 'Refining...';

  return (
    <box flexDirection="column" overflow="hidden">
      <text fg={theme.brand} content={`${job.company || 'Unknown Company'} · ${job.role || 'Untitled Role'}`} />
      {statusLine ? <text fg={theme.muted} content={statusLine} /> : null}
      {question && step !== 'ask-question' ? (
        <text fg={theme.answerCategoryColors[category]} content={`Question: ${clip(question, width - 6)}`} />
      ) : null}

      {step === 'review' && generatedAnswer ? (
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
            content={generatedAnswer}
          />
        </scrollbox>
      ) : null}

      {isSpinning ? (
        <box flexDirection="row" columnGap={1}>
          <Spinner color={theme.warning} />
          <text fg={theme.warning} content={spinnerLabel} />
        </box>
      ) : null}

      {step === 'ask-question' ? (
        <box flexDirection="column" marginTop={1}>
          <text fg={theme.heading} content="Question" />
          <input
            ref={questionInputRef}
            value={questionDraft}
            placeholder="e.g. Why do you want to work here?"
            onInput={setQuestionDraft}
            focused
            onSubmit={(value: unknown) => {
              if (typeof value === 'string') void handleQuestionSubmit(value);
            }}
          />
        </box>
      ) : null}

      {step === 'ask-tone' ? (
        <box flexDirection="column" marginTop={1}>
          <select
            height={Math.min(5, TONE_OPTIONS.length + 1)}
            width="100%"
            options={toneOptions}
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

      {step === 'ask-context' ? (
        <box flexDirection="column" marginTop={1}>
          <text fg={theme.heading} content="Context (optional)" />
          <textarea
            ref={contextInputRef}
            height={4}
            initialValue={contextDraft}
            placeholder="Company values, examples, or the angle to emphasize..."
            keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
            onContentChange={() => setContextDraft(contextInputRef.current?.plainText ?? '')}
            onSubmit={() => void handleContextSubmit(contextInputRef.current?.plainText ?? '')}
            focused
          />
        </box>
      ) : null}

      {step === 'ask-refine' ? (
        <box flexDirection="column" marginTop={1}>
          <text fg={theme.heading} content="Refinement request" />
          <input
            ref={refineInputRef}
            value={refineDraft}
            placeholder="e.g. Make it shorter and more specific."
            onInput={setRefineDraft}
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
            {step === 'review' ? <text fg={theme.footer} content="s=save" /> : null}
            {step === 'review' ? <text fg={theme.muted} content="|" /> : null}
            {step === 'review' ? <text fg={theme.footer} content="r=refine" /> : null}
            {step === 'review' ? <text fg={theme.muted} content="|" /> : null}
            {step === 'review' ? <text fg={theme.footer} content="c=copy" /> : null}
            {step === 'review' ? <text fg={theme.muted} content="|" /> : null}
            <text fg={theme.footer} content="esc=back" />
          </>
        )}
      </box>
    </box>
  );
}
