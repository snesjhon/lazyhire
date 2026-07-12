import { useState, useEffect } from 'react';
import type { Job, JobStatus, EvaluationResult } from '@shared/types';
import { JOB_STATUSES } from '@shared/types';
import { IPC } from '@shared/ipc-channels';
import Donut from '../../components/Donut';
import Icon from '../../components/Icon';

type Reco = 'apply' | 'consider' | 'skip' | 'pending';
type RecoFilter = 'all' | 'apply' | 'consider' | 'skip';

function getReco(score: number | null): Reco {
  if (score === null) return 'pending';
  if (score >= 4.0) return 'apply';
  if (score >= 2.5) return 'consider';
  return 'skip';
}

function getLogoChar(company: string) {
  return company.trim().charAt(0).toUpperCase();
}

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

const RECO_LABEL: Record<Reco, string> = {
  apply: 'Apply',
  consider: 'Consider',
  skip: 'Skip',
  pending: 'Pending',
};

const STATUS_OPTIONS = JOB_STATUSES.map((s) => ({ value: s, label: s }));

// ── Job row ───────────────────────────────────────────────────
function JobRow({ job, selected, evaluating, onClick }: { job: Job; selected: boolean; evaluating: boolean; onClick: () => void }) {
  const reco = getReco(job.score);
  const isFirstEvaluation = evaluating && job.score === null;
  return (
    <div className={'job-row' + (selected ? ' sel' : '')} onClick={onClick}>
      <div className="logo">{getLogoChar(job.company)}</div>
      <div className="jr-main">
        <div className="jr-role">{job.role}</div>
        <div className="jr-meta">{job.company}</div>
      </div>
      <div className="jr-score">
        {isFirstEvaluation ? (
          <span className="spinner" style={{ width: 11, height: 11 }} />
        ) : job.score !== null ? (
          <>
            <span className={'score-num s-' + reco}>{job.score}</span>
            <span className={'state-dot bg-' + reco} />
          </>
        ) : (
          <>
            <span className="score-num s-pending">—</span>
            <span className="state-dot bg-pending" />
          </>
        )}
      </div>
    </div>
  );
}

// ── Job detail ────────────────────────────────────────────────
interface DetailProps {
  job: Job;
  onStatusChange: (s: JobStatus) => void;
  onEvaluate: () => void;
  onGenerateResume: () => void;
  onGenerateCover: () => void;
  onGoDocuments: () => void;
  onGoAnswers: () => void;
  onDelete: () => void;
  evaluating: boolean;
  generatingResume: boolean;
  generatingCover: boolean;
  deleting: boolean;
  localNotes: string;
  onNotesChange: (v: string) => void;
  onNotesBlur: () => void;
}

function JobDetail({
  job,
  onStatusChange,
  onEvaluate,
  onGenerateResume,
  onGenerateCover,
  onGoDocuments,
  onGoAnswers,
  onDelete,
  evaluating,
  generatingResume,
  generatingCover,
  deleting,
  localNotes,
  onNotesChange,
  onNotesBlur,
}: DetailProps) {
  const reco = getReco(job.score);
  const anyRunning = evaluating || generatingResume || generatingCover || deleting;
  // A first-time evaluation (no prior score) hides everything but the score
  // card until it resolves. A re-evaluation leaves the existing detail in
  // place — only the Re-evaluate button shows a loading state.
  const isFirstEvaluation = evaluating && job.score === null;
  const [jdOpen, setJdOpen] = useState(false);

  useEffect(() => { setJdOpen(false); }, [job.id]);

  const recoIcon = reco === 'apply' ? 'check' : reco === 'skip' ? 'minus' : reco === 'consider' ? 'clock' : 'clock';
  const recoText = reco === 'pending'
    ? 'Evaluate this role to get a fit score and recommendation.'
    : reco === 'apply'
    ? `Score ${job.score} — strong match. Category: ${job.category || '—'}.`
    : reco === 'consider'
    ? `Score ${job.score} — worth a look. Category: ${job.category || '—'}.`
    : `Score ${job.score} — poor fit. Category: ${job.category || '—'}.`;

  return (
    <div className="detail">
      {/* Header */}
      <div className="detail-head">
        <div className="logo" style={{ width: 46, height: 46, fontSize: 16 }}>
          {getLogoChar(job.company)}
        </div>
        <div style={{ flex: 1 }}>
          <div className="dh-role">{job.role}</div>
          <div className="dh-meta">
            <span>{job.company}</span>
            <span className="dot-sep" />
            <span>{formatDate(job.added)}</span>
            <span className="pill">{isFirstEvaluation ? 'Evaluating' : job.status}</span>
          </div>
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" className="dh-link">
              {job.url}
            </a>
          )}
        </div>
        <button
          className="btn btn-danger"
          style={{ height: 32, fontSize: 12 }}
          onClick={onDelete}
          disabled={anyRunning}
          title="Delete job"
        >
          {deleting
            ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Deleting…</>
            : <><Icon name="trash" size={14} /> Delete</>}
        </button>
      </div>

      {isFirstEvaluation ? (
        /* First-time evaluation: everything but the score card is hidden
           until it resolves. A re-evaluation skips this branch entirely
           (job.score is already set), leaving the full detail in place. */
        <div className="score-block">
          <Donut score={null} reco="pending" />
          <div className="reco">
            <span className="reco-tag pending">
              <span className="spinner" style={{ width: 11, height: 11 }} />
              Evaluating
            </span>
            <div className="reco-text">Evaluating this role for fit…</div>
          </div>
        </div>
      ) : (
        <>
          {/* Score block */}
          <div className="score-block">
            <Donut score={job.score} reco={reco} />
            <div className="reco">
              <span className={'reco-tag ' + reco}>
                <Icon name={recoIcon} size={13} />
                {RECO_LABEL[reco]}
              </span>
              <div className="reco-text">{recoText}</div>
            </div>
          </div>

          {/* Status + meta */}
          <div className="meta-grid">
            <div className="meta-cell">
              <div className="mc-label">Status</div>
              <select
                className="mc-val"
                value={job.status}
                onChange={(e) => onStatusChange(e.target.value as JobStatus)}
                style={{ background: 'none', border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', padding: 0 }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="meta-cell">
              <div className="mc-label">Category</div>
              <div className="mc-val">{job.category || '—'}</div>
            </div>
            <div className="meta-cell">
              <div className="mc-label">Focus</div>
              <div className="mc-val">{job.focus || '—'}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="action-strip">
            <button className="btn btn-primary" onClick={onEvaluate} disabled={anyRunning}>
              {evaluating
                ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Evaluating…</>
                : <><Icon name="sparkle" size={14} /> {job.score !== null ? 'Re-evaluate' : 'Evaluate'}</>}
            </button>
            <button className="btn btn-ghost" onClick={onGenerateResume} disabled={anyRunning}>
              {generatingResume
                ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Generating…</>
                : <><Icon name="docs" size={14} /> Resume</>}
            </button>
            <button className="btn btn-ghost" onClick={onGenerateCover} disabled={anyRunning}>
              {generatingCover
                ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Generating…</>
                : <><Icon name="docs" size={14} /> Cover Letter</>}
            </button>
          </div>

          {/* Application material quick-cards */}
          <div className="section" style={{ marginBottom: 22 }}>
            <div className="section-label">Application material</div>
            <div className="quick-grid">
              <div
                className="quick-card"
                onClick={() => job.pdfPath
                  ? window.api.invoke(IPC.SHELL_OPEN_PATH, job.pdfPath)
                  : onGoDocuments()}
              >
                <div className="qc-top">
                  <span className="qc-ico"><Icon name="docs" size={18} /></span>
                  <span className="qc-label">Resume</span>
                </div>
                <div className={'qc-status ' + (job.pdfPath ? 'ready' : 'empty')}>
                  {job.pdfPath ? 'Generated' : 'Not yet'}
                </div>
                {job.pdfPath && <div className="qc-sub">PDF ready</div>}
              </div>
              <div
                className="quick-card"
                onClick={() => job.coverLetterPdfPath
                  ? window.api.invoke(IPC.SHELL_OPEN_PATH, job.coverLetterPdfPath)
                  : onGoDocuments()}
              >
                <div className="qc-top">
                  <span className="qc-ico"><Icon name="docs" size={18} /></span>
                  <span className="qc-label">Cover letter</span>
                </div>
                <div className={'qc-status ' + (job.coverLetterPdfPath ? 'ready' : 'empty')}>
                  {job.coverLetterPdfPath ? 'Generated' : 'Not yet'}
                </div>
                {job.coverLetterPdfPath && <div className="qc-sub">PDF ready</div>}
              </div>
              <div className="quick-card" onClick={onGoAnswers}>
                <div className="qc-top">
                  <span className="qc-ico"><Icon name="answers" size={18} /></span>
                  <span className="qc-label">Answers</span>
                </div>
                <div className="qc-status empty">Interview prep</div>
              </div>
            </div>
          </div>

          {/* Job summary (post-evaluation) */}
          {job.jobSummary && (
            <div className="section" style={{ marginBottom: 22 }}>
              <div className="section-label">Evaluation summary</div>
              <div className="jd-block" style={{ marginBottom: 10 }}>{job.jobSummary.company}</div>
              {job.jobSummary.alignments.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div className="mc-label" style={{ marginBottom: 4 }}>Alignments</div>
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {job.jobSummary.alignments.map((a, i) => (
                      <li key={i} className="jd-block" style={{ marginBottom: 2 }}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {job.jobSummary.gaps.length > 0 && (
                <div>
                  <div className="mc-label" style={{ marginBottom: 4 }}>Gaps</div>
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {job.jobSummary.gaps.map((g, i) => (
                      <li key={i} className="jd-block" style={{ marginBottom: 2 }}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Job description (toggleable) */}
          {job.jd && (
            <div className="section">
              <div
                className="section-label"
                onClick={() => setJdOpen((o) => !o)}
                style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ fontSize: 10, display: 'inline-block', transform: jdOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
                Job description
              </div>
              {jdOpen && <div className="jd-block" style={{ marginTop: 8 }}>{job.jd}</div>}
            </div>
          )}

          {/* Notes */}
          <div className="section" style={{ marginBottom: 0 }}>
            <div className="section-label">Notes</div>
            <textarea
              className="notes-textarea"
              value={localNotes}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={onNotesBlur}
              placeholder="Add notes…"
              rows={3}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Jobs view root ────────────────────────────────────────────
interface JobsProps {
  jobs: Job[];
  onJobsChange: (jobs: Job[]) => void;
  onGoDocuments: () => void;
  onGoAnswers: () => void;
  collapsed: boolean;
  evaluatingJobIds: Set<string>;
  onEvaluatingChange: (jobId: string, isEvaluating: boolean) => void;
}

export default function Jobs({ jobs, onJobsChange, onGoDocuments, onGoAnswers, collapsed, evaluatingJobIds, onEvaluatingChange }: JobsProps) {
  const [filter, setFilter] = useState<RecoFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingResume, setGeneratingResume] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localNotes, setLocalNotes] = useState('');

  const sorted = sortByScore(jobs);

  const counts = {
    all: sorted.length,
    apply: sorted.filter((j) => getReco(j.score) === 'apply').length,
    consider: sorted.filter((j) => getReco(j.score) === 'consider').length,
    skip: sorted.filter((j) => getReco(j.score) === 'skip').length,
  };

  const shown = filter === 'all' ? sorted : sorted.filter((j) => getReco(j.score) === filter);
  const selected = sorted.find((j) => j.id === selectedId) ?? shown[0] ?? null;

  const updateJob = (updated: Job) => {
    onJobsChange(jobs.map((j) => (j.id === updated.id ? updated : j)));
  };

  const handleSelect = (job: Job) => {
    setSelectedId(job.id);
    setLocalNotes(job.notes ?? '');
    setError(null);
  };

  const handleStatusChange = async (status: JobStatus) => {
    if (!selected) return;
    try {
      const updated = await window.api.invoke(IPC.JOBS_UPDATE, { id: selected.id, status }) as Job;
      updateJob(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleNotesBlur = async () => {
    if (!selected) return;
    try {
      const updated = await window.api.invoke(IPC.JOBS_UPDATE, { id: selected.id, notes: localNotes }) as Job;
      updateJob(updated);
    } catch {}
  };

  const evaluateJob = async (jobId: string) => {
    onEvaluatingChange(jobId, true);
    setError(null);
    try {
      const result = await window.api.invoke(IPC.AI_EVALUATE, { jobId }) as EvaluationResult;
      await window.api.invoke(IPC.JOBS_UPDATE, {
        id: jobId,
        score: result.score,
        category: result.category,
        focus: result.focus,
        jobSummary: result.jobSummary,
        status: 'Evaluated',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      onEvaluatingChange(jobId, false);
      const list = await window.api.invoke(IPC.JOBS_LIST) as Job[];
      onJobsChange(list);
    }
  };

  const handleEvaluate = async () => {
    if (!selected) return;
    await evaluateJob(selected.id);
  };

  const handleGenerateResume = async () => {
    if (!selected) return;
    setGeneratingResume(true);
    setError(null);
    try {
      await window.api.invoke(IPC.AI_GENERATE_RESUME, { jobId: selected.id });
      const list = await window.api.invoke(IPC.JOBS_LIST) as Job[];
      onJobsChange(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume generation failed');
    } finally {
      setGeneratingResume(false);
    }
  };

  const handleGenerateCover = async () => {
    if (!selected) return;
    setGeneratingCover(true);
    setError(null);
    try {
      await window.api.invoke(IPC.AI_GENERATE_COVER_LETTER, { jobId: selected.id });
      const list = await window.api.invoke(IPC.JOBS_LIST) as Job[];
      onJobsChange(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover letter generation failed');
    } finally {
      setGeneratingCover(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.role}" at ${selected.company}? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await window.api.invoke(IPC.JOBS_REMOVE, selected.id);
      onJobsChange(jobs.filter((j) => j.id !== selected.id));
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setFetching(true);
    setError(null);
    let job: Job | null = null;
    try {
      job = await window.api.invoke(IPC.JOBS_HYDRATE, urlInput.trim()) as Job;
      const newList = sortByScore([...jobs, job]);
      onJobsChange(newList);
      setSelectedId(job.id);
      setLocalNotes('');
      setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add job from URL');
    } finally {
      setFetching(false);
    }
    if (job) void evaluateJob(job.id);
  };

  return (
    <div className="main">
      {/* View header */}
      <div className={'view-head' + (collapsed ? ' collapsed' : '')}>
        <div>
          <div className="view-title">Jobs</div>
          <div className="view-sub">Triage by fit before you spend time applying</div>
        </div>
        <div className="head-actions">
          <div className="segment">
            {(['all', 'apply', 'consider', 'skip'] as const).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="seg-count">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* URL add row */}
      <div className="url-add-bar">
        <input
          className="url-input"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
          placeholder="Paste job URL to add…"
        />
        <button
          className="btn btn-primary"
          style={{ height: 32, fontSize: 12 }}
          onClick={handleFetchUrl}
          disabled={fetching || !urlInput.trim()}
        >
          {fetching
            ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Fetching…</>
            : <><Icon name="plus" size={14} /> Add</>}
        </button>
      </div>

      {error && <div className="error-bar">{error}</div>}

      {/* Master-detail */}
      <div className="split">
        <div className="list-pane">
          {shown.length === 0 ? (
            <div className="empty-state">
              <Icon name="jobs" size={36} />
              <div className="es-title">No jobs</div>
              <div className="es-sub">Paste a job URL above to get started</div>
            </div>
          ) : (
            shown.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                selected={selected?.id === job.id}
                evaluating={evaluatingJobIds.has(job.id)}
                onClick={() => handleSelect(job)}
              />
            ))
          )}
        </div>
        <div className="detail-pane">
          {selected ? (
            <JobDetail
              job={selected}
              onStatusChange={handleStatusChange}
              onEvaluate={handleEvaluate}
              onGenerateResume={handleGenerateResume}
              onGenerateCover={handleGenerateCover}
              onGoDocuments={onGoDocuments}
              onGoAnswers={onGoAnswers}
              onDelete={handleDelete}
              evaluating={evaluatingJobIds.has(selected.id)}
              generatingResume={generatingResume}
              generatingCover={generatingCover}
              deleting={deleting}
              localNotes={localNotes}
              onNotesChange={setLocalNotes}
              onNotesBlur={handleNotesBlur}
            />
          ) : (
            <div className="empty-state">
              <Icon name="jobs" size={36} />
              <div className="es-title">Select a job</div>
              <div className="es-sub">Pick a role from the list to see details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
