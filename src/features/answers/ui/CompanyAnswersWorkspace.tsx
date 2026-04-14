/** @jsxImportSource @opentui/react */
import { useKeyboard } from '@opentui/react';
import type { InputRenderable, SelectOption } from '@opentui/core';
import { execSync } from 'child_process';
import { useEffect, useMemo, useRef, useState } from 'react';
import { answersDb } from '../../../shared/data/db.js';
import { loadProfile } from '../../../shared/models/profile.js';
import type { AnswerEntry, Job } from '../../../shared/models/types.js';
import { clip } from '../../../shared/lib/utils.js';
import { selectColors } from '../../../shared/ui/selectTheme.js';
import Spinner from '../../../shared/ui/Spinner.js';
import type { UiTheme } from '../../../shared/ui/theme.js';
import { refineAnswer } from '../services/answers.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  theme: UiTheme;
  job: Job;
  answers: AnswerEntry[];
  title: string;
  emptyMessage: string;
  width: number;
  height: number;
  onClose: () => void;
  onSaved: (message: string) => void;
  onDeleted: (message: string) => void;
}

export default function CompanyAnswersWorkspace({
  theme,
  job,
  answers: initialAnswers,
  title,
  emptyMessage,
  width,
  height,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<'list' | 'detail' | 'ask-refine' | 'refining'>('list');
  const [refineDraft, setRefineDraft] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [copyFlash, setCopyFlash] = useState(false);
  const refineInputRef = useRef<InputRenderable>(null);

  function refreshAnswers(nextAnswers = initialAnswers) {
    const next = nextAnswers
      .slice()
      .sort((a, b) => {
        if (a.revised !== b.revised) return b.revised.localeCompare(a.revised);
        return b.id.localeCompare(a.id);
      });
    setAnswers(next);
    setSelectedId((current) =>
      next.some((answer) => answer.id === current) ? current : next[0]?.id ?? null,
    );
    return next;
  }

  useEffect(() => {
    refreshAnswers(initialAnswers);
  }, [initialAnswers, job.id]);

  const selectedAnswer = useMemo(
    () => answers.find((answer) => answer.id === selectedId) ?? null,
    [answers, selectedId],
  );

  useEffect(() => {
    setDraftAnswer(selectedAnswer?.answer ?? '');
  }, [selectedAnswer?.id, selectedAnswer?.answer]);

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
    if (!selectedAnswer) return;
    const request = value.trim();
    if (!request) return;
    setRefineDraft(request);
    setStep('refining');

    try {
      const profile = loadProfile();
      const refined = await refineAnswer(
        selectedAnswer.question,
        draftAnswer,
        request,
        profile,
      );
      answersDb.updateAnswer(selectedAnswer.id, {
        answer: refined,
        revised: today(),
      });
      setDraftAnswer(refined);
      setRefineDraft('');
      refreshAnswers(
        initialAnswers.map((answer) =>
          answer.id === selectedAnswer.id
            ? { ...answer, answer: refined, revised: today() }
            : answer,
        ),
      );
      setStep('detail');
      onSaved(`Updated saved answer #${selectedAnswer.id}.`);
    } catch (error) {
      setStep('ask-refine');
      onSaved(`Refinement failed: ${String(error)}`);
    }
  }

  function handleDelete() {
    if (!selectedAnswer) return;
    answersDb.removeAnswer(selectedAnswer.id);
    const next = refreshAnswers(
      initialAnswers.filter((answer) => answer.id !== selectedAnswer.id),
    );
    if (next.length === 0) {
      onDeleted(`Deleted saved answer #${selectedAnswer.id}.`);
      return;
    }
    setStep('list');
    onDeleted(`Deleted saved answer #${selectedAnswer.id}.`);
  }

  useKeyboard((key) => {
    if (step === 'refining') return;
    if (step === 'ask-refine') {
      if (key.name === 'escape') {
        setRefineDraft('');
        setStep('detail');
      }
      return;
    }
    if (key.name === 'escape') {
      if (step === 'detail') {
        setStep('list');
        return;
      }
      onClose();
      return;
    }
    if (step === 'list') {
      if (key.name === 'return' && selectedAnswer) setStep('detail');
      return;
    }
    if (step === 'detail') {
      if (key.name === 'r' && selectedAnswer) {
        setRefineDraft('');
        setStep('ask-refine');
      }
      if (key.name === 'c' && selectedAnswer) copyToClipboard(draftAnswer);
      if (key.name === 'd' && selectedAnswer) handleDelete();
    }
  });

  const options: SelectOption[] = answers.map((answer) => ({
    name: clip(answer.question, Math.max(20, width - 8)),
    description: `${answer.originJobId ? `#${answer.originJobId}` : 'Library'} · ${answer.revised}`,
    value: answer.id,
  }));

  if (answers.length === 0) {
    return (
      <box flexDirection="column">
        <text fg={theme.brand} content={title} />
        <text fg={theme.muted} content={emptyMessage} />
        <box flexDirection="row" columnGap={1} marginTop={1}>
          <text fg={theme.footer} content="esc=back" />
        </box>
      </box>
    );
  }

  return (
    <box flexDirection="column" overflow="hidden">
      <text fg={theme.brand} content={title} />
      <text
        fg={theme.muted}
        content={`${answers.length} ${answers.length === 1 ? 'answer' : 'answers'}`}
      />

      {step === 'list' ? (
        <select
          height={Math.max(6, height - 8)}
          width="100%"
          options={options}
          selectedIndex={Math.max(0, answers.findIndex((answer) => answer.id === selectedId))}
          showDescription
          showScrollIndicator
          focused
          {...selectColors(theme)}
          onChange={(_, option) => {
            if (option?.value) setSelectedId(String(option.value));
          }}
          onSelect={(_, option) => {
            if (!option?.value) return;
            setSelectedId(String(option.value));
            setStep('detail');
          }}
        />
      ) : null}

      {step === 'detail' && selectedAnswer ? (
        <box flexDirection="column" overflow="hidden">
          <text
            fg={theme.answerCategoryColors[selectedAnswer.category]}
            content={`${selectedAnswer.category} · ${selectedAnswer.role || 'General'} · ${selectedAnswer.revised}`}
          />
          <text fg={theme.heading} content={clip(selectedAnswer.question, width - 4)} />
          <scrollbox
            height={Math.max(6, height - 12)}
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
              content={draftAnswer}
            />
          </scrollbox>
        </box>
      ) : null}

      {step === 'ask-refine' ? (
        <box flexDirection="column" marginTop={1}>
          <text fg={theme.heading} content="Refinement request" />
          <input
            ref={refineInputRef}
            value={refineDraft}
            placeholder="e.g. Make it more specific to this role."
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

      <box flexDirection="row" columnGap={1} marginTop={1}>
        {copyFlash ? (
          <text fg={theme.success} content="Copied!" />
        ) : step === 'list' ? (
          <>
            <text fg={theme.footer} content="enter=view" />
            <text fg={theme.muted} content="|" />
            <text fg={theme.footer} content="esc=back" />
          </>
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
