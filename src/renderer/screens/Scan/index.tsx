import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EvaluationResult, Job, ScanJob, SourceProgress } from '@shared/types';
import { IPC } from '@shared/ipc-channels';
import Icon from '../../components/Icon';

interface CompaniesStatus {
  greenhouse: number;
  ashby: number;
  fetchedAt: string | null;
}

type Verdict = 'apply' | 'consider' | 'skip';

const REVEAL_STEP = 10;

const VERDICT_LABEL: Record<Verdict, string> = { apply: 'Apply', consider: 'Consider', skip: 'Skip' };
const VERDICT_ICON: Record<Verdict, 'check' | 'clock' | 'minus'> = { apply: 'check', consider: 'clock', skip: 'minus' };

function getVerdict(score: number): Verdict {
  if (score >= 4.0) return 'apply';
  if (score >= 2.5) return 'consider';
  return 'skip';
}

function getLogoChar(company: string) {
  return company.trim().charAt(0).toUpperCase();
}

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
  jobs: Job[];
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
  collapsed: boolean;
  onExpand: () => void;
}

export default function Scan({
  jobs,
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
  collapsed,
  onExpand,
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
      onErrorChange(err instanceof Error ? err.message : 'Mine companies failed');
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
      const evaluatedJob = list.find((j) => j.id === addedJob!.id);
      if (evaluatedJob) onJobUpdated(evaluatedJob);
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : `Failed to analyze ${job.company}`);
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
  const jobsByUrl = new Map(jobs.map((j) => [j.url, j]));

  const mineStatus = companiesStatus === null
    ? ' '
    : companiesStatus.fetchedAt
      ? `${companiesStatus.greenhouse} Greenhouse + ${companiesStatus.ashby} Ashby · ${formatRelativeTime(companiesStatus.fetchedAt)}`
      : 'Not mined yet';

  const discoverStatus = discoveredJobs.length === 0 && !discovering
    ? 'Not discovered yet'
    : `${discoveredJobs.length} posting${discoveredJobs.length === 1 ? '' : 's'} discovered so far`;

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
            <div className="view-title">Discover</div>
          </div>
          <div className="view-sub">Mine companies, discover postings, then add the ones worth pursuing</div>
        </div>
      </div>

      <div className="discover-body">
        {/* Pipeline rail */}
        <div className="discover-rail">
          <div className="rail-label">Pipeline</div>

          <div className="pipeline">
            <div className={'stage' + (scanningCompanies ? ' active' : companiesStatus?.fetchedAt ? ' done' : '')}>
              <div className="stage-line">
                <span className="stage-dot" />
                <span className="stage-connector" />
              </div>
              <div className="stage-body">
                <div className="stage-title">Mine companies</div>
                <div className="stage-status">{mineStatus}</div>
                <button className="btn btn-ghost stage-btn" onClick={handleScanCompanies} disabled={isRunning}>
                  {scanningCompanies
                    ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Mining…</>
                    : 'Scan companies'}
                </button>
              </div>
            </div>

            <div className={'stage' + (discovering ? ' active' : discoveredJobs.length > 0 ? ' done' : '')}>
              <div className="stage-line">
                <span className="stage-dot" />
              </div>
              <div className="stage-body">
                <div className="stage-title">Discover postings</div>
                <div className="stage-status">{discoverStatus}</div>

                {sourceProgress.length > 0 && (
                  <div className="source-list">
                    {sourceProgress.map((s) => (
                      <div key={s.source} className="source-row">
                        <div className="source-row-head">
                          <span className="source-name">{s.source}</span>
                          <span className="source-count">{s.count}</span>
                        </div>
                        {(s.cachedCompanies !== undefined || s.fetchedCompanies !== undefined) && (
                          <div className="source-sub">
                            {s.cachedCompanies ?? 0} cached · {s.fetchedCompanies ?? 0} fetched
                          </div>
                        )}
                        {(s.remainingStale ?? 0) > 0 && (
                          <div className="source-backlog">{s.remainingStale} left in backlog</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button className="btn btn-primary stage-btn" onClick={handleDiscover} disabled={isRunning}>
                  {discovering
                    ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Discovering…</>
                    : discoveredJobs.length > 0 ? 'Discover again' : 'Discover'}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="stage-error">{error}</div>}
        </div>

        {/* Results */}
        <div className="discover-results">
          <DiscoverResults
            jobs={discoveredJobs}
            jobsByUrl={jobsByUrl}
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
    </div>
  );
}

interface DiscoverResultsProps {
  jobs: ScanJob[];
  jobsByUrl: Map<string, Job>;
  visibleCount: number;
  discovering: boolean;
  addedUrls: Set<string>;
  addingUrls: Set<string>;
  evaluatingUrls: Set<string>;
  onAdd: (job: ScanJob) => void;
  onShowMore: () => void;
}

function DiscoverResults({
  jobs, jobsByUrl, visibleCount, discovering, addedUrls, addingUrls, evaluatingUrls, onAdd, onShowMore,
}: DiscoverResultsProps) {
  if (discovering && jobs.length === 0) {
    return (
      <div className="empty-state">
        <span className="spinner" style={{ width: 20, height: 20 }} />
        <div className="es-title">Discovering matches…</div>
        <div className="es-sub">Ranking postings from mined companies against your profile</div>
      </div>
    );
  }

  if (!discovering && jobs.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="scan" size={36} />
        <div className="es-title">Nothing discovered yet</div>
        <div className="es-sub">Mine companies, then discover to find postings ranked for your profile</div>
      </div>
    );
  }

  const shown = Math.min(visibleCount, jobs.length);
  const visibleJobs = jobs.slice(0, shown);
  const maxScore = Math.max(1, ...jobs.map((j) => j.score));

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="discover-count-row">
        <span className="discover-count"><b>{shown}</b> of <b>{jobs.length}</b> shown · ranked by fit</span>
      </div>

      {visibleJobs.map((job, i) => {
        const added = addedUrls.has(job.url);
        const adding = addingUrls.has(job.url);
        const evaluating = evaluatingUrls.has(job.url);
        const addedJob = jobsByUrl.get(job.url);
        const relevancePct = Math.max(6, Math.round((job.score / maxScore) * 100));

        return (
          <div key={`${job.url}-${i}`} className={'scan-row' + (added ? ' added' : '')}>
            <div className="logo">{getLogoChar(job.company)}</div>
            <div className="scan-main">
              <div className="scan-top">
                <span className="scan-company">{job.company}</span>
                <span className="scan-source">{job.source}</span>
              </div>
              <span className="scan-title">{job.title}</span>
              {job.snippet && <span className="scan-snippet">{job.snippet}</span>}
            </div>

            <div className="scan-side">
              {!added && (
                <>
                  <div className="relevance" title={`Relevance score ${job.score}`}>
                    <span className="relevance-track">
                      <span className="relevance-fill" style={{ width: `${relevancePct}%` }} />
                    </span>
                    <span className="relevance-num">{job.score}</span>
                  </div>
                  <button className="mini-btn accent" onClick={() => onAdd(job)} disabled={adding}>
                    {adding
                      ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Adding…</>
                      : <><Icon name="plus" size={12} /> Add</>}
                  </button>
                </>
              )}

              {added && evaluating && (
                <div className="scan-analyzing">
                  <span className="spinner" style={{ width: 11, height: 11 }} /> Analyzing…
                </div>
              )}

              {added && !evaluating && addedJob?.score != null && (
                <span className={'scan-verdict ' + getVerdict(addedJob.score)}>
                  <Icon name={VERDICT_ICON[getVerdict(addedJob.score)]} size={11} />
                  {VERDICT_LABEL[getVerdict(addedJob.score)]} · {addedJob.score}
                </span>
              )}

              {added && !evaluating && addedJob?.score == null && (
                <span className="scan-verdict pending">
                  <Icon name="check" size={11} /> Added
                </span>
              )}
            </div>
          </div>
        );
      })}

      {shown < jobs.length && (
        <div className="discover-more">
          <button className="btn btn-ghost" onClick={onShowMore}>
            Show {Math.min(REVEAL_STEP, jobs.length - shown)} more
          </button>
        </div>
      )}
    </div>
  );
}
