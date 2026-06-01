import { useState, useEffect, useCallback, useRef } from 'react';
import type { Job, JobStatus, EvaluationResult } from '@shared/types';
import { JOB_STATUSES } from '@shared/types';
import Badge from '../../components/Badge';
import ScoreBadge from '../../components/ScoreBadge';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import { useIpcEvent } from '../../hooks/useIpc';

type FilterTab = 'All' | 'Pending' | 'Evaluated' | 'Applied' | 'Interview' | 'Offer';
const FILTER_TABS: FilterTab[] = ['All', 'Pending', 'Evaluated', 'Applied', 'Interview', 'Offer'];

const STATUS_OPTIONS = JOB_STATUSES.map((s) => ({ value: s, label: s }));

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sortByScore(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Job | null>(null);
  const [filter, setFilter] = useState<FilterTab>('All');

  const [localNotes, setLocalNotes] = useState('');
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [generatingResume, setGeneratingResume] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);

  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiStatusRef = useRef(aiStatus);
  aiStatusRef.current = aiStatus;

  useEffect(() => {
    window.api.invoke('jobs:list').then((result) => {
      setJobs(result as Job[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLocalNotes(selected?.notes ?? '');
  }, [selected?.id]);

  const handleAiProgress = useCallback((payload: unknown) => {
    const p = payload as { channel: string; message: string };
    setAiStatus(p.message);
  }, []);

  useIpcEvent<{ channel: string; message: string }>('ai:progress', handleAiProgress);

  const updateJobInList = (updated: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    setSelected((prev) => (prev?.id === updated.id ? updated : prev));
  };

  const handleStatusChange = async (jobId: string, status: JobStatus) => {
    setError(null);
    try {
      const updated = await window.api.invoke('jobs:update', { id: jobId, status }) as Job;
      updateJobInList(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleNotesBlur = async () => {
    if (!selected) return;
    setError(null);
    try {
      const updated = await window.api.invoke('jobs:update', { id: selected.id, notes: localNotes }) as Job;
      updateJobInList(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    }
  };

  const handleEvaluate = async () => {
    if (!selected) return;
    setEvaluating(true);
    setAiStatus('Starting evaluation…');
    setError(null);
    try {
      const result = await window.api.invoke('ai:evaluate', { jobId: selected.id }) as EvaluationResult;
      const updated = await window.api.invoke('jobs:update', {
        id: selected.id,
        score: result.score,
        category: result.category,
        focus: result.focus,
        status: 'Evaluated',
      }) as Job;
      updateJobInList(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Evaluation failed';
      setAiStatus(message);
      setError(message);
    } finally {
      setEvaluating(false);
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const handleGenerateResume = async () => {
    if (!selected) return;
    setGeneratingResume(true);
    setAiStatus('Generating resume…');
    setError(null);
    try {
      await window.api.invoke('ai:generate-resume', { jobId: selected.id });
      const refreshed = await window.api.invoke('jobs:list') as Job[];
      setJobs(refreshed);
      const updated = refreshed.find((j) => j.id === selected.id);
      if (updated) setSelected(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resume generation failed';
      setAiStatus(message);
      setError(message);
    } finally {
      setGeneratingResume(false);
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!selected) return;
    setGeneratingCover(true);
    setAiStatus('Generating cover letter…');
    setError(null);
    try {
      await window.api.invoke('ai:generate-cover-letter', { jobId: selected.id });
      const refreshed = await window.api.invoke('jobs:list') as Job[];
      setJobs(refreshed);
      const updated = refreshed.find((j) => j.id === selected.id);
      if (updated) setSelected(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cover letter generation failed';
      setAiStatus(message);
      setError(message);
    } finally {
      setGeneratingCover(false);
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setFetching(true);
    setError(null);
    try {
      const job = await window.api.invoke('jobs:hydrate', urlInput.trim()) as Job;
      setJobs((prev) => sortByScore([...prev, job]));
      setSelected(job);
      setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add job from URL');
    } finally {
      setFetching(false);
    }
  };

  const anyAiRunning = evaluating || generatingResume || generatingCover;

  const filteredJobs = sortByScore(
    filter === 'All' ? jobs : jobs.filter((j) => j.status === filter)
  );

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: job list */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '7px 10px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                background: 'transparent',
                border: 'none',
                borderBottom: filter === tab ? '2px solid var(--accent)' : '2px solid transparent',
                color: filter === tab ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color var(--transition)',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Count + URL add */}
        <div
          style={{
            padding: '6px 10px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
            placeholder="Paste job URL…"
            style={{
              flex: 1,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '3px 7px',
              fontSize: 11,
              outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Button size="sm" variant="primary" onClick={handleFetchUrl} disabled={fetching || !urlInput.trim()}>
            {fetching ? <Spinner size={10} color="#fff" /> : 'Fetch'}
          </Button>
        </div>
        {error && (
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border)',
              color: 'var(--red)',
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* Job list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, gap: 8, color: 'var(--text-muted)', fontSize: 11 }}>
              <Spinner size={12} /> loading…
            </div>
          ) : filteredJobs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              no jobs
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isActive = selected?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => setSelected(isActive ? null : job)}
                  style={{
                    padding: '9px 10px',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isActive ? 'var(--bg-overlay)' : 'transparent',
                    transition: 'background var(--transition)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ScoreBadge score={job.score} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span
                        style={{
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12,
                        }}
                      >
                        {job.company}
                      </span>
                      <Badge status={job.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {job.role}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        {formatDate(job.added)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer count */}
        <div style={{ padding: '5px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {filteredJobs.length} / {jobs.length} jobs
          </span>
        </div>
      </div>

      {/* Right: detail panel */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* AI status bar */}
        {aiStatus && (
          <div
            style={{
              padding: '5px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            {anyAiRunning && <Spinner size={11} color="var(--accent)" />}
            <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{aiStatus}</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {selected ? (
            <DetailPanel
              job={selected}
              localNotes={localNotes}
              onNotesChange={setLocalNotes}
              onNotesBlur={handleNotesBlur}
              onStatusChange={(status) => handleStatusChange(selected.id, status)}
              onEvaluate={handleEvaluate}
              onGenerateResume={handleGenerateResume}
              onGenerateCoverLetter={handleGenerateCoverLetter}
              evaluating={evaluating}
              generatingResume={generatingResume}
              generatingCover={generatingCover}
            />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              select a job
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DetailPanelProps {
  job: Job;
  localNotes: string;
  onNotesChange: (v: string) => void;
  onNotesBlur: () => void;
  onStatusChange: (s: JobStatus) => void;
  onEvaluate: () => void;
  onGenerateResume: () => void;
  onGenerateCoverLetter: () => void;
  evaluating: boolean;
  generatingResume: boolean;
  generatingCover: boolean;
}

function DetailPanel({
  job,
  localNotes,
  onNotesChange,
  onNotesBlur,
  onStatusChange,
  onEvaluate,
  onGenerateResume,
  onGenerateCoverLetter,
  evaluating,
  generatingResume,
  generatingCover,
}: DetailPanelProps) {
  const anyRunning = evaluating || generatingResume || generatingCover;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <ScoreBadge score={job.score} />
          <Badge status={job.status} />
          {job.pdfPath && (
            <Badge status="default" label="resume" />
          )}
          {job.coverLetterPdfPath && (
            <Badge status="default" label="cover letter" />
          )}
        </div>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 3,
            letterSpacing: '-0.02em',
          }}
        >
          {job.company}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{job.role}</p>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4, display: 'inline-block', textDecoration: 'none' }}
          >
            {job.url}
          </a>
        )}
      </div>

      {/* Status selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
        <select
          value={job.status}
          onChange={(e) => onStatusChange(e.target.value as JobStatus)}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            padding: '3px 6px',
            fontSize: 11,
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Meta grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          background: 'var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {([
          ['Added', formatDate(job.added)],
          ['Category', job.category ?? '—'],
          ['Focus', job.focus ?? '—'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', padding: '7px 10px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button
          variant="primary"
          size="sm"
          onClick={onEvaluate}
          disabled={anyRunning}
        >
          {evaluating ? <><Spinner size={10} color="#fff" /> Evaluating…</> : 'Evaluate'}
        </Button>
        <Button
          size="sm"
          onClick={onGenerateResume}
          disabled={anyRunning}
        >
          {generatingResume ? <><Spinner size={10} /> Generating Resume…</> : 'Generate Resume'}
        </Button>
        <Button
          size="sm"
          onClick={onGenerateCoverLetter}
          disabled={anyRunning}
        >
          {generatingCover ? <><Spinner size={10} /> Generating Cover Letter…</> : 'Generate Cover Letter'}
        </Button>
      </div>

      {/* Job description */}
      {job.jd && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
            Job Description
          </div>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              fontSize: 11,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxHeight: 260,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {job.jd}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
          Notes
        </div>
        <textarea
          value={localNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          onBlur={onNotesBlur}
          placeholder="Add notes…"
          rows={4}
          style={{
            width: '100%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-primary)',
            padding: '8px 10px',
            fontSize: 11,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>auto-saves on blur</span>
      </div>
    </div>
  );
}
