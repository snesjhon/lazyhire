import { useState, useCallback } from 'react';
import type { ScanJob, DiscoveredJob } from '@shared/types';
import Button from '../../components/Button';
import ScoreBadge from '../../components/ScoreBadge';
import Spinner from '../../components/Spinner';
import { useIpcEvent } from '../../hooks/useIpc';

interface SourceProgress {
  source: string;
  count: number;
}

export default function Scan() {
  const [scanning, setScanning] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [sourceProgress, setSourceProgress] = useState<SourceProgress[]>([]);
  const [scanResults, setScanResults] = useState<ScanJob[]>([]);
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'scan' | 'discover'>('scan');
  const [error, setError] = useState<string | null>(null);

  const handleScanProgress = useCallback((payload: unknown) => {
    const p = payload as { source: string; count: number };
    setSourceProgress((prev) => {
      const existing = prev.find((s) => s.source === p.source);
      if (existing) {
        return prev.map((s) => (s.source === p.source ? { ...s, count: p.count } : s));
      }
      return [...prev, { source: p.source, count: p.count }];
    });
  }, []);

  useIpcEvent<{ source: string; count: number }>('scan:progress', handleScanProgress);

  const handleStartScan = async () => {
    setScanning(true);
    setSourceProgress([]);
    setScanResults([]);
    setError(null);
    try {
      const profile = await window.api.invoke('profile:read');
      const results = await window.api.invoke('scan:run', { profile }) as ScanJob[];
      setScanResults(results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoveredJobs([]);
    setError(null);
    try {
      const results = await window.api.invoke('scan:discover') as DiscoveredJob[];
      setDiscoveredJobs(results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discover failed');
    } finally {
      setDiscovering(false);
    }
  };

  const handleAddScanJob = async (job: ScanJob) => {
    try {
      await window.api.invoke('jobs:add', job);
      setAddedUrls((prev) => new Set([...prev, job.url]));
    } catch {
      // silently fail
    }
  };

  const handleAcceptDiscovered = async (slug: string) => {
    setDiscoveredJobs((prev) =>
      prev.map((j) => (j.slug === slug ? { ...j, status: 'added' as const } : j))
    );
    try {
      await window.api.invoke('scan:accept-batch', [slug]);
    } catch {
      setDiscoveredJobs((prev) =>
        prev.map((j) => (j.slug === slug ? { ...j, status: 'pending' as const } : j))
      );
    }
  };

  const handlePassDiscovered = (slug: string) => {
    setDiscoveredJobs((prev) =>
      prev.map((j) => (j.slug === slug ? { ...j, status: 'passed' as const } : j))
    );
  };

  const handleAcceptAll = async () => {
    const pending = discoveredJobs.filter((j) => j.status === 'pending');
    setDiscoveredJobs((prev) =>
      prev.map((j) => (j.status === 'pending' ? { ...j, status: 'added' as const } : j))
    );
    try {
      await window.api.invoke('scan:accept-batch', pending.map((j) => j.slug));
    } catch {
      // revert
      setDiscoveredJobs((prev) =>
        prev.map((j) =>
          pending.some((p) => p.slug === j.slug) ? { ...j, status: 'pending' as const } : j
        )
      );
    }
  };

  const isRunning = scanning || discovering;

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            variant="primary"
            onClick={() => { setMode('scan'); handleStartScan(); }}
            disabled={isRunning}
          >
            {scanning ? <><Spinner size={11} color="#fff" /> Scanning…</> : 'Start Scan'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setMode('discover'); handleDiscover(); }}
            disabled={isRunning}
          >
            {discovering ? <><Spinner size={11} /> Discovering…</> : 'Discover'}
          </Button>
        </div>

        {/* Per-source progress */}
        {sourceProgress.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Sources
            </span>
            {sourceProgress.map((s) => (
              <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{s.source}</span>
                <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.count}</span>
              </div>
            ))}
          </div>
        )}

        {(scanning || discovering) && sourceProgress.length === 0 && (
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
        {mode === 'scan' ? (
          <ScanResults
            results={scanResults}
            addedUrls={addedUrls}
            onAdd={handleAddScanJob}
            scanning={scanning}
          />
        ) : (
          <DiscoverResults
            jobs={discoveredJobs}
            discovering={discovering}
            onAccept={handleAcceptDiscovered}
            onPass={handlePassDiscovered}
            onAcceptAll={handleAcceptAll}
          />
        )}
      </div>
    </div>
  );
}

interface ScanResultsProps {
  results: ScanJob[];
  addedUrls: Set<string>;
  onAdd: (job: ScanJob) => void;
  scanning: boolean;
}

function ScanResults({ results, addedUrls, onAdd, scanning }: ScanResultsProps) {
  if (scanning && results.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)', fontSize: 11 }}>
        <Spinner size={12} /> Scanning job boards…
      </div>
    );
  }

  if (!scanning && results.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        run a scan to find jobs
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {results.length} results
        </span>
      </div>
      {results.map((job, i) => {
        const added = addedUrls.has(job.url);
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
              onClick={() => !added && onAdd(job)}
              disabled={added}
              style={{ flexShrink: 0 }}
            >
              {added ? 'Added' : 'Add'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

interface DiscoverResultsProps {
  jobs: DiscoveredJob[];
  discovering: boolean;
  onAccept: (slug: string) => void;
  onPass: (slug: string) => void;
  onAcceptAll: () => void;
}

function DiscoverResults({ jobs, discovering, onAccept, onPass, onAcceptAll }: DiscoverResultsProps) {
  if (discovering && jobs.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)', fontSize: 11 }}>
        <Spinner size={12} /> Discovering companies…
      </div>
    );
  }

  if (!discovering && jobs.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        run discover to find matched companies
      </div>
    );
  }

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {jobs.length} discovered · {pendingCount} pending
        </span>
        {pendingCount > 0 && (
          <Button size="sm" variant="primary" onClick={onAcceptAll}>
            Accept All ({pendingCount})
          </Button>
        )}
      </div>
      {jobs.map((job) => (
        <div
          key={job.slug}
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            opacity: job.status !== 'pending' ? 0.5 : 1,
          }}
        >
          <ScoreBadge score={job.score} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {job.name}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-overlay)', padding: '1px 5px', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>
                {job.ats}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {job.jobTitle}
            </span>
            {job.snippet && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: 3 }}>
                {job.snippet}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {job.status === 'pending' ? (
              <>
                <Button size="sm" variant="primary" onClick={() => onAccept(job.slug)}>Accept</Button>
                <Button size="sm" variant="ghost" onClick={() => onPass(job.slug)}>Pass</Button>
              </>
            ) : (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: job.status === 'added' ? 'var(--green)' : 'var(--text-muted)', padding: '3px 0' }}>
                {job.status}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
