import { useState, useCallback } from 'react';
import { IPC } from '@shared/ipc-channels';
import type { AnswerCategory, AnswerEntry, Job } from '@shared/types';
import { TONE_OPTIONS, DEFAULT_TONE, type Tone } from '@shared/generate-presets';
import Icon from '../../components/Icon';

const CATEGORY_LABELS: Record<AnswerCategory, string> = {
  identity: 'Identity',
  motivation: 'Motivation',
  behavioral: 'Behavioral',
  strengths: 'Strengths',
  vision: 'Vision',
  culture: 'Culture',
  situational: 'Situational',
  other: 'Other',
};

function pickJobContext(job?: Job | null) {
  if (!job) return null;
  return { company: job.company, role: job.role, jdSummary: job.jdSummary, jd: job.jd, url: job.url };
}

// ── New answer form ───────────────────────────────────────────
function NewAnswerForm({
  job,
  embedded,
  onSaved,
  onCancel,
}: {
  job?: Job | null;
  embedded?: boolean;
  onSaved: (e: AnswerEntry) => void;
  onCancel?: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<AnswerCategory | null>(null);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  const [context, setContext] = useState('');
  const [answer, setAnswer] = useState('');
  const [refineText, setRefineText] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    if (!question.trim()) return;
    setGenerating(true);
    setAnswer('');
    setError('');
    try {
      let cat = category;
      if (!cat) {
        cat = await window.api.invoke(IPC.AI_DETECT_ANSWER_CATEGORY, question.trim()) as AnswerCategory;
        setCategory(cat);
      }
      const result = await window.api.invoke(IPC.AI_GENERATE_ANSWER, {
        question: question.trim(),
        category: cat,
        tone,
        context: context.trim(),
        job: pickJobContext(job),
      });
      setAnswer(result as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefine() {
    if (!answer || !refineText.trim()) return;
    setRefining(true);
    setError('');
    try {
      const result = await window.api.invoke(IPC.AI_REFINE_ANSWER, {
        question: question.trim(),
        existingAnswer: answer,
        refineRequest: refineText.trim(),
        job: pickJobContext(job),
      });
      setAnswer(result as string);
      setShowRefine(false);
      setRefineText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed');
    } finally {
      setRefining(false);
    }
  }

  async function handleSave() {
    if (!answer || !category) return;
    setSaving(true);
    try {
      const entry = await window.api.invoke(IPC.ANSWERS_SAVE, {
        question: question.trim(),
        category,
        answer,
        tone,
        context: context.trim(),
        originJobId: job?.id ?? null,
        company: job?.company ?? null,
        role: job?.role ?? null,
      });
      onSaved(entry as AnswerEntry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={'ans-new-form' + (embedded ? ' embedded' : '')}>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>New Answer</span>
          <button
            className="mini-btn"
            style={{ marginLeft: 'auto' }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Question */}
      <div>
        <label className="form-label">Question</label>
        <textarea
          className="form-textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What's a challenge you faced and how did you handle it?"
          rows={3}
        />
      </div>

      {/* Tone */}
      <div>
        <label className="form-label">Tone</label>
        <div className="tone-options">
          {TONE_OPTIONS.map((t) => (
            <button
              key={t}
              className={'tone-btn' + (tone === t ? ' on' : '')}
              onClick={() => setTone(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Context */}
      <div>
        <label className="form-label">
          Context <span style={{ color: 'var(--text-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea
          className="form-textarea"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Any specific story, angle, or details to include…"
          rows={2}
        />
      </div>

      {/* Generate */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={!question.trim() || generating}
        >
          {generating
            ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Generating…</>
            : <><Icon name="sparkle" size={14} /> Generate</>}
        </button>
      </div>

      {/* Result */}
      {answer && (
        <div>
          <label className="form-label">Answer</label>
          <textarea
            className="form-textarea"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={8}
          />
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save answer'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowRefine(!showRefine)}>
              <Icon name="sparkle" size={14} /> Refine
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigator.clipboard.writeText(answer)}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Refine */}
      {showRefine && answer && (
        <div className="refine">
          <Icon name="sparkle" size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder="Make it more concise, add a metric, change the tone…"
            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
          />
          <button
            className="mini-btn accent"
            onClick={handleRefine}
            disabled={!refineText.trim() || refining}
          >
            {refining
              ? <span className="spinner" style={{ width: 10, height: 10 }} />
              : <><Icon name="arrow" size={12} /> Apply</>}
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: 'var(--state-skip)', fontFamily: 'var(--font-mono)' }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ── Answer detail ─────────────────────────────────────────────
function AnswerDetail({
  answer,
  embedded,
  onRefine,
}: {
  answer: AnswerEntry;
  embedded?: boolean;
  onRefine: (text: string) => Promise<void>;
}) {
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);

  async function handleRefine() {
    if (!refineText.trim()) return;
    setRefining(true);
    try {
      await onRefine(refineText.trim());
      setRefineText('');
    } finally {
      setRefining(false);
    }
  }

  return (
    <div className={'ans-detail' + (embedded ? ' embedded' : '')}>
      <div className="ans-question">{answer.question}</div>
      <div className="ans-tags">
        <span className="tag cls">{CATEGORY_LABELS[answer.category]}</span>
        <span className="tag">{answer.tone} tone</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
          {answer.company ? answer.company + ' · ' : ''}
          {new Date(answer.added).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div className="ans-body">
        {answer.answer.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <div className="refine">
        <Icon name="sparkle" size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <input
          value={refineText}
          onChange={(e) => setRefineText(e.target.value)}
          placeholder="Refine — e.g. make it more concise, add a metric…"
          onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
        />
        <button
          className="mini-btn accent"
          onClick={handleRefine}
          disabled={!refineText.trim() || refining}
        >
          {refining
            ? <span className="spinner" style={{ width: 10, height: 10 }} />
            : <><Icon name="arrow" size={12} /> Refine</>}
        </button>
      </div>
    </div>
  );
}

// ── Answers root ──────────────────────────────────────────────
interface AnswersProps {
  answers: AnswerEntry[];
  onAnswersChange: (answers: AnswerEntry[]) => void;
  collapsed?: boolean;
  onExpand?: () => void;
  job?: Job | null;
  embedded?: boolean;
}

export default function Answers({ answers, onAnswersChange, collapsed, onExpand, job, embedded }: AnswersProps) {
  const scopedAnswers = job ? answers.filter((a) => a.originJobId === job.id) : answers;
  const [selectedId, setSelectedId] = useState<string | null>(() => (job ? scopedAnswers[0]?.id ?? null : null));
  const [showNew, setShowNew] = useState(() => Boolean(job) && scopedAnswers.length === 0);

  const selected = scopedAnswers.find((a) => a.id === selectedId) ?? null;

  const handleSaved = useCallback((entry: AnswerEntry) => {
    onAnswersChange([entry, ...answers]);
    setSelectedId(entry.id);
    setShowNew(false);
  }, [answers, onAnswersChange]);

  const handleRefine = async (entryId: string, refineText: string) => {
    const entry = answers.find((a) => a.id === entryId);
    if (!entry) return;
    const result = await window.api.invoke(IPC.AI_REFINE_ANSWER, {
      question: entry.question,
      existingAnswer: entry.answer,
      refineRequest: refineText,
      job: pickJobContext(job),
    });
    const updated = { ...entry, answer: result as string, revised: new Date().toISOString() };
    onAnswersChange(answers.map((a) => (a.id === entryId ? updated : a)));
  };

  if (embedded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {showNew ? (
          <NewAnswerForm job={job} embedded onSaved={handleSaved} />
        ) : selected ? (
          <>
            <AnswerDetail embedded answer={selected} onRefine={(text) => handleRefine(selected.id, text)} />
            <button
              className="mini-btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => { setShowNew(true); setSelectedId(null); }}
            >
              <Icon name="plus" size={12} /> Add another answer
            </button>
          </>
        ) : (
          <NewAnswerForm job={job} embedded onSaved={handleSaved} />
        )}
      </div>
    );
  }

  return (
    <div className="main">
      <div className={'view-head' + (collapsed ? ' collapsed' : '')}>
        <div>
          <div className="view-title-row">
            {collapsed && (
              <button className="expand-btn" onClick={onExpand} title="Show sidebar">
                <Icon name="sidebarToggle" size={17} />
              </button>
            )}
            <div className="view-title">Answers</div>
          </div>
          <div className="view-sub">Draft, classify, and refine interview answers</div>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => { setShowNew(true); setSelectedId(null); }}>
            <Icon name="plus" size={14} /> New answer
          </button>
        </div>
      </div>

      <div className="split">
        {/* Answer list */}
        <div className="list-pane">
          {answers.length === 0 && !showNew ? (
            <div className="empty-state">
              <Icon name="answers" size={36} />
              <div className="es-title">No answers yet</div>
              <div className="es-sub">Click "New answer" to start prepping for interviews</div>
            </div>
          ) : (
            answers.map((a) => (
              <div
                key={a.id}
                className={'ans-q-row' + (selected?.id === a.id && !showNew ? ' sel' : '')}
                onClick={() => { setSelectedId(a.id); setShowNew(false); }}
              >
                <div className="aq-q">{a.question}</div>
                <div className="aq-meta">
                  <span className="tag cls">{CATEGORY_LABELS[a.category]}</span>
                  <span className="tag">{a.tone}</span>
                </div>
                {a.company && (
                  <div className="aq-job">
                    <Icon name="jobs" size={12} /> {a.company}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Detail / new form */}
        <div className="detail-pane">
          {showNew ? (
            <NewAnswerForm job={job} onSaved={handleSaved} onCancel={() => setShowNew(false)} />
          ) : selected ? (
            <AnswerDetail
              answer={selected}
              onRefine={(text) => handleRefine(selected.id, text)}
            />
          ) : (
            <div className="empty-state">
              <Icon name="answers" size={36} />
              <div className="es-title">Select an answer</div>
              <div className="es-sub">Pick a saved answer or create a new one</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
