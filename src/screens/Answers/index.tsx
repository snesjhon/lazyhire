import { useState, useEffect, useCallback } from 'react';
import { IPC } from '@shared/ipc-channels';
import type { AnswerCategory, AnswerEntry } from '@shared/types';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';

const TONE_OPTIONS = ['Professional', 'Storytelling', 'Concise', 'Enthusiastic', 'Humble'] as const;
type Tone = (typeof TONE_OPTIONS)[number];

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

// ── Textarea ──────────────────────────────────────────────────────

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
}) {
  return (
    <textarea
      value={value}
      readOnly={readOnly}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        width: '100%',
        background: readOnly ? 'var(--bg-base)' : 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        color: 'var(--text-primary)',
        padding: '7px 10px',
        outline: 'none',
        resize: 'vertical',
        fontFamily: 'inherit',
        fontSize: 13,
        lineHeight: 1.6,
      }}
      onFocus={(e) => { if (!readOnly) e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    />
  );
}

// ── Answer workspace ──────────────────────────────────────────────

function AnswerWorkspace({ onSaved }: { onSaved: (entry: AnswerEntry) => void }) {
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<AnswerCategory | null>(null);
  const [tone, setTone] = useState<Tone>('Professional');
  const [context, setContext] = useState('');
  const [answer, setAnswer] = useState('');
  const [refineText, setRefineText] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function handleDetect() {
    if (!question.trim()) return;
    setDetecting(true);
    setError('');
    try {
      const cat = await window.api.invoke(IPC.AI_DETECT_ANSWER_CATEGORY, question.trim());
      setCategory(cat as AnswerCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setDetecting(false);
    }
  }

  async function handleGenerate() {
    if (!question.trim() || !category) return;
    setGenerating(true);
    setAnswer('');
    setError('');
    try {
      const result = await window.api.invoke(IPC.AI_GENERATE_ANSWER, {
        question: question.trim(),
        category,
        tone,
        context: context.trim(),
      });
      setAnswer(result as string);
      setShowRefine(false);
      setRefineText('');
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
        originJobId: null,
        company: null,
        role: null,
      });
      onSaved(entry as AnswerEntry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const canGenerate = question.trim() && category && !generating;

  return (
    <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Question */}
      <div>
        <label style={labelStyle}>Question</label>
        <Textarea
          value={question}
          onChange={setQuestion}
          placeholder="What's a challenge you faced and how did you handle it?"
          rows={3}
        />
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button size="sm" variant="secondary" onClick={handleDetect} disabled={!question.trim() || detecting}>
            {detecting ? <><Spinner size={10} /> Detecting…</> : 'Detect Category'}
          </Button>
          {category && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', padding: '2px 8px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)' }}>
              {CATEGORY_LABELS[category]}
            </span>
          )}
        </div>
      </div>

      {/* Tone */}
      <div>
        <label style={labelStyle}>Tone</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TONE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid',
                borderColor: tone === t ? 'var(--accent)' : 'var(--border)',
                background: tone === t ? 'var(--accent-dim)' : 'transparent',
                color: tone === t ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Context */}
      <div>
        <label style={labelStyle}>Context <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
        <Textarea
          value={context}
          onChange={setContext}
          placeholder="Any specific angle, story, or details to include…"
          rows={2}
        />
      </div>

      {/* Generate */}
      <div>
        <Button variant="primary" onClick={handleGenerate} disabled={!canGenerate}>
          {generating ? <><Spinner size={12} /> Generating…</> : 'Generate'}
        </Button>
      </div>

      {/* Result */}
      {answer && (
        <div>
          <label style={labelStyle}>Answer</label>
          <Textarea value={answer} onChange={setAnswer} rows={6} />
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" onClick={() => setShowRefine(!showRefine)}>
              Refine
            </Button>
            <Button size="sm" variant="secondary" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Refine */}
      {showRefine && answer && (
        <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
          <label style={labelStyle}>Refinement request</label>
          <Textarea
            value={refineText}
            onChange={setRefineText}
            placeholder="Make it more specific, add the example from my last job, trim it to 2 sentences…"
            rows={2}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Button size="sm" variant="primary" onClick={handleRefine} disabled={!refineText.trim() || refining}>
              {refining ? <><Spinner size={10} /> Refining…</> : 'Apply'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRefine(false); setRefineText(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: 'var(--red)' }}>{error}</p>}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

// ── Saved answer list ─────────────────────────────────────────────

function AnswerList({
  answers,
  selected,
  onSelect,
}: {
  answers: AnswerEntry[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{
      width: 260,
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Saved ({answers.length})
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {answers.length === 0 ? (
          <p style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)' }}>No saved answers yet.</p>
        ) : (
          answers.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                background: selected === a.id ? 'var(--bg-overlay)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.question}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', padding: '1px 5px', background: 'var(--accent-dim)', borderRadius: 2 }}>
                  {CATEGORY_LABELS[a.category]}
                </span>
                {a.company && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.company}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────

export default function Answers() {
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    window.api.invoke(IPC.ANSWERS_LIST)
      .then((list) => setAnswers(list as AnswerEntry[]))
      .catch(() => {});
  }, []);

  const handleSaved = useCallback((entry: AnswerEntry) => {
    setAnswers((prev) => [entry, ...prev]);
    setSelectedId(entry.id);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <AnswerList answers={answers} selected={selectedId} onSelect={setSelectedId} />
      <AnswerWorkspace onSaved={handleSaved} />
    </div>
  );
}
