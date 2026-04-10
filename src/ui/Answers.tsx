import { execSync } from 'child_process';
import { useEffect, useState } from 'react';
import { Box, Text, useStdout } from 'ink';
import { FocusScope, useFocusScope, useNavigation } from 'giggles';
import { Badge, Panel, Select, Spinner, Viewport } from 'giggles/ui';
import { answersDb } from '../db.js';
import { loadProfile } from '../profile.js';
import type { AnswerCategory, AnswerEntry } from '../types.js';
import {
  TONE_OPTIONS,
  detectCategory,
  generateAnswer,
  refineAnswer,
} from '../claude/answers.js';
import MultilineInput from './MultilineInput.js';
import PasteInput from './PasteInput.js';

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

type Message = {
  role: 'assistant' | 'user' | 'answer';
  text: string;
};

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

const CATEGORY_COLOR: Record<AnswerCategory, string> = {
  identity: 'magenta',
  motivation: 'cyan',
  behavioral: 'yellow',
  strengths: 'green',
  vision: 'blue',
  culture: 'blueBright',
  situational: 'red',
  other: 'gray',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface Props {
  onBack: () => void;
}

export default function AnswersScreen({ onBack }: Props) {
  const { stdout } = useStdout();
  const navigation = useNavigation();
  const terminalWidth = stdout.columns ?? 80;
  const terminalHeight = stdout.rows ?? 24;
  const appWidth = Math.max(terminalWidth, 80);
  const appHeight = Math.max(terminalHeight, 24);

  const [answers, setAnswers] = useState<AnswerEntry[]>(() => answersDb.readAnswers());
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(
    () => answersDb.readAnswers()[0]?.id ?? null,
  );
  const [step, setStep] = useState<Step>(() =>
    answersDb.readAnswers().length > 0 ? 'view-saved' : 'idle',
  );
  const [messages, setMessages] = useState<Message[]>([]);

  // wizard transient state
  const [questionDraft, setQuestionDraft] = useState('');
  const [contextDraft, setContextDraft] = useState('');
  const [refineDraft, setRefineDraft] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [pendingCategory, setPendingCategory] = useState<AnswerCategory>('other');
  const [pendingTone, setPendingTone] = useState('');
  const [pendingContext, setPendingContext] = useState('');
  const [generatedAnswer, setGeneratedAnswer] = useState('');
  const [isRefinement, setIsRefinement] = useState(false);
  const [activePanel, setActivePanel] = useState<'list' | 'detail'>('list');
  const [copyFlash, setCopyFlash] = useState(false);

  const listWidth = Math.min(34, Math.floor(appWidth * 0.3));
  const chatWidth = appWidth - listWidth - 5;

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
      // non-mac or pbcopy unavailable
    }
  }

  function addMsg(role: Message['role'], text: string) {
    setMessages((prev) => [...prev, { role, text }]);
  }

  function startNew() {
    setIsRefinement(false);
    setMessages([{ role: 'assistant', text: 'What question would you like to answer?' }]);
    setQuestionDraft('');
    setContextDraft('');
    setRefineDraft('');
    setPendingQuestion('');
    setPendingCategory('other');
    setPendingTone('');
    setPendingContext('');
    setGeneratedAnswer('');
    setSelectedAnswerId(null);
    setStep('ask-question');
  }

  function startRefine(answer: AnswerEntry) {
    setIsRefinement(true);
    setPendingQuestion(answer.question);
    setPendingCategory(answer.category);
    setPendingTone(answer.tone);
    setPendingContext(answer.context);
    setGeneratedAnswer(answer.answer);
    setRefineDraft('');
    setMessages([
      { role: 'answer', text: answer.answer },
      { role: 'assistant', text: 'How would you like to refine this answer?' },
    ]);
    setStep('ask-refine');
  }

  async function handleQuestionSubmit(value: string) {
    const q = value.trim();
    if (!q) return;
    setPendingQuestion(q);
    setQuestionDraft('');
    addMsg('user', q);
    setStep('detecting');

    try {
      const category = await detectCategory(q);
      setPendingCategory(category);
      addMsg(
        'assistant',
        `Categorized as ${CATEGORY_LABEL[category]}. What tone would you like?`,
      );
    } catch {
      setPendingCategory('other');
      addMsg('assistant', 'What tone would you like?');
    }

    setStep('ask-tone');
  }

  async function handleToneSelect(tone: string) {
    setPendingTone(tone);
    addMsg('user', tone);
    addMsg(
      'assistant',
      'Any specific context to include? (company values, a particular angle, examples to draw from) Press Enter to skip.',
    );
    setContextDraft('');
    setStep('ask-context');
  }

  async function handleContextSubmit(value: string) {
    const ctx = value.trim();
    setPendingContext(ctx);
    addMsg('user', ctx || '(no additional context)');
    setStep('generating');

    try {
      const profile = loadProfile();
      const answer = await generateAnswer(
        pendingQuestion,
        pendingCategory,
        pendingTone,
        ctx,
        profile,
      );
      setGeneratedAnswer(answer);
      setMessages((prev) => [...prev, { role: 'answer', text: answer }]);
      addMsg('assistant', 'Press s to save, r to refine, or Esc to discard.');
      setStep('review');
    } catch (error) {
      addMsg('assistant', `Generation failed: ${String(error)}. Press Esc to discard.`);
      setStep('idle');
    }
  }

  async function handleRefineSubmit(value: string) {
    const request = value.trim();
    if (!request) return;
    setRefineDraft('');
    addMsg('user', request);
    setStep('refining');

    try {
      const profile = loadProfile();
      const refined = await refineAnswer(pendingQuestion, generatedAnswer, request, profile);
      setGeneratedAnswer(refined);
      setMessages((prev) => [...prev, { role: 'answer', text: refined }]);
      addMsg('assistant', 'Press s to save, r to refine again, or Esc to discard.');
      setStep('review');
    } catch (error) {
      addMsg('assistant', `Refinement failed: ${String(error)}.`);
      setStep('review');
    }
  }

  function handleSave() {
    const date = today();

    if (isRefinement && selectedAnswerId) {
      answersDb.updateAnswer(selectedAnswerId, {
        answer: generatedAnswer,
        tone: pendingTone,
        context: pendingContext,
        revised: date,
      });
      const next = refreshAnswers();
      setMessages([]);
      setStep('view-saved');
      const saved = next.find((a) => a.id === selectedAnswerId);
      if (!saved) setSelectedAnswerId(next[0]?.id ?? null);
      return;
    }

    const id = answersDb.nextAnswerId();
    answersDb.addAnswer({
      id,
      question: pendingQuestion,
      category: pendingCategory,
      answer: generatedAnswer,
      tone: pendingTone,
      context: pendingContext,
      added: date,
      revised: date,
    });
    refreshAnswers();
    setSelectedAnswerId(id);
    setMessages([]);
    setStep('view-saved');
  }

  function handleDelete() {
    if (!selectedAnswerId) return;
    answersDb.removeAnswer(selectedAnswerId);
    const next = refreshAnswers();
    const newId = next[0]?.id ?? null;
    setSelectedAnswerId(newId);
    setMessages([]);
    setStep(next.length > 0 ? 'view-saved' : 'idle');
  }

  function goToRefine() {
    setRefineDraft('');
    addMsg('assistant', 'How would you like to refine this?');
    setStep('ask-refine');
  }

  const root = useFocusScope({
    keybindings: ({ focusChild }) => ({
      '1': () => navigation.reset('dashboard'),
      '2': () => navigation.push('scan'),
      '3': () => navigation.push('profile'),
      '4': () => navigation.reset('answers'),
      q: () => process.exit(0),
      escape: () => {
        if (step === 'ask-refine') {
          if (isRefinement) {
            setMessages([]);
            setStep('view-saved');
          } else {
            setStep('review');
          }
          return;
        }
        if (step === 'view-saved' && activePanel === 'detail') {
          setActivePanel('list');
          focusChild('answer-list');
          return;
        }
        if (step === 'idle' || step === 'view-saved') {
          onBack();
          return;
        }
        setMessages([]);
        setStep(answers.length > 0 ? 'view-saved' : 'idle');
        focusChild('answer-list');
      },
      h: () => {
        if (step === 'view-saved' && activePanel === 'detail') {
          setActivePanel('list');
          focusChild('answer-list');
        }
      },
      l: () => {
        if (step === 'view-saved' && activePanel === 'list') {
          setActivePanel('detail');
          focusChild('saved-answer-scroll');
        }
      },
      c: () => {
        if (step === 'review') copyToClipboard(generatedAnswer);
        if (step === 'view-saved') {
          const answer = answers.find((a) => a.id === selectedAnswerId);
          if (answer) copyToClipboard(answer.answer);
        }
      },
      n: () => {
        if (step === 'idle' || step === 'view-saved') startNew();
      },
      r: () => {
        if (step === 'view-saved') {
          const answer = answers.find((a) => a.id === selectedAnswerId);
          if (answer) startRefine(answer);
        }
        if (step === 'review') goToRefine();
      },
      d: () => {
        if (step === 'view-saved') handleDelete();
      },
      s: () => {
        if (step === 'review') handleSave();
      },
    }),
  });

  useEffect(() => {
    root.focusChild('answer-list');
  }, [root.id]);

  useEffect(() => {
    if (step === 'ask-question') root.focusChild('question-input');
    else if (step === 'ask-tone') root.focusChild('tone-select');
    else if (step === 'ask-context') root.focusChild('context-input');
    else if (step === 'ask-refine') root.focusChild('refine-input');
    else if (step === 'review') root.focusChild('answer-scroll');
    else if (step === 'view-saved' || step === 'idle') {
      setActivePanel('list');
      root.focusChild('answer-list');
    }
  }, [step, root.id]);

  const chatContentHeight = appHeight - 12;
  const selectedAnswer = answers.find((a) => a.id === selectedAnswerId) ?? null;
  const lastAnswerIndex = messages.reduce(
    (last, msg, i) => (msg.role === 'answer' ? i : last),
    -1,
  );
  const answerViewportHeight = Math.max(8, chatContentHeight - 12);

  const answerOptions = answers.map((a) => ({
    label: clip(a.question, listWidth - 4),
    value: a.id,
  }));

  const toneOptions = TONE_OPTIONS.map((t) => ({ label: t, value: t }));

  const isSpinning = step === 'detecting' || step === 'generating' || step === 'refining';
  const spinnerLabel =
    step === 'detecting'
      ? 'Detecting category...'
      : step === 'generating'
        ? 'Generating your answer...'
        : 'Refining...';

  return (
    <FocusScope handle={root}>
      <Box flexDirection="column" paddingX={1} width={appWidth} height={appHeight}>
        {/* Nav */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Box gap={2}>
            <Text bold color="cyan">
              open-positions
            </Text>
            <Text color="gray">[1] Queue</Text>
            <Text color="gray">[2] Scan</Text>
            <Text color="gray">[3] Profile</Text>
            <Text color="cyan">[4] Answers</Text>
          </Box>
          <Text dimColor>{answers.length} answers</Text>
        </Box>

        {/* Main layout */}
        <Box gap={1} flexGrow={1}>
          {/* Left: answer list */}
          <Panel title="Saved" width={listWidth} borderColor="gray">
            {answers.length === 0 ? (
              <Text dimColor>No answers yet.{'\n'}Press n to start.</Text>
            ) : (
              <Select
                focusKey="answer-list"
                options={answerOptions}
                value={selectedAnswerId ?? undefined}
                onChange={(id) => {
                  setSelectedAnswerId(id);
                  if (step === 'view-saved' || step === 'idle') {
                    setStep('view-saved');
                    setMessages([]);
                  }
                }}
                onHighlight={(id) => {
                  setSelectedAnswerId(id);
                  if (step === 'view-saved' || step === 'idle') {
                    setMessages([]);
                  }
                }}
                onSubmit={(id) => {
                  setSelectedAnswerId(id);
                  setMessages([]);
                  setStep('view-saved');
                }}
                maxVisible={Math.max(8, appHeight - 12)}
                render={({ option, highlighted }) => (
                  <Box>
                    <Text color={highlighted ? 'cyan' : 'gray'}>
                      {highlighted ? '▶ ' : '  '}
                    </Text>
                    <Text color={highlighted ? 'white' : undefined}>{option.label}</Text>
                  </Box>
                )}
              />
            )}
          </Panel>

          {/* Right: chat panel */}
          <Panel title="Chat" width={chatWidth} borderColor="green">
            <Box flexDirection="column" height={chatContentHeight}>
              {/* --- view-saved: show selected answer --- */}
              {step === 'view-saved' && selectedAnswer && (
                <Box flexDirection="column" gap={1} flexGrow={1}>
                  <Box gap={1} flexWrap="wrap">
                    <Badge
                      color="black"
                      background={CATEGORY_COLOR[selectedAnswer.category]}
                    >
                      {CATEGORY_LABEL[selectedAnswer.category]}
                    </Badge>
                    <Text dimColor>{selectedAnswer.tone}</Text>
                    <Text dimColor>·</Text>
                    <Text dimColor>{selectedAnswer.revised}</Text>
                  </Box>
                  <Text bold>{selectedAnswer.question}</Text>
                  <Viewport
                    focusKey="saved-answer-scroll"
                    height={Math.max(8, chatContentHeight - 6)}
                  >
                    <Text>{selectedAnswer.answer}</Text>
                  </Viewport>
                  {selectedAnswer.context ? (
                    <Text dimColor>Context: {selectedAnswer.context}</Text>
                  ) : null}
                </Box>
              )}

              {/* --- idle: empty state --- */}
              {step === 'idle' && (
                <Box flexGrow={1} alignItems="center" justifyContent="center">
                  <Text dimColor>Press n to answer your first question.</Text>
                </Box>
              )}

              {/* --- wizard steps: chat messages + active input --- */}
              {step !== 'idle' && step !== 'view-saved' && (
                <Box flexDirection="column" flexGrow={1}>
                  {/* Chat history */}
                  <Box flexDirection="column" flexGrow={1}>
                    {messages.map((msg, i) => (
                      <Box key={i} marginBottom={1} flexDirection="column">
                        {msg.role === 'assistant' && (
                          <Box gap={1}>
                            <Text color="cyan">◈</Text>
                            <Text wrap="wrap">{msg.text}</Text>
                          </Box>
                        )}
                        {msg.role === 'user' && (
                          <Box gap={1} paddingLeft={2}>
                            <Text dimColor>You ›</Text>
                            <Text wrap="wrap">{msg.text}</Text>
                          </Box>
                        )}
                        {msg.role === 'answer' && i === lastAnswerIndex && (
                          <Viewport
                            focusKey="answer-scroll"
                            height={answerViewportHeight}
                          >
                            <Text wrap="wrap">{msg.text}</Text>
                          </Viewport>
                        )}
                        {msg.role === 'answer' && i !== lastAnswerIndex && (
                          <Box height={4} overflow="hidden">
                            <Text dimColor wrap="wrap">{msg.text}</Text>
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>

                  {/* Active input / spinner */}
                  <Box flexDirection="column">
                    {isSpinning && (
                      <Box gap={1}>
                        <Spinner color="cyan" />
                        <Text dimColor>{spinnerLabel}</Text>
                      </Box>
                    )}

                    {step === 'ask-question' && (
                      <PasteInput
                        focusKey="question-input"
                        label="Question"
                        value={questionDraft}
                        onChange={setQuestionDraft}
                        onSubmit={(v) => void handleQuestionSubmit(v)}
                        placeholder="e.g. Why do you want to work here?"
                      />
                    )}

                    {step === 'ask-tone' && (
                      <Select
                        focusKey="tone-select"
                        options={toneOptions}
                        value={TONE_OPTIONS[0]}
                        onSubmit={(v) => void handleToneSelect(v)}
                        render={({ option, highlighted }) => (
                          <Text color={highlighted ? 'cyan' : undefined}>
                            {highlighted ? '▶ ' : '  '}
                            {option.label}
                          </Text>
                        )}
                      />
                    )}

                    {step === 'ask-context' && (
                      <MultilineInput
                        focusKey="context-input"
                        label="Context"
                        hint="Enter submits · Ctrl+N for newline · Enter on empty to skip"
                        value={contextDraft}
                        onChange={setContextDraft}
                        onSubmit={(v) => void handleContextSubmit(v)}
                        placeholder="Optional: company values, specific angle, examples to draw from..."
                      />
                    )}

                    {step === 'ask-refine' && (
                      <PasteInput
                        focusKey="refine-input"
                        label="Refinement"
                        value={refineDraft}
                        onChange={setRefineDraft}
                        onSubmit={(v) => void handleRefineSubmit(v)}
                        placeholder="e.g. Make it more concise, add an example from my Stripe work..."
                      />
                    )}

                    {step === 'review' && (
                      <Box marginTop={1}>
                        <Text dimColor>Answer ready — see footer for actions.</Text>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </Panel>
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Box
            width={appWidth - 2}
            borderTop
            borderColor="gray"
            paddingTop={1}
            flexWrap="wrap"
            gap={1}
          >
            {copyFlash ? (
              <Text color="green">Copied!</Text>
            ) : (
              <>
                <Text color="blueBright">n=new</Text>
                {step === 'view-saved' && (
                  <>
                    <Text color="gray">|</Text>
                    <Text color="blueBright">r=refine</Text>
                    <Text color="gray">|</Text>
                    <Text color="blueBright">d=delete</Text>
                    <Text color="gray">|</Text>
                    <Text color="blueBright">c=copy</Text>
                    <Text color="gray">|</Text>
                    <Text color="blueBright">h/l=panels</Text>
                  </>
                )}
                {step === 'review' && (
                  <>
                    <Text color="gray">|</Text>
                    <Text color="blueBright">s=save</Text>
                    <Text color="gray">|</Text>
                    <Text color="blueBright">r=refine</Text>
                    <Text color="gray">|</Text>
                    <Text color="blueBright">c=copy</Text>
                  </>
                )}
                <Text color="gray">|</Text>
                <Text color="blueBright">Esc=back</Text>
                <Text color="gray">|</Text>
                <Text color="blueBright">q=quit</Text>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </FocusScope>
  );
}
