import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EvaluationResult, Job, ScanJob, SourceProgress } from '@shared/types';
import { IPC } from '@shared/ipc-channels';
import Button from '../../components/Button';
import ScoreBadge from '../../components/ScoreBadge';
import Spinner from '../../components/Spinner';

interface CompaniesStatus {
  greenhouse: number;
  ashby: number;
  fetchedAt: string | null;
}

const REVEAL_STEP = 10;

function mergeScanJobs(existing: ScanJob[], incoming: ScanJob[]): ScanJob[] {
  const byUrl = new Map(existing.map((job) => [job.url, job]));
  for (const job of incoming) {
    if (!byUrl.has(job.url)) byUrl.set(job.url, job);
  }
  return [...byUrl.values()];
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ScanProps {
  discoveredJobs: ScanJob[];
  onDiscoveredJobsChange: Dispatch<SetStateAction<ScanJob[]>>;
  addedUrls: Set<string>;
  onAddedUrlsChange: Dispatch<SetStateAction<Set<string>>>;
  visibleDiscoverCount: number;
  onVisibleDiscoverCountChange: Dispatch<SetStateAction<number>>;
  scanningCompanies: boolean;
  onScanningCompaniesChange: Dispatch<SetStateAction<boolean>>;
  discovering: boolean;
  onDiscoveringChange: Dispatch<SetStateAction<boolean>>;
  sourceProgress: SourceProgress[];
  onSourceProgressChange: Dispatch<SetStateAction<SourceProgress[]>>;
  error: string | null;
  onErrorChange: Dispatch<SetStateAction<string | null>>;
  onJobAdded: (job: Job) => void;
  onJobUpdated: (job: Job) => void;
  onEvaluatingChange: (jobId: string, isEvaluating: boolean) => void;
}

export default function Scan({
  discoveredJobs,
  onDiscoveredJobsChange,
  addedUrls,
  onAddedUrlsChange,
  visibleDiscoverCount,
  onVisibleDiscoverCountChange,
  scanningCompanies,
  onScanningCompaniesChange,
  discovering,
  onDiscoveringChange,
  sourceProgress,
  onSourceProgressChange,
  error,
  onErrorChange,
  onJobAdded,
  onJobUpdated,
  onEvaluatingChange,
}: ScanProps) {
  const [companiesStatus, setCompaniesStatus] = useState<CompaniesStatus | null>(null);
  const [addingUrls, setAddingUrls] = useState<Set<string>>(new Set());
  const [evaluatingUrls, setEvaluatingUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.api.invoke('scan:companies-status')
      .then((status) => setCompaniesStatus(status as CompaniesStatus))
      .catch(() => {});
  }, []);

  const handleScanCompanies = async () => {
    onScanningCompaniesChange(true);
    onSourceProgressChange([]);
    onErrorChange(null);
    try {
      const status = await window.api.invoke('scan:companies') as CompaniesStatus;
      setCompaniesStatus(status);
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : 'Scan Companies failed');
    } finally {
      onScanningCompaniesChange(false);
    }
  };

  const handleDiscover = async () => {
    onDiscoveringChange(true);
    onSourceProgressChange([]);
    onErrorChange(null);
    try {
      const results = await window.api.invoke('scan:discover') as ScanJob[];
      const merged = mergeScanJobs(discoveredJobs, results ?? []);
      const wasShowingAll = visibleDiscoverCount >= discoveredJobs.length;
      onDiscoveredJobsChange(merged);
      onVisibleDiscoverCountChange(wasShowingAll ? merged.length : visibleDiscoverCount);
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : 'Discover failed');
    } finally {
      onDiscoveringChange(false);
    }
  };

  const handleAddJob = async (job: ScanJob) => {
    setAddingUrls((prev) => new Set([...prev, job.url]));
    onErrorChange(null);
    let addedJob: Job | null = null;
    try {
      addedJob = await window.api.invoke(IPC.JOBS_ADD_FROM_SCAN, job) as Job;
      onAddedUrlsChange((prev) => new Set([...prev, job.url]));
      onJobAdded(addedJob);
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : `Failed to add ${job.company}`);
    } finally {
      setAddingUrls((prev) => {
        const next = new Set(prev);
        next.delete(job.url);
        return next;
      });
    }

    if (!addedJob) return;
    setEvaluatingUrls((prev) => new Set([...prev, job.url]));
    onEvaluatingChange(addedJob.id, true);
    try {
      const result = await window.api.invoke(IPC.AI_EVALUATE, { jobId: addedJob.id }) as EvaluationResult;
      await window.api.invoke(IPC.JOBS_UPDATE, {
        id: addedJob.id,
        score: result.score,
        category: result.category,
        focus: result.focus,
        jobSummary: result.jobSummary,
        status: 'Evaluated',
      });
      const list = await window.api.invoke(IPC.JOBS_LIST) as Job[];
      const evaluated = list.find((j) => j.id === addedJob!.id);
      if (evaluated) onJobUpdated(evaluated);
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : `Failed to evaluate ${job.company}`);
    } finally {
      onEvaluatingChange(addedJob.id, false);
      setEvaluatingUrls((prev) => {
        const next = new Set(prev);
        next.delete(job.url);
        return next;
      });
    }
  };

  const handleShowMore = () => {
    onVisibleDiscoverCountChange((prev) => Math.min(discoveredJobs.length, prev + REVEAL_STEP));
  };

  const isRunning = scanningCompanies || discovering;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: controls + progress */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Button variant="secondary" onClick={handleScanCompanies} disabled={isRunning}>
            {scanningCompanies ? <><Spinner size={11} /> Scanning…</> : 'Scan Companies'}
          </Button>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
            {companiesStatus === null
              ? ' '
              : companiesStatus.fetchedAt
                ? `${companiesStatus.greenhouse} Greenhouse + ${companiesStatus.ashby} Ashby · ${formatRelativeTime(companiesStatus.fetchedAt)}`
                : 'Not scanned yet'}
          </span>
        </div>

        <Button
          variant="primary"
          onClick={handleDiscover}
          disabled={isRunning}
        >
          {discovering ? <><Spinner size={11} color="#fff" /> Discovering…</> : 'Discover'}
        </Button>

        {/* Per-source progress */}
        {sourceProgress.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Sources
            </span>
            {sourceProgress.map((s) => (
              <div key={s.source} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{s.source}</span>
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.count}</span>
                </div>
                {(s.cachedCompanies !== undefined || s.fetchedCompanies !== undefined) && (
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {s.cachedCompanies ?? 0} cached · {s.fetchedCompanies ?? 0} fetched
                  </span>
                )}
                {(s.remainingStale ?? 0) > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    {s.remainingStale} left in backlog — run Discover again
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {isRunning && sourceProgress.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 11 }}>
            <Spinner size={11} /> Starting…
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--red)', fontSize: 11, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
      </div>

      {/* Right: results */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <JobResults
          jobs={discoveredJobs}
          visibleCount={visibleDiscoverCount}
          discovering={discovering}
          addedUrls={addedUrls}
          addingUrls={addingUrls}
          evaluatingUrls={evaluatingUrls}
          onAdd={handleAddJob}
          onShowMore={handleShowMore}
        />
      </div>
    </div>
  );
}

interface JobResultsProps {
  jobs: ScanJob[];
  visibleCount: number;
  discovering: boolean;
  addedUrls: Set<string>;
  addingUrls: Set<string>;
  evaluatingUrls: Set<string>;
  onAdd: (job: ScanJob) => void;
  onShowMore: () => void;
}

function JobResults({ jobs, visibleCount, discovering, addedUrls, addingUrls, evaluatingUrls, onAdd, onShowMore }: JobResultsProps) {
  if (discovering && jobs.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)', fontSize: 11 }}>
        <Spinner size={12} /> Discovering matches…
      </div>
    );
  }

  if (!discovering && jobs.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        scan companies, then run discover to find matches
      </div>
    );
  }

  const shown = Math.min(visibleCount, jobs.length);
  const visibleJobs = jobs.slice(0, shown);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {shown} of {jobs.length} shown
        </span>
      </div>
      {visibleJobs.map((job, i) => {
        const added = addedUrls.has(job.url);
        const adding = addingUrls.has(job.url);
        const evaluating = evaluatingUrls.has(job.url);
        return (
          <div
            key={`${job.url}-${i}`}
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              opacity: added ? 0.5 : 1,
            }}
          >
            <ScoreBadge score={job.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {job.company}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-overlay)', padding: '1px 5px', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>
                  {job.source}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {job.title}
              </span>
              {job.snippet && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: 3 }}>
                  {job.snippet}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant={added ? 'ghost' : 'secondary'}
              onClick={() => !added && !adding && onAdd(job)}
              disabled={added || adding || evaluating}
              style={{ flexShrink: 0 }}
            >
              {evaluating
                ? <><Spinner size={11} /> Evaluating…</>
                : added ? 'Added' : adding ? <Spinner size={11} /> : 'Add'}
            </Button>
          </div>
        );
      })}
      {shown < jobs.length && (
        <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'center' }}>
          <Button size="sm" variant="secondary" onClick={onShowMore}>
            Show {Math.min(REVEAL_STEP, jobs.length - shown)} more
          </Button>
        </div>
      )}
    </div>
  );
}
