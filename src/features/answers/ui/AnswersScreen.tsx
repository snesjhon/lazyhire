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
import { loadProfile } from '../../../shared/models/profile.js';
import Spinner from '../../../shared/ui/Spinner.js';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { AnswerCategory, AnswerEntry } from '../../../shared/models/types.js';
import {
  TONE_OPTIONS,
  detectCategory,
  generateAnswer,
  refineAnswer,
} from '../services/answers.js';
import { clip } from '../../../shared/lib/utils.js';

type Step =
  | 'idle'
  | 'ask-question'
  | 'detecting'
  | 'ask-tone'
  | 'ask-context'
  | 'generating'
  | 'review'
  | 'view-saved'
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
  appWidth: number;
  appHeight: number;
  theme: UiTheme;
}

export default function AnswersScreen({ appWidth, appHeight, theme }: Props) {
  const [answers, setAnswers] = useState<AnswerEntry[]>(() => answersDb.readAnswers());
  const [selectedId, setSelectedId] = useState<string | null>(
    () => answersDb.readAnswers()[0]?.id ?? null,
  );
  const [step, setStep] = useState<Step>(() =>
    answersDb.readAnswers().length > 0 ? 'view-saved' : 'idle',
  );
  const [activePanel, setActivePanel] = useState<'list' | 'detail'>('list');
  const [copyFlash, setCopyFlash] = useState(false);

  // Wizard state
  const [question, setQuestion] = useState('');
  const [questionDraft, setQuestionDraft] = useState('');
  const [category, setCategory] = useState<AnswerCategory>('other');
  const [tone, setTone] = useState('');
  const [contextDraft, setContextDraft] = useState('');
  const [refineDraft, setRefineDraft] = useState('');
  const [generatedAnswer, setGeneratedAnswer] = useState('');
  const [isRefinement, setIsRefinement] = useState(false);
  const [statusLine, setStatusLine] = useState('');

  const questionInputRef = useRef<InputRenderable>(null);
  const contextInputRef = useRef<TextareaRenderable>(null);
  const refineInputRef = useRef<InputRenderable>(null);

  const isInputStep = step === 'ask-question' || step === 'ask-context' || step === 'ask-refine';
  const isSpinning = step === 'detecting' || step === 'generating' || step === 'refining';

  const listWidth = Math.max(28, Math.floor(appWidth * 0.28));
  const detailWidth = Math.max(40, appWidth - listWidth - 5);
  const contentHeight = Math.max(10, appHeight - 10);
  const scrollHeight = Math.max(6, contentHeight - 8);

  useEffect(() => {
    if (step === 'ask-question') questionInputRef.current?.focus();
    if (step === 'ask-context') contextInputRef.current?.focus();
    if (step === 'ask-refine') refineInputRef.current?.focus();
  }, [step]);

  function refreshAnswers(): AnswerEntry[] {
    const next = answersDb.readAnswers();
    setAnswers(next);
    return next;
  }

  function copyToClipboard(text: string) {
    try {
      execSync('pbcopy', { input: text });
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1500);
    } catch {
      // pbcopy unavailable
    }
  }

  function startNew() {
    setIsRefinement(false);
    setQuestion('');
    setQuestionDraft('');
    setContextDraft('');
    setRefineDraft('');
    setCategory('other');
    setTone('');
    setGeneratedAnswer('');
    setSelectedId(null);
    setStatusLine('What question would you like to answer?');
    setStep('ask-question');
  }

  function startRefine(answer: AnswerEntry) {
    setIsRefinement(true);
    setQuestion(answer.question);
    setCategory(answer.category);
    setTone(answer.tone);
    setContextDraft(answer.context);
    setGeneratedAnswer(answer.answer);
    setRefineDraft('');
    setStatusLine('How would you like to refine this answer?');
    setStep('ask-refine');
  }

  function handleSave() {
    if (isRefinement && selectedId) {
      answersDb.updateAnswer(selectedId, {
        answer: generatedAnswer,
        tone,
        context: contextDraft,
        revised: today(),
      });
      const next = refreshAnswers();
      const saved = next.find((a) => a.id === selectedId);
      if (!saved) setSelectedId(next[0]?.id ?? null);
      setStep('view-saved');
      setStatusLine('');
      return;
    }

    const id = answersDb.nextAnswerId();
    answersDb.addAnswer({
      id,
      question,
      category,
      answer: generatedAnswer,
      tone,
      context: contextDraft,
      originJobId: null,
      company: null,
      role: null,
      added: today(),
      revised: today(),
    });
    refreshAnswers();
    setSelectedId(id);
    setStep('view-saved');
    setStatusLine('');
  }

  function handleDelete() {
    if (!selectedId) return;
    answersDb.removeAnswer(selectedId);
    const next = refreshAnswers();
    const newId = next[0]?.id ?? null;
    setSelectedId(newId);
    setStep(next.length > 0 ? 'view-saved' : 'idle');
    setStatusLine('');
  }

  async function handleQuestionSubmit(value: string) {
    const q = value.trim();
    if (!q) return;
    setQuestion(q);
    setQuestionDraft('');
    setStatusLine(`Detecting category for: "${clip(q, 50)}"…`);
    setStep('detecting');

    try {
      const detected = await detectCategory(q);
      setCategory(detected);
      setStatusLine(
        `Categorized as ${CATEGORY_LABEL[detected]}. What tone would you like?`,
      );
    } catch {
      setCategory('other');
      setStatusLine('What tone would you like?');
    }
    setStep('ask-tone');
  }

  async function handleToneSelect(selected: string) {
    setTone(selected);
    setContextDraft('');
    setStatusLine(
      'Any context to include? (company values, examples, angle) Ctrl+O to skip.',
    );
    setStep('ask-context');
  }

  async function handleContextSubmit(value: string) {
    setContextDraft(value.trim());
    setStatusLine('Generating your answer…');
    setStep('generating');

    try {
      const profile = loadProfile();
      const answer = await generateAnswer(question, category, tone, value.trim(), profile);
      setGeneratedAnswer(answer);
      setStatusLine('Answer ready — s=save  r=refine  esc=discard');
      setStep('review');
    } catch (error) {
      setStatusLine(`Generation failed: ${String(error)}. Esc to discard.`);
      setStep('idle');
    }
  }

  async function handleRefineSubmit(value: string) {
    const request = value.trim();
    if (!request) return;
    setRefineDraft('');
    setStatusLine('Refining…');
    setStep('refining');

    try {
      const profile = loadProfile();
      const refined = await refineAnswer(question, generatedAnswer, request, profile);
      setGeneratedAnswer(refined);
      setStatusLine('Refined — s=save  r=refine again  esc=discard');
      setStep('review');
    } catch (error) {
      setStatusLine(`Refinement failed: ${String(error)}.`);
      setStep('review');
    }
  }

  useKeyboard((key) => {
    // Block all keys while async work or input is active
    if (isSpinning) return;
    if (isInputStep || step === 'ask-tone') {
      if (key.name === 'escape') {
        setStep(answers.length > 0 ? 'view-saved' : 'idle');
        setStatusLine('');
      }
      return;
    }

    if (key.name === 'escape') {
      if (step === 'view-saved' && activePanel === 'detail') {
        setActivePanel('list');
        return;
      }
      if (step === 'review') {
        setStep(answers.length > 0 ? 'view-saved' : 'idle');
        setStatusLine('');
        return;
      }
      return;
    }

    if (key.name === 'n' && (step === 'idle' || step === 'view-saved')) {
      startNew();
      return;
    }

    if (step === 'review') {
      if (key.name === 's') handleSave();
      if (key.name === 'r') {
        setRefineDraft('');
        setStatusLine('How would you like to refine this?');
        setStep('ask-refine');
      }
      if (key.name === 'c') copyToClipboard(generatedAnswer);
      return;
    }

    if (step === 'view-saved') {
      if (key.name === 'r') {
        const answer = answers.find((a) => a.id === selectedId);
        if (answer) startRefine(answer);
      }
      if (key.name === 'd') handleDelete();
      if (key.name === 'c') {
        const answer = answers.find((a) => a.id === selectedId);
        if (answer) copyToClipboard(answer.answer);
      }
      if (key.name === 'h' && activePanel === 'detail') setActivePanel('list');
      if (key.name === 'l' && activePanel === 'list') setActivePanel('detail');
    }
  });

  const selectedAnswer = answers.find((a) => a.id === selectedId) ?? null;
  const selectedIndex = selectedAnswer
    ? Math.max(0, answers.findIndex((a) => a.id === selectedId))
    : 0;

  const answerListOptions: SelectOption[] = answers.map((a) => ({
    name: clip(a.question, listWidth - 4),
    description: `${CATEGORY_LABEL[a.category]} · ${a.originJobId ? `#${a.originJobId}` : a.company || 'General'} · ${a.revised}`,
    value: a.id,
  }));

  const toneOptions: SelectOption[] = TONE_OPTIONS.map((t) => ({
    name: t,
    description: '',
    value: t,
  }));

  const spinnerLabel =
    step === 'detecting'
      ? 'Detecting category…'
      : step === 'generating'
        ? 'Generating answer…'
        : 'Refining…';

  // Build the wizard/detail content for the right panel
  const showWizard =
    step !== 'idle' && step !== 'view-saved';
  const showSavedDetail = step === 'view-saved' && selectedAnswer !== null;
  const showIdle = step === 'idle';

  return (
    <box flexDirection="column" width={appWidth} paddingX={1}>
      <box flexDirection="row" columnGap={1} marginTop={1} height={contentHeight}>
        {/* Left: answer list */}
        <box
          title="Saved"
          border
          borderColor={activePanel === 'list' ? theme.borderActive : theme.border}
          width={listWidth}
          padding={1}
          overflow="hidden"
        >
          {answers.length === 0 ? (
            <text fg={theme.muted} content={`No answers yet.\nPress n to start.`} />
          ) : (
            <select
              height={contentHeight - 2}
              width="100%"
              options={answerListOptions}
              selectedIndex={selectedIndex}
              showDescription
              showScrollIndicator
              {...selectColors(theme)}
              focused={activePanel === 'list' && !isInputStep && step !== 'ask-tone' && !isSpinning}
              onChange={(_, option) => {
                if (!option?.value) return;
                setSelectedId(String(option.value));
                if (step === 'view-saved' || step === 'idle') {
                  setStep('view-saved');
                  setStatusLine('');
                }
              }}
              onSelect={(_, option) => {
                if (!option?.value) return;
                setSelectedId(String(option.value));
                setStep('view-saved');
                setStatusLine('');
                setActivePanel('detail');
              }}
            />
          )}
        </box>

        {/* Right: detail or wizard */}
        <box
          title={showWizard ? 'Wizard' : 'Answer'}
          border
          borderColor={activePanel === 'detail' ? theme.borderActive : theme.border}
          width={detailWidth}
          padding={1}
          flexDirection="column"
          overflow="hidden"
        >
          {showIdle && (
            <text fg={theme.muted} content="Press n to answer your first question." />
          )}

          {showSavedDetail && selectedAnswer && (
            <box flexDirection="column" overflow="hidden">
              <text
                fg={theme.answerCategoryColors[selectedAnswer.category]}
                content={`${CATEGORY_LABEL[selectedAnswer.category]}  ·  ${selectedAnswer.company || 'General'}  ·  ${selectedAnswer.tone}  ·  ${selectedAnswer.revised}`}
              />
              <text fg={theme.heading} content={selectedAnswer.question} />
              <scrollbox
                height={scrollHeight}
                width="100%"
                scrollX={false}
                scrollY
                focused={activePanel === 'detail'}
                rootOptions={{ overflow: 'hidden' }}
                wrapperOptions={{ overflow: 'hidden' }}
                viewportOptions={{ overflow: 'hidden' }}
                contentOptions={{ overflow: 'hidden' }}
                scrollbarOptions={{ showArrows: true }}
              >
                <text
                  width={Math.max(20, detailWidth - 6)}
                  maxWidth={Math.max(20, detailWidth - 6)}
                  wrapMode="char"
                  content={selectedAnswer.answer}
                />
              </scrollbox>
              {selectedAnswer.context ? (
                <text fg={theme.muted} content={`Context: ${selectedAnswer.context}`} />
              ) : null}
            </box>
          )}

          {showWizard && (
            <box flexDirection="column" overflow="hidden">
              {/* Status / instructions */}
              {statusLine ? (
                <text fg={theme.brand} content={statusLine} />
              ) : null}

              {/* Question echo (after it's been set) */}
              {question && step !== 'ask-question' ? (
                <text fg={theme.muted} content={`Q: ${clip(question, detailWidth - 6)}`} />
              ) : null}

              {/* Generated answer preview (review step) */}
              {(step === 'review') && generatedAnswer ? (
                <scrollbox
                  height={scrollHeight}
                  width="100%"
                  scrollX={false}
                  scrollY
                  focused={step === 'review' && activePanel === 'detail'}
                  rootOptions={{ overflow: 'hidden' }}
                  wrapperOptions={{ overflow: 'hidden' }}
                  viewportOptions={{ overflow: 'hidden' }}
                  contentOptions={{ overflow: 'hidden' }}
                  scrollbarOptions={{ showArrows: true }}
                >
                  <text
                    width={Math.max(20, detailWidth - 6)}
                    maxWidth={Math.max(20, detailWidth - 6)}
                    wrapMode="char"
                    content={generatedAnswer}
                  />
                </scrollbox>
              ) : null}

              {/* Spinner */}
              {isSpinning && (
                <box flexDirection="row" columnGap={1}>
                  <Spinner color={theme.warning} />
                  <text fg={theme.warning} content={spinnerLabel} />
                </box>
              )}

              {/* Step inputs */}
              {step === 'ask-question' && (
                <box flexDirection="column" marginTop={1}>
                  <text fg={theme.muted} content="Question" />
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
              )}

              {step === 'ask-tone' && (
                <box flexDirection="column" marginTop={1}>
                  <select
                    height={Math.min(5, TONE_OPTIONS.length + 1)}
                    width="100%"
                    options={toneOptions}
                    focused
                    {...selectColors(theme)}
                    onSelect={(_, option) => {
                      if (option?.value) void handleToneSelect(String(option.value));
                    }}
                  />
                </box>
              )}

              {step === 'ask-context' && (
                <box flexDirection="column" marginTop={1}>
                  <text fg={theme.muted} content="Context (optional)" />
                  <textarea
                    ref={contextInputRef}
                    height={4}
                    initialValue={contextDraft}
                    placeholder="Company values, specific angle, examples to draw from…"
                    keyBindings={TEXTAREA_SUBMIT_KEY_BINDINGS}
                    onContentChange={() =>
                      setContextDraft(contextInputRef.current?.plainText ?? '')
                    }
                    onSubmit={() =>
                      void handleContextSubmit(contextInputRef.current?.plainText ?? '')
                    }
                    focused
                  />
                </box>
              )}

              {step === 'ask-refine' && (
                <box flexDirection="column" marginTop={1}>
                  <text fg={theme.muted} content="Refinement request" />
                  <input
                    ref={refineInputRef}
                    value={refineDraft}
                    placeholder="e.g. Make it more concise, add a specific example…"
                    onInput={setRefineDraft}
                    focused
                    onSubmit={(value: unknown) => {
                      if (typeof value === 'string') void handleRefineSubmit(value);
                    }}
                  />
                </box>
              )}
            </box>
          )}
        </box>
      </box>

      {/* Footer */}
      <box flexDirection="row" columnGap={1} position="absolute" bottom={0}>
        {copyFlash ? (
          <text fg={theme.success} content="Copied!" />
        ) : (
          <>
            <text fg={theme.footer} content="n=new" />
            {step === 'view-saved' && (
              <>
                <text fg={theme.muted} content="|" />
                <text fg={theme.footer} content="r=refine" />
                <text fg={theme.muted} content="|" />
                <text fg={theme.footer} content="d=delete" />
                <text fg={theme.muted} content="|" />
                <text fg={theme.footer} content="c=copy" />
                <text fg={theme.muted} content="|" />
                <text fg={theme.footer} content="h/l=panels" />
              </>
            )}
            {step === 'review' && (
              <>
                <text fg={theme.muted} content="|" />
                <text fg={theme.footer} content="s=save" />
                <text fg={theme.muted} content="|" />
                <text fg={theme.footer} content="r=refine" />
                <text fg={theme.muted} content="|" />
                <text fg={theme.footer} content="c=copy" />
              </>
            )}
            <text fg={theme.muted} content="|" />
            <text fg={theme.footer} content="esc=back" />
            <text fg={theme.muted} content="|" />
            <text fg={theme.footer} content="1-3=tabs" />
            <text fg={theme.muted} content="|" />
            <text fg={theme.footer} content="ctrl-q=quit" />
          </>
        )}
      </box>
    </box>
  );
}
