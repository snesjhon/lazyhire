import { useState, useEffect, useCallback } from 'react';
import './styles/globals.css';
import Sidebar, { type Screen } from './components/Sidebar';
import Jobs from './screens/Dashboard';
import Documents from './screens/Documents';
import Answers from './screens/Answers';
import Scan from './screens/Scan';
import Profile from './screens/Profile';
import Settings from './screens/Settings';
import Welcome from './screens/Welcome';
import Spinner from './components/Spinner';
import { IPC } from '@shared/ipc-channels';
import type { Job, AnswerEntry, Profile as ProfileType, ScanJob, SourceProgress } from '@shared/types';
import { useIpcEvent } from './hooks/useIpc';

function StatusBar({ jobsCount }: { jobsCount: number }) {
  return (
    <div className="statusbar">
      <span className="sb-item"><span className="sb-key">1 2 3</span> panels</span>
      <span className="sb-item"><span className="sb-key">a</span> add job</span>
      <span className="sb-right">
        <span className="live-dot" /> {jobsCount} roles · local
      </span>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('jobs');
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('lh-theme') as 'light' | 'dark') || 'dark'
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('lh-collapsed') === '1'
  );

  const [jobs, setJobs] = useState<Job[]>([]);
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [candidateName, setCandidateName] = useState<string | undefined>();
  const [candidateTitle, setCandidateTitle] = useState<string | undefined>();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  // Lifted so navigating away from and back to Discover doesn't lose results.
  const [discoveredJobs, setDiscoveredJobs] = useState<ScanJob[]>([]);
  const [discoveredAddedUrls, setDiscoveredAddedUrls] = useState<Set<string>>(new Set());
  const [visibleDiscoverCount, setVisibleDiscoverCount] = useState(10);

  // Lifted so navigating away from Scan mid-run doesn't lose progress state,
  // and so the scan:progress listener stays subscribed while on another screen.
  const [scanningCompanies, setScanningCompanies] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [sourceProgress, setSourceProgress] = useState<SourceProgress[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScanProgress = useCallback((payload: SourceProgress) => {
    setSourceProgress((prev) => [...prev.filter((s) => s.source !== payload.source), payload]);
  }, []);
  useIpcEvent<SourceProgress>('scan:progress', handleScanProgress);

  // Lifted so a job's "Evaluating" state is visible everywhere it appears,
  // regardless of whether the evaluation was kicked off from Scan or Dashboard.
  const [evaluatingJobIds, setEvaluatingJobIds] = useState<Set<string>>(new Set());
  const handleEvaluatingChange = (jobId: string, isEvaluating: boolean) => {
    setEvaluatingJobIds((prev) => {
      const next = new Set(prev);
      if (isEvaluating) next.add(jobId); else next.delete(jobId);
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lh-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lh-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    window.api.invoke(IPC.JOBS_LIST)
      .then((list) => setJobs(list as Job[]))
      .catch(() => {});
    window.api.invoke(IPC.ANSWERS_LIST)
      .then((list) => setAnswers(list as AnswerEntry[]))
      .catch(() => {});
    window.api.invoke(IPC.SCAN_READ_DISCOVERED)
      .then((list) => setDiscoveredJobs(list as ScanJob[]))
      .catch(() => {});
    window.api.invoke(IPC.PROFILE_HAS)
      .then(async (has) => {
        setHasProfile(Boolean(has));
        if (!has) return;
        const profile = await window.api.invoke(IPC.PROFILE_READ) as ProfileType;
        setCandidateName(profile.candidate?.name);
        setCandidateTitle(profile.headline);
      })
      .catch(() => setHasProfile(false));
  }, []);

  const docsCount = jobs.filter((j) => j.pdfPath || j.coverLetterPdfPath).length;

  const navigate = (s: Screen) => setScreen(s);

  if (hasProfile === null) {
    return (
      <div className="app-shell">
        <div className="drag-bar" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={16} />
        </div>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="app-shell">
        <div className="drag-bar" />
        <Welcome
          onComplete={(p) => {
            setHasProfile(true);
            setCandidateName(p.candidate.name);
            setCandidateTitle(p.headline);
          }}
        />
      </div>
    );
  }

  return (
    <div className={'app-shell' + (collapsed ? ' sidebar-collapsed' : '')}>
      <div className="app-body">
        <Sidebar
          active={screen}
          onNavigate={navigate}
          theme={theme}
          onThemeChange={setTheme}
          onCollapse={() => setCollapsed(true)}
          jobsCount={jobs.length}
          docsCount={docsCount}
          answersCount={answers.length}
          candidateName={candidateName}
          candidateTitle={candidateTitle}
        />

        {screen === 'jobs' && (
          <Jobs
            jobs={jobs}
            onJobsChange={setJobs}
            answers={answers}
            onAnswersChange={setAnswers}
            collapsed={collapsed}
            onExpand={() => setCollapsed(false)}
            evaluatingJobIds={evaluatingJobIds}
            onEvaluatingChange={handleEvaluatingChange}
          />
        )}
        {screen === 'docs' && (
          <Documents
            jobs={jobs}
            onJobsChange={setJobs}
            collapsed={collapsed}
            onExpand={() => setCollapsed(false)}
          />
        )}
        {screen === 'answers' && (
          <Answers
            answers={answers}
            onAnswersChange={setAnswers}
            collapsed={collapsed}
            onExpand={() => setCollapsed(false)}
          />
        )}
        {screen === 'scan' && (
          <Scan
            discoveredJobs={discoveredJobs}
            onDiscoveredJobsChange={setDiscoveredJobs}
            addedUrls={discoveredAddedUrls}
            onAddedUrlsChange={setDiscoveredAddedUrls}
            visibleDiscoverCount={visibleDiscoverCount}
            onVisibleDiscoverCountChange={setVisibleDiscoverCount}
            scanningCompanies={scanningCompanies}
            onScanningCompaniesChange={setScanningCompanies}
            discovering={discovering}
            onDiscoveringChange={setDiscovering}
            sourceProgress={sourceProgress}
            onSourceProgressChange={setSourceProgress}
            error={scanError}
            onErrorChange={setScanError}
            onJobAdded={(job) => setJobs((prev) => [...prev, job])}
            onJobUpdated={(job) => setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)))}
            onEvaluatingChange={handleEvaluatingChange}
          />
        )}
        {screen === 'profile' && <Profile />}
        {screen === 'settings' && <Settings />}
      </div>

      <StatusBar jobsCount={jobs.length} />
    </div>
  );
}
